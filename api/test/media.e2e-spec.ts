import { existsSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent.js'
import { ContentTypeRegistry } from '../src/content/content-types.js'
import { TrashService } from '../src/trash/trash.service.js'
import { note, noteType } from './note-type.js'
import {
  createTestApp,
  createUser,
  login,
  resetDatabase,
  SITE_API_TOKEN,
  storageDirOf,
  type TestApp,
} from './test-app.js'

const jpeg = (width: number, height: number, color = { r: 47, g: 138, b: 61 }) =>
  sharp({ create: { width, height, channels: 3, background: color } })
    .jpeg()
    .toBuffer()

describe('media library', () => {
  let app: TestApp
  let marketing: TestAgent

  beforeAll(async () => {
    app = await createTestApp()
    app.get(ContentTypeRegistry).register(noteType)
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(async () => {
    await resetDatabase(app)
    await createUser(app, { email: 'marketing@autodoc.uz', role: 'marketing' })
    marketing = await login(app, 'marketing@autodoc.uz')
  })

  async function upload(buffer: Buffer, name = 'office.jpg') {
    return marketing.post('/api/admin/media').attach('file', buffer, name)
  }

  it('stores a photo as WebP copies and serves them at /media', async () => {
    const res = await upload(await jpeg(1600, 1200))
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      originalName: 'office.jpg',
      mime: 'image/jpeg',
      width: 1600,
      height: 1200,
      duplicate: false,
      usageCount: 0,
    })
    expect(res.body.variants.map((v: { width: number }) => v.width)).toEqual([
      320, 640, 960, 1280, 1600,
    ])
    expect(res.body.url).toMatch(/^\/media\/\d{4}\/\d{2}\/[0-9a-f-]{36}-1280\.webp$/)

    const file = await request(app.getHttpServer()).get(res.body.thumbUrl).expect(200)
    expect(file.headers['content-type']).toBe('image/webp')
    expect(file.headers['cache-control']).toBe('public, max-age=31536000, immutable')
    expect(existsSync(join(storageDirOf(app), 'private', 'originals'))).toBe(true)

    await request(app.getHttpServer()).get('/media/2026/01/missing-320.webp').expect(404)
  })

  it('recognises the same photo uploaded twice', async () => {
    const buffer = await jpeg(800, 600)
    const first = await upload(buffer, 'a.jpg')
    const second = await upload(buffer, 'b.jpg')
    expect(second.body).toMatchObject({ id: first.body.id, duplicate: true })
    const list = await marketing.get('/api/admin/media').expect(200)
    expect(list.body.total).toBe(1)
  })

  it('refuses files that are not photos', async () => {
    const res = await upload(Buffer.from('%PDF-1.7 not a photo'), 'cv.pdf')
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('unsupported_image')
  })

  it('refuses files over 20 MB', async () => {
    const res = await upload(Buffer.alloc(20 * 1024 * 1024 + 1, 1), 'huge.jpg')
    expect(res.status).toBe(413)
  })

  it('edits alt text and searches by it', async () => {
    const { body: photo } = await upload(await jpeg(800, 600))
    await marketing
      .patch(`/api/admin/media/${photo.id}`)
      .send({ alt: { uz: 'Bosh ofis', ru: 'Головной офис', en: '  ' } })
      .expect(200)
      .expect(({ body }) => expect(body.alt).toEqual({ uz: 'Bosh ofis', ru: 'Головной офис' }))

    const found = await marketing
      .get(`/api/admin/media?q=${encodeURIComponent('Головной')}`)
      .expect(200)
    expect(found.body.items.map((m: { id: string }) => m.id)).toEqual([photo.id])
  })

  it('knows where a photo is used, refuses to delete it then, and lets the site show it', async () => {
    const { body: photo } = await upload(await jpeg(1400, 900))
    await marketing.patch(`/api/admin/media/${photo.id}`).send({ alt: { uz: 'Ofis', ru: 'Офис' } })

    const created = await marketing
      .post('/api/admin/content')
      .send({ type: 'note', data: note('Ofis', { shared: { cover: { mediaId: photo.id } } }) })
      .expect(201)
    await marketing.post(`/api/admin/content/${created.body.id}/publish`).send({}).expect(200)

    const details = await marketing.get(`/api/admin/media/${photo.id}`).expect(200)
    expect(details.body.usages).toEqual([
      { documentId: created.body.id, type: 'note', typeLabel: 'Заметка', title: 'Ofis' },
    ])
    const refused = await marketing.delete(`/api/admin/media/${photo.id}`).expect(409)
    expect(refused.body).toMatchObject({ code: 'media_in_use' })
    expect(refused.body.message).toContain('«Ofis»')

    const live = await request(app.getHttpServer())
      .get(`/api/v1/content/note/${created.body.slug}?locale=ru`)
      .set('x-site-token', SITE_API_TOKEN)
      .expect(200)
    expect(live.body.media[photo.id]).toMatchObject({ width: 1400, height: 900, alt: 'Офис' })
    expect(live.body.media[photo.id].srcSet).toContain(' 1400w')

    // Taken out of the draft and the published version: free to delete.
    await marketing
      .put(`/api/admin/content/${created.body.id}`)
      .send({ revision: 1, data: note('Ofis') })
      .expect(200)
    await marketing.post(`/api/admin/content/${created.body.id}/publish`).send({}).expect(200)
    await marketing.delete(`/api/admin/media/${photo.id}`).expect(204)
  })

  it('keeps deleted photos in the trash, restores them, and removes the files for good', async () => {
    const { body: photo } = await upload(await jpeg(700, 500))
    const fileOnDisk = join(
      storageDirOf(app),
      'public',
      'media',
      photo.thumbUrl.replace('/media/', ''),
    )
    await marketing.delete(`/api/admin/media/${photo.id}`).expect(204)

    const trash = await marketing.get('/api/admin/trash').expect(200)
    expect(trash.body.items).toEqual([
      expect.objectContaining({
        kind: 'media',
        id: photo.id,
        typeLabel: 'Фото',
        title: 'office.jpg',
      }),
    ])
    await marketing.post(`/api/admin/trash/media/${photo.id}/restore`).expect(204)
    await marketing.get(`/api/admin/media/${photo.id}`).expect(200)

    await marketing.delete(`/api/admin/media/${photo.id}`).expect(204)
    expect(existsSync(fileOnDisk)).toBe(true)
    await marketing.delete(`/api/admin/trash/media/${photo.id}`).expect(204)
    expect(existsSync(fileOnDisk)).toBe(false)
    await marketing.get(`/api/admin/media/${photo.id}`).expect(404)
  })

  it('empties expired photos with the nightly cleanup', async () => {
    const { body: photo } = await upload(await jpeg(500, 500))
    await marketing.delete(`/api/admin/media/${photo.id}`).expect(204)
    const result = await app
      .get(TrashService)
      .purgeExpired(new Date(Date.now() + 31 * 24 * 60 * 60 * 1000))
    expect(result).toEqual({ documents: 0, media: 1 })
  })

  it('keeps the library away from HR', async () => {
    await createUser(app, { email: 'hr@autodoc.uz', role: 'hr' })
    const hr = await login(app, 'hr@autodoc.uz')
    await hr.get('/api/admin/media').expect(403)
    await hr
      .post('/api/admin/media')
      .attach('file', await jpeg(100, 100), 'x.jpg')
      .expect(403)
  })
})

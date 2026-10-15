import sharp from 'sharp'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent.js'
import { paragraph } from './note-type.js'
import {
  createTestApp,
  createUser,
  login,
  resetDatabase,
  SITE_API_TOKEN,
  startFakeSite,
  type TestApp,
} from './test-app.js'

describe('news', () => {
  let app: TestApp
  let site: Awaited<ReturnType<typeof startFakeSite>>
  let marketing: TestAgent

  beforeAll(async () => {
    site = await startFakeSite()
    app = await createTestApp({ SITE_INTERNAL_URL: site.url })
  })
  afterAll(async () => {
    await app.close()
    await site.close()
  })
  beforeEach(async () => {
    await resetDatabase(app)
    site.calls.length = 0
    await createUser(app, { email: 'marketing@autodoc.uz', role: 'marketing' })
    marketing = await login(app, 'marketing@autodoc.uz')
  })

  const siteApi = (path: string) =>
    request(app.getHttpServer()).get(`/api/v1/content/${path}`).set('x-site-token', SITE_API_TOKEN)

  async function photo(): Promise<string> {
    const buffer = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 40, b: 40 } },
    })
      .jpeg()
      .toBuffer()
    const res = await marketing.post('/api/admin/media').attach('file', buffer, 'cover.jpg')
    expect(res.status).toBe(201)
    return res.body.id
  }

  async function category(name: string, order = 0): Promise<string> {
    const res = await marketing.post('/api/admin/content').send({
      type: 'post_category',
      data: { shared: { order }, locales: { uz: { name } } },
    })
    expect(res.status).toBe(201)
    return res.body.id
  }

  function post(title: string, shared: Record<string, unknown> = {}) {
    return {
      shared: { date: '2026-10-01', ...shared },
      locales: { uz: { title, body: paragraph(`${title} matni`) } },
    }
  }

  async function createPost(title: string, shared: Record<string, unknown> = {}) {
    const res = await marketing
      .post('/api/admin/content')
      .send({ type: 'post', data: post(title, shared) })
    expect(res.status).toBe(201)
    return res.body as { id: string; revision: number; slug: string }
  }

  it('saves a draft without a cover but refuses to publish it', async () => {
    const draft = await createPost('Yangi kiosklar')
    expect(draft.slug).toBe('yangi-kiosklar')

    const refused = await marketing
      .post(`/api/admin/content/${draft.id}/publish`)
      .send({})
      .expect(400)
    expect(refused.body.code).toBe('not_publishable')
    expect(refused.body.issues).toEqual([{ path: 'shared.cover', message: 'Выберите обложку' }])

    const at = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    await marketing.put(`/api/admin/content/${draft.id}/schedule`).send({ at }).expect(400)
  })

  it('lists live posts pinned first, newest next, without their text', async () => {
    const cover = { mediaId: await photo() }
    const first = await createPost('Birinchi', { cover })
    const second = await createPost('Ikkinchi', { cover })
    const pinned = await createPost('Muhim', { cover, pinned: true })
    for (const { id } of [first, pinned, second]) {
      await marketing.post(`/api/admin/content/${id}/publish`).send({}).expect(200)
    }

    const list = await siteApi('post?locale=ru').expect(200)
    expect(list.body.items.map((item: { slug: string }) => item.slug)).toEqual([
      'muhim',
      'ikkinchi',
      'birinchi',
    ])
    const [item] = list.body.items
    expect(Object.keys(item.data).sort()).toEqual(
      ['cover', 'date', 'excerpt', 'pinned', 'title'].sort(),
    )
    // Nobody types the card's lines: they are the start of the text.
    expect(item.data.excerpt).toBe('Muhim matni')
    expect(item.media[cover.mediaId]).toMatchObject({ width: 800, height: 600 })

    // The post's own page gets everything.
    const page = await siteApi('post/muhim?locale=ru').expect(200)
    expect(page.body.data.body).toEqual(paragraph('Muhim matni'))
    expect(page.body.data.excerpt).toBe('Muhim matni')
  })

  it('checks the category and keeps a category in use out of the trash', async () => {
    await marketing
      .post('/api/admin/content')
      .send({
        type: 'post',
        data: post('Xato', { categoryId: '6f1c3e9a-1b2c-4d5e-8f90-1234567890ab' }),
      })
      .expect(400)
      .expect((res) => expect(res.body.code).toBe('invalid_reference'))

    const events = await category('Tadbirlar')
    const used = await createPost('Tadbir', { categoryId: events })
    const refused = await marketing.delete(`/api/admin/content/${events}`).expect(409)
    expect(refused.body.code).toBe('document_in_use')
    expect(refused.body.message).toContain('Новость: 1')

    // Once no post uses it, it can go.
    await marketing.delete(`/api/admin/content/${used.id}`).expect(204)
    await marketing.delete(`/api/admin/content/${events}`).expect(204)
  })

  it('publishes categories on save, in their set order', async () => {
    await category('Ikkinchi', 2)
    await category('Birinchi', 1)
    const list = await siteApi('post_category?locale=uz').expect(200)
    expect(list.body.items.map((item: { data: { name: string } }) => item.data.name)).toEqual([
      'Birinchi',
      'Ikkinchi',
    ])
    const admin = await marketing.get('/api/admin/content?type=post_category').expect(200)
    expect(admin.body.items.map((item: { title: string }) => item.title)).toEqual([
      'Birinchi',
      'Ikkinchi',
    ])
  })

  it('accepts YouTube and Instagram links only', async () => {
    await createPost('Video', { videoUrl: 'https://www.youtube.com/watch?v=RxLmcESwrKg' })
    await createPost('Reels', { videoUrl: 'https://www.instagram.com/reel/C9xYz/' })
    const bad = await marketing
      .post('/api/admin/content')
      .send({ type: 'post', data: post('Boshqa', { videoUrl: 'https://vimeo.com/123' }) })
      .expect(400)
    expect(bad.body.issues[0].path).toBe('shared.videoUrl')
  })

  it('previews a post at its address on the site', async () => {
    const draft = await createPost('Ko‘rib chiqish')
    const res = await marketing
      .post(`/api/admin/content/${draft.id}/preview-link`)
      .send({ locale: 'ru' })
      .expect(200)
    expect(new URL(res.body.url).searchParams.get('path')).toBe('/ru/blog/korib-chiqish/')
  })
})

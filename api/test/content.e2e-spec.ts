import request from 'supertest'
import type TestAgent from 'supertest/lib/agent.js'
import { ContentTypeRegistry } from '../src/content/content-types.js'
import { DocumentsService } from '../src/content/documents.service.js'
import { verifyPreview } from '../src/content/preview.js'
import { TrashService } from '../src/trash/trash.service.js'
import { note, noteType, paragraph } from './note-type.js'
import {
  createTestApp,
  createUser,
  login,
  PREVIEW_SECRET,
  REVALIDATE_SECRET,
  resetDatabase,
  SITE_API_TOKEN,
  startFakeSite,
  type TestApp,
} from './test-app.js'

describe('content core', () => {
  let app: TestApp
  let site: Awaited<ReturnType<typeof startFakeSite>>
  let marketing: TestAgent

  beforeAll(async () => {
    site = await startFakeSite()
    app = await createTestApp({ SITE_INTERNAL_URL: site.url })
    app.get(ContentTypeRegistry).register(noteType)
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

  async function createNote(title = 'Infokiosklar', extra: Parameters<typeof note>[1] = {}) {
    const res = await marketing
      .post('/api/admin/content')
      .send({ type: 'note', data: note(title, extra) })
    expect(res.status).toBe(201)
    return res.body as { id: string; revision: number; slug: string; status: string }
  }

  it('creates a draft with a slug from the Uzbek title', async () => {
    const created = await createNote('Infokiosklar — yangi xizmat')
    expect(created).toMatchObject({
      status: 'draft',
      revision: 1,
      slug: 'infokiosklar-yangi-xizmat',
    })

    const versions = await marketing.get(`/api/admin/content/${created.id}/versions`).expect(200)
    expect(versions.body.map((v: { kind: string }) => v.kind)).toEqual(['created'])
  })

  it('requires Uzbek and lets other languages be partial', async () => {
    const noUzbek = await marketing
      .post('/api/admin/content')
      .send({ type: 'note', data: { shared: {}, locales: { ru: { title: 'Только русский' } } } })
      .expect(400)
    expect(noUzbek.body.code).toBe('invalid_document')
    expect(noUzbek.body.issues[0].path).toBe('locales.uz')

    await createNote('Sarlavha', { ru: { title: 'Заголовок без текста' } })
  })

  it('refuses unsafe content in the editor field', async () => {
    const data = note('Xavfli')
    data.locales.uz.body = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
      ],
    } as never
    const res = await marketing.post('/api/admin/content').send({ type: 'note', data }).expect(400)
    expect(res.body.code).toBe('invalid_document')
  })

  it('keeps drafts off the site until published, then refreshes the site', async () => {
    const created = await createNote()
    await siteApi('note')
      .expect(200)
      .expect(({ body }) => expect(body.total).toBe(0))
    await siteApi(`note/${created.slug}`).expect(404)
    // Draft mode (preview) does see it.
    await siteApi('note?draft=1').expect(({ body }) => expect(body.total).toBe(1))

    const published = await marketing
      .post(`/api/admin/content/${created.id}/publish`)
      .send({})
      .expect(200)
    expect(published.body.status).toBe('published')

    const call = await site.waitFor((c) => c.tags.includes(`content:note:${created.slug}`))
    expect(call).toMatchObject({ path: '/api/revalidate/', secret: REVALIDATE_SECRET })
    expect(call.tags).toEqual(expect.arrayContaining(['content:note', `content:doc:${created.id}`]))

    const live = await siteApi(`note/${created.slug}`).expect(200)
    expect(live.body.data.title).toBe('Infokiosklar')
  })

  it('serves each language with field-by-field Uzbek fallback', async () => {
    const created = await createNote('Infokiosklar', { ru: { title: 'Инфокиоски' } })
    await marketing.post(`/api/admin/content/${created.id}/publish`).send({}).expect(200)

    const ru = await siteApi(`note/${created.slug}?locale=ru`).expect(200)
    expect(ru.body).toMatchObject({ locale: 'ru', translated: true })
    expect(ru.body.data.title).toBe('Инфокиоски')
    expect(ru.body.data.body).toEqual(paragraph('Infokiosklar matni'))

    const en = await siteApi(`note/${created.slug}?locale=en`).expect(200)
    expect(en.body).toMatchObject({ locale: 'en', translated: false })
    expect(en.body.data.title).toBe('Infokiosklar')
  })

  it('shows the published version while the draft changes, until the next publish', async () => {
    const created = await createNote('Birinchi')
    await marketing.post(`/api/admin/content/${created.id}/publish`).send({}).expect(200)

    const saved = await marketing
      .put(`/api/admin/content/${created.id}`)
      .send({ revision: 1, data: note('Birinchi') })
      .expect(200)
    // Same content: no new revision, no new version.
    expect(saved.body.revision).toBe(1)

    const edited = await marketing
      .put(`/api/admin/content/${created.id}`)
      .send({ revision: 1, data: { ...note('Ikkinchi'), shared: { slug: 'birinchi' } } })
      .expect(200)
    expect(edited.body).toMatchObject({ status: 'changed', revision: 2 })
    await siteApi('note/birinchi').expect(({ body }) => expect(body.data.title).toBe('Birinchi'))

    await marketing
      .post(`/api/admin/content/${created.id}/publish`)
      .send({ revision: 2 })
      .expect(200)
    await siteApi('note/birinchi').expect(({ body }) => expect(body.data.title).toBe('Ikkinchi'))
  })

  it('refuses a save based on an old revision instead of overwriting', async () => {
    const created = await createNote()
    await marketing
      .put(`/api/admin/content/${created.id}`)
      .send({ revision: 1, data: note('Birinchi tahrir') })
      .expect(200)
    const stale = await marketing
      .put(`/api/admin/content/${created.id}`)
      .send({ revision: 1, data: note('Ikkinchi tahrir') })
      .expect(409)
    expect(stale.body.code).toBe('conflict')
  })

  it('numbers new slugs and refuses renaming to a taken one', async () => {
    const first = await createNote('Yangilik')
    const second = await createNote('Yangilik')
    expect([first.slug, second.slug]).toEqual(['yangilik', 'yangilik-2'])

    const taken = await marketing
      .put(`/api/admin/content/${second.id}`)
      .send({ revision: 1, data: { ...note('Yangilik'), shared: { slug: 'yangilik' } } })
      .expect(409)
    expect(taken.body.code).toBe('slug_taken')
  })

  it('keeps every version and restores an old one into the working copy', async () => {
    const created = await createNote('Versiya 1')
    await marketing
      .put(`/api/admin/content/${created.id}`)
      .send({ revision: 1, data: note('Versiya 2') })
      .expect(200)
    await marketing.post(`/api/admin/content/${created.id}/publish`).send({}).expect(200)

    const versions = await marketing.get(`/api/admin/content/${created.id}/versions`).expect(200)
    expect(versions.body.map((v: { kind: string }) => v.kind)).toEqual([
      'published',
      'saved',
      'created',
    ])
    const first = versions.body.at(-1)
    expect(first).toMatchObject({ title: 'Versiya 1', isDraft: false, isLive: false })

    const restored = await marketing
      .post(`/api/admin/content/${created.id}/versions/${first.id}/restore`)
      .send({ revision: 2 })
      .expect(200)
    expect(restored.body).toMatchObject({ title: 'Versiya 1', status: 'changed', revision: 3 })
    // The site still shows what was published.
    await siteApi(`note/${restored.body.publishedSlug}`).expect(({ body }) =>
      expect(body.data.title).toBe('Versiya 2'),
    )
  })

  it('publishes on schedule', async () => {
    const created = await createNote('Rejali')
    await marketing
      .put(`/api/admin/content/${created.id}/schedule`)
      .send({ at: new Date(Date.now() + 10_000).toISOString() })
      .expect(400)

    const at = new Date(Date.now() + 5 * 60_000)
    const scheduled = await marketing
      .put(`/api/admin/content/${created.id}/schedule`)
      .send({ at: at.toISOString() })
      .expect(200)
    expect(scheduled.body.status).toBe('scheduled')

    const documents = app.get(DocumentsService)
    expect(await documents.publishDue(new Date())).toBe(0)
    expect(await documents.publishDue(new Date(at.getTime() + 1_000))).toBe(1)

    const after = await marketing.get(`/api/admin/content/${created.id}`).expect(200)
    expect(after.body).toMatchObject({ status: 'published', scheduledAt: null })
    await siteApi(`note/${created.slug}`).expect(200)
  })

  it('takes a document off the site when unpublished', async () => {
    const created = await createNote()
    await marketing.post(`/api/admin/content/${created.id}/publish`).send({}).expect(200)
    site.calls.length = 0

    const res = await marketing.post(`/api/admin/content/${created.id}/unpublish`).expect(200)
    expect(res.body).toMatchObject({ status: 'draft', isLive: false })
    await siteApi(`note/${created.slug}`).expect(404)
    await site.waitFor((c) => c.tags.includes(`content:note:${created.slug}`))
  })

  it('moves deleted documents to the trash, restores them, and empties it after 30 days', async () => {
    const created = await createNote()
    await marketing.post(`/api/admin/content/${created.id}/publish`).send({}).expect(200)
    await marketing.delete(`/api/admin/content/${created.id}`).expect(204)

    await marketing.get(`/api/admin/content/${created.id}`).expect(404)
    await siteApi(`note/${created.slug}`).expect(404)
    const trash = await marketing.get('/api/admin/trash').expect(200)
    expect(trash.body.items).toEqual([
      expect.objectContaining({
        kind: 'document',
        id: created.id,
        typeLabel: 'Заметка',
        title: 'Infokiosklar',
      }),
    ])

    await marketing.post(`/api/admin/trash/document/${created.id}/restore`).expect(204)
    await siteApi(`note/${created.slug}`).expect(200)

    await marketing.delete(`/api/admin/content/${created.id}`).expect(204)
    const trashService = app.get(TrashService)
    expect(await trashService.purgeExpired(new Date())).toEqual({ documents: 0, media: 0 })
    expect(
      await trashService.purgeExpired(new Date(Date.now() + 31 * 24 * 60 * 60 * 1000)),
    ).toEqual({
      documents: 1,
      media: 0,
    })
    const empty = await marketing.get('/api/admin/trash').expect(200)
    expect(empty.body.items).toEqual([])
  })

  it('signs preview links for the page in the requested language', async () => {
    const created = await createNote()
    const res = await marketing
      .post(`/api/admin/content/${created.id}/preview-link`)
      .send({ locale: 'ru' })
      .expect(200)
    const url = new URL(res.body.url)
    expect(url.origin + url.pathname).toBe('http://site.test/api/draft/')
    const link = {
      path: url.searchParams.get('path') ?? '',
      exp: url.searchParams.get('exp') ?? '',
      sig: url.searchParams.get('sig') ?? '',
    }
    expect(link.path).toBe(`/ru/notes/${created.slug}/`)
    expect(verifyPreview(link, PREVIEW_SECRET)).toBe(true)
  })

  it('keeps content types away from roles without their permissions', async () => {
    const created = await createNote()
    await createUser(app, { email: 'hr@autodoc.uz', role: 'hr' })
    const hr = await login(app, 'hr@autodoc.uz')

    await hr.get('/api/admin/content?type=note').expect(403)
    await hr.get(`/api/admin/content/${created.id}`).expect(403)
    await hr
      .post('/api/admin/content')
      .send({ type: 'note', data: note('HR') })
      .expect(403)
    // HR sees its own types (vacancies) only, never the marketing ones.
    const types = await hr.get('/api/admin/content/types').expect(200)
    expect(types.body.map((type: { type: string }) => type.type).sort()).toEqual([
      'vacancy',
      'vacancy_direction',
    ])
    // HR's trash doesn't show other types' documents.
    await marketing.delete(`/api/admin/content/${created.id}`).expect(204)
    const trash = await hr.get('/api/admin/trash').expect(200)
    expect(trash.body.items).toEqual([])
  })

  it('answers the site only with the site token', async () => {
    await request(app.getHttpServer()).get('/api/v1/content/note').expect(401)
    await request(app.getHttpServer())
      .get('/api/v1/content/note')
      .set('x-site-token', 'wrong')
      .expect(401)
    await siteApi('nope').expect(404)
    await siteApi('note/Not-A-Slug').expect(404)
  })

  it('writes every change to the audit log', async () => {
    const created = await createNote()
    await marketing.post(`/api/admin/content/${created.id}/publish`).send({}).expect(200)
    await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    const admin = await login(app, 'admin@autodoc.uz')
    const log = await admin.get(`/api/admin/audit?entityId=${created.id}`).expect(200)
    expect(log.body.items.map((e: { action: string }) => e.action)).toEqual([
      'documents.publish',
      'documents.create',
    ])
    expect(log.body.items[0]).toMatchObject({
      entityType: 'note',
      summary: 'Заметка: Infokiosklar',
    })
  })
})

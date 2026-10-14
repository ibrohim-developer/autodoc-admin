import request from 'supertest'
import type TestAgent from 'supertest/lib/agent.js'
import {
  createTestApp,
  createUser,
  login,
  resetDatabase,
  SITE_API_TOKEN,
  SITE_TEXTS,
  startFakeSite,
  type TestApp,
} from './test-app.js'

describe('site texts', () => {
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
    await createUser(app, { email: 'marketing@autodoc.uz', role: 'marketing' })
    marketing = await login(app, 'marketing@autodoc.uz')
  })

  const texts = (overrides: Record<string, Record<string, string>>) => ({
    shared: { overrides: { uz: {}, ru: {}, en: {}, ...overrides } },
    locales: { uz: {} },
  })

  it('serves the site’s own texts as the defaults', async () => {
    const res = await marketing.get('/api/admin/site-texts/defaults').expect(200)
    expect(res.body).toEqual(SITE_TEXTS)
  })

  it('keeps changes per language, with no fallback to Uzbek', async () => {
    const created = await marketing
      .post('/api/admin/content')
      .send({ type: 'site_texts', data: texts({ uz: { 'Hero.title': 'Yangi sarlavha' } }) })
      .expect(201)
    await marketing.post(`/api/admin/content/${created.body.id}/publish`).send({}).expect(200)

    const ru = await request(app.getHttpServer())
      .get('/api/v1/content/single/site_texts?locale=ru')
      .set('x-site-token', SITE_API_TOKEN)
      .expect(200)
    // The site applies overrides.ru to Russian pages: none, so the Russian default stays.
    expect(ru.body.data.overrides).toEqual({
      uz: { 'Hero.title': 'Yangi sarlavha' },
      ru: {},
      en: {},
    })
  })

  it('refuses unknown keys, empty texts and unpaired braces', async () => {
    const bad = async (overrides: Record<string, string>) =>
      (
        await marketing
          .post('/api/admin/content')
          .send({ type: 'site_texts', data: texts({ ru: overrides }) })
          .expect(400)
      ).body.issues[0]

    expect((await bad({ '__proto__.x': 'x' })).message).toBe('Неизвестный текст')
    expect((await bad({ 'Hero.title': '  ' })).path).toBe('shared.overrides.ru.Hero.title')
    expect((await bad({ 'Blog.shareOn': 'Поделиться в {network' })).message).toBe(
      'Фигурные скобки { } должны быть парными',
    )
  })

  it('is one document that can’t be deleted', async () => {
    const created = await marketing
      .post('/api/admin/content')
      .send({ type: 'site_texts', data: texts({}) })
      .expect(201)
    await marketing
      .post('/api/admin/content')
      .send({ type: 'site_texts', data: texts({}) })
      .expect(409)
    await marketing.delete(`/api/admin/content/${created.body.id}`).expect(400)
  })
})

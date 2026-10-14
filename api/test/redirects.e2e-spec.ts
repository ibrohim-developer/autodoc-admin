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
  type TestApp,
} from './test-app.js'

describe('redirects', () => {
  let app: TestApp
  let marketing: TestAgent

  beforeAll(async () => {
    app = await createTestApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(async () => {
    await resetDatabase(app)
    await createUser(app, { email: 'marketing@autodoc.uz', role: 'marketing' })
    marketing = await login(app, 'marketing@autodoc.uz')
  })

  const live = async () =>
    (
      await request(app.getHttpServer())
        .get('/api/v1/redirects')
        .set('x-site-token', SITE_API_TOKEN)
        .expect(200)
    ).body as { from: string; to: string; permanent: boolean }[]

  const redirect = (from: string, to: string, extra: Record<string, unknown> = {}) =>
    marketing.post('/api/admin/content').send({
      type: 'redirect',
      data: { shared: { from, to, permanent: true, enabled: true, ...extra }, locales: { uz: {} } },
    })

  it('serves redirects made by hand, with the site’s trailing slash', async () => {
    await redirect('/old-about', '/about').expect(201)
    await redirect('/promo/', 'https://www.instagram.com/autodoc_holding/', {
      permanent: false,
    }).expect(201)
    await redirect('/off/', '/about/', { enabled: false }).expect(201)

    expect(await live()).toEqual([
      { from: '/old-about/', to: '/about/', permanent: true },
      { from: '/promo/', to: 'https://www.instagram.com/autodoc_holding/', permanent: false },
    ])
    const twice = await redirect('/old-about/', '/contacts/').expect(409)
    expect(twice.body.code).toBe('duplicate')
  })

  it('refuses addresses that are not paths on the site', async () => {
    for (const from of ['//evil.example/', 'https://autodoc.uz/x/', '/a b/', '/x?y=1']) {
      await redirect(from, '/about/').expect(400)
    }
    await redirect('/x/', 'http://plain.example/').expect(400)
    await redirect('/same/', '/same').expect(400)
  })

  it('redirects a page’s old address when its address changes, in every language', async () => {
    const buffer = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 10, g: 120, b: 40 } },
    })
      .jpeg()
      .toBuffer()
    const cover = (await marketing.post('/api/admin/media').attach('file', buffer, 'c.jpg')).body.id
    const data = (slug: string) => ({
      shared: { slug, date: '2026-10-01', cover: { mediaId: cover } },
      locales: { uz: { title: 'Kiosklar', body: paragraph('Matn') } },
    })
    const post = (
      await marketing.post('/api/admin/content').send({ type: 'post', data: data('birinchi') })
    ).body as { id: string; revision: number }
    await marketing.post(`/api/admin/content/${post.id}/publish`).send({}).expect(200)
    expect(await live()).toEqual([])

    async function rename(slug: string) {
      const current = (await marketing.get(`/api/admin/content/${post.id}`)).body
      await marketing
        .put(`/api/admin/content/${post.id}`)
        .send({ data: data(slug), revision: current.revision })
        .expect(200)
      await marketing.post(`/api/admin/content/${post.id}/publish`).send({}).expect(200)
    }

    await rename('ikkinchi')
    expect(await live()).toEqual([
      { from: '/blog/birinchi/', to: '/blog/ikkinchi/', permanent: true },
      { from: '/ru/blog/birinchi/', to: '/ru/blog/ikkinchi/', permanent: true },
      { from: '/en/blog/birinchi/', to: '/en/blog/ikkinchi/', permanent: true },
    ])

    // No chains: the first address now leads straight to the newest one.
    await rename('uchinchi')
    const uz = (await live()).filter((item) => !/^\/(ru|en)\//.test(item.from))
    expect(uz).toEqual([
      { from: '/blog/birinchi/', to: '/blog/uchinchi/', permanent: true },
      { from: '/blog/ikkinchi/', to: '/blog/uchinchi/', permanent: true },
    ])

    // Back to an old address: the page lives there again, its redirect goes.
    await rename('birinchi')
    const back = (await live()).filter((item) => !/^\/(ru|en)\//.test(item.from))
    expect(back).toEqual([
      { from: '/blog/ikkinchi/', to: '/blog/birinchi/', permanent: true },
      { from: '/blog/uchinchi/', to: '/blog/birinchi/', permanent: true },
    ])
  })
})

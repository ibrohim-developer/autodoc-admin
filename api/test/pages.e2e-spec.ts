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

describe('pages, settings and legal pages', () => {
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

  const single = (type: string, locale = 'uz') =>
    request(app.getHttpServer())
      .get(`/api/v1/content/single/${type}?locale=${locale}`)
      .set('x-site-token', SITE_API_TOKEN)

  it('hides blocks of a page and keeps SEO per language', async () => {
    const created = await marketing
      .post('/api/admin/content')
      .send({
        type: 'page_home',
        data: {
          shared: { hidden: ['partnerStrip', 'video'] },
          locales: {
            uz: { seoTitle: 'Autodoc — bosh sahifa' },
            ru: { seoTitle: 'Autodoc — главная' },
          },
        },
      })
      .expect(201)
    await single('page_home').expect(404) // a draft until published
    await marketing.post(`/api/admin/content/${created.body.id}/publish`).send({}).expect(200)

    const ru = await single('page_home', 'ru').expect(200)
    expect(ru.body.data).toMatchObject({
      hidden: ['partnerStrip', 'video'],
      seoTitle: 'Autodoc — главная',
    })

    const unknown = await marketing
      .post('/api/admin/content')
      .send({ type: 'page_about', data: { shared: { hidden: ['hero'] }, locales: { uz: {} } } })
      .expect(400)
    expect(unknown.body.issues[0].message).toBe('Неизвестный блок')
  })

  it('publishes settings on save and checks them', async () => {
    const settings = (shared: Record<string, unknown> = {}) => ({
      type: 'site_settings',
      data: {
        shared: {
          phone: '+998 55 505 75 75',
          email: 'info@autodoc.uz',
          socials: { linkedin: 'https://www.linkedin.com/company/autodoc-holding', instagram: '' },
          map: { lat: 41.3203, lon: 69.2673 },
          menu: [
            { key: 'home', visible: true },
            { key: 'contacts', visible: false },
          ],
          ...shared,
        },
        locales: { uz: {} },
      },
    })
    await marketing.post('/api/admin/content').send(settings()).expect(201)
    const live = await single('site_settings').expect(200)
    expect(live.body.data.menu).toEqual([
      { key: 'home', visible: true },
      { key: 'contacts', visible: false },
    ])

    await resetDatabase(app)
    await createUser(app, { email: 'marketing@autodoc.uz', role: 'marketing' })
    marketing = await login(app, 'marketing@autodoc.uz')
    const bad = await marketing
      .post('/api/admin/content')
      .send(settings({ phone: 'call us' }))
      .expect(400)
    expect(bad.body.issues[0].path).toBe('shared.phone')
    const twice = await marketing
      .post('/api/admin/content')
      .send(
        settings({
          menu: [
            { key: 'home', visible: true },
            { key: 'home', visible: false },
          ],
        }),
      )
      .expect(400)
    expect(twice.body.issues[0].message).toBe('Пункт меню дважды')
  })

  it('keeps the tracking codes the cookie banner loads', async () => {
    const settings = (tracking: Record<string, string>) => ({
      type: 'site_settings',
      data: {
        shared: {
          phone: '+998 55 505 75 75',
          email: 'info@autodoc.uz',
          socials: { linkedin: '', instagram: '' },
          map: { lat: 41.3203, lon: 69.2673 },
          menu: [],
          tracking,
        },
        locales: { uz: {} },
      },
    })
    const bad = await marketing
      .post('/api/admin/content')
      .send(settings({ ga4: 'UA-12345-1', metrica: '', pixel: '' }))
      .expect(400)
    expect(bad.body.issues[0]).toMatchObject({
      path: 'shared.tracking.ga4',
      message: 'Идентификатор GA4 выглядит так: G-XXXXXXXXXX',
    })
    await marketing
      .post('/api/admin/content')
      .send(settings({ ga4: 'G-ABC123DEF4', metrica: '98765432', pixel: '' }))
      .expect(201)
    const live = await single('site_settings').expect(200)
    expect(live.body.data.tracking).toEqual({ ga4: 'G-ABC123DEF4', metrica: '98765432', pixel: '' })
  })

  it('previews the privacy policy at its address', async () => {
    const created = await marketing
      .post('/api/admin/content')
      .send({
        type: 'legal_privacy',
        data: {
          shared: {},
          locales: { uz: { title: 'Maxfiylik siyosati', body: paragraph('Matn') } },
        },
      })
      .expect(201)
    const link = await marketing
      .post(`/api/admin/content/${created.body.id}/preview-link`)
      .send({ locale: 'en' })
      .expect(200)
    expect(new URL(link.body.url).searchParams.get('path')).toBe('/en/privacy/')
  })
})

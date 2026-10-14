import { randomUUID } from 'node:crypto'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent.js'
import { DataSource } from 'typeorm'
import { StatsService } from '../src/stats/stats.service.js'
import { paragraph } from './note-type.js'
import {
  createTestApp,
  createUser,
  login,
  nextIp,
  resetDatabase,
  type TestApp,
} from './test-app.js'

const SITE = 'http://site.test'
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'

describe('statistics', () => {
  let app: TestApp
  let admin: TestAgent
  let marketing: TestAgent
  let hr: TestAgent

  beforeAll(async () => {
    app = await createTestApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(async () => {
    await resetDatabase(app)
    await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    await createUser(app, { email: 'marketing@autodoc.uz', role: 'marketing' })
    await createUser(app, { email: 'hr@autodoc.uz', role: 'hr' })
    admin = await login(app, 'admin@autodoc.uz')
    marketing = await login(app, 'marketing@autodoc.uz')
    hr = await login(app, 'hr@autodoc.uz')
  })

  /** One browser on one address: the page views it sends. */
  function browser(userAgent = DESKTOP, ip = nextIp()) {
    const send = (body: Record<string, unknown>) =>
      request(app.getHttpServer())
        .post('/api/v1/collect')
        .set('Origin', SITE)
        .set('User-Agent', userAgent)
        .set('X-Forwarded-For', ip)
        .send(body)
    return {
      ip,
      async view(path: string, extra: Record<string, unknown> = {}) {
        const id = randomUUID()
        await send({ t: 'view', id, path, ...extra }).expect(204)
        return id
      },
      end: (id: string, ms: number) => send({ t: 'end', id, ms }).expect(204),
      send,
    }
  }

  const rows = () => app.get(DataSource).query(`SELECT * FROM stats_views ORDER BY id`)

  async function publishedVacancy(title: string) {
    const direction = await hr
      .post('/api/admin/content')
      .send({
        type: 'vacancy_direction',
        data: { shared: { order: 1 }, locales: { uz: { name: `Yo'nalish ${title}` } } },
      })
      .expect(201)
    const vacancy = await hr
      .post('/api/admin/content')
      .send({
        type: 'vacancy',
        data: {
          shared: { directionId: direction.body.id, employment: 'fullTime' },
          locales: {
            uz: { title, city: 'Toshkent', description: 'Tavsif', body: paragraph('Shartlar') },
          },
        },
      })
      .expect(201)
    await hr.post(`/api/admin/content/${vacancy.body.id}/publish`).send({}).expect(200)
    return vacancy.body as { id: string; slug: string }
  }

  /** A live post straight in the database: the news rules (cover…) are tested elsewhere. */
  async function livePost(slug: string, title: string): Promise<string> {
    const data = { shared: { date: '2026-10-01' }, locales: { uz: { title } } }
    const [row] = await app.get(DataSource).query(
      `INSERT INTO documents (type, slug, published_slug, draft, draft_hash, published, published_hash, first_published_at, published_at)
       VALUES ('post', $1, $1, $2, repeat('a', 64), $2, repeat('a', 64), now(), now()) RETURNING id`,
      [slug, JSON.stringify(data)],
    )
    return row.id
  }

  it('counts views without cookies or addresses, and skips bots and other sites', async () => {
    const phone = browser(IPHONE)
    await phone.view('/', { ref: 'https://www.google.com/', w: 390 })
    await phone.view('/ru/about', { ref: `${SITE}/` })
    const computer = browser(DESKTOP)
    await computer.view('/en/contacts/', { utm: 'Newsletter' })

    await browser('Mozilla/5.0 (compatible; Googlebot/2.1)').view('/')
    await browser().send({ t: 'view', id: 'nope', path: '/' }).expect(204)
    await browser().view('https://evil.example/')
    await request(app.getHttpServer())
      .post('/api/v1/collect')
      .set('Origin', 'https://evil.example')
      .set('User-Agent', DESKTOP)
      .send({ t: 'view', id: randomUUID(), path: '/' })
      .expect(403)

    const saved = await rows()
    expect(saved).toHaveLength(3)
    expect(
      saved.map((r: { path: string; locale: string; source: string; device: string }) => [
        r.path,
        r.locale,
        r.source,
        r.device,
      ]),
    ).toEqual([
      ['/', 'uz', 'search', 'mobile'],
      ['/ru/about/', 'ru', 'internal', 'mobile'],
      ['/en/contacts/', 'en', 'campaign', 'desktop'],
    ])
    // The same phone is one visitor; nothing in the table leads back to its address.
    expect(saved[0].visitor).toBe(saved[1].visitor)
    expect(saved[0].visitor).not.toBe(saved[2].visitor)
    expect(JSON.stringify(saved)).not.toContain(phone.ip)
    expect(Object.keys(saved[0])).not.toContain('ip')
    expect(
      (await app.get(DataSource).query(`SELECT * FROM audit_log WHERE action LIKE 'stats%'`))
        .length,
    ).toBe(0)
  })

  it('reports the site: totals, days, sources, devices, languages, pages and forms', async () => {
    const phone = browser(IPHONE)
    const first = await phone.view('/', { ref: 'https://l.instagram.com/' })
    await phone.end(first, 42_000)
    await phone.view('/ru/vacancies/', { ref: `${SITE}/` })
    await browser().view('/', { ref: 'https://kun.uz/news/1' })
    await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('X-Forwarded-For', nextIp())
      .send({
        form: 'feedback',
        name: 'A',
        phone: '+998901234567',
        locale: 'uz',
        consent: true,
      })
      .expect(201)

    const { body } = await marketing.get('/api/admin/stats/overview').expect(200)
    expect(body.totals).toEqual({ views: 3, visitors: 2, avgSeconds: 42 })
    expect(body.previous).toEqual({ views: 0, visitors: 0, avgSeconds: null })
    expect(body.daily).toHaveLength(30)
    expect(body.daily.at(-1)).toMatchObject({ views: 3, visitors: 2 })
    expect(body.sources).toEqual(
      expect.arrayContaining([
        { source: 'social', visits: 1 },
        { source: 'referral', visits: 1 },
      ]),
    )
    expect(body.sources).toHaveLength(2)
    expect(body.referrers).toEqual(
      expect.arrayContaining([
        { source: 'social', name: 'instagram', visits: 1 },
        { source: 'referral', name: 'kun.uz', visits: 1 },
      ]),
    )
    expect(body.devices).toEqual(
      expect.arrayContaining([
        { device: 'mobile', visitors: 1 },
        { device: 'desktop', visitors: 1 },
      ]),
    )
    expect(body.locales).toEqual([
      { locale: 'uz', views: 2 },
      { locale: 'ru', views: 1 },
    ])
    expect(body.pages[0]).toEqual({ path: '/', views: 2, visitors: 2, avgSeconds: 42 })
    expect(body.forms).toEqual({ leads: 1, applications: 0 })

    await marketing.get('/api/admin/stats/overview?from=2026-10-10&to=2026-10-01').expect(400)
    await marketing.get('/api/admin/stats/overview?from=2020-01-01&to=2026-01-01').expect(400)
  })

  it('reports reading time per post and applications per vacancy view', async () => {
    const postId = await livePost('14', 'Infokiosklar')
    const reader = browser(IPHONE)
    await reader.end(await reader.view('/blog/14/'), 120_000)
    // A tab left open for hours is capped at 30 minutes.
    await browser().end(await browser().view('/ru/blog/14/'), 5 * 3_600_000)

    const vacancy = await publishedVacancy('Frontend dasturchi')
    await browser().view(`/vacancies/${vacancy.slug}/`)
    await browser().view(`/en/vacancies/${vacancy.slug}/`)
    await browser().view('/vacancies/')
    await request(app.getHttpServer())
      .post('/api/v1/applications')
      .set('X-Forwarded-For', nextIp())
      .field('name', 'A')
      .field('phone', '+998901234567')
      .field('locale', 'uz')
      .field('consent', 'on')
      .field('vacancyId', vacancy.id)
      .attach('resume', Buffer.from('%PDF-1.4\n%%EOF'), 'cv.pdf')
      .expect(201)

    const content = await marketing.get('/api/admin/stats/content').expect(200)
    expect(content.body.posts).toEqual([
      expect.objectContaining({ id: postId, title: 'Infokiosklar', views: 2, visitors: 2 }),
    ])
    // (120 + 1800) / 2 seconds.
    expect(content.body.posts[0].avgSeconds).toBe(960)

    const vacancies = await hr.get('/api/admin/stats/vacancies').expect(200)
    expect(vacancies.body.vacancies).toEqual([
      {
        id: vacancy.id,
        title: 'Frontend dasturchi',
        slug: vacancy.slug,
        closed: false,
        views: 2,
        visitors: 2,
        applications: 1,
        conversion: 50,
      },
    ])
    expect(vacancies.body.careerPage).toMatchObject({ views: 1, visitors: 1 })
    expect(vacancies.body.applications).toEqual({ total: 1, otherPosition: 0 })

    // HR sees the vacancy tab only.
    await hr.get('/api/admin/stats/overview').expect(403)
    await hr.get('/api/admin/stats/content').expect(403)
  })

  it('forgets the salt of past days, so visitors are never followed across days', async () => {
    const stats = app.get(StatsService)
    const client = { ip: '203.0.113.7', userAgent: DESKTOP }
    const today = new Date()
    const tomorrow = new Date(today.getTime() + 24 * 3_600_000)
    await stats.collect({ t: 'view', id: randomUUID(), path: '/' }, client, today)
    await stats.collect({ t: 'view', id: randomUUID(), path: '/' }, client, tomorrow)
    const [a, b] = await rows()
    expect(a.visitor).not.toBe(b.visitor)

    await stats.dropOldSalts(tomorrow)
    const salts = await app
      .get(DataSource)
      .query(`SELECT to_char(day, 'YYYY-MM-DD') AS day FROM stats_salts`)
    expect(salts).toHaveLength(1)
  })

  it('fills the start screen for each role', async () => {
    await browser().view('/')
    await browser().view('/vacancies/')
    const vacancy = await publishedVacancy('Dizayner')
    const { body: live } = await hr.get(`/api/admin/content/${vacancy.id}`).expect(200)
    await hr
      .post('/api/admin/content')
      .send({
        type: 'vacancy',
        data: {
          shared: { directionId: live.data.shared.directionId, employment: 'remote' },
          locales: { uz: { title: 'Qoralama', city: 'Toshkent', description: 'x' } },
        },
      })
      .expect(201)
    await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('X-Forwarded-For', nextIp())
      .send({
        form: 'feedback',
        name: 'Bek',
        phone: '+998901234567',
        topic: 'Savol',
        locale: 'uz',
        consent: true,
      })
      .expect(201)

    const forHr = (await hr.get('/api/admin/home').expect(200)).body
    expect(forHr.leads).toBeNull()
    expect(forHr.applications).toEqual({ new: 0, latest: [] })
    expect(forHr.views.scope).toBe('vacancies')
    expect(forHr.views.totals.views).toBe(1)
    expect(forHr.views.daily).toHaveLength(7)
    expect(forHr.drafts.items.map((d: { title: string }) => d.title)).toEqual(['Qoralama'])
    expect(forHr.drafts.items[0]).toMatchObject({ type: 'vacancy', status: 'draft' })

    const forMarketing = (await marketing.get('/api/admin/home').expect(200)).body
    expect(forMarketing.leads).toMatchObject({
      new: 1,
      latest: [{ number: 1, name: 'Bek', topic: 'Savol', status: 'new' }],
    })
    expect(forMarketing.views.scope).toBe('site')
    expect(forMarketing.views.totals.views).toBe(2)
    expect(forMarketing.drafts.total).toBe(1)

    const forAdmin = (await admin.get('/api/admin/home').expect(200)).body
    expect(Object.keys(forAdmin)).toEqual(['leads', 'applications', 'views', 'drafts'])
  })
})

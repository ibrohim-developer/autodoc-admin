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

describe('vacancies', () => {
  let app: TestApp
  let hr: TestAgent
  let marketing: TestAgent

  beforeAll(async () => {
    app = await createTestApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(async () => {
    await resetDatabase(app)
    await createUser(app, { email: 'hr@autodoc.uz', role: 'hr' })
    await createUser(app, { email: 'marketing@autodoc.uz', role: 'marketing' })
    hr = await login(app, 'hr@autodoc.uz')
    marketing = await login(app, 'marketing@autodoc.uz')
  })

  const siteApi = (path: string) =>
    request(app.getHttpServer()).get(`/api/v1/content/${path}`).set('x-site-token', SITE_API_TOKEN)

  async function direction(name: string): Promise<string> {
    const res = await hr.post('/api/admin/content').send({
      type: 'vacancy_direction',
      data: { shared: { order: 1 }, locales: { uz: { name } } },
    })
    expect(res.status).toBe(201)
    return res.body.id
  }

  function vacancy(directionId: string, uz: Record<string, unknown> = {}) {
    return {
      shared: { directionId, employment: 'fullTime' },
      locales: {
        uz: {
          title: 'Frontend dasturchi',
          city: 'Toshkent',
          description: 'Davlat portallari interfeyslari',
          requirements: ['React tajribasi', 'TypeScript'],
          body: paragraph('Vazifalar va shartlar'),
          ...uz,
        },
      },
    }
  }

  it('lets HR run vacancies end to end, and nothing else', async () => {
    const development = await direction('Dasturlash')
    const created = await hr
      .post('/api/admin/content')
      .send({ type: 'vacancy', data: vacancy(development) })
      .expect(201)
    expect(created.body.slug).toBe('frontend-dasturchi')
    await hr.post(`/api/admin/content/${created.body.id}/publish`).send({}).expect(200)

    // News belong to marketing.
    await hr
      .post('/api/admin/content')
      .send({
        type: 'post',
        data: {
          shared: { date: '2026-10-01' },
          locales: { uz: { title: 'X', body: paragraph('x') } },
        },
      })
      .expect(403)
    const types = await hr.get('/api/admin/content/types').expect(200)
    expect(types.body.map((type: { type: string }) => type.type).sort()).toEqual([
      'vacancy',
      'vacancy_direction',
    ])
  })

  it('keeps the card light in lists and the full text on the page', async () => {
    const development = await direction('Dasturlash')
    const created = await hr
      .post('/api/admin/content')
      .send({ type: 'vacancy', data: vacancy(development) })
      .expect(201)
    await hr.post(`/api/admin/content/${created.body.id}/publish`).send({}).expect(200)

    const list = await siteApi('vacancy?locale=ru').expect(200)
    expect(Object.keys(list.body.items[0].data).sort()).toEqual(
      ['city', 'description', 'directionId', 'employment', 'requirements', 'title'].sort(),
    )
    const page = await siteApi('vacancy/frontend-dasturchi?locale=ru').expect(200)
    expect(page.body.data.body).toEqual(paragraph('Vazifalar va shartlar'))
  })

  it('allows four requirements at most and needs a direction', async () => {
    const development = await direction('Dasturlash')
    const tooMany = await hr
      .post('/api/admin/content')
      .send({
        type: 'vacancy',
        data: vacancy(development, { requirements: ['a', 'b', 'c', 'd', 'e'] }),
      })
      .expect(400)
    expect(tooMany.body.issues[0]).toEqual({
      path: 'locales.uz.requirements',
      message: 'Не больше 4 требований',
    })

    const noDirection = vacancy(development)
    noDirection.shared = { employment: 'fullTime' } as typeof noDirection.shared
    const missing = await hr
      .post('/api/admin/content')
      .send({ type: 'vacancy', data: noDirection })
      .expect(400)
    expect(missing.body.issues[0].path).toBe('shared.directionId')
  })

  it('shows HR only vacancies in the trash', async () => {
    const development = await direction('Dasturlash')
    const job = await hr
      .post('/api/admin/content')
      .send({ type: 'vacancy', data: vacancy(development) })
    const post = await marketing.post('/api/admin/content').send({
      type: 'post',
      data: {
        shared: { date: '2026-10-01' },
        locales: { uz: { title: 'Yangilik', body: paragraph('x') } },
      },
    })
    await hr.delete(`/api/admin/content/${job.body.id}`).expect(204)
    await marketing.delete(`/api/admin/content/${post.body.id}`).expect(204)

    const trash = await hr.get('/api/admin/trash').expect(200)
    expect(trash.body.items.map((item: { title: string }) => item.title)).toEqual([
      'Frontend dasturchi',
    ])
    // The direction is free again once its only vacancy is in the trash.
    await hr.delete(`/api/admin/content/${development}`).expect(204)
  })
})

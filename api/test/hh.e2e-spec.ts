import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type TestAgent from 'supertest/lib/agent.js'
import { DataSource } from 'typeorm'
import { HhService } from '../src/hh/hh.service.js'
import { createTestApp, createUser, login, resetDatabase, type TestApp } from './test-app.js'

const TOKEN = 'APPLICATION_TOKEN_FROM_DEV_HH_RU_0123456789'

type FakeVacancy = {
  id: string
  name: string
  archived?: boolean
  area?: { name: string }
  employment?: { id: string }
  schedule?: { id: string }
  description: string
  key_skills?: { name: string }[]
}

/** Stands in for api.hh.ru: the employer's open vacancies and each one's details. */
async function startFakeHh() {
  const vacancies = new Map<string, FakeVacancy>()
  const seen: { url: string; auth: string | undefined }[] = []
  let status = 200
  const server: Server = createServer((req, res) => {
    seen.push({ url: req.url ?? '', auth: req.headers.authorization })
    const send = (code: number, body: unknown) =>
      res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(body))
    if (status !== 200) return send(status, { errors: [{ type: 'forbidden' }] })
    if (req.headers.authorization !== `Bearer ${TOKEN}`)
      return send(403, { errors: [{ type: 'oauth' }] })
    const url = new URL(req.url ?? '/', 'http://hh')
    if (url.pathname === '/vacancies') {
      const items = [...vacancies.values()].filter((v) => !v.archived)
      return send(200, {
        items: items.map(({ id, name }) => ({ id, name })),
        pages: 1,
        found: items.length,
      })
    }
    const vacancy = vacancies.get(url.pathname.replace('/vacancies/', ''))
    return vacancy ? send(200, vacancy) : send(404, { errors: [{ type: 'not_found' }] })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    vacancies,
    seen,
    fail: (code: number) => {
      status = code
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

describe('hh.uz import', () => {
  let app: TestApp
  let hh: Awaited<ReturnType<typeof startFakeHh>>
  let admin: TestAgent
  let hr: TestAgent
  let directionId: string

  beforeAll(async () => {
    hh = await startFakeHh()
    app = await createTestApp({ HH_API_URL: hh.url })
  })
  afterAll(async () => {
    await app.close()
    await hh.close()
  })
  beforeEach(async () => {
    await resetDatabase(app)
    hh.vacancies.clear()
    hh.fail(200)
    await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    await createUser(app, { email: 'hr@autodoc.uz', role: 'hr' })
    admin = await login(app, 'admin@autodoc.uz')
    hr = await login(app, 'hr@autodoc.uz')
    const direction = await hr
      .post('/api/admin/content')
      .send({
        type: 'vacancy_direction',
        data: { shared: {}, locales: { uz: { name: 'Dasturlash' } } },
      })
      .expect(201)
    directionId = direction.body.id
    hh.vacancies.set('101', {
      id: '101',
      name: 'Frontend-разработчик',
      area: { name: 'Ташкент' },
      employment: { id: 'full' },
      schedule: { id: 'fullDay' },
      description: '<p><strong>Задачи:</strong></p><ul><li>React</li><li>TypeScript</li></ul>',
      key_skills: [{ name: 'React' }, { name: 'TypeScript' }],
    })
  })

  const connect = (extra: Record<string, unknown> = {}) =>
    admin
      .put('/api/admin/integrations/hh')
      .send({ enabled: true, employerId: '123456', token: TOKEN, directionId, ...extra })
      .expect(200)
  const sync = async () => (await admin.post('/api/admin/integrations/hh/sync').expect(200)).body
  const vacancies = async () =>
    (await hr.get('/api/admin/content?type=vacancy').expect(200)).body.items as {
      id: string
      title: string
      status: string
      slug: string
      shared: Record<string, unknown>
    }[]

  it('is set up by the administrator only and never shows the token', async () => {
    await hr.get('/api/admin/integrations/hh').expect(403)
    await admin.put('/api/admin/integrations/hh').send({ employerId: 'abc' }).expect(400)
    const view = (await connect()).body
    expect(view).toMatchObject({
      enabled: true,
      hasToken: true,
      employerId: '123456',
      autoPublish: false,
    })
    expect(JSON.stringify(view)).not.toContain(TOKEN)
  })

  it('brings new vacancies in as drafts, follows changes, closes and reopens them', async () => {
    await connect()
    expect(await sync()).toMatchObject({ ok: true, created: 1, updated: 0, closed: 0 })
    expect(hh.seen[0]?.url).toBe('/vacancies?employer_id=123456&per_page=100&page=0&host=hh.uz')

    let [vacancy] = await vacancies()
    expect(vacancy).toMatchObject({
      title: 'Frontend-разработчик',
      status: 'draft',
      slug: 'frontend-razrabotchik',
    })
    const { body: doc } = await hr.get(`/api/admin/content/${vacancy?.id}`).expect(200)
    expect(doc.data.locales.uz).toMatchObject({
      title: 'Frontend-разработчик',
      city: 'Ташкент',
      description: 'Задачи: React TypeScript',
      requirements: ['React', 'TypeScript'],
    })
    expect(doc.data.locales.ru.title).toBe('Frontend-разработчик')
    expect(doc.data.shared).toMatchObject({
      directionId,
      employment: 'fullTime',
      hh: { id: '101' },
    })
    expect(doc.updatedBy.name).toBe('hh.uz')

    // Nothing changed on hh: nothing happens.
    expect(await sync()).toMatchObject({ created: 0, updated: 0 })

    // HR publishes it; hh renames it: the live vacancy follows, at the same address.
    await hr.post(`/api/admin/content/${vacancy?.id}/publish`).send({}).expect(200)
    hh.vacancies.set('101', {
      ...(hh.vacancies.get('101') as FakeVacancy),
      name: 'Senior Frontend-разработчик',
      schedule: { id: 'remote' },
    })
    expect(await sync()).toMatchObject({ updated: 1 })
    ;[vacancy] = await vacancies()
    expect(vacancy).toMatchObject({
      title: 'Senior Frontend-разработчик',
      status: 'published',
      slug: 'frontend-razrabotchik',
    })
    expect(vacancy?.shared.employment).toBe('remote')

    // Closed on hh: closed on the site; open again: reopened.
    ;(hh.vacancies.get('101') as FakeVacancy).archived = true
    expect(await sync()).toMatchObject({ closed: 1 })
    ;[vacancy] = await vacancies()
    expect(vacancy).toMatchObject({ status: 'published' })
    expect(vacancy?.shared.closed).toBe(true)
    ;(hh.vacancies.get('101') as FakeVacancy).archived = false
    expect(await sync()).toMatchObject({ reopened: 1 })
    expect((await vacancies())[0]?.shared.closed).toBe(false)

    const audit = await app
      .get(DataSource)
      .query(`SELECT summary FROM audit_log WHERE action = 'hh.sync' ORDER BY id`)
    expect(audit).toHaveLength(4)
  })

  it('leaves the text alone once HR edited it, but still closes it', async () => {
    await connect({ autoPublish: true })
    await sync()
    const [vacancy] = await vacancies()
    expect(vacancy?.status).toBe('published')
    const { body: doc } = await hr.get(`/api/admin/content/${vacancy?.id}`).expect(200)
    const translated = {
      ...doc.data,
      locales: { ...doc.data.locales, uz: { ...doc.data.locales.uz, title: 'Frontend dasturchi' } },
    }
    await hr
      .put(`/api/admin/content/${doc.id}`)
      .send({ data: translated, revision: doc.revision })
      .expect(200)
    await hr.post(`/api/admin/content/${doc.id}/publish`).send({}).expect(200)

    hh.vacancies.set('101', {
      ...(hh.vacancies.get('101') as FakeVacancy),
      name: 'Другое название',
    })
    expect(await sync()).toMatchObject({ updated: 0, protected: 1 })
    expect((await vacancies())[0]?.title).toBe('Frontend dasturchi')

    hh.vacancies.delete('101')
    expect(await sync()).toMatchObject({ closed: 1 })
    const [closed] = await vacancies()
    expect(closed).toMatchObject({ title: 'Frontend dasturchi', status: 'published' })
    expect(closed?.shared.closed).toBe(true)
  })

  it('does not bring back a vacancy deleted here, and reports hh errors once', async () => {
    await connect()
    await sync()
    const [vacancy] = await vacancies()
    await hr.delete(`/api/admin/content/${vacancy?.id}`).expect(204)
    expect(await sync()).toMatchObject({ created: 0 })
    expect(await vacancies()).toEqual([])

    hh.fail(403)
    const failed = await sync()
    expect(failed).toMatchObject({ ok: false })
    expect(failed.error).toContain('hh.uz не принимает токен (403')
    await sync()
    const errors = await app
      .get(DataSource)
      .query(`SELECT 1 FROM audit_log WHERE action = 'hh.sync' AND summary LIKE '%ошибка%'`)
    expect(errors).toHaveLength(1)
    expect((await admin.get('/api/admin/integrations/hh').expect(200)).body.lastRun).toMatchObject({
      ok: false,
    })

    // The hh.uz account is no one to manage.
    const users = await admin.get('/api/admin/users').expect(200)
    expect(users.body.items.map((u: { email: string }) => u.email)).not.toContain(
      'hh@system.autodoc.uz',
    )
  })

  it('needs its settings before it runs', async () => {
    const result = await app.get(HhService).sync()
    expect(result).toMatchObject({ ok: false, error: 'Не указан токен приложения hh.uz' })
  })
})

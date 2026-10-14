import { existsSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent.js'
import { DataSource } from 'typeorm'
import { TelegramService } from '../src/integrations/telegram.service.js'
import { TrashService } from '../src/trash/trash.service.js'
import { paragraph } from './note-type.js'
import {
  createTestApp,
  createUser,
  login,
  nextIp,
  resetDatabase,
  storageDirOf,
  type TestApp,
} from './test-app.js'

const SITE = 'http://site.test'
const BOT_TOKEN = '123456789:AAE-test-token-for-the-fake-telegram-api'

type TelegramCall = { path: string; chatId: string; text: string }

/** Stands in for api.telegram.org: records what the bot would have sent. */
async function startFakeTelegram() {
  const calls: TelegramCall[] = []
  const server: Server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}') as { chat_id?: string; text?: string }
      calls.push({ path: req.url ?? '', chatId: String(parsed.chat_id), text: parsed.text ?? '' })
      const ok = parsed.chat_id !== '-404'
      res
        .writeHead(ok ? 200 : 400, { 'content-type': 'application/json' })
        .end(JSON.stringify(ok ? { ok: true } : { ok: false, description: 'chat not found' }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    calls,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

const pdf = Buffer.from('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer\n%%EOF\n')

describe('forms: submissions and job applications', () => {
  let app: TestApp
  let telegram: Awaited<ReturnType<typeof startFakeTelegram>>
  let admin: TestAgent
  let marketing: TestAgent
  let hr: TestAgent

  beforeAll(async () => {
    telegram = await startFakeTelegram()
    app = await createTestApp({ TELEGRAM_API_URL: telegram.url })
  })
  afterAll(async () => {
    await app.close()
    await telegram.close()
  })
  beforeEach(async () => {
    await resetDatabase(app)
    telegram.calls.length = 0
    await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    await createUser(app, { email: 'marketing@autodoc.uz', role: 'marketing' })
    await createUser(app, { email: 'hr@autodoc.uz', role: 'hr', name: 'Нигора Кадрова' })
    admin = await login(app, 'admin@autodoc.uz')
    marketing = await login(app, 'marketing@autodoc.uz')
    hr = await login(app, 'hr@autodoc.uz')
  })

  /** A visitor of the site, each from their own address unless one is given. */
  const visitor = (ip = nextIp()) => ({
    lead: (body: Record<string, unknown>) =>
      request(app.getHttpServer())
        .post('/api/v1/leads')
        .set('Origin', SITE)
        .set('X-Forwarded-For', ip)
        .send(body),
    apply: (fields: Record<string, string>, file?: { buffer: Buffer; name: string }) => {
      const req = request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Origin', SITE)
        .set('X-Forwarded-For', ip)
      for (const [key, value] of Object.entries(fields)) req.field(key, value)
      if (file) req.attach('resume', file.buffer, file.name)
      return req
    },
  })

  const feedback = {
    form: 'feedback',
    name: 'Алишер Каримов',
    phone: '+998 90 123 45 67',
    topic: 'Сотрудничество',
    message: 'Хотим обсудить проект',
    locale: 'ru',
    page: '/ru/contacts/',
    consent: true,
  }

  async function connectTelegram() {
    await admin
      .put('/api/admin/integrations/telegram')
      .send({ enabled: true, token: BOT_TOKEN, leadsChatId: '-1001', applicationsChatId: '-1002' })
      .expect(200)
  }

  async function waitForTelegram(count: number) {
    await vi.waitFor(() => expect(telegram.calls.length).toBeGreaterThanOrEqual(count), {
      timeout: 3_000,
    })
  }

  async function publishedVacancy(title = 'Frontend dasturchi', closed = false) {
    const direction = await hr
      .post('/api/admin/content')
      .send({
        type: 'vacancy_direction',
        data: { shared: { order: 1 }, locales: { uz: { name: 'Dasturlash' } } },
      })
      .expect(201)
    const vacancy = await hr
      .post('/api/admin/content')
      .send({
        type: 'vacancy',
        data: {
          shared: { directionId: direction.body.id, employment: 'fullTime', closed },
          locales: {
            uz: {
              title,
              city: 'Toshkent',
              description: 'Interfeyslar',
              body: paragraph('Shartlar'),
            },
          },
        },
      })
      .expect(201)
    await hr.post(`/api/admin/content/${vacancy.body.id}/publish`).send({}).expect(200)
    return vacancy.body.id as string
  }

  // ── Submissions ─────────────────────────────────────────────────────────────

  it('takes a submission from the site and shows it to marketing, not to HR', async () => {
    await connectTelegram()
    await visitor().lead(feedback).expect(201, { ok: true })

    const list = await marketing.get('/api/admin/leads').expect(200)
    expect(list.body.total).toBe(1)
    expect(list.body.counts).toEqual({ new: 1, in_progress: 0, done: 0, spam: 0 })
    const [lead] = list.body.items
    expect(lead).toMatchObject({
      number: 1,
      form: 'feedback',
      formLabel: 'Обратная связь',
      name: 'Алишер Каримов',
      phone: '+998 90 123 45 67',
      locale: 'ru',
      page: '/ru/contacts/',
      status: 'new',
    })
    expect(lead.consentAt).toBeTruthy()
    await hr.get('/api/admin/leads').expect(403)

    // Telegram: which form and a link, never who or what.
    await waitForTelegram(1)
    const [alert] = telegram.calls
    expect(alert?.path).toBe(`/bot${BOT_TOKEN}/sendMessage`)
    expect(alert?.chatId).toBe('-1001')
    expect(alert?.text).toContain('Новая заявка №1')
    expect(alert?.text).toContain(`/leads/${lead.id}`)
    for (const secret of ['Алишер', '123 45 67', 'Сотрудничество', 'обсудить']) {
      expect(alert?.text).not.toContain(secret)
    }
  })

  it('refuses a submission without consent, with a bad phone, or from another site', async () => {
    const res = await visitor()
      .lead({ ...feedback, consent: false })
      .expect(400)
    expect(res.body.code).toBe('invalid_form')
    expect(res.body.fields.consent).toBe('Нужно согласие на обработку персональных данных')

    const phone = await visitor()
      .lead({ ...feedback, phone: '12' })
      .expect(400)
    expect(Object.keys(phone.body.fields)).toEqual(['phone'])

    await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Origin', 'https://evil.example')
      .send(feedback)
      .expect(403)
    expect((await marketing.get('/api/admin/leads').expect(200)).body.total).toBe(0)
  })

  it('answers a bot that filled the hidden field as usual, and keeps nothing', async () => {
    await visitor()
      .lead({ ...feedback, website: 'http://spam.example' })
      .expect(201, { ok: true })
    expect((await marketing.get('/api/admin/leads').expect(200)).body.total).toBe(0)
  })

  it('allows 5 submissions in 10 minutes per form and address', async () => {
    const ip = nextIp()
    for (let i = 0; i < 5; i++) await visitor(ip).lead(feedback).expect(201)
    const res = await visitor(ip).lead(feedback).expect(429)
    expect(res.body.code).toBe('too_many_submissions')
    // Another address is not affected, and neither is the resume form.
    await visitor().lead(feedback).expect(201)
    await visitor(ip).apply({ name: 'A', phone: '+998901234567', locale: 'uz' }).expect(400)
    expect(
      (
        await visitor(ip)
          .lead({ ...feedback, consent: undefined })
          .expect(429)
      ).body.code,
    ).toBe('too_many_submissions')
  })

  it('also allows no more than 20 a day', async () => {
    const ip = nextIp()
    const db = app.get(DataSource)
    const address = (await import('../src/forms/form-limits.service.js')).FormLimitsService
    const hash = app.get(address).addressOf(ip)
    // 20 earlier today, spread outside the 10-minute window.
    for (let i = 0; i < 20; i++) {
      await db.query(
        `INSERT INTO form_hits (form, address, created_at) VALUES ('feedback', $1, now() - interval '1 hour')`,
        [hash],
      )
    }
    await visitor(ip).lead(feedback).expect(429)
  })

  it('tracks status and comment, exports to Excel, and goes through the trash', async () => {
    await visitor().lead(feedback).expect(201)
    await visitor()
      .lead({ ...feedback, name: 'Другой', locale: 'uz', topic: undefined })
      .expect(201)
    const { body } = await marketing.get('/api/admin/leads?q=Алишер').expect(200)
    expect(body.total).toBe(1)
    const id = body.items[0].id

    const updated = await marketing
      .patch(`/api/admin/leads/${id}`)
      .send({ status: 'in_progress', comment: '  Перезвонить в понедельник ' })
      .expect(200)
    expect(updated.body).toMatchObject({
      status: 'in_progress',
      comment: 'Перезвонить в понедельник',
    })
    expect(updated.body.updatedBy.id).toBeTruthy()
    await marketing.patch(`/api/admin/leads/${id}`).send({ status: 'lost' }).expect(400)

    const filtered = await marketing.get('/api/admin/leads?status=in_progress').expect(200)
    expect(filtered.body.items.map((l: { id: string }) => l.id)).toEqual([id])
    expect(filtered.body.counts).toMatchObject({ new: 1, in_progress: 1 })
    const byNumber = await marketing
      .get(`/api/admin/leads?q=${encodeURIComponent('№2')}`)
      .expect(200)
    expect(byNumber.body.items.map((l: { number: number }) => l.number)).toEqual([2])

    const file = await marketing
      .get('/api/admin/leads/export?status=in_progress')
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => done(null, Buffer.concat(chunks)))
      })
      .expect(200)
    expect(file.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(file.headers['content-disposition']).toMatch(
      /^attachment; filename="zayavki-\d{4}-\d{2}-\d{2}\.xlsx"$/,
    )
    expect((file.body as Buffer).subarray(0, 2).toString()).toBe('PK')
    await hr.get('/api/admin/leads/export').expect(403)

    const audit = await app
      .get(DataSource)
      .query(`SELECT action, meta FROM audit_log WHERE entity_type = 'lead' ORDER BY id`)
    expect(audit.map((row: { action: string }) => row.action)).toEqual([
      'leads.update',
      'leads.export',
    ])
    expect(audit[0].meta).toEqual({ status: { from: 'new', to: 'in_progress' }, comment: true })

    await marketing.delete(`/api/admin/leads/${id}`).expect(204)
    await marketing.get(`/api/admin/leads/${id}`).expect(404)
    const trash = await marketing.get('/api/admin/trash').expect(200)
    expect(trash.body.items).toMatchObject([
      { kind: 'lead', id, typeLabel: 'Заявка', title: 'Заявка №1 · Алишер Каримов' },
    ])
    // HR's trash has vacancies and applications only.
    expect((await hr.get('/api/admin/trash').expect(200)).body.items).toEqual([])
    await hr.post(`/api/admin/trash/lead/${id}/restore`).expect(403)

    await marketing.post(`/api/admin/trash/lead/${id}/restore`).expect(204)
    await marketing.get(`/api/admin/leads/${id}`).expect(200)
    await marketing.delete(`/api/admin/leads/${id}`).expect(204)
    const purged = await app
      .get(TrashService)
      .purgeExpired(new Date(Date.now() + 31 * 24 * 60 * 60 * 1000))
    expect(purged.leads).toBe(1)
  })

  // ── Applications ────────────────────────────────────────────────────────────

  it('takes an application with a resume for an open vacancy', async () => {
    await connectTelegram()
    const vacancyId = await publishedVacancy()
    await visitor()
      .apply(
        {
          name: 'Дилноза',
          phone: '+998 91 000 00 00',
          vacancyId,
          about: 'Три года React',
          locale: 'uz',
          page: '/vacancies/frontend-dasturchi/',
          consent: 'on',
        },
        { buffer: pdf, name: 'Резюме Дилноза.pdf' },
      )
      .expect(201, { ok: true })

    const list = await hr.get('/api/admin/applications').expect(200)
    expect(list.body.total).toBe(1)
    const [application] = list.body.items
    expect(application).toMatchObject({
      number: 1,
      vacancy: { id: vacancyId, title: 'Frontend dasturchi' },
      name: 'Дилноза',
      about: 'Три года React',
      source: 'site',
      sourceLabel: 'Сайт',
      status: 'new',
      resume: { name: 'Резюме Дилноза.pdf', size: pdf.length, mime: 'application/pdf' },
    })

    // The file is private and comes out byte for byte, and the download is logged.
    const download = await hr
      .get(`/api/admin/applications/${application.id}/resume`)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => done(null, Buffer.concat(chunks)))
      })
      .expect(200)
    expect((download.body as Buffer).equals(pdf)).toBe(true)
    expect(download.headers['content-type']).toBe('application/pdf')
    expect(download.headers['content-disposition']).toBe(
      `attachment; filename="______ _______.pdf"; filename*=UTF-8''${encodeURIComponent('Резюме Дилноза.pdf')}`,
    )
    const logged = await app
      .get(DataSource)
      .query(`SELECT user_email FROM audit_log WHERE action = 'applications.resume_download'`)
    expect(logged).toEqual([{ user_email: 'hr@autodoc.uz' }])
    await request(app.getHttpServer())
      .get(`/api/admin/applications/${application.id}/resume`)
      .expect(401)

    await waitForTelegram(1)
    expect(telegram.calls[0]).toMatchObject({ chatId: '-1002' })
    expect(telegram.calls[0]?.text).toContain('Новый отклик №1: «Frontend dasturchi»')
    expect(telegram.calls[0]?.text).not.toContain('Дилноза')

    const vacancies = await hr.get('/api/admin/applications/vacancies').expect(200)
    expect(vacancies.body.items).toEqual([
      {
        id: vacancyId,
        title: 'Frontend dasturchi',
        closed: false,
        isLive: true,
        applications: 1,
        newApplications: 1,
      },
    ])
  })

  it('checks the resume by its content and the vacancy by the site', async () => {
    const fields = { name: 'Bot', phone: '+998901234567', locale: 'uz', consent: 'true' }
    const fake = await visitor()
      .apply(fields, { buffer: Buffer.from('<script>alert(1)</script>'), name: 'cv.pdf' })
      .expect(422)
    expect(fake.body.code).toBe('unsupported_resume')
    expect((await visitor().apply(fields).expect(422)).body.code).toBe('no_resume')

    const closed = await publishedVacancy('Yopiq vakansiya', true)
    const res = await visitor()
      .apply({ ...fields, vacancyId: closed }, { buffer: pdf, name: 'cv.pdf' })
      .expect(422)
    expect(res.body.code).toBe('vacancy_closed')

    // "Другая позиция".
    await visitor()
      .apply({ ...fields, vacancyId: 'other' }, { buffer: pdf, name: 'cv.pdf' })
      .expect(201)
    const list = await hr.get('/api/admin/applications?vacancyId=none').expect(200)
    expect(list.body.items).toHaveLength(1)
    expect(list.body.items[0].vacancy).toBeNull()

    // Over 10 MB never reaches the disk.
    await visitor()
      .apply(fields, {
        buffer: Buffer.concat([pdf, Buffer.alloc(10 * 1024 * 1024)]),
        name: 'big.pdf',
      })
      .expect(413)
  })

  it('lets HR add a candidate from hh.uz by hand and handle it through the trash', async () => {
    const vacancyId = await publishedVacancy()
    const created = await hr
      .post('/api/admin/applications')
      .field('name', 'Сардор')
      .field('phone', '+998 93 111 22 33')
      .field('email', '')
      .field('vacancyId', vacancyId)
      .field('source', 'hh')
      .field('comment', 'Нашли на hh.uz')
      .attach('resume', pdf, 'sardor.pdf')
      .expect(201)
    expect(created.body).toMatchObject({
      number: 1,
      source: 'hh',
      sourceLabel: 'hh.uz',
      email: null,
      comment: 'Нашли на hh.uz',
      createdBy: { name: 'Нигора Кадрова' },
      vacancy: { id: vacancyId },
    })
    await hr
      .post('/api/admin/applications')
      .field('name', 'X')
      .field('phone', '+998931112233')
      .field('source', 'site')
      .expect(400)

    const id = created.body.id
    await hr.patch(`/api/admin/applications/${id}`).send({ status: 'interview' }).expect(200)
    const byStatus = await hr.get('/api/admin/applications?status=interview&source=hh').expect(200)
    expect(byStatus.body.total).toBe(1)
    expect(byStatus.body.counts.interview).toBe(1)

    const file = join(
      storageDirOf(app),
      'private',
      (
        await app.get(DataSource).query(`SELECT resume_file FROM applications WHERE id = $1`, [id])
      )[0].resume_file,
    )
    expect(existsSync(file)).toBe(true)

    await hr.delete(`/api/admin/applications/${id}`).expect(204)
    const trash = await hr.get('/api/admin/trash').expect(200)
    expect(trash.body.items).toMatchObject([
      { kind: 'application', id, title: 'Отклик №1 · Сардор', typeLabel: 'Отклик' },
    ])
    await hr.delete(`/api/admin/trash/application/${id}`).expect(204)
    expect(existsSync(file)).toBe(false)
    await hr.get(`/api/admin/applications/${id}`).expect(404)
  })

  it('keeps applications when their vacancy is removed for good', async () => {
    const vacancyId = await publishedVacancy()
    await visitor()
      .apply(
        { name: 'A', phone: '+998901234567', locale: 'uz', consent: '1', vacancyId },
        { buffer: pdf, name: 'cv.pdf' },
      )
      .expect(201)
    await hr.delete(`/api/admin/content/${vacancyId}`).expect(204)
    await hr.delete(`/api/admin/trash/document/${vacancyId}`).expect(204)
    const { body } = await hr.get('/api/admin/applications').expect(200)
    expect(body.items[0].vacancy).toEqual({ id: null, title: 'Frontend dasturchi' })
  })

  // ── Telegram ────────────────────────────────────────────────────────────────

  it('lets only the administrator set up Telegram, and never shows the token', async () => {
    await marketing.get('/api/admin/integrations/telegram').expect(403)
    const empty = await admin.get('/api/admin/integrations/telegram').expect(200)
    expect(empty.body).toMatchObject({ enabled: false, hasToken: false, leadsChatId: null })

    await admin.put('/api/admin/integrations/telegram').send({ token: 'not-a-token' }).expect(400)
    await admin.put('/api/admin/integrations/telegram').send({ leadsChatId: 'abc' }).expect(400)
    await connectTelegram()
    const view = await admin.get('/api/admin/integrations/telegram').expect(200)
    expect(view.body).toMatchObject({
      enabled: true,
      hasToken: true,
      leadsChatId: '-1001',
      applicationsChatId: '-1002',
    })
    expect(JSON.stringify(view.body)).not.toContain(BOT_TOKEN)
    const stored = await app.get(DataSource).query(`SELECT value FROM app_settings`)
    expect(JSON.stringify(stored)).not.toContain(BOT_TOKEN)

    // "Проверить" reports Telegram's answer per chat.
    await admin
      .put('/api/admin/integrations/telegram')
      .send({ applicationsChatId: '-404' })
      .expect(200)
    const test = await admin.post('/api/admin/integrations/telegram/test').expect(200)
    expect(test.body).toEqual({
      leads: { ok: true },
      applications: { ok: false, error: 'chat not found' },
    })

    // Turned off: nothing is sent.
    await admin.put('/api/admin/integrations/telegram').send({ enabled: false }).expect(200)
    telegram.calls.length = 0
    expect(await app.get(TelegramService).deliver('leads', 'x')).toBeNull()
    expect(telegram.calls).toEqual([])
  })
})

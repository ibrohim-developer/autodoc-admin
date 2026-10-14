import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent.js'
import { DataSource } from 'typeorm'
import { RetentionService } from '../src/retention/retention.service.js'
import {
  createTestApp,
  createUser,
  login,
  nextIp,
  resetDatabase,
  storageDirOf,
  type TestApp,
} from './test-app.js'

const DAY = 24 * 60 * 60 * 1000

describe('audit log and retention', () => {
  let app: TestApp
  let admin: TestAgent
  let marketing: TestAgent

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
    admin = await login(app, 'admin@autodoc.uz')
    marketing = await login(app, 'marketing@autodoc.uz')
  })

  const db = () => app.get(DataSource)

  const lead = (name: string) =>
    request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('X-Forwarded-For', nextIp())
      .send({ form: 'feedback', name, phone: '+998901234567', locale: 'uz', consent: true })
      .expect(201)

  it('lets only the administrator read the log, filtered by section, user, text and time', async () => {
    await lead('Bek')
    const [{ id }] = await db().query(`SELECT id FROM leads`)
    await marketing.patch(`/api/admin/leads/${id}`).send({ status: 'done' }).expect(200)

    await marketing.get('/api/admin/audit').expect(403)
    const all = await admin.get('/api/admin/audit').expect(200)
    expect(all.body.items.map((e: { action: string }) => e.action)).toEqual(
      expect.arrayContaining(['auth.login', 'leads.update']),
    )

    const leads = await admin.get('/api/admin/audit?section=leads').expect(200)
    expect(leads.body.items).toMatchObject([
      { action: 'leads.update', userEmail: 'marketing@autodoc.uz', summary: 'Заявка №1' },
    ])
    const byText = await admin.get(`/api/admin/audit?q=${encodeURIComponent('№1')}`).expect(200)
    expect(byText.body.total).toBe(1)
    const byEntity = await admin.get(`/api/admin/audit?q=${id}`).expect(200)
    expect(byEntity.body.total).toBe(1)
    const future = new Date(Date.now() + DAY).toISOString()
    expect((await admin.get(`/api/admin/audit?from=${future}`).expect(200)).body.total).toBe(0)
    await admin.get('/api/admin/audit?section=lea%25').expect(400)
  })

  it('deletes what is past its period every night, and logs the run', async () => {
    await lead('Eski')
    await lead('Yangi')
    const pdf = Buffer.from('%PDF-1.4\n%%EOF')
    for (const name of ['Old', 'New']) {
      await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('X-Forwarded-For', nextIp())
        .field('name', name)
        .field('phone', '+998901234567')
        .field('locale', 'uz')
        .field('consent', 'on')
        .attach('resume', pdf, 'cv.pdf')
        .expect(201)
    }
    const now = new Date()
    const ago = (days: number) => new Date(now.getTime() - days * DAY)
    await db().query(`UPDATE leads SET updated_at = $1 WHERE name = 'Eski'`, [ago(800)])
    await db().query(`UPDATE applications SET updated_at = $1 WHERE name = 'Old'`, [ago(400)])
    await db().query(`UPDATE audit_log SET created_at = $1 WHERE action = 'auth.login'`, [ago(400)])
    await db().query(
      `INSERT INTO stats_views (view_id, day, visitor, path, locale, source, device)
       VALUES (gen_random_uuid(), $1, repeat('a', 32), '/', 'uz', 'direct', 'mobile'),
              (gen_random_uuid(), $2, repeat('b', 32), '/', 'uz', 'direct', 'mobile')`,
      [ago(420).toISOString().slice(0, 10), now.toISOString().slice(0, 10)],
    )
    const resumes = async () =>
      (await readdir(join(storageDirOf(app), 'private', 'resumes'), { recursive: true })).filter(
        (file) => file.endsWith('.pdf'),
      ).length
    expect(await resumes()).toBe(2)

    const result = await app.get(RetentionService).run(now)
    expect(result).toEqual({ applications: 1, leads: 1, audit: 2, stats: 1 })
    expect(
      (await db().query(`SELECT name FROM leads`)).map((r: { name: string }) => r.name),
    ).toEqual(['Yangi'])
    expect(
      (await db().query(`SELECT name FROM applications`)).map((r: { name: string }) => r.name),
    ).toEqual(['New'])
    expect(await resumes()).toBe(1)
    const [run] = await db().query(
      `SELECT user_email, meta FROM audit_log WHERE action = 'retention.run'`,
    )
    expect(run).toEqual({ user_email: 'system', meta: result })

    // Nothing left to do: no second entry.
    expect(await app.get(RetentionService).run(now)).toEqual({
      applications: 0,
      leads: 0,
      audit: 0,
      stats: 0,
    })
    expect(
      (await db().query(`SELECT 1 FROM audit_log WHERE action = 'retention.run'`)).length,
    ).toBe(1)
  })
})

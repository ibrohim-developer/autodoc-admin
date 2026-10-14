import type { NestExpressApplication } from '@nestjs/platform-express'
import request from 'supertest'
import { createTestApp, createUser, login, nextIp, PASSWORD, resetDatabase } from './test-app.js'

describe('users and roles', () => {
  let app: NestExpressApplication

  beforeAll(async () => {
    app = await createTestApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(async () => {
    await resetDatabase(app)
  })

  const http = () => request(app.getHttpServer())
  const tokenOf = (link: string) => link.split('#')[1] ?? ''

  it('invites a user who sets a password through the link and can then log in', async () => {
    await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    const admin = await login(app, 'admin@autodoc.uz')

    const invited = await admin
      .post('/api/admin/users')
      .send({ email: 'New.HR@autodoc.uz', name: 'Новый HR', role: 'hr' })
      .expect(201)
    expect(invited.body.user).toMatchObject({ email: 'new.hr@autodoc.uz', status: 'invited' })
    expect(invited.body.link).toMatch(/^http:\/\/admin\.test\/set-password#.{40,}$/)

    const token = tokenOf(invited.body.link)
    const inspected = await http()
      .post('/api/admin/auth/password-token/inspect')
      .send({ token })
      .expect(200)
    expect(inspected.body).toEqual({
      email: 'new.hr@autodoc.uz',
      name: 'Новый HR',
      purpose: 'invite',
    })

    await http()
      .post('/api/admin/auth/password-token/use')
      .send({ token, password: 'short' })
      .expect(400)
    await http()
      .post('/api/admin/auth/password-token/use')
      .send({ token, password: 'Hr-Password-2026' })
      .expect(204)
    await http()
      .post('/api/admin/auth/password-token/use')
      .send({ token, password: 'Another-Password-1' })
      .expect(410)

    await login(app, 'new.hr@autodoc.uz', 'Hr-Password-2026')
    const list = await admin.get('/api/admin/users').expect(200)
    expect(
      list.body.items.find((u: { email: string }) => u.email === 'new.hr@autodoc.uz').status,
    ).toBe('active')
  })

  it('refuses a second account with the same email', async () => {
    await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    const admin = await login(app, 'admin@autodoc.uz')
    const res = await admin
      .post('/api/admin/users')
      .send({ email: 'ADMIN@autodoc.uz', name: 'Copy', role: 'hr' })
      .expect(409)
    expect(res.body.code).toBe('email_taken')
  })

  it('lets marketing invite marketing and HR, but not administrators', async () => {
    await createUser(app, { email: 'marketing@autodoc.uz', role: 'marketing' })
    const marketing = await login(app, 'marketing@autodoc.uz')

    await marketing
      .post('/api/admin/users')
      .send({ email: 'hr@autodoc.uz', name: 'HR', role: 'hr' })
      .expect(201)
    await marketing
      .post('/api/admin/users')
      .send({ email: 'm2@autodoc.uz', name: 'M2', role: 'marketing' })
      .expect(201)
    const res = await marketing
      .post('/api/admin/users')
      .send({ email: 'boss@autodoc.uz', name: 'Boss', role: 'admin' })
      .expect(403)
    expect(res.body.code).toBe('role_not_allowed')

    const list = await marketing.get('/api/admin/users').expect(200)
    expect(list.body.assignableRoles.map((r: { value: string }) => r.value)).toEqual([
      'marketing',
      'hr',
    ])
  })

  it('stops marketing from touching administrator accounts', async () => {
    const admin = await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    await createUser(app, { email: 'marketing@autodoc.uz', role: 'marketing' })
    const marketing = await login(app, 'marketing@autodoc.uz')

    await marketing.patch(`/api/admin/users/${admin.id}`).send({ isActive: false }).expect(403)
    await marketing.post(`/api/admin/users/${admin.id}/reset-link`).expect(403)
    await marketing.post(`/api/admin/users/${admin.id}/reset-2fa`).expect(403)
  })

  it('keeps user management and the audit log away from HR', async () => {
    await createUser(app, { email: 'hr@autodoc.uz', role: 'hr' })
    const hr = await login(app, 'hr@autodoc.uz')

    await hr.get('/api/admin/users').expect(403)
    await hr
      .post('/api/admin/users')
      .send({ email: 'x@autodoc.uz', name: 'X', role: 'hr' })
      .expect(403)
    await hr.get('/api/admin/audit').expect(403)
  })

  it('keeps the audit log away from marketing', async () => {
    await createUser(app, { email: 'marketing@autodoc.uz', role: 'marketing' })
    const marketing = await login(app, 'marketing@autodoc.uz')
    await marketing.get('/api/admin/audit').expect(403)
  })

  it('ends every session of a user the moment they are disabled', async () => {
    await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    const target = await createUser(app, { email: 'hr@autodoc.uz', role: 'hr' })
    const admin = await login(app, 'admin@autodoc.uz')
    const hr = await login(app, 'hr@autodoc.uz')

    await hr.get('/api/admin/auth/me').expect(200)
    await admin.patch(`/api/admin/users/${target.id}`).send({ isActive: false }).expect(200)
    await hr.get('/api/admin/auth/me').expect(401)
    await http()
      .post('/api/admin/auth/login')
      .set('X-Forwarded-For', nextIp())
      .send({ email: 'hr@autodoc.uz', password: PASSWORD })
      .expect(401)
  })

  it('applies a role change on the next request', async () => {
    await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    const target = await createUser(app, { email: 'staff@autodoc.uz', role: 'hr' })
    const admin = await login(app, 'admin@autodoc.uz')
    const staff = await login(app, 'staff@autodoc.uz')

    await staff.get('/api/admin/users').expect(403)
    await admin.patch(`/api/admin/users/${target.id}`).send({ role: 'marketing' }).expect(200)
    await staff.get('/api/admin/users').expect(200)
  })

  it("doesn't let anyone change their own role or disable themselves", async () => {
    const admin = await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    const agent = await login(app, 'admin@autodoc.uz')
    await agent.patch(`/api/admin/users/${admin.id}`).send({ role: 'hr' }).expect(403)
    await agent.patch(`/api/admin/users/${admin.id}`).send({ isActive: false }).expect(403)
    await agent.patch(`/api/admin/users/${admin.id}`).send({ name: 'Новое имя' }).expect(200)
  })

  it('makes only the newest reset link work', async () => {
    await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    const target = await createUser(app, { email: 'hr@autodoc.uz', role: 'hr' })
    const admin = await login(app, 'admin@autodoc.uz')

    const first = await admin.post(`/api/admin/users/${target.id}/reset-link`).expect(201)
    const second = await admin.post(`/api/admin/users/${target.id}/reset-link`).expect(201)

    await http()
      .post('/api/admin/auth/password-token/use')
      .send({ token: tokenOf(first.body.link), password: 'First-Password-1' })
      .expect(410)
    await http()
      .post('/api/admin/auth/password-token/use')
      .send({ token: tokenOf(second.body.link), password: 'Second-Password-1' })
      .expect(204)
    await login(app, 'hr@autodoc.uz', 'Second-Password-1')
  })

  it('writes who did what to the audit log', async () => {
    await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    const admin = await login(app, 'admin@autodoc.uz')
    const invited = await admin
      .post('/api/admin/users')
      .send({ email: 'hr@autodoc.uz', name: 'HR', role: 'hr' })
      .expect(201)
    await admin
      .patch(`/api/admin/users/${invited.body.user.id}`)
      .send({ role: 'marketing' })
      .expect(200)

    const log = await admin.get('/api/admin/audit').expect(200)
    const actions = log.body.items.map((entry: { action: string }) => entry.action)
    expect(actions).toEqual(['users.update', 'users.invite', 'auth.login'])
    expect(log.body.items[0]).toMatchObject({
      userEmail: 'admin@autodoc.uz',
      entityType: 'user',
      entityId: invited.body.user.id,
      summary: 'hr@autodoc.uz: роль: HR → Маркетинг',
    })
    // The visitor's address as nginx forwards it, not the proxy's.
    expect(log.body.items[2].ip).toMatch(/^10\./)
  })
})

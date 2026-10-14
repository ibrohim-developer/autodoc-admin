import type { NestExpressApplication } from '@nestjs/platform-express'
import { generate } from 'otplib'
import request from 'supertest'
import { DataSource } from 'typeorm'
import { RefreshToken } from '../src/users/refresh-token.entity.js'
import {
  ADMIN_ORIGIN,
  cookieValue,
  createTestApp,
  createUser,
  login,
  nextIp,
  nextTotpCode,
  PASSWORD,
  resetDatabase,
} from './test-app.js'

describe('auth', () => {
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

  it('logs in whatever the email case and returns the role and its permissions', async () => {
    await createUser(app, { email: 'hr@autodoc.uz', role: 'hr' })
    const res = await http()
      .post('/api/admin/auth/login')
      .set('X-Forwarded-For', nextIp())
      .send({ email: '  HR@Autodoc.UZ ', password: PASSWORD })
      .expect(200)

    expect(res.body.status).toBe('ok')
    expect(res.body.user).toMatchObject({ email: 'hr@autodoc.uz', role: 'hr', roleLabel: 'HR' })
    expect(res.body.user.permissions).toContain('applications.read')
    expect(res.body.user.permissions).not.toContain('content.write')

    const cookies = res.headers['set-cookie'] as unknown as string[]
    expect(cookies.find((c) => c.startsWith('ad_access='))).toMatch(
      /HttpOnly.*SameSite=Strict|SameSite=Strict.*HttpOnly/,
    )
    expect(cookies.find((c) => c.startsWith('ad_refresh='))).toContain('Path=/api/admin/auth')
  })

  it('answers a wrong password and an unknown email the same way', async () => {
    await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    const wrong = await http()
      .post('/api/admin/auth/login')
      .set('X-Forwarded-For', nextIp())
      .send({ email: 'admin@autodoc.uz', password: 'not-the-password' })
      .expect(401)
    const unknown = await http()
      .post('/api/admin/auth/login')
      .set('X-Forwarded-For', nextIp())
      .send({ email: 'nobody@autodoc.uz', password: 'not-the-password' })
      .expect(401)
    expect(wrong.body).toEqual(unknown.body)
  })

  it('locks the account for 15 minutes after five wrong passwords', async () => {
    await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    for (let i = 0; i < 5; i++) {
      await http()
        .post('/api/admin/auth/login')
        .set('X-Forwarded-For', nextIp())
        .send({ email: 'admin@autodoc.uz', password: 'wrong-password' })
        .expect(401)
    }
    const locked = await http()
      .post('/api/admin/auth/login')
      .set('X-Forwarded-For', nextIp())
      .send({ email: 'admin@autodoc.uz', password: PASSWORD })
      .expect(429)
    expect(locked.body.code).toBe('locked')
  })

  it('rate-limits login attempts from one address', async () => {
    const ip = nextIp()
    for (let i = 0; i < 10; i++) {
      await http()
        .post('/api/admin/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email: `nobody${i}@autodoc.uz`, password: 'x' })
        .expect(401)
    }
    await http()
      .post('/api/admin/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: 'nobody@autodoc.uz', password: 'x' })
      .expect(429)
  })

  it('refuses admin requests without a session', async () => {
    const res = await http().get('/api/admin/auth/me').expect(401)
    expect(res.body.code).toBe('unauthorized')
  })

  it('rotates the refresh token and keeps the session going', async () => {
    await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    const agent = await login(app, 'admin@autodoc.uz')

    const res = await agent.post('/api/admin/auth/refresh').expect(200)
    expect(res.body.user.email).toBe('admin@autodoc.uz')
    expect(cookieValue(res.headers['set-cookie'], 'ad_refresh')).toBeTruthy()
    await agent.get('/api/admin/auth/me').expect(200)
  })

  it('treats an old refresh token coming back later as stolen and ends that login', async () => {
    await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    const first = await http()
      .post('/api/admin/auth/login')
      .set('X-Forwarded-For', nextIp())
      .send({ email: 'admin@autodoc.uz', password: PASSWORD })
      .expect(200)
    const oldRefresh = cookieValue(first.headers['set-cookie'], 'ad_refresh')

    const rotated = await http()
      .post('/api/admin/auth/refresh')
      .set('Cookie', `ad_refresh=${oldRefresh}`)
      .expect(200)
    const newRefresh = cookieValue(rotated.headers['set-cookie'], 'ad_refresh')

    // Within 30 seconds a replay is a second tab losing the race, not an attack.
    const stale = await http()
      .post('/api/admin/auth/refresh')
      .set('Cookie', `ad_refresh=${oldRefresh}`)
      .expect(401)
    expect(stale.body.code).toBe('stale_session')

    // Later, it is: the whole family dies, including the token the real user holds.
    await app
      .get(DataSource)
      .getRepository(RefreshToken)
      .query(
        `UPDATE refresh_tokens SET revoked_at = now() - interval '5 minutes' WHERE revoked_at IS NOT NULL`,
      )
    await http()
      .post('/api/admin/auth/refresh')
      .set('Cookie', `ad_refresh=${oldRefresh}`)
      .expect(401)
    await http()
      .post('/api/admin/auth/refresh')
      .set('Cookie', `ad_refresh=${newRefresh}`)
      .expect(401)
  })

  it('logout ends the session at once, including the unexpired access token', async () => {
    await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    const res = await http()
      .post('/api/admin/auth/login')
      .set('X-Forwarded-For', nextIp())
      .send({ email: 'admin@autodoc.uz', password: PASSWORD })
      .expect(200)
    const access = cookieValue(res.headers['set-cookie'], 'ad_access')
    const refresh = cookieValue(res.headers['set-cookie'], 'ad_refresh')

    await http().get('/api/admin/auth/me').set('Cookie', `ad_access=${access}`).expect(200)
    await http().post('/api/admin/auth/logout').set('Cookie', `ad_refresh=${refresh}`).expect(204)
    await http().get('/api/admin/auth/me').set('Cookie', `ad_access=${access}`).expect(401)
  })

  it('rejects changes sent from another site', async () => {
    await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    const agent = await login(app, 'admin@autodoc.uz')
    const res = await agent
      .post('/api/admin/users')
      .set('Origin', 'https://evil.example')
      .send({ email: 'x@autodoc.uz', name: 'X', role: 'hr' })
      .expect(403)
    expect(res.body.code).toBe('bad_origin')

    await agent
      .post('/api/admin/users')
      .set('Origin', ADMIN_ORIGIN)
      .send({ email: 'x@autodoc.uz', name: 'X', role: 'hr' })
      .expect(201)
  })

  it('changes the password, keeping this login and ending the others', async () => {
    await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    const here = await login(app, 'admin@autodoc.uz')
    const elsewhere = await login(app, 'admin@autodoc.uz')

    await here
      .post('/api/admin/auth/password')
      .send({ currentPassword: 'wrong', newPassword: 'New-Password-123' })
      .expect(400)
    await here
      .post('/api/admin/auth/password')
      .send({ currentPassword: PASSWORD, newPassword: 'New-Password-123' })
      .expect(204)

    await here.get('/api/admin/auth/me').expect(200)
    await elsewhere.get('/api/admin/auth/me').expect(401)
    await login(app, 'admin@autodoc.uz', 'New-Password-123')
  })

  describe('two-factor authentication', () => {
    async function enable(agent: Awaited<ReturnType<typeof login>>) {
      const setup = await agent.post('/api/admin/auth/2fa/setup').expect(200)
      expect(setup.body.uri).toMatch(/^otpauth:\/\/totp\//)
      expect(setup.body.qr).toMatch(/^data:image\/png;base64,/)
      // The current window's code; a later login then uses the next window's.
      const enabled = await agent
        .post('/api/admin/auth/2fa/enable')
        .send({ code: await generate({ secret: setup.body.secret }) })
        .expect(200)
      return {
        secret: setup.body.secret as string,
        recoveryCodes: enabled.body.recoveryCodes as string[],
      }
    }

    it('asks for the code after the password once enabled', async () => {
      await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
      const { secret, recoveryCodes } = await enable(await login(app, 'admin@autodoc.uz'))
      expect(recoveryCodes).toHaveLength(10)

      const ip = nextIp()
      const step1 = await http()
        .post('/api/admin/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email: 'admin@autodoc.uz', password: PASSWORD })
        .expect(200)
      expect(step1.body).toEqual({ status: 'two_factor_required' })
      expect(step1.headers['set-cookie']).toBeUndefined()

      await http()
        .post('/api/admin/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email: 'admin@autodoc.uz', password: PASSWORD, code: '000000' })
        .expect(401)

      // Not the code that enabled 2FA: that one is spent.
      const code = await nextTotpCode(secret)
      const ok = await http()
        .post('/api/admin/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email: 'admin@autodoc.uz', password: PASSWORD, code })
        .expect(200)
      expect(ok.body.user.totpEnabled).toBe(true)
    })

    it('accepts each recovery code once', async () => {
      await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
      const { recoveryCodes } = await enable(await login(app, 'admin@autodoc.uz'))
      const code = recoveryCodes[0]?.toUpperCase()

      await http()
        .post('/api/admin/auth/login')
        .set('X-Forwarded-For', nextIp())
        .send({ email: 'admin@autodoc.uz', password: PASSWORD, code })
        .expect(200)
      await http()
        .post('/api/admin/auth/login')
        .set('X-Forwarded-For', nextIp())
        .send({ email: 'admin@autodoc.uz', password: PASSWORD, code })
        .expect(401)
    })

    it('turns off only with the password', async () => {
      await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
      const agent = await login(app, 'admin@autodoc.uz')
      await enable(agent)

      await agent.post('/api/admin/auth/2fa/disable').send({ password: 'wrong' }).expect(400)
      await agent.post('/api/admin/auth/2fa/disable').send({ password: PASSWORD }).expect(204)
      const me = await agent.get('/api/admin/auth/me').expect(200)
      expect(me.body.totpEnabled).toBe(false)
      await login(app, 'admin@autodoc.uz')
    })
  })
})

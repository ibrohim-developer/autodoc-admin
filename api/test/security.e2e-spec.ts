import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import request from 'supertest'
import {
  createTestApp,
  createUser,
  login,
  resetDatabase,
  storageDirOf,
  type TestApp,
} from './test-app.js'

/** Express's route table: every method + path the app answers. */
function routes(app: TestApp): { method: string; path: string }[] {
  const router = app.getHttpAdapter().getInstance().router as {
    stack: { route?: { path: string; methods: Record<string, boolean> } }[]
  }
  return router.stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route?.methods ?? {}).map((method) => ({
        method,
        path: layer.route?.path ?? '',
      })),
    )
}

/** Anyone may call these without a session (login, invite links, logout). */
const PUBLIC_ADMIN = [
  'post /api/admin/auth/login',
  'post /api/admin/auth/refresh',
  'post /api/admin/auth/logout',
  'post /api/admin/auth/password-token/inspect',
  'post /api/admin/auth/password-token/use',
]

describe('security', () => {
  let app: TestApp

  beforeAll(async () => {
    app = await createTestApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(async () => {
    await resetDatabase(app)
  })

  it('refuses every admin route without a session', async () => {
    const admin = routes(app).filter((route) => route.path.startsWith('/api/admin/'))
    expect(admin.length).toBeGreaterThan(50)
    for (const { method, path } of admin) {
      if (PUBLIC_ADMIN.includes(`${method} ${path}`)) continue
      const url = path.replace(/:[a-zA-Z]+/g, '00000000-0000-4000-8000-000000000000')
      const res = await (
        request(app.getHttpServer()) as unknown as Record<string, (u: string) => request.Test>
      )[method]?.(url)
      expect({ route: `${method} ${path}`, status: res?.status }).toEqual({
        route: `${method} ${path}`,
        status: 401,
      })
    }
  })

  it('keeps the site API behind its token', async () => {
    for (const path of [
      '/api/v1/content/post',
      '/api/v1/content/single/site_settings',
      '/api/v1/redirects',
    ]) {
      await request(app.getHttpServer()).get(path).expect(401)
    }
  })

  it('never serves private storage, whatever the path', async () => {
    const privateDir = join(storageDirOf(app), 'private', 'resumes')
    await mkdir(privateDir, { recursive: true })
    await writeFile(join(privateDir, 'secret.pdf'), '%PDF-secret')
    for (const path of [
      '/media/../private/resumes/secret.pdf',
      '/media/%2e%2e/private/resumes/secret.pdf',
      '/media/..%2fprivate%2fresumes%2fsecret.pdf',
      '/private/resumes/secret.pdf',
    ]) {
      const res = await request(app.getHttpServer()).get(path)
      expect(res.status, path).not.toBe(200)
      expect(res.text ?? '').not.toContain('%PDF-secret')
    }
  })

  it('sends security headers, and admin answers are never cached', async () => {
    await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    const agent = await login(app, 'admin@autodoc.uz')
    const res = await agent.get('/api/admin/auth/me').expect(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.headers.etag).toBeUndefined()
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(res.headers['permissions-policy']).toContain('camera=()')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('refuses admin changes sent from another site', async () => {
    await createUser(app, { email: 'admin@autodoc.uz', role: 'admin' })
    const agent = await login(app, 'admin@autodoc.uz')
    const res = await agent
      .post('/api/admin/users')
      .set('Origin', 'https://evil.example')
      .send({ email: 'x@autodoc.uz', name: 'X', role: 'admin' })
      .expect(403)
    expect(res.body.code).toBe('bad_origin')
  })
})

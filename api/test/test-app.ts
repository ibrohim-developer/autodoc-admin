import { randomBytes } from 'node:crypto'
import { mkdtemp } from 'node:fs/promises'
import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { generate } from 'otplib'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent.js'
import { DataSource } from 'typeorm'
import { inject } from 'vitest'
import { hashPassword } from '../src/auth/password.js'
import type { Role } from '../src/auth/permissions.js'
import { User } from '../src/users/user.entity.js'

export const ADMIN_ORIGIN = 'http://admin.test'
export const PASSWORD = 'Correct-Horse-42'
export const SITE_API_TOKEN = 'site-token-for-tests-site-token-for-tests'
export const REVALIDATE_SECRET = 'revalidate-secret-for-tests-revalidate'
export const PREVIEW_SECRET = 'preview-secret-for-tests-preview-secret'

export type TestApp = NestExpressApplication

/**
 * Boots the real app (same guards, pipes and middleware as production) against the e2e
 * database, with uploads in a throwaway folder. The environment is set before AppModule is
 * imported, because ConfigModule validates it at import time.
 */
export async function createTestApp(env: Record<string, string> = {}): Promise<TestApp> {
  const storageDir = await mkdtemp(join(inject('storageRoot'), 'run-'))
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: inject('databaseUrl'),
    JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
    DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    ADMIN_ORIGIN,
    COOKIE_SECURE: 'false',
    SWAGGER: 'false',
    DASHBOARD_DIST: 'no-dashboard-in-tests',
    STORAGE_DIR: storageDir,
    SITE_ORIGIN: 'http://site.test',
    // Nothing listens here unless a test passes its own fake site.
    SITE_INTERNAL_URL: 'http://127.0.0.1:9',
    TELEGRAM_API_URL: 'http://127.0.0.1:9',
    HH_API_URL: 'http://127.0.0.1:9',
    SITE_API_TOKEN,
    REVALIDATE_SECRET,
    PREVIEW_SECRET,
    ...env,
  })
  const { AppModule } = await import('../src/app.module.js')
  const { configureApp } = await import('../src/app.setup.js')

  // NestFactory, exactly like main.ts. Test.createTestingModule compiles the modules before the
  // HTTP adapter exists, so ServeStaticModule would silently serve nothing (no /media).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false })
  configureApp(app)
  await app.init()
  return app
}

/** The app's upload folder (a temporary one, deleted with the whole run). */
export function storageDirOf(app: TestApp): string {
  return app.get(ConfigService).get('STORAGE_DIR') as string
}

export async function resetDatabase(app: NestExpressApplication): Promise<void> {
  await app
    .get(DataSource)
    .query(
      'TRUNCATE users, refresh_tokens, password_tokens, audit_log, documents, document_versions, media, media_usages, leads, applications, form_hits, app_settings, stats_views, stats_salts RESTART IDENTITY CASCADE',
    )
}

export async function createUser(
  app: NestExpressApplication,
  {
    email,
    role,
    password = PASSWORD,
    name = 'Test User',
  }: {
    email: string
    role: Role
    password?: string
    name?: string
  },
): Promise<User> {
  const users = app.get(DataSource).getRepository(User)
  return users.save(
    users.create({
      email,
      name,
      role,
      passwordHash: await hashPassword(password),
      passwordChangedAt: new Date(),
    }),
  )
}

let ipCounter = 0
/** Each login comes from its own address, so per-IP rate limits don't leak between tests. */
export function nextIp(): string {
  ipCounter += 1
  return `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`
}

export async function login(
  app: NestExpressApplication,
  email: string,
  password = PASSWORD,
): Promise<TestAgent> {
  const agent = request.agent(app.getHttpServer())
  await agent
    .post('/api/admin/auth/login')
    .set('X-Forwarded-For', nextIp())
    .send({ email, password })
    .expect(200)
  return agent
}

/** A valid code from the next 30-second window: verify allows one step of drift, and it's never the code just used. */
export function nextTotpCode(secret: string): Promise<string> {
  return generate({ secret, epoch: Math.floor(Date.now() / 1000) + 30 })
}

export function cookieValue(setCookie: string | string[] | undefined, name: string): string | null {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
  for (const cookie of list) {
    const [pair] = cookie.split(';')
    const [key, ...value] = (pair ?? '').split('=')
    if (key === name) return value.join('=')
  }
  return null
}

export type SiteCall = { path: string; secret: string | undefined; tags: string[] }

/** What the fake site's /api/texts/ answers: its default texts, per language. */
export const SITE_TEXTS = {
  uz: {
    Hero: { title: 'Raqamli kelajak', more: 'Batafsil' },
    Blog: { shareOn: '{network} orqali ulashish' },
  },
  ru: {
    Hero: { title: 'Цифровое будущее', more: 'Подробнее' },
    Blog: { shareOn: 'Поделиться в {network}' },
  },
  en: {
    Hero: { title: 'Digital future', more: 'Details' },
    Blog: { shareOn: 'Share on {network}' },
  },
}

/**
 * Stands in for the Next.js site: records every /api/revalidate call the API makes, and serves
 * its default texts at /api/texts/ to callers with the site token.
 */
export async function startFakeSite(): Promise<{
  url: string
  calls: SiteCall[]
  waitFor: (predicate: (call: SiteCall) => boolean, timeoutMs?: number) => Promise<SiteCall>
  close: () => Promise<void>
}> {
  const calls: SiteCall[] = []
  const readBody = (req: IncomingMessage) =>
    new Promise<string>((resolve) => {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
      })
      req.on('end', () => resolve(body))
    })
  const server = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/api/texts/') {
      const allowed = req.headers['x-site-token'] === SITE_API_TOKEN
      res
        .writeHead(allowed ? 200 : 401, { 'content-type': 'application/json' })
        .end(JSON.stringify(allowed ? SITE_TEXTS : { error: 'unauthorized' }))
      return
    }
    const body = await readBody(req)
    const parsed = body ? (JSON.parse(body) as { tags?: string[] }) : {}
    calls.push({
      path: req.url ?? '',
      secret: req.headers['x-revalidate-secret'] as string | undefined,
      tags: parsed.tags ?? [],
    })
    res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${port}`,
    calls,
    async waitFor(predicate, timeoutMs = 3_000) {
      const started = Date.now()
      while (Date.now() - started < timeoutMs) {
        const found = calls.find(predicate)
        if (found) return found
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      throw new Error(`No matching site call. Seen: ${JSON.stringify(calls)}`)
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}

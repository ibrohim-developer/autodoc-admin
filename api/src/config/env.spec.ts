import { validateEnv } from './env.js'

const valid = {
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5433/autodoc',
  JWT_ACCESS_SECRET: 'x'.repeat(40),
  DATA_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  ADMIN_ORIGIN: 'http://localhost:5173',
  SITE_API_TOKEN: 's'.repeat(40),
  REVALIDATE_SECRET: 'r'.repeat(40),
  PREVIEW_SECRET: 'p'.repeat(40),
}

describe('validateEnv', () => {
  it('fills defaults and converts types', () => {
    const env = validateEnv({ ...valid, PORT: '4100', COOKIE_SECURE: 'false' })
    expect(env.PORT).toBe(4100)
    expect(env.COOKIE_SECURE).toBe(false)
    expect(env.HOST).toBe('127.0.0.1')
    expect(env.NODE_ENV).toBe('development')
  })

  it('keeps cookies secure unless told otherwise', () => {
    expect(validateEnv(valid).COOKIE_SECURE).toBe(true)
  })

  it('names every problem at once', () => {
    expect(() =>
      validateEnv({ ...valid, JWT_ACCESS_SECRET: 'short', DATA_ENCRYPTION_KEY: 'c2hvcnQ=' }),
    ).toThrow(/JWT_ACCESS_SECRET[\s\S]*DATA_ENCRYPTION_KEY: must be 32 bytes/)
  })

  it('requires the database URL', () => {
    const { DATABASE_URL: _, ...rest } = valid
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/)
  })
})

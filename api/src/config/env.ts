import { plainToInstance, Transform } from 'class-transformer'
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator'

const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1'
const toInt = ({ value }: { value: unknown }) => (typeof value === 'string' ? Number(value) : value)

/**
 * Every environment variable the API reads, validated once at startup so a
 * missing or malformed value fails the boot instead of a request.
 */
export class Env {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development'

  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 4000

  /** nginx proxies to this; the port is never exposed directly. */
  @IsString()
  HOST = '127.0.0.1'

  @IsString()
  DATABASE_URL: string

  /** Signs the 15-minute access tokens. */
  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string

  /** 32 random bytes, base64. Encrypts 2FA secrets at rest. */
  @IsString()
  DATA_ENCRYPTION_KEY: string

  /** Origin the dashboard is served from: CSRF origin check and links in invites. */
  @IsUrl({ require_tld: false, require_protocol: true })
  ADMIN_ORIGIN: string

  /** Secure cookies need HTTPS; false only for local http. */
  @Transform(toBoolean)
  @IsBoolean()
  COOKIE_SECURE = true

  @Transform(toBoolean)
  @IsBoolean()
  SWAGGER = false

  /** Built dashboard served at the admin origin. Relative to the api folder. */
  @IsString()
  DASHBOARD_DIST = '../dashboard/dist'

  /** Uploaded files: `public/` is served at /media, `private/` never is. Relative to the api folder. */
  @IsString()
  STORAGE_DIR = 'storage'

  /** Public origin of the site, for preview links. */
  @IsUrl({ require_tld: false, require_protocol: true })
  SITE_ORIGIN = 'http://localhost:3000'

  /** Where the API reaches the site server-to-server (cache refresh after publishing). */
  @IsUrl({ require_tld: false, require_protocol: true })
  SITE_INTERNAL_URL = 'http://127.0.0.1:3000'

  /** The site sends this with every content request (`x-site-token`). Shared with the site. */
  @IsString()
  @MinLength(32)
  SITE_API_TOKEN: string

  /** The API sends this to the site's /api/revalidate. Shared with the site. */
  @IsString()
  @MinLength(32)
  REVALIDATE_SECRET: string

  /** Signs short-lived preview links that open drafts on the site. Shared with the site. */
  @IsString()
  @MinLength(32)
  PREVIEW_SECRET: string

  /** Telegram's Bot API. Tests point it at a fake server. */
  @IsUrl({ require_tld: false, require_protocol: true })
  TELEGRAM_API_URL = 'https://api.telegram.org'
}

export function validateEnv(config: Record<string, unknown>): Env {
  const env = plainToInstance(Env, config, { exposeDefaultValues: true })
  const problems = validateSync(env).map(
    (error) => `${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`,
  )

  if (env.DATA_ENCRYPTION_KEY && Buffer.from(env.DATA_ENCRYPTION_KEY, 'base64').length !== 32) {
    problems.push('DATA_ENCRYPTION_KEY: must be 32 bytes, base64-encoded (openssl rand -base64 32)')
  }
  if (problems.length > 0) {
    throw new Error(`Invalid environment variables:\n  - ${problems.join('\n  - ')}`)
  }
  return env
}

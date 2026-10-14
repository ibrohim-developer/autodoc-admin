import type { DataSourceOptions } from 'typeorm'
import { AuditLog } from '../audit/audit-log.entity.js'
import { ContentDocument } from '../content/document.entity.js'
import { DocumentVersion } from '../content/document-version.entity.js'
import { Application } from '../forms/application.entity.js'
import { Lead } from '../forms/lead.entity.js'
import { AppSetting } from '../integrations/app-setting.entity.js'
import { Media } from '../media/media.entity.js'
import { MediaUsage } from '../media/media-usage.entity.js'
import { PasswordToken } from '../users/password-token.entity.js'
import { RefreshToken } from '../users/refresh-token.entity.js'
import { User } from '../users/user.entity.js'
import { InitAuth1791849600000 } from './migrations/1791849600000-init-auth.js'
import { ContentCore1791853200000 } from './migrations/1791853200000-content-core.js'
import { Forms1791856800000 } from './migrations/1791856800000-forms.js'

/**
 * Entities and migrations are listed explicitly rather than globbed: ESM has no
 * `require`, and an explicit list can't silently miss a file.
 *
 * Migrations are hand-written SQL and run on boot, so a deploy is "build and
 * restart". Don't use `migration:generate`: index names here don't follow
 * TypeORM's generated ones and it would emit noise.
 */
export const ENTITIES = [
  User,
  RefreshToken,
  PasswordToken,
  AuditLog,
  ContentDocument,
  DocumentVersion,
  Media,
  MediaUsage,
  Lead,
  Application,
  AppSetting,
]

export const MIGRATIONS = [InitAuth1791849600000, ContentCore1791853200000, Forms1791856800000]

export function typeOrmOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    migrationsRun: true,
    migrationsTransactionMode: 'each',
    synchronize: false,
    logging: ['error', 'warn', 'migration'],
  }
}

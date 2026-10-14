import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { ServeStaticModule, type ServeStaticModuleOptions } from '@nestjs/serve-static'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditInterceptor } from './audit/audit.interceptor.js'
import { AuditModule } from './audit/audit.module.js'
import { AuthGuard } from './auth/auth.guard.js'
import { AuthModule } from './auth/auth.module.js'
import { PermissionGuard } from './auth/permission.guard.js'
import { type Env, validateEnv } from './config/env.js'
import { ContentModule } from './content/content.module.js'
import { ContentTypesModule } from './content/content-types.module.js'
import { typeOrmOptions } from './database/typeorm.config.js'
import { FormsModule } from './forms/forms.module.js'
import { HealthController } from './health/health.controller.js'
import { HomeModule } from './home/home.module.js'
import { IntegrationsModule } from './integrations/integrations.module.js'
import { MediaModule } from './media/media.module.js'
import { SiteContentModule } from './site-content/site-content.module.js'
import { StatsModule } from './stats/stats.module.js'
import { TrashModule } from './trash/trash.module.js'
import { UsersModule } from './users/users.module.js'

const IMMUTABLE = 'public, max-age=31536000, immutable'

/**
 * Uploaded photos at /media (file names carry the photo's id and width and never change), and
 * in production the built dashboard, with every other non-API path falling back to index.html
 * for client-side routing. In production nginx serves /media on the public site itself; this
 * covers the admin origin and development.
 */
function staticRoots(config: ConfigService<Env, true>): ServeStaticModuleOptions[] {
  const mediaPath = join(resolve(config.get('STORAGE_DIR', { infer: true })), 'public', 'media')
  mkdirSync(mediaPath, { recursive: true })
  const roots: ServeStaticModuleOptions[] = [
    {
      rootPath: mediaPath,
      serveRoot: '/media',
      // A missing photo is a 404, not the dashboard's index.html.
      serveStaticOptions: {
        fallthrough: false,
        index: false,
        setHeaders: (res) => res.setHeader('Cache-Control', IMMUTABLE),
      },
    },
  ]

  const dashboard = resolve(config.get('DASHBOARD_DIST', { infer: true }))
  if (existsSync(join(dashboard, 'index.html'))) {
    roots.push({
      rootPath: dashboard,
      exclude: ['/api/{*path}', '/media/{*path}'],
      serveStaticOptions: {
        setHeaders: (res, path) => {
          // Vite fingerprints everything under assets/; index.html must always be revalidated.
          res.setHeader('Cache-Control', /[\\/]assets[\\/]/.test(path) ? IMMUTABLE : 'no-cache')
        },
      },
    })
  }
  return roots
}

const isTest = process.env.NODE_ENV === 'test'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // Tests set their own variables; reading api/.env could point them at the dev database.
      ignoreEnvFile: isTest,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        typeOrmOptions(config.get('DATABASE_URL', { infer: true })),
    }),
    // A generous default for the dashboard; sensitive routes set their own limits.
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }] }),
    // Scheduled publishing and the nightly cleanups. Tests call those jobs directly.
    ...(isTest ? [] : [ScheduleModule.forRoot()]),
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: staticRoots,
    }),
    ContentTypesModule,
    SiteContentModule,
    AuditModule,
    UsersModule,
    AuthModule,
    MediaModule,
    ContentModule,
    IntegrationsModule,
    FormsModule,
    StatsModule,
    HomeModule,
    TrashModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate limit, then who you are, then what you may do.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}

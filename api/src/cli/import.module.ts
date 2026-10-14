import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module.js'
import { type Env, validateEnv } from '../config/env.js'
import { ContentModule } from '../content/content.module.js'
import { ContentTypesModule } from '../content/content-types.module.js'
import { typeOrmOptions } from '../database/typeorm.config.js'
import { MediaModule } from '../media/media.module.js'
import { SiteContentModule } from '../site-content/site-content.module.js'
import { UsersModule } from '../users/users.module.js'

/** The content engine without the HTTP server or the scheduler: for the one-time import. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        typeOrmOptions(config.get('DATABASE_URL', { infer: true })),
    }),
    ContentTypesModule,
    SiteContentModule,
    AuditModule,
    UsersModule,
    MediaModule,
    ContentModule,
  ],
})
export class ImportModule {}

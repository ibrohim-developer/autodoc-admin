import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { type Env, validateEnv } from '../config/env.js'
import { typeOrmOptions } from '../database/typeorm.config.js'
import { UsersModule } from '../users/users.module.js'

/** Just enough of the app for server-side commands: config, database, users. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        typeOrmOptions(config.get('DATABASE_URL', { infer: true })),
    }),
    UsersModule,
  ],
})
export class CliModule {}

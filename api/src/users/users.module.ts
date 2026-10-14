import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module.js'
import type { Env } from '../config/env.js'
import { PasswordToken } from './password-token.entity.js'
import { RefreshToken } from './refresh-token.entity.js'
import { ACCESS_TTL_SECONDS, SessionsService } from './sessions.service.js'
import { User } from './user.entity.js'
import { UsersController } from './users.controller.js'
import { UsersService } from './users.service.js'

const JWT_ISSUER = 'autodoc-admin'
const JWT_AUDIENCE = 'dashboard'

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, PasswordToken]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: ACCESS_TTL_SECONDS,
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        },
        verifyOptions: { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
      }),
    }),
    AuditModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, SessionsService],
  exports: [UsersService, SessionsService],
})
export class UsersModule {}

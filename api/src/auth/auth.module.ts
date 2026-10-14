import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module.js'
import { UsersModule } from '../users/users.module.js'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { TotpService } from './totp.service.js'

@Module({
  imports: [UsersModule, AuditModule],
  controllers: [AuthController],
  providers: [AuthService, TotpService],
})
export class AuthModule {}

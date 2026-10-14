import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module.js'
import { AppSetting } from './app-setting.entity.js'
import { IntegrationsController } from './integrations.controller.js'
import { IntegrationsService } from './integrations.service.js'
import { TelegramService } from './telegram.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([AppSetting]), AuditModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, TelegramService],
  exports: [TelegramService, IntegrationsService],
})
export class IntegrationsModule {}

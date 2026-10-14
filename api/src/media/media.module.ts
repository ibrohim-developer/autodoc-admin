import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module.js'
import { MediaController } from './media.controller.js'
import { Media } from './media.entity.js'
import { MediaService } from './media.service.js'
import { MediaUsage } from './media-usage.entity.js'

@Module({
  imports: [TypeOrmModule.forFeature([Media, MediaUsage]), AuditModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}

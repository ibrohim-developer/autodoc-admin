import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module.js'
import { MediaModule } from '../media/media.module.js'
import { User } from '../users/user.entity.js'
import { ContentDocument } from './document.entity.js'
import { DocumentVersion } from './document-version.entity.js'
import { DocumentsController } from './documents.controller.js'
import { DocumentsService } from './documents.service.js'
import { PublicContentController } from './public-content.controller.js'
import { PublishScheduler } from './publish.scheduler.js'
import { SiteRevalidationService } from './site-revalidation.service.js'
import { SiteTokenGuard } from './site-token.guard.js'

@Module({
  imports: [
    TypeOrmModule.forFeature([ContentDocument, DocumentVersion, User]),
    AuditModule,
    MediaModule,
  ],
  controllers: [DocumentsController, PublicContentController],
  providers: [DocumentsService, SiteRevalidationService, SiteTokenGuard, PublishScheduler],
  exports: [DocumentsService, SiteRevalidationService],
})
export class ContentModule {}

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module.js'
import { ContentDocument } from '../content/document.entity.js'
import { IntegrationsModule } from '../integrations/integrations.module.js'
import { User } from '../users/user.entity.js'
import { Application } from './application.entity.js'
import { ApplicationsController } from './applications.controller.js'
import { ApplicationsService } from './applications.service.js'
import { FormLimitsService } from './form-limits.service.js'
import { Lead } from './lead.entity.js'
import { LeadsController } from './leads.controller.js'
import { LeadsService } from './leads.service.js'
import { PublicFormsController } from './public-forms.controller.js'
import { SiteOriginGuard } from './site-origin.guard.js'

/** The site's forms: submissions ("Заявки") and job applications ("Отклики"). */
@Module({
  imports: [
    TypeOrmModule.forFeature([Lead, Application, ContentDocument, User]),
    AuditModule,
    IntegrationsModule,
  ],
  controllers: [PublicFormsController, LeadsController, ApplicationsController],
  providers: [LeadsService, ApplicationsService, FormLimitsService, SiteOriginGuard],
  exports: [LeadsService, ApplicationsService],
})
export class FormsModule {}

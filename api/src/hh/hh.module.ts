import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module.js'
import { ContentModule } from '../content/content.module.js'
import { ContentDocument } from '../content/document.entity.js'
import { IntegrationsModule } from '../integrations/integrations.module.js'
import { User } from '../users/user.entity.js'
import { HhController } from './hh.controller.js'
import { HhService } from './hh.service.js'

/** Stage 7: vacancies from hh.uz. */
@Module({
  imports: [
    TypeOrmModule.forFeature([ContentDocument, User]),
    AuditModule,
    ContentModule,
    IntegrationsModule,
  ],
  controllers: [HhController],
  providers: [HhService],
})
export class HhModule {}

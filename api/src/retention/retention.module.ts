import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module.js'
import { FormsModule } from '../forms/forms.module.js'
import { StatsModule } from '../stats/stats.module.js'
import { RetentionService } from './retention.service.js'

@Module({
  imports: [AuditModule, FormsModule, StatsModule],
  providers: [RetentionService],
})
export class RetentionModule {}

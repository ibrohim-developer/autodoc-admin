import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { AuditService } from '../audit/audit.service.js'
import { ApplicationsService } from '../forms/applications.service.js'
import { LeadsService } from '../forms/leads.service.js'
import { dayOf } from '../stats/classify.js'
import { StatsService } from '../stats/stats.service.js'
import { monthsAgo, RETENTION } from './retention.js'

export type RetentionResult = {
  applications: number
  leads: number
  audit: number
  stats: number
}

/**
 * Personal data and logs are not kept forever: every night what is past its period is deleted
 * for good (backups age out on their own after 8 weeks). Each run that removed something is
 * itself written to the audit log, with the counts.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name)

  constructor(
    private readonly applications: ApplicationsService,
    private readonly leads: LeadsService,
    private readonly audit: AuditService,
    private readonly stats: StatsService,
  ) {}

  @Cron('0 4 * * *', { name: 'retention', timeZone: 'Asia/Tashkent' })
  async run(now = new Date()): Promise<RetentionResult | null> {
    try {
      const result: RetentionResult = {
        applications: await this.applications.purgeUnchangedSince(
          monthsAgo(now, RETENTION.applicationsMonths),
        ),
        leads: await this.leads.purgeUnchangedSince(monthsAgo(now, RETENTION.leadsMonths)),
        audit: await this.audit.purgeBefore(monthsAgo(now, RETENTION.auditMonths)),
        stats: await this.stats.purgeBefore(dayOf(monthsAgo(now, RETENTION.statsMonths))),
      }
      if (Object.values(result).some((count) => count > 0)) {
        this.logger.log(`Retention: ${JSON.stringify(result)}`)
        await this.audit.record({
          action: 'retention.run',
          userEmail: 'system',
          summary: `Удалено по срокам хранения: отклики ${result.applications}, заявки ${result.leads}, записи журнала ${result.audit}, просмотры ${result.stats}`,
          meta: result,
        })
      }
      return result
    } catch (error) {
      this.logger.error(`Retention failed: ${String(error)}`)
      return null
    }
  }
}

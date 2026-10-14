import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { DocumentsService } from './documents.service.js'

/** Publishes scheduled documents. One API instance, so no two runs ever overlap across servers. */
@Injectable()
export class PublishScheduler {
  private readonly logger = new Logger(PublishScheduler.name)
  private running = false

  constructor(private readonly documents: DocumentsService) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'publish-scheduled' })
  async run(): Promise<void> {
    // A slow run must not overlap the next tick.
    if (this.running) return
    this.running = true
    try {
      const count = await this.documents.publishDue()
      if (count > 0) this.logger.log(`Published ${count} scheduled document(s)`)
    } catch (error) {
      this.logger.error(`Scheduled publishing failed: ${String(error)}`)
    } finally {
      this.running = false
    }
  }
}

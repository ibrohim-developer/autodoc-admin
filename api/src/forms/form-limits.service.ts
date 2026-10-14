import { createHmac } from 'node:crypto'
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { DataSource } from 'typeorm'
import type { Env } from '../config/env.js'

/** Per form and address: 5 submissions in 10 minutes, 20 in a day. */
export const FORM_LIMITS = [
  { windowMs: 10 * 60_000, max: 5 },
  { windowMs: 24 * 60 * 60_000, max: 20 },
] as const

/**
 * Counts submissions per form and visitor address. The address itself is never stored, only a
 * keyed hash of it, and the counts live a day. Kept in the database (not in memory) so a
 * restart doesn't reset them.
 */
@Injectable()
export class FormLimitsService {
  private readonly logger = new Logger(FormLimitsService.name)
  private readonly key: Buffer

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService<Env, true>,
  ) {
    this.key = Buffer.from(config.get('DATA_ENCRYPTION_KEY', { infer: true }), 'base64')
  }

  addressOf(ip: string | null | undefined): string {
    return createHmac('sha256', this.key)
      .update(`form-limit\n${ip ?? 'unknown'}`)
      .digest('hex')
  }

  /** Throws 429 when this address used up a limit for the form. */
  async check(form: string, address: string, now = new Date()): Promise<void> {
    const longest = Math.max(...FORM_LIMITS.map((limit) => limit.windowMs))
    const rows: { created_at: Date }[] = await this.dataSource.query(
      `SELECT created_at FROM form_hits WHERE form = $1 AND address = $2 AND created_at > $3`,
      [form, address, new Date(now.getTime() - longest)],
    )
    for (const limit of FORM_LIMITS) {
      const since = now.getTime() - limit.windowMs
      if (rows.filter((row) => row.created_at.getTime() > since).length >= limit.max) {
        throw new HttpException(
          {
            statusCode: 429,
            code: 'too_many_submissions',
            message: 'Слишком много отправок. Попробуйте позже.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        )
      }
    }
  }

  async record(form: string, address: string): Promise<void> {
    await this.dataSource.query(`INSERT INTO form_hits (form, address) VALUES ($1, $2)`, [
      form,
      address,
    ])
  }

  /** Every night: counts older than the longest window are of no use. */
  @Cron('15 3 * * *', { name: 'purge-form-hits', timeZone: 'Asia/Tashkent' })
  async purgeOld(now = new Date()): Promise<void> {
    const longest = Math.max(...FORM_LIMITS.map((limit) => limit.windowMs))
    try {
      await this.dataSource.query(`DELETE FROM form_hits WHERE created_at < $1`, [
        new Date(now.getTime() - longest),
      ])
    } catch (error) {
      this.logger.error(`Form limits cleanup failed: ${String(error)}`)
    }
  }
}

import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RequirePermission, SkipAudit } from '../common/decorators.js'
import type { Env } from '../config/env.js'

type Messages = Record<string, unknown>
type Defaults = { uz: Messages; ru: Messages; en: Messages }

const CACHE_MS = 60_000

/**
 * The site's own texts (messages/*.json as deployed), for the "Тексты сайта" screen: the
 * default next to each field, and the list of what can be changed. Read from the site so it
 * always matches the code that is live.
 */
@Controller('admin/site-texts')
@SkipAudit()
export class SiteTextsController {
  private readonly logger = new Logger(SiteTextsController.name)
  private cached: { at: number; defaults: Defaults } | null = null

  constructor(private readonly config: ConfigService<Env, true>) {}

  @Get('defaults')
  @RequirePermission('content.read')
  async defaults(): Promise<Defaults> {
    if (this.cached && Date.now() - this.cached.at < CACHE_MS) return this.cached.defaults
    const url = new URL('/api/texts/', this.config.get('SITE_INTERNAL_URL', { infer: true }))
    try {
      const response = await fetch(url, {
        headers: { 'x-site-token': this.config.get('SITE_API_TOKEN', { infer: true }) },
        signal: AbortSignal.timeout(5_000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const defaults = (await response.json()) as Defaults
      this.cached = { at: Date.now(), defaults }
      return defaults
    } catch (error) {
      this.logger.warn(`Site texts unavailable: ${String(error)}`)
      // An older copy is better than nothing while the site restarts.
      if (this.cached) return this.cached.defaults
      throw new ServiceUnavailableException({
        code: 'site_unavailable',
        message:
          'Сайт недоступен, поэтому исходные тексты не загрузились. Попробуйте через минуту.',
      })
    }
  }
}

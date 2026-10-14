import { setTimeout as delay } from 'node:timers/promises'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../config/env.js'

const ATTEMPTS = 3

/**
 * Tells the site which cached pages to rebuild after content changes (its /api/revalidate
 * calls Next's revalidateTag). Fire and forget: publishing never waits for the site and never
 * fails because of it. Failed calls are retried and then logged; the site's own hourly
 * revalidation catches anything missed.
 */
@Injectable()
export class SiteRevalidationService {
  private readonly logger = new Logger(SiteRevalidationService.name)
  private readonly url: URL
  private readonly secret: string

  constructor(config: ConfigService<Env, true>) {
    // Trailing slash: the site has `trailingSlash: true` and would answer the bare path with a redirect.
    this.url = new URL('/api/revalidate/', config.get('SITE_INTERNAL_URL', { infer: true }))
    this.secret = config.get('REVALIDATE_SECRET', { infer: true })
  }

  revalidate(tags: string[]): void {
    if (tags.length === 0) return
    void this.send([...new Set(tags)])
  }

  /** Exposed for tests; returns whether the site accepted the request. */
  async send(tags: string[]): Promise<boolean> {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        const response = await fetch(this.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-revalidate-secret': this.secret },
          body: JSON.stringify({ tags }),
          signal: AbortSignal.timeout(5_000),
        })
        if (response.ok) return true
        throw new Error(`HTTP ${response.status}`)
      } catch (error) {
        if (attempt === ATTEMPTS) {
          this.logger.warn(`Site refresh failed for ${tags.join(', ')}: ${String(error)}`)
          return false
        }
        await delay(attempt * 2_000)
      }
    }
    return false
  }
}

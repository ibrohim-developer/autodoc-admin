import { createHash, randomBytes } from 'node:crypto'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { DataSource } from 'typeorm'
import type { Env } from '../config/env.js'
import type { Locale } from '../content/locales.js'
import { ApplicationsService } from '../forms/applications.service.js'
import { LeadsService } from '../forms/leads.service.js'
import { dayOf, deviceOf, isBot, pageOf, type Source, sourceOf } from './classify.js'

/** One page view as the site's script reports it. */
export type ViewEvent = {
  t: 'view'
  /** Random per page view (not per visitor): lets the "end" event find its view. */
  id: string
  path: string
  ref?: string
  /** Screen width, to tell an iPad from a Mac. */
  w?: number
  utm?: string
}

/** Sent when the visitor leaves the page: how long it was in front of them. */
export type EndEvent = { t: 'end'; id: string; ms: number }

export type Client = { ip: string | null; userAgent: string | null }

export type Period = { from: string; to: string }

/** Longer is a tab left open: it doesn't count as reading. */
const MAX_DURATION_MS = 30 * 60_000
const CONTENT_CACHE_MS = 5 * 60_000
const MAX_PERIOD_DAYS = 400
const DAY_MS = 86_400_000

/** The vacancies list, in each language. */
export const CAREER_LIST_PATHS = ['/vacancies/', '/ru/vacancies/', '/en/vacancies/']

type Totals = { views: number; visitors: number; avgSeconds: number | null }

function toTotals(
  row: { views: string; visitors: string; avg_ms: string | null } | undefined,
): Totals {
  return {
    views: Number(row?.views ?? 0),
    visitors: Number(row?.visitors ?? 0),
    avgSeconds: row?.avg_ms ? Math.round(Number(row.avg_ms) / 1000) : null,
  }
}

function shiftDay(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Days between two YYYY-MM-DD dates, both included. */
function lengthOf(period: Period): number {
  return Math.round((Date.parse(period.to) - Date.parse(period.from)) / DAY_MS) + 1
}

/**
 * The site's own statistics, without cookies: page views, visitors per day, sources, devices,
 * languages, reading time, and how vacancy views turn into applications. A visitor is a hash
 * of address + browser + a salt that lives one day; the address is never written anywhere.
 */
@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name)
  private readonly siteHost: string
  private salt: { day: string; value: string } | null = null
  private readonly contentIds = new Map<string, { id: string | null; at: number }>()

  constructor(
    private readonly dataSource: DataSource,
    private readonly leads: LeadsService,
    private readonly applications: ApplicationsService,
    config: ConfigService<Env, true>,
  ) {
    this.siteHost = new URL(config.get('SITE_ORIGIN', { infer: true })).hostname
  }

  // ── Collecting ──────────────────────────────────────────────────────────────

  async collect(event: ViewEvent | EndEvent, client: Client, now = new Date()): Promise<void> {
    if (isBot(client.userAgent)) return
    if (event.t === 'end') {
      await this.dataSource.query(
        `UPDATE stats_views SET duration_ms = GREATEST(COALESCE(duration_ms, 0), $2)
          WHERE view_id = $1 AND created_at > $3`,
        [
          event.id,
          Math.min(Math.max(0, Math.round(event.ms)), MAX_DURATION_MS),
          new Date(now.getTime() - 6 * 3_600_000),
        ],
      )
      return
    }

    const page = pageOf(event.path)
    if (!page) return
    const day = dayOf(now)
    const salt = await this.saltFor(day)
    const visitor = createHash('sha256')
      .update(`${salt}\n${client.ip ?? ''}\n${client.userAgent ?? ''}`)
      .digest('hex')
      .slice(0, 32)
    const source = sourceOf(event.ref, this.siteHost, event.utm)
    const contentId = page.content
      ? await this.contentId(page.content.type, page.content.slug)
      : null

    await this.dataSource.query(
      `INSERT INTO stats_views
         (view_id, created_at, day, visitor, path, locale, content_type, content_id, source, source_name, device)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (view_id) DO NOTHING`,
      [
        event.id,
        now,
        day,
        visitor,
        page.path,
        page.locale,
        contentId ? page.content?.type : null,
        contentId,
        source.source,
        source.name,
        deviceOf(client.userAgent ?? '', event.w),
      ],
    )
  }

  /** Today's salt; made on the first visit of the day and shared by every API process. */
  private async saltFor(day: string): Promise<string> {
    if (this.salt?.day === day) return this.salt.value
    await this.dataSource.query(
      `INSERT INTO stats_salts (day, salt) VALUES ($1, $2) ON CONFLICT (day) DO NOTHING`,
      [day, randomBytes(32).toString('hex')],
    )
    const [row]: { salt: string }[] = await this.dataSource.query(
      `SELECT salt FROM stats_salts WHERE day = $1`,
      [day],
    )
    this.salt = { day, value: (row as { salt: string }).salt }
    return this.salt.value
  }

  /** The live post or vacancy at this address, remembered a few minutes. */
  private async contentId(type: string, slug: string): Promise<string | null> {
    const key = `${type}:${slug}`
    const cached = this.contentIds.get(key)
    if (cached && Date.now() - cached.at < CONTENT_CACHE_MS) return cached.id
    const [row]: { id: string }[] = await this.dataSource.query(
      `SELECT id FROM documents
        WHERE type = $1 AND published_slug = $2 AND published IS NOT NULL AND deleted_at IS NULL
        LIMIT 1`,
      [type, slug],
    )
    if (this.contentIds.size > 5_000) this.contentIds.clear()
    this.contentIds.set(key, { id: row?.id ?? null, at: Date.now() })
    return row?.id ?? null
  }

  /** Just after midnight: yesterday's salt goes, so yesterday's visitors can't be recomputed. */
  @Cron('5 0 * * *', { name: 'drop-stats-salts', timeZone: 'Asia/Tashkent' })
  async dropOldSalts(now = new Date()): Promise<void> {
    try {
      await this.dataSource.query(`DELETE FROM stats_salts WHERE day < $1`, [dayOf(now)])
      if (this.salt && this.salt.day < dayOf(now)) this.salt = null
    } catch (error) {
      this.logger.error(`Dropping old statistics salts failed: ${String(error)}`)
    }
  }

  // ── Reports ─────────────────────────────────────────────────────────────────

  /** The last `days` days, today included. */
  lastDays(days: number, now = new Date()): Period {
    const to = dayOf(now)
    return { from: shiftDay(to, -(days - 1)), to }
  }

  /** `from`/`to` as given, or the last 30 days; never longer than 400 days. */
  period(from?: string, to?: string, now = new Date()): Period {
    const end = to ?? dayOf(now)
    const start = from ?? shiftDay(end, -29)
    const period = { from: start, to: end }
    if (Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end)) || start > end) {
      throw new BadRequestException({ code: 'bad_period', message: 'Неверный период' })
    }
    if (lengthOf(period) > MAX_PERIOD_DAYS) {
      throw new BadRequestException({
        code: 'bad_period',
        message: `Период не длиннее ${MAX_PERIOD_DAYS} дней`,
      })
    }
    return period
  }

  /** The period of the same length just before, for "compared with the previous period". */
  previous(period: Period): Period {
    const days = lengthOf(period)
    return { from: shiftDay(period.from, -days), to: shiftDay(period.from, -1) }
  }

  async totals(period: Period, where = 'TRUE', params: unknown[] = []): Promise<Totals> {
    const [row] = await this.dataSource.query(
      `SELECT count(*) AS views,
              count(DISTINCT visitor || day::text) AS visitors,
              avg(duration_ms) FILTER (WHERE duration_ms > 0) AS avg_ms
         FROM stats_views WHERE day BETWEEN $1 AND $2 AND (${where})`,
      [period.from, period.to, ...params],
    )
    return toTotals(row)
  }

  async daily(
    period: Period,
    where = 'TRUE',
    params: unknown[] = [],
  ): Promise<{ day: string; views: number; visitors: number }[]> {
    const rows: { day: string; views: string; visitors: string }[] = await this.dataSource.query(
      `SELECT to_char(d, 'YYYY-MM-DD') AS day, count(v.id) AS views, count(DISTINCT v.visitor) AS visitors
         FROM generate_series($1::date, $2::date, interval '1 day') AS d
         LEFT JOIN stats_views v ON v.day = d::date AND (${where})
        GROUP BY d ORDER BY d`,
      [period.from, period.to, ...params],
    )
    return rows.map((row) => ({
      day: row.day,
      views: Number(row.views),
      visitors: Number(row.visitors),
    }))
  }

  /** "Общая": the whole site. */
  async overview(period: Period) {
    const range = [period.from, period.to]
    const [current, previous, daily, sources, referrers, devices, locales, pages] =
      await Promise.all([
        this.totals(period),
        this.totals(this.previous(period)),
        this.daily(period),
        this.dataSource.query(
          `SELECT source, count(*) AS visits FROM stats_views
          WHERE day BETWEEN $1 AND $2 AND source <> 'internal'
          GROUP BY source ORDER BY visits DESC`,
          range,
        ) as Promise<{ source: Source; visits: string }[]>,
        this.dataSource.query(
          `SELECT source, source_name AS name, count(*) AS visits FROM stats_views
          WHERE day BETWEEN $1 AND $2 AND source_name IS NOT NULL
          GROUP BY source, source_name ORDER BY visits DESC LIMIT 10`,
          range,
        ) as Promise<{ source: Source; name: string; visits: string }[]>,
        this.dataSource.query(
          `SELECT device, count(DISTINCT visitor || day::text) AS visitors FROM stats_views
          WHERE day BETWEEN $1 AND $2 GROUP BY device ORDER BY visitors DESC`,
          range,
        ) as Promise<{ device: string; visitors: string }[]>,
        this.dataSource.query(
          `SELECT locale, count(*) AS views FROM stats_views
          WHERE day BETWEEN $1 AND $2 GROUP BY locale ORDER BY views DESC`,
          range,
        ) as Promise<{ locale: Locale; views: string }[]>,
        this.dataSource.query(
          `SELECT path, count(*) AS views, count(DISTINCT visitor || day::text) AS visitors,
                avg(duration_ms) FILTER (WHERE duration_ms > 0) AS avg_ms
           FROM stats_views WHERE day BETWEEN $1 AND $2
          GROUP BY path ORDER BY views DESC, path LIMIT 20`,
          range,
        ) as Promise<{ path: string; views: string; visitors: string; avg_ms: string | null }[]>,
      ])
    const { start, end } = this.bounds(period)
    const [leads, applications] = await Promise.all([
      this.leads.countBetween(start, end),
      this.applications.countBetween(start, end),
    ])
    return {
      period,
      totals: current,
      previous,
      daily,
      sources: sources.map((row) => ({ source: row.source, visits: Number(row.visits) })),
      referrers: referrers.map((row) => ({
        source: row.source,
        name: row.name,
        visits: Number(row.visits),
      })),
      devices: devices.map((row) => ({ device: row.device, visitors: Number(row.visitors) })),
      locales: locales.map((row) => ({ locale: row.locale, views: Number(row.views) })),
      pages: pages.map((row) => ({ path: row.path, ...toTotals(row) })),
      forms: { leads, applications },
    }
  }

  /** "Новости": views and reading time per post. */
  async content(period: Period) {
    const rows: {
      id: string
      title: string | null
      slug: string | null
      first_published_at: Date | null
      views: string
      visitors: string
      avg_ms: string | null
    }[] = await this.dataSource.query(
      `SELECT d.id, d.published #>> '{locales,uz,title}' AS title, d.published_slug AS slug,
              d.first_published_at,
              count(v.id) AS views, count(DISTINCT v.visitor || v.day::text) AS visitors,
              avg(v.duration_ms) FILTER (WHERE v.duration_ms > 0) AS avg_ms
         FROM documents d
         LEFT JOIN stats_views v ON v.content_id = d.id AND v.day BETWEEN $1 AND $2
        WHERE d.type = 'post' AND d.deleted_at IS NULL AND d.published IS NOT NULL
        GROUP BY d.id
        ORDER BY views DESC, d.first_published_at DESC NULLS LAST
        LIMIT 200`,
      [period.from, period.to],
    )
    return {
      period,
      totals: await this.totals(period, `content_type = 'post'`),
      posts: rows.map((row) => ({
        id: row.id,
        title: row.title ?? '—',
        slug: row.slug,
        publishedAt: row.first_published_at,
        ...toTotals(row),
      })),
    }
  }

  /** "Вакансии": views of each vacancy and how many of them became applications. */
  async vacancies(period: Period) {
    const range = [period.from, period.to]
    const [rows, list] = await Promise.all([
      this.dataSource.query(
        `SELECT d.id, d.published #>> '{locales,uz,title}' AS title, d.published_slug AS slug,
                (d.published #>> '{shared,closed}')::boolean AS closed,
                count(v.id) AS views, count(DISTINCT v.visitor || v.day::text) AS visitors
           FROM documents d
           LEFT JOIN stats_views v ON v.content_id = d.id AND v.day BETWEEN $1 AND $2
          WHERE d.type = 'vacancy' AND d.deleted_at IS NULL AND d.published IS NOT NULL
          GROUP BY d.id
          ORDER BY views DESC, d.first_published_at DESC NULLS LAST`,
        range,
      ) as Promise<
        {
          id: string
          title: string | null
          slug: string | null
          closed: boolean | null
          views: string
          visitors: string
        }[]
      >,
      this.totals(period, 'path = ANY($3)', [CAREER_LIST_PATHS]),
    ])
    const { start, end } = this.bounds(period)
    const applications = await this.applications.countByVacancy(start, end)
    const vacancies = rows.map((row) => {
      const visitors = Number(row.visitors)
      const count = applications.get(row.id) ?? 0
      return {
        id: row.id,
        title: row.title ?? '—',
        slug: row.slug,
        closed: row.closed === true,
        views: Number(row.views),
        visitors,
        applications: count,
        /** Applications per 100 visitors of the vacancy's page. */
        conversion: visitors > 0 ? Math.round((count / visitors) * 1000) / 10 : null,
      }
    })
    return {
      period,
      careerPage: list,
      totals: await this.totals(period, `content_type = 'vacancy'`),
      applications: {
        total: [...applications.values()].reduce((sum, n) => sum + n, 0),
        otherPosition: applications.get(null) ?? 0,
      },
      vacancies,
    }
  }

  /** The period as instants: from the first day's midnight to the day after the last, Tashkent time. */
  private bounds(period: Period): { start: Date; end: Date } {
    return {
      start: new Date(`${period.from}T00:00:00+05:00`),
      end: new Date(Date.parse(`${period.to}T00:00:00+05:00`) + DAY_MS),
    }
  }
}

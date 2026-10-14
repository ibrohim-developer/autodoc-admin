import { Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { IsOptional, Matches } from 'class-validator'
import type { Request } from 'express'
import { z } from 'zod'
import { Public, RequirePermission } from '../common/decorators.js'
import { clientMeta } from '../common/request.js'
import { SiteOriginGuard } from '../common/site-origin.guard.js'
import { StatsService } from './stats.service.js'

const DAY = /^\d{4}-\d{2}-\d{2}$/

class PeriodDto {
  @IsOptional()
  @Matches(DAY, { message: 'Дата в формате ГГГГ-ММ-ДД' })
  from?: string

  @IsOptional()
  @Matches(DAY, { message: 'Дата в формате ГГГГ-ММ-ДД' })
  to?: string
}

const eventSchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('view'),
    id: z.uuid(),
    path: z.string().max(1000),
    ref: z.string().max(1000).optional(),
    w: z.number().int().min(0).max(20_000).optional(),
    utm: z.string().max(200).optional(),
  }),
  z.object({ t: z.literal('end'), id: z.uuid(), ms: z.number().min(0).max(86_400_000) }),
])

/**
 * The site's script reports page views here (autodoc.uz/api/v1/collect, from the visitor's
 * browser, with sendBeacon). No cookies and no consent needed: nothing identifies anyone.
 */
@Controller('v1/collect')
@Public()
@UseGuards(SiteOriginGuard)
export class CollectController {
  constructor(private readonly stats: StatsService) {}

  @Post()
  @HttpCode(204)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async collect(@Body() body: unknown, @Req() req: Request) {
    const event = eventSchema.safeParse(body)
    // A broken event is dropped quietly: the browser doesn't read the answer anyway.
    if (!event.success) return
    await this.stats.collect(event.data, clientMeta(req))
  }
}

/** "Статистика": each tab has its own permission (HR sees vacancies only). */
@Controller('admin/stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  @RequirePermission('stats.general')
  overview(@Query() query: PeriodDto) {
    return this.stats.overview(this.stats.period(query.from, query.to))
  }

  @Get('content')
  @RequirePermission('stats.content')
  content(@Query() query: PeriodDto) {
    return this.stats.content(this.stats.period(query.from, query.to))
  }

  @Get('vacancies')
  @RequirePermission('stats.vacancies')
  vacancies(@Query() query: PeriodDto) {
    return this.stats.vacancies(this.stats.period(query.from, query.to))
  }
}

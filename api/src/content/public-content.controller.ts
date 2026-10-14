import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, Max, Min } from 'class-validator'
import { Public } from '../common/decorators.js'
import { DocumentsService } from './documents.service.js'
import { LOCALES, type Locale } from './locales.js'
import { SiteTokenGuard } from './site-token.guard.js'
import { SLUG_PATTERN } from './slug.js'

const TYPE_PATTERN = /^[a-z][a-z0-9_-]{0,39}$/

class PublicQuery {
  @IsIn(LOCALES)
  locale: Locale = 'uz'

  /** Working copies instead of published versions: the site asks for these only in draft mode. */
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  draft = false
}

class PublicListQuery extends PublicQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20

  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0
}

const notFound = () => new NotFoundException({ code: 'not_found', message: 'Not found' })

/**
 * Content for the site's server (Next.js), never for browsers: nginx doesn't route
 * /api/v1/content from outside, and every request carries the shared site token. Not
 * rate-limited: all of the site's traffic arrives from one address.
 */
@Controller('v1/content')
@Public()
@SkipThrottle()
@UseGuards(SiteTokenGuard)
export class PublicContentController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('single/:type')
  singleton(@Param('type') type: string, @Query() query: PublicQuery) {
    if (!TYPE_PATTERN.test(type)) throw notFound()
    return this.documents.publicSingleton(type, query)
  }

  @Get(':type')
  list(@Param('type') type: string, @Query() query: PublicListQuery) {
    if (!TYPE_PATTERN.test(type)) throw notFound()
    return this.documents.publicList(type, query)
  }

  @Get(':type/:slug')
  get(@Param('type') type: string, @Param('slug') slug: string, @Query() query: PublicQuery) {
    if (!TYPE_PATTERN.test(type) || !SLUG_PATTERN.test(slug)) throw notFound()
    return this.documents.publicGet(type, slug, query)
  }
}

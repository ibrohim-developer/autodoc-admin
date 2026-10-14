import { Controller, Get, UseGuards } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { z } from 'zod'
import { Public } from '../common/decorators.js'
import type { ContentTypeDef } from '../content/content-types.js'
import { DocumentsService, REDIRECT_TYPE } from '../content/documents.service.js'
import { SiteTokenGuard } from '../content/site-token.guard.js'
import { CONTENT } from './fields.js'

/**
 * "Редиректы": an old address of the site sends visitors to a new one. Made by hand here, or
 * automatically when a published page's address changes (DocumentsService). Saved = live; the
 * site picks changes up within a minute.
 */

/** A path on the site: /about/, /ru/blog/14/. No host, no query, no "//" tricks. */
function isSitePath(value: string): boolean {
  return /^\/(?!\/)[^\s?#\\]*$/.test(value)
}

/** The site's addresses end with a slash (/about/), files excepted (/brochure.pdf). */
export function normalizePath(value: string): string {
  const path = value.trim()
  return path.endsWith('/') || /\.[a-z0-9]{2,5}$/i.test(path) ? path : `${path}/`
}

const sitePath = z
  .string()
  .trim()
  .max(500)
  .refine(isSitePath, 'Путь на сайте, начинается с /: /old-page/')
  .transform(normalizePath)

const target = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => isSitePath(value) || /^https:\/\/[^\s]+$/.test(value),
    'Путь на сайте (/new-page/) или ссылка https://…',
  )
  .transform((value) => (value.startsWith('/') ? normalizePath(value) : value))

export const redirectType: ContentTypeDef = {
  type: REDIRECT_TYPE,
  label: 'Редирект',
  permissions: CONTENT,
  publishOnSave: true,
  shared: z
    .object({
      from: sitePath,
      to: target,
      /** 301 for search engines (the page moved for good); 302 for a temporary detour. */
      permanent: z.boolean(),
      enabled: z.boolean(),
      /** Made when a page's address changed, not by hand. */
      auto: z.boolean().optional(),
    })
    .refine((data) => data.from !== data.to, { message: 'Адрес ведёт сам на себя', path: ['to'] }),
  localized: z.object({}),
  title: (data) => `${String(data.shared.from)} → ${String(data.shared.to)}`,
  unique: { field: 'from', message: 'Для этого адреса уже есть редирект' },
  summary: { shared: ['from', 'to', 'permanent', 'enabled', 'auto'] },
}

/** All redirects that are on, for the site's proxy (it keeps them in memory for a minute). */
@Controller('v1/redirects')
@Public()
@SkipThrottle()
@UseGuards(SiteTokenGuard)
export class PublicRedirectsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  async list() {
    const redirects = await this.documents.publicShared(REDIRECT_TYPE)
    return redirects
      .filter((redirect) => redirect.enabled === true)
      .map((redirect) => ({
        from: redirect.from,
        to: redirect.to,
        permanent: redirect.permanent === true,
      }))
  }
}

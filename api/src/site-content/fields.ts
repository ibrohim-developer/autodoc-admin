import { z } from 'zod'
import type { Permission } from '../auth/permissions.js'
import type { Locale } from '../content/locales.js'
import { SLUG_MAX_LENGTH } from '../content/slug.js'

/** Building blocks for the site's content types. Messages are Russian: editors read them. */

/** A photo from the media library. The site gets its sizes and alt text by this id. */
export const mediaRef = z.object({ mediaId: z.uuid() })

/** Optional: empty means "make it from the title". Turned into a URL-safe slug on save. */
export const slugField = z.string().trim().max(SLUG_MAX_LENGTH).optional()

export const text = (max: number) => z.string().trim().max(max, `Не длиннее ${max} символов`)

export const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, `Не длиннее ${max} символов`)

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Такой даты нет')

/** Where a photo's subject is, as CSS object-position: "50% 20%". */
export const focalPoint = z
  .string()
  .regex(/^(100|\d{1,2})% (100|\d{1,2})%$/, 'Неверная точка фокуса')

const VIDEO_HOSTS = new Set(['youtube.com', 'youtu.be', 'instagram.com'])

/** YouTube and Instagram links only: those are the players the site can embed. */
export function isVideoUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && VIDEO_HOSTS.has(url.hostname.replace(/^(www|m)\./, ''))
  } catch {
    return false
  }
}

export const videoUrl = z
  .string()
  .trim()
  .max(500)
  .refine(isVideoUrl, 'Нужна ссылка на YouTube или Instagram (https://…)')

/** Uzbek lives at the root, the others under their prefix: /blog/x/, /ru/blog/x/. */
export function localePath(locale: Locale, path: string): string {
  return `${locale === 'uz' ? '' : `/${locale}`}${path}`
}

/** News, projects, pages, texts, settings: marketing and admin. */
export const CONTENT: Record<'read' | 'write' | 'publish' | 'trash', Permission> = {
  read: 'content.read',
  write: 'content.write',
  publish: 'content.publish',
  trash: 'trash.content',
}

/** Vacancies and their directions: HR too. */
export const VACANCIES: Record<'read' | 'write' | 'publish' | 'trash', Permission> = {
  read: 'vacancies.read',
  write: 'vacancies.write',
  publish: 'vacancies.publish',
  trash: 'trash.vacancies',
}

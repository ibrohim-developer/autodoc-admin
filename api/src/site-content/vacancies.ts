import { z } from 'zod'
import type { ContentTypeDef } from '../content/content-types.js'
import { richTextSchema } from '../content/rich-text.js'
import { localePath, requiredText, slugField, text, VACANCIES } from './fields.js'

/** The directions vacancies are grouped by (the green pill on the card). Saved = live. */
export const vacancyDirectionType: ContentTypeDef = {
  type: 'vacancy_direction',
  label: 'Направление вакансий',
  permissions: VACANCIES,
  shared: z.object({
    slug: slugField,
    order: z.number().int().min(0).max(9999).optional(),
  }),
  localized: z.object({ name: requiredText(60, 'Укажите название') }),
  title: (data) => String(data.locales.uz.name ?? ''),
  slug: (data) => String(data.shared.slug || data.locales.uz.name || ''),
  publishOnSave: true,
  order: [{ field: 'order', direction: 'asc', cast: 'number' }],
  adminOrder: true,
  summary: { shared: ['order'], localized: ['name'] },
}

/** The labels live in the site's texts (Career.vacancies.employment). */
export const EMPLOYMENT = ['fullTime', 'partTime', 'remote', 'internship'] as const

/**
 * A vacancy. Draft → not on the site; published → open; published and closed → off the list,
 * its page says the vacancy is closed (links from hh.uz or messengers still land somewhere).
 */
export const vacancyType: ContentTypeDef = {
  type: 'vacancy',
  label: 'Вакансия',
  permissions: VACANCIES,
  shared: z.object({
    slug: slugField,
    directionId: z.uuid({ message: 'Выберите направление' }),
    employment: z.enum(EMPLOYMENT, { message: 'Выберите занятость' }),
    closed: z.boolean().optional(),
    /**
     * Imported from hh.uz (src/hh): the vacancy's id there and a hash of what the sync last
     * wrote. When the content no longer matches the hash, someone edited it here and the sync
     * stops changing its text.
     */
    hh: z
      .object({ id: z.string().regex(/^\d{1,20}$/), hash: z.string().regex(/^[0-9a-f]{64}$/) })
      .optional(),
  }),
  localized: z.object({
    title: requiredText(120, 'Укажите название'),
    city: requiredText(60, 'Укажите город'),
    /** On the card: two or three lines. */
    description: requiredText(400, 'Укажите короткое описание'),
    /** Up to four, as the card has room for. */
    requirements: z
      .array(requiredText(120, 'Пустое требование'))
      .max(4, 'Не больше 4 требований')
      .optional(),
    /** The vacancy's own page: duties, conditions, everything that doesn't fit the card. */
    body: richTextSchema.optional(),
    seoTitle: text(120).optional(),
    seoDescription: text(300).optional(),
  }),
  title: (data) => String(data.locales.uz.title ?? ''),
  slug: (data) => String(data.shared.slug || data.locales.uz.title || ''),
  sitePath: (_data, slug, locale) => (slug ? localePath(locale, `/vacancies/${slug}/`) : null),
  summary: {
    shared: ['directionId', 'employment', 'closed', 'hh'],
    localized: ['title', 'city', 'description', 'requirements'],
  },
  references: [{ field: 'directionId', type: 'vacancy_direction', label: 'Направление' }],
}

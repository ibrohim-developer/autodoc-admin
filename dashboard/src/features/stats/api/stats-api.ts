import { z } from 'zod'
import { request } from '@/lib/api-client'

const totals = z.object({
  views: z.number(),
  visitors: z.number(),
  avgSeconds: z.number().nullable(),
})
export type Totals = z.infer<typeof totals>

const period = z.object({ from: z.string(), to: z.string() })
const day = z.object({ day: z.string(), views: z.number(), visitors: z.number() })

export const SOURCES = ['direct', 'search', 'social', 'referral', 'campaign'] as const
export const SOURCE_LABELS: Record<string, string> = {
  direct: 'Прямые заходы',
  search: 'Поисковики',
  social: 'Соцсети и мессенджеры',
  referral: 'Другие сайты',
  campaign: 'Рекламные метки (utm)',
}
export const DEVICE_LABELS: Record<string, string> = {
  mobile: 'Телефоны',
  tablet: 'Планшеты',
  desktop: 'Компьютеры',
}
export const LOCALE_NAMES: Record<string, string> = {
  uz: 'Узбекский',
  ru: 'Русский',
  en: 'Английский',
}

const overviewSchema = z.object({
  period,
  totals,
  previous: totals,
  daily: z.array(day),
  sources: z.array(z.object({ source: z.string(), visits: z.number() })),
  referrers: z.array(z.object({ source: z.string(), name: z.string(), visits: z.number() })),
  devices: z.array(z.object({ device: z.string(), visitors: z.number() })),
  locales: z.array(z.object({ locale: z.string(), views: z.number() })),
  pages: z.array(totals.extend({ path: z.string() })),
  forms: z.object({ leads: z.number(), applications: z.number() }),
})
export type Overview = z.infer<typeof overviewSchema>

const contentSchema = z.object({
  period,
  totals,
  posts: z.array(
    totals.extend({
      id: z.string(),
      title: z.string(),
      slug: z.string().nullable(),
      publishedAt: z.string().nullable(),
    }),
  ),
})
export type ContentStats = z.infer<typeof contentSchema>

const vacanciesSchema = z.object({
  period,
  careerPage: totals,
  totals,
  applications: z.object({ total: z.number(), otherPosition: z.number() }),
  vacancies: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      slug: z.string().nullable(),
      closed: z.boolean(),
      views: z.number(),
      visitors: z.number(),
      applications: z.number(),
      conversion: z.number().nullable(),
    }),
  ),
})
export type VacancyStats = z.infer<typeof vacanciesSchema>

export type PeriodQuery = { from: string; to: string }

export function fetchOverview(query: PeriodQuery) {
  return request('admin/stats/overview', { schema: overviewSchema, searchParams: query })
}

export function fetchContentStats(query: PeriodQuery) {
  return request('admin/stats/content', { schema: contentSchema, searchParams: query })
}

export function fetchVacancyStats(query: PeriodQuery) {
  return request('admin/stats/vacancies', { schema: vacanciesSchema, searchParams: query })
}

import { z } from 'zod'
import { request } from '@/lib/api-client'

const totals = z.object({
  views: z.number(),
  visitors: z.number(),
  avgSeconds: z.number().nullable(),
})

const homeSchema = z.object({
  leads: z
    .object({
      new: z.number(),
      latest: z.array(
        z.object({
          id: z.string(),
          number: z.number(),
          name: z.string(),
          topic: z.string().nullable(),
          status: z.string(),
          createdAt: z.string(),
        }),
      ),
    })
    .nullable(),
  applications: z
    .object({
      new: z.number(),
      latest: z.array(
        z.object({
          id: z.string(),
          number: z.number(),
          name: z.string(),
          vacancyTitle: z.string().nullable(),
          status: z.string(),
          createdAt: z.string(),
        }),
      ),
    })
    .nullable(),
  views: z
    .object({
      scope: z.enum(['site', 'vacancies']),
      totals,
      previous: totals,
      daily: z.array(z.object({ day: z.string(), views: z.number(), visitors: z.number() })),
    })
    .nullable(),
  drafts: z
    .object({
      total: z.number(),
      items: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          typeLabel: z.string(),
          title: z.string(),
          status: z.enum(['draft', 'changed', 'scheduled']),
          updatedAt: z.string(),
        }),
      ),
    })
    .nullable(),
})
export type Home = z.infer<typeof homeSchema>

export function fetchHome() {
  return request('admin/home', { schema: homeSchema })
}

/** Where the dashboard edits a document of this type. */
export function editorPath(type: string, id: string): string {
  if (type === 'post') return `/news/${id}`
  if (type === 'vacancy') return `/vacancies/${id}`
  if (type.startsWith('legal_')) return `/pages/legal/${type.slice('legal_'.length)}`
  if (type.startsWith('page_')) return `/pages/${type.slice('page_'.length)}`
  return '/'
}

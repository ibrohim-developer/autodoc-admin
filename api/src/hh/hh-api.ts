import { z } from 'zod'

/** What the sync reads from hh's API (https://api.hh.ru/openapi). Unknown fields are dropped. */

const named = z.object({ id: z.string(), name: z.string().optional() }).nullable().optional()

export const hhListSchema = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string() })),
  pages: z.number().int().min(0),
})

export const hhVacancySchema = z.object({
  id: z.string(),
  name: z.string(),
  archived: z.boolean().optional(),
  area: z.object({ name: z.string() }).nullable().optional(),
  employment: named,
  schedule: named,
  description: z.string().default(''),
  key_skills: z.array(z.object({ name: z.string() })).default([]),
})
export type HhVacancy = z.infer<typeof hhVacancySchema>

export class HhError extends Error {}

export type HhClient = {
  /** Ids of the employer's open vacancies. */
  openIds(employerId: string): Promise<string[]>
  vacancy(id: string): Promise<HhVacancy>
}

/** Anonymous requests get 403 from hh: every call carries the application token. */
export function hhClient(baseUrl: string, token: string): HhClient {
  const base = baseUrl.replace(/\/$/, '')
  async function get<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
    let response: Response
    try {
      response = await fetch(`${base}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'HH-User-Agent': 'autodoc-admin/1.0 (info@autodoc.uz)',
          'User-Agent': 'autodoc-admin/1.0 (info@autodoc.uz)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      throw new HhError('Нет связи с hh.uz')
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        description?: string
        errors?: { type?: string; value?: string }[]
      } | null
      const reason =
        body?.description ??
        body?.errors?.map((e) => [e.type, e.value].filter(Boolean).join(': ')).join(', ')
      if (response.status === 401 || response.status === 403) {
        throw new HhError(
          `hh.uz не принимает токен (${response.status}${reason ? `: ${reason}` : ''})`,
        )
      }
      throw new HhError(`hh.uz ответил ${response.status}${reason ? `: ${reason}` : ''}`)
    }
    const parsed = schema.safeParse(await response.json().catch(() => null))
    if (!parsed.success) throw new HhError('hh.uz прислал неожиданный ответ')
    return parsed.data
  }

  return {
    async openIds(employerId) {
      const ids: string[] = []
      for (let page = 0; page < 20; page++) {
        const list = await get(
          `/vacancies?employer_id=${encodeURIComponent(employerId)}&per_page=100&page=${page}&host=hh.uz`,
          hhListSchema,
        )
        ids.push(...list.items.map((item) => item.id))
        if (page + 1 >= list.pages) break
      }
      return ids
    },
    vacancy: (id) => get(`/vacancies/${encodeURIComponent(id)}?host=hh.uz`, hhVacancySchema),
  }
}

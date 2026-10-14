import { z } from 'zod'
import { request } from '@/lib/api-client'

export const telegramSchema = z.object({
  enabled: z.boolean(),
  /** The token itself never leaves the API. */
  hasToken: z.boolean(),
  leadsChatId: z.string().nullable(),
  applicationsChatId: z.string().nullable(),
  updatedAt: z.string().nullable(),
})
export type Telegram = z.infer<typeof telegramSchema>

export type TelegramChanges = {
  enabled?: boolean
  /** A new token; '' removes it; left out keeps it. */
  token?: string
  leadsChatId?: string | null
  applicationsChatId?: string | null
}

const resultSchema = z
  .union([z.object({ ok: z.literal(true) }), z.object({ ok: z.literal(false), error: z.string() })])
  .nullable()
export type TelegramResult = z.infer<typeof resultSchema>

export function fetchTelegram() {
  return request('admin/integrations/telegram', { schema: telegramSchema })
}

export function updateTelegram(changes: TelegramChanges) {
  return request('admin/integrations/telegram', {
    method: 'PUT',
    body: changes,
    schema: telegramSchema,
  })
}

export function testTelegram() {
  return request('admin/integrations/telegram/test', {
    method: 'POST',
    schema: z.object({ leads: resultSchema, applications: resultSchema }),
  })
}

const hhRunSchema = z.object({
  at: z.string(),
  ok: z.boolean(),
  error: z.string().nullable(),
  created: z.number(),
  updated: z.number(),
  closed: z.number(),
  reopened: z.number(),
  protected: z.number(),
  failed: z.number(),
})
export type HhRun = z.infer<typeof hhRunSchema>

export const hhSchema = z.object({
  enabled: z.boolean(),
  employerId: z.string().nullable(),
  directionId: z.string().nullable(),
  autoPublish: z.boolean(),
  hasToken: z.boolean(),
  updatedAt: z.string().nullable(),
  lastRun: hhRunSchema.nullable(),
})
export type Hh = z.infer<typeof hhSchema>

export type HhChanges = {
  enabled?: boolean
  employerId?: string | null
  token?: string
  directionId?: string | null
  autoPublish?: boolean
}

export function fetchHh() {
  return request('admin/integrations/hh', { schema: hhSchema })
}

export function updateHh(changes: HhChanges) {
  return request('admin/integrations/hh', { method: 'PUT', body: changes, schema: hhSchema })
}

export function syncHh() {
  return request('admin/integrations/hh/sync', { method: 'POST', schema: hhRunSchema })
}

/** Directions to put new vacancies in (the vacancy_direction content type). */
export function fetchDirections() {
  return request('admin/content', {
    schema: z.object({ items: z.array(z.object({ id: z.string(), title: z.string() })) }),
    searchParams: { type: 'vacancy_direction', pageSize: 100 },
  })
}

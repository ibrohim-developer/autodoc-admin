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

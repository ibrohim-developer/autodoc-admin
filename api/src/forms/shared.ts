import { BadRequestException } from '@nestjs/common'
import { In, type Repository } from 'typeorm'
import type { z } from 'zod'
import { User } from '../users/user.entity.js'

/** Days in the admin are Tashkent days (UTC+5, no daylight saving). */
const TASHKENT_OFFSET = '+05:00'

/** `from`/`to` as YYYY-MM-DD, both days included. */
export function dayRange(from?: string, to?: string): { start?: Date; end?: Date } {
  const start = from ? new Date(`${from}T00:00:00${TASHKENT_OFFSET}`) : undefined
  const end = to
    ? new Date(new Date(`${to}T00:00:00${TASHKENT_OFFSET}`).getTime() + 86_400_000)
    : undefined
  return { start, end }
}

const dateTime = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Tashkent',
})

/** For exports: 14.10.2026, 13:05 in Tashkent time. */
export function formatDateTime(date: Date | null): string {
  return date ? dateTime.format(date) : ''
}

export type UserRef = { id: string; name: string } | null

export async function userNames(
  users: Repository<User>,
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (unique.length === 0) return new Map()
  const rows = await users.find({ select: { id: true, name: true }, where: { id: In(unique) } })
  return new Map(rows.map((row) => [row.id, row.name]))
}

export function userRef(names: Map<string, string>, id: string | null): UserRef {
  return id ? { id, name: names.get(id) ?? '—' } : null
}

/** Visitor input checked by a zod schema; problems go back per field, in Russian. */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  const fields: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || '_'
    fields[path] ??= issue.message
  }
  throw new BadRequestException({
    code: 'invalid_form',
    message: Object.values(fields)[0] ?? 'Проверьте поля формы',
    fields,
  })
}

/** ILIKE needs its wildcards escaped, or "50%" matches everything. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
}

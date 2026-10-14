/**
 * How long data is kept (ROADMAP, Stage 6). Trash (30 days), content versions (last 100), the
 * forms' rate-limit counts (a day) and the statistics salts (a day) have their own cleanups.
 */
export const RETENTION = {
  /** After the last change: a candidate who was rejected a year ago is gone with the resume. */
  applicationsMonths: 12,
  leadsMonths: 24,
  auditMonths: 12,
  statsMonths: 13,
} as const

/** The same calendar day `months` back (the 31st falls back to the month's last day). */
export function monthsAgo(now: Date, months: number): Date {
  const date = new Date(now)
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() - months)
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, last))
  return date
}

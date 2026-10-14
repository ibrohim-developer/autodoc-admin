/** Admin dates are always shown in Tashkent time, whatever the computer's zone. */
const dateTime = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Tashkent',
})

export function formatDateTime(value: string | Date | null | undefined, empty = '—'): string {
  if (!value) return empty
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? empty : dateTime.format(date)
}

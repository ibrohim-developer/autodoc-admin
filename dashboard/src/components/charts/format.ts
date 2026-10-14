const compact = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 })
const whole = new Intl.NumberFormat('ru-RU')

/** 1 284 → "1,3 тыс." from ten thousand up; exact below. */
export function formatCount(value: number): string {
  return value >= 10_000 ? compact.format(value) : whole.format(value)
}

/** Seconds as "2 мин 05 с" / "45 с". */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds < 60) return `${seconds} с`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} мин ${String(seconds % 60).padStart(2, '0')} с`
}

const dayLabel = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

/** "14 окт." for a YYYY-MM-DD day. */
export function formatDay(day: string): string {
  return dayLabel.format(new Date(`${day}T00:00:00Z`))
}

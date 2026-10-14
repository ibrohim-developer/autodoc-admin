import { formatCount } from './format'

export type BarItem = { key: string; label: string; value: number; hint?: string }

/**
 * A ranked list with a bar under each row: sources, devices, languages. One measure, one hue;
 * the number is written out, so the bar only helps compare.
 */
export function BarList({ items, empty = 'Нет данных' }: { items: BarItem[]; empty?: string }) {
  const max = Math.max(0, ...items.map((item) => item.value))
  const total = items.reduce((sum, item) => sum + item.value, 0)
  if (items.length === 0 || total === 0) {
    return <p className="text-muted-foreground text-sm">{empty}</p>
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key} title={item.hint}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="shrink-0 tabular-nums">
              {formatCount(item.value)}
              <span className="ml-1.5 text-muted-foreground text-xs">
                {Math.round((item.value / total) * 100)}%
              </span>
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/80"
              style={{ width: `${max > 0 ? (item.value / max) * 100 : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/cn'

/** A headline number, with the change against the previous period of the same length. */
export function StatTile({
  label,
  value,
  current,
  previous,
  className,
}: {
  label: string
  /** As shown: "1 284", "2 мин 05 с". */
  value: string
  /** For the change; left out when it makes no sense (an average with no data). */
  current?: number
  previous?: number
  className?: string
}) {
  let delta: { text: string; up: boolean } | null = null
  if (current !== undefined && previous !== undefined && previous > 0) {
    const change = Math.round(((current - previous) / previous) * 100)
    delta = { text: `${change > 0 ? '+' : ''}${change}%`, up: change >= 0 }
  }
  return (
    <div className={cn('rounded-xl border bg-card p-4', className)}>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 font-semibold text-2xl tracking-tight">{value}</p>
      {delta ? (
        <p className="mt-1 flex items-center gap-1 text-muted-foreground text-xs">
          {delta.up ? (
            <ArrowUpRight className="size-3.5 text-primary" aria-hidden="true" />
          ) : (
            <ArrowDownRight className="size-3.5 text-destructive" aria-hidden="true" />
          )}
          {delta.text} к прошлому периоду
        </p>
      ) : current !== undefined && previous === 0 ? (
        <p className="mt-1 text-muted-foreground text-xs">В прошлом периоде данных нет</p>
      ) : null}
    </div>
  )
}

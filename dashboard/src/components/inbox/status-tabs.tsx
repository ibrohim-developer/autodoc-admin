import { cn } from '@/lib/cn'

/** "Все 12 · Новые 3 · В работе 2…": the list's status filter with a count on each. */
export function StatusTabs<S extends string>({
  statuses,
  labels,
  counts,
  value,
  onChange,
}: {
  statuses: readonly S[]
  labels: Record<S, string>
  counts: Record<S, number> | undefined
  value: S | undefined
  onChange: (value: S | undefined) => void
}) {
  const total = counts ? statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0) : 0
  return (
    <div role="tablist" aria-label="Статус" className="flex flex-wrap gap-1.5">
      {[undefined, ...statuses].map((status) => {
        const selected = value === status
        return (
          <button
            key={status ?? 'all'}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(status)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              selected ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
            )}
          >
            {status ? labels[status] : 'Все'}
            <span className="ml-1.5 tabular-nums opacity-70">
              {status ? (counts?.[status] ?? 0) : total}
            </span>
          </button>
        )
      })}
    </div>
  )
}

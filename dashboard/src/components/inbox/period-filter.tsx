import { Input } from '@/components/ui/input'

export type Period = { from: string; to: string }

/** Two dates, both optional ("с" and "по", the last day included). */
export function PeriodFilter({
  value,
  onChange,
}: {
  value: Period
  onChange: (value: Period) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        aria-label="С даты"
        value={value.from}
        max={value.to || undefined}
        onChange={(event) => onChange({ ...value, from: event.target.value })}
        className="w-40"
      />
      <span className="text-muted-foreground text-sm">—</span>
      <Input
        type="date"
        aria-label="По дату"
        value={value.to}
        min={value.from || undefined}
        onChange={(event) => onChange({ ...value, to: event.target.value })}
        className="w-40"
      />
    </div>
  )
}

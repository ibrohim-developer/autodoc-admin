import { DatePicker } from '@/components/date-picker'

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
      <DatePicker
        aria-label="С даты"
        placeholder="С даты"
        value={value.from}
        max={value.to || undefined}
        clearable
        onChange={(from) => onChange({ ...value, from })}
        className="w-44"
      />
      <span className="text-muted-foreground text-sm">—</span>
      <DatePicker
        aria-label="По дату"
        placeholder="По дату"
        value={value.to}
        min={value.from || undefined}
        clearable
        onChange={(to) => onChange({ ...value, to })}
        className="w-44"
      />
    </div>
  )
}

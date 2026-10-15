import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/cn'
import { todayInTashkent } from '@/lib/content'

/**
 * Our own date and time pickers instead of the browser's (which look different in every
 * browser and ignore the admin's language). Values stay what the native inputs gave:
 * "2026-10-15" and "10:30", so forms and the API don't change.
 */

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const display = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const spoken = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'full', timeZone: 'UTC' })

/** "2026-10-15" ↔ a UTC midnight: date arithmetic without time zones getting in the way. */
const parse = (value: string): Date | null =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null
const iso = (date: Date) => date.toISOString().slice(0, 10)
const addDays = (value: string, days: number) => {
  const date = parse(value) as Date
  date.setUTCDate(date.getUTCDate() + days)
  return iso(date)
}
const addMonths = (value: string, months: number) => {
  const date = parse(value) as Date
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + months)
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, last))
  return iso(date)
}

export function formatDate(value: string): string {
  const date = parse(value)
  return date ? display.format(date) : ''
}

/** The six weeks shown for the month of `value`, Monday first. */
function weeksOf(value: string): string[] {
  const date = parse(value) as Date
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const offset = (first.getUTCDay() + 6) % 7
  const start = iso(first)
  return Array.from({ length: 42 }, (_, index) => addDays(start, index - offset))
}

const clamp = (value: string, min?: string, max?: string) =>
  min && value < min ? min : max && value > max ? max : value

export function Calendar({
  value,
  onSelect,
  min,
  max,
}: {
  value: string
  onSelect: (value: string) => void
  min?: string
  max?: string
}) {
  const today = todayInTashkent()
  // The day with the keyboard focus; the month shown is its month.
  const [focused, setFocused] = useState(() => clamp(parse(value) ? value : today, min, max))
  const grid = useRef<HTMLDivElement>(null)
  const moved = useRef(false)

  useEffect(() => {
    if (!moved.current) return
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)?.focus()
  }, [focused])

  const month = focused.slice(0, 7)
  const [year, monthIndex] = [Number(focused.slice(0, 4)), Number(focused.slice(5, 7)) - 1]
  const disabled = (day: string) => Boolean((min && day < min) || (max && day > max))

  function move(next: string) {
    moved.current = true
    setFocused(next)
  }

  function onKeyDown(event: KeyboardEvent) {
    const steps: Record<string, () => string> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => addMonths(focused, -1),
      PageDown: () => addMonths(focused, 1),
      Home: () => addDays(focused, -(((parse(focused) as Date).getUTCDay() + 6) % 7)),
      End: () => addDays(focused, 6 - (((parse(focused) as Date).getUTCDay() + 6) % 7)),
    }
    const step = steps[event.key]
    if (!step) return
    event.preventDefault()
    move(step())
  }

  return (
    <div className="w-[252px] select-none">
      <div className="mb-2 flex items-center justify-between">
        <p className="pl-1 font-semibold text-sm" aria-live="polite">
          {MONTHS[monthIndex]} {year}
        </p>
        <div className="flex gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Предыдущий месяц"
            onClick={() => setFocused(addMonths(focused, -1))}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Следующий месяц"
            onClick={() => setFocused(addMonths(focused, 1))}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <span key={day} className="py-1">
            {day}
          </span>
        ))}
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: arrow keys move between the day buttons. */}
      <div ref={grid} className="grid grid-cols-7 gap-0.5" onKeyDown={onKeyDown}>
        {weeksOf(focused).map((day) => {
          const selected = day === value
          const outside = !day.startsWith(month)
          return (
            <button
              key={day}
              type="button"
              data-day={day}
              tabIndex={day === focused ? 0 : -1}
              disabled={disabled(day)}
              aria-pressed={selected}
              aria-label={spoken.format(parse(day) as Date)}
              aria-current={day === today ? 'date' : undefined}
              onClick={() => onSelect(day)}
              className={cn(
                'grid h-8 place-items-center rounded-md text-[13px] tabular-nums outline-none transition-colors',
                'hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30',
                outside && 'text-muted-foreground/60',
                day === today && !selected && 'font-semibold text-primary',
                selected && 'bg-primary font-semibold text-primary-foreground hover:bg-primary/90',
              )}
            >
              {Number(day.slice(8))}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const triggerClass =
  'flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive data-[state=open]:border-ring'

/** A date field: the date in words, a calendar on click. `value` is "2026-10-15" or "". */
export function DatePicker({
  value,
  onChange,
  id,
  min,
  max,
  clearable = false,
  placeholder = 'Выберите дату',
  invalid,
  disabled,
  className,
  onBlur,
  ...aria
}: {
  value: string
  onChange: (value: string) => void
  id?: string
  min?: string
  max?: string
  /** Shows «Очистить» under the calendar. */
  clearable?: boolean
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  className?: string
  onBlur?: () => void
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  const today = todayInTashkent()
  const choose = (next: string) => {
    onChange(next)
    setOpen(false)
  }
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) onBlur?.()
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-invalid={invalid ? true : undefined}
          aria-label={aria['aria-label']}
          className={cn(triggerClass, className)}
        >
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value ? formatDate(value) : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <Calendar value={value} onSelect={choose} min={min} max={max} />
        <div className="mt-2 flex justify-between border-t pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={Boolean((min && today < min) || (max && today > max))}
            onClick={() => choose(today)}
          >
            Сегодня
          </Button>
          {clearable && value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => choose('')}
            >
              Очистить
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

const TIMES = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, '0')
  return `${hours}:${index % 2 ? '30' : '00'}`
})

/** "930", "9:3", "09.30" → "09:30"; null when it isn't a time. */
export function normalizeTime(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  const match =
    input.includes(':') || input.includes('.')
      ? /^(\d{1,2})[:.](\d{1,2})$/.exec(input.trim())
      : /^(\d{1,2})(\d{2})$/.exec(digits)
  if (!match)
    return /^\d{1,2}$/.test(digits) && Number(digits) < 24 ? `${digits.padStart(2, '0')}:00` : null
  const [hours, minutes] = [Number(match[1]), Number(match[2])]
  if (hours > 23 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** A time: type it ("930" works) or pick from the half hours. `value` is "10:30" or "". */
export function TimePicker({
  value,
  onChange,
  id,
  className,
  'aria-label': label,
}: {
  value: string
  onChange: (value: string) => void
  id?: string
  className?: string
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => setDraft(value), [value])

  function commit() {
    const time = normalizeTime(draft)
    if (time) onChange(time)
    else setDraft(value)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn('relative', className)}>
        <input
          id={id}
          aria-label={label}
          inputMode="numeric"
          placeholder="ЧЧ:ММ"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            }
          }}
          className={cn(triggerClass, 'pr-9 tabular-nums')}
        />
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Выбрать время"
            className="absolute inset-y-0 right-0 grid w-9 place-items-center rounded-r-lg text-muted-foreground hover:text-foreground"
          >
            <Clock className="size-4" aria-hidden="true" />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        align="end"
        className="w-28 p-1"
        onOpenAutoFocus={(event) => {
          // Start at the chosen time (or the first), not at midnight.
          event.preventDefault()
          const box = list.current
          const target =
            box?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ??
            box?.querySelector<HTMLButtonElement>('button')
          if (box && target) {
            box.scrollTop = target.offsetTop - box.clientHeight / 2 + target.offsetHeight / 2
            target.focus({ preventScroll: true })
          }
        }}
      >
        <div ref={list} className="relative max-h-56 overflow-y-auto">
          {(TIMES.includes(value) || !value ? TIMES : [...TIMES, value].sort()).map((time) => (
            <button
              key={time}
              type="button"
              aria-pressed={time === value}
              onClick={() => {
                onChange(time)
                setOpen(false)
              }}
              className={cn(
                'block w-full rounded-md px-2.5 py-1.5 text-left text-sm tabular-nums outline-none hover:bg-accent focus-visible:bg-accent',
                time === value && 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              {time}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

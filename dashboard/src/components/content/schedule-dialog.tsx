import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Tashkent is UTC+5 all year: no daylight saving to account for.
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000

/** A moment as the value of a datetime-local field, in Tashkent time: "2026-10-14T10:00". */
function toTashkentInput(date: Date): string {
  return new Date(date.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 16)
}

function fromTashkentInput(value: string): Date {
  return new Date(`${value}:00+05:00`)
}

function tomorrowMorning(): string {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return `${toTashkentInput(date).slice(0, 10)}T10:00`
}

/** The working copy goes live at the chosen time (checked every minute). */
export function ScheduleDialog({
  open,
  onOpenChange,
  current,
  pending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The time already set, if any. */
  current: string | null
  pending: boolean
  onSubmit: (at: string) => void
}) {
  const id = useId()
  const [value, setValue] = useState(() =>
    current ? toTashkentInput(new Date(current)) : tomorrowMorning(),
  )
  const at = value ? fromTashkentInput(value) : null
  const tooSoon = at !== null && at.getTime() < Date.now() + 60_000

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Опубликовать по расписанию</DialogTitle>
          <DialogDescription>
            В выбранное время на сайт выйдет черновик в том виде, в каком он будет сохранён.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={id}>Дата и время (Ташкент)</Label>
          <Input
            id={id}
            type="datetime-local"
            value={value}
            min={toTashkentInput(new Date(Date.now() + 2 * 60_000))}
            onChange={(event) => setValue(event.target.value)}
          />
          {tooSoon ? (
            <p className="text-destructive text-xs">Выберите время хотя бы на минуту позже.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Отмена
          </Button>
          <Button
            onClick={() => at && onSubmit(at.toISOString())}
            disabled={!at || tooSoon || pending}
          >
            Запланировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

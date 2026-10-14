import { ArrowDown, ArrowUp } from 'lucide-react'
import { useController } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/cn'
import { type MenuItem, NAV_ITEMS } from '../api/settings-form'

const labelOf = (key: string) => NAV_ITEMS.find((item) => item.key === key)?.label ?? key

/** The header menu and the footer: order with the arrows, hide with the switch. */
export function MenuField({ name }: { name: string }) {
  const { field } = useController({ name })
  const items: MenuItem[] = Array.isArray(field.value) ? field.value : []

  function move(index: number, delta: number) {
    const next = [...items]
    const [item] = next.splice(index, 1)
    if (item) next.splice(index + delta, 0, item)
    field.onChange(next)
  }

  return (
    <ol className="divide-y rounded-lg border">
      {items.map((item, index) => (
        <li key={item.key} className="flex items-center gap-3 px-3 py-2">
          <span className="w-5 text-right text-muted-foreground text-xs tabular-nums">
            {index + 1}
          </span>
          <span
            className={cn('flex-1 text-sm', !item.visible && 'text-muted-foreground line-through')}
          >
            {labelOf(item.key)}
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            disabled={index === 0}
            onClick={() => move(index, -1)}
            aria-label={`«${labelOf(item.key)}» выше`}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            disabled={index === items.length - 1}
            onClick={() => move(index, 1)}
            aria-label={`«${labelOf(item.key)}» ниже`}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
          <Switch
            checked={item.visible}
            onCheckedChange={(visible) =>
              field.onChange(items.map((entry, i) => (i === index ? { ...entry, visible } : entry)))
            }
            aria-label={`Показывать «${labelOf(item.key)}»`}
          />
        </li>
      ))}
    </ol>
  )
}

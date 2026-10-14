import { Monitor, Moon, Sun } from 'lucide-react'
import { type Theme, useThemeStore } from '@/stores/theme-store'
import { Button } from './ui/button'

const OPTIONS: ReadonlyArray<{ value: Theme; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Светлая тема', Icon: Sun },
  { value: 'dark', label: 'Тёмная тема', Icon: Moon },
  { value: 'system', label: 'Как в системе', Icon: Monitor },
]

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <fieldset className="inline-flex items-center gap-1 rounded-lg border border-border p-1">
      <legend className="sr-only">Тема оформления</legend>
      {OPTIONS.map(({ value, label, Icon }) => (
        <Button
          key={value}
          type="button"
          size="icon"
          variant={theme === value ? 'secondary' : 'ghost'}
          aria-label={label}
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
          className="size-7"
        >
          <Icon aria-hidden="true" />
        </Button>
      ))}
    </fieldset>
  )
}

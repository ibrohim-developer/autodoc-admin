import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/cn'
import { type Theme, useThemeStore } from '@/stores/theme-store'
import { Button } from './ui/button'

const OPTIONS: ReadonlyArray<{ value: Theme; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Светлая тема', Icon: Sun },
  { value: 'dark', label: 'Тёмная тема', Icon: Moon },
  { value: 'system', label: 'Как в системе', Icon: Monitor },
]

/** `onDark`: sits on the dark sidebar, so its colours don't follow the page theme. */
export function ThemeToggle({ onDark = false }: { onDark?: boolean }) {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <fieldset
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border p-1',
        onDark ? 'border-sidebar-border' : 'border-border',
      )}
    >
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
          className={cn(
            'size-7',
            onDark &&
              (theme === value
                ? 'bg-sidebar-active text-white hover:bg-sidebar-active'
                : 'text-sidebar-muted hover:bg-sidebar-active hover:text-white'),
          )}
        >
          <Icon aria-hidden="true" />
        </Button>
      ))}
    </fieldset>
  )
}

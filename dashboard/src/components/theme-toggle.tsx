import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/cn'
import { type Theme, useThemeStore } from '@/stores/theme-store'

const OPTIONS: ReadonlyArray<{ value: Theme; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Светлая тема', Icon: Sun },
  { value: 'dark', label: 'Тёмная тема', Icon: Moon },
  { value: 'system', label: 'Как в системе', Icon: Monitor },
]

/**
 * Light / dark / system as one row of three equal buttons. `onDark`: sits on the dark sidebar,
 * so its colours don't follow the page theme.
 */
export function ThemeToggle({ onDark = false }: { onDark?: boolean }) {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <fieldset
      className={cn(
        'm-0 grid w-full min-w-0 grid-cols-3 gap-0.5 rounded-lg border-0 p-0.5',
        onDark ? 'bg-sidebar-active/60' : 'bg-muted',
      )}
    >
      <legend className="sr-only">Тема оформления</legend>
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              'grid h-7 place-items-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary [&_svg]:size-4',
              onDark
                ? active
                  ? 'bg-[#3a3a3f] text-white'
                  : 'text-sidebar-muted hover:text-white'
                : active
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon aria-hidden="true" />
          </button>
        )
      })}
    </fieldset>
  )
}

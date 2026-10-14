import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'

type ThemeState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Single place that decides whether the `.dark` class is on <html>. */
export function applyTheme(theme: Theme): void {
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark())
  document.documentElement.classList.toggle('dark', isDark)
}

/**
 * Persisted under the `ui-theme` localStorage key. The inline script in
 * index.html reads the same key before first paint to avoid a theme flash —
 * if you rename this, rename it there too.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
    }),
    {
      name: 'ui-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      },
    },
  ),
)

/**
 * Keeps `system` honest: if the OS flips appearance while the app is open and
 * the user has not made an explicit choice, follow it. Called once from main.tsx.
 */
export function watchSystemTheme(): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (useThemeStore.getState().theme === 'system') applyTheme('system')
  }
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

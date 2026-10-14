// Applies the persisted theme before first paint so there is no flash of the wrong theme.
// Mirrors the shape written by src/stores/theme-store.ts. An external file, not an inline
// script: the API's Content-Security-Policy allows only same-origin scripts.
try {
  const raw = localStorage.getItem('ui-theme')
  const theme = raw ? JSON.parse(raw).state.theme : 'system'
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
} catch {
  /* localStorage unavailable (private mode) — fall back to light. */
}

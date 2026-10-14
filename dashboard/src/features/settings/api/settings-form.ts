import type { DocumentData } from '@/lib/content'

/** "Настройки сайта": contacts, social links, the map pin, the menu, the tracking codes. Rules: api/src/site-content/pages.ts. */

/** The menu items the site has, as they are named there (labels are in "Тексты сайта" → Меню). */
export const NAV_ITEMS = [
  { key: 'home', label: 'Главная' },
  { key: 'media', label: 'Медиа (блог)' },
  { key: 'history', label: 'История (о компании)' },
  { key: 'leadership', label: 'Руководство' },
  { key: 'projects', label: 'Проекты' },
  { key: 'career', label: 'Карьера' },
  { key: 'partners', label: 'Партнёры' },
  { key: 'contacts', label: 'Контакты' },
] as const
export type NavKey = (typeof NAV_ITEMS)[number]['key']

export type MenuItem = { key: NavKey; visible: boolean }

export type SettingsForm = {
  shared: {
    phone: string
    email: string
    socials: { linkedin: string; instagram: string }
    map: { lat: number | undefined; lon: number | undefined }
    menu: MenuItem[]
    /** Loaded by the site only after the visitor accepts cookies. Empty = not used. */
    tracking: { ga4: string; metrica: string; pixel: string }
  }
  locales: { uz: Record<string, never> }
}

/** What the site shows today: the first save changes nothing until something is edited. */
export function defaultSettings(): SettingsForm {
  return {
    shared: {
      phone: '+998 55 505 75 75',
      email: 'info@autodoc.uz',
      socials: {
        linkedin: 'https://www.linkedin.com/company/autodoc-holding',
        instagram: 'https://www.instagram.com/autodoc_holding/',
      },
      map: { lat: 41.3203, lon: 69.2673 },
      menu: NAV_ITEMS.map((item) => ({ key: item.key, visible: true })),
      tracking: { ga4: '', metrica: '', pixel: '' },
    },
    locales: { uz: {} },
  }
}

const text = (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback)

export function settingsFromData(data: DocumentData): SettingsForm {
  const defaults = defaultSettings().shared
  const shared = data.shared
  const socials = (shared.socials ?? {}) as Record<string, unknown>
  const map = (shared.map ?? {}) as Record<string, unknown>
  const tracking = (shared.tracking ?? {}) as Record<string, unknown>
  const saved = (Array.isArray(shared.menu) ? shared.menu : []) as MenuItem[]
  const known = NAV_ITEMS.map((item) => item.key) as string[]
  // Items the site gained since the last save appear at the end, shown.
  const menu = [
    ...saved.filter((item) => known.includes(item.key)),
    ...NAV_ITEMS.filter((item) => !saved.some((entry) => entry.key === item.key)).map((item) => ({
      key: item.key,
      visible: true,
    })),
  ]
  return {
    shared: {
      phone: text(shared.phone, defaults.phone),
      email: text(shared.email, defaults.email),
      socials: {
        linkedin: text(socials.linkedin, ''),
        instagram: text(socials.instagram, ''),
      },
      map: {
        lat: typeof map.lat === 'number' ? map.lat : defaults.map.lat,
        lon: typeof map.lon === 'number' ? map.lon : defaults.map.lon,
      },
      menu,
      tracking: {
        ga4: text(tracking.ga4, ''),
        metrica: text(tracking.metrica, ''),
        pixel: text(tracking.pixel, ''),
      },
    },
    locales: { uz: {} },
  }
}

export function settingsToData(values: SettingsForm): DocumentData {
  const { shared } = values
  return {
    shared: {
      phone: shared.phone.trim(),
      email: shared.email.trim(),
      socials: {
        linkedin: shared.socials.linkedin.trim(),
        instagram: shared.socials.instagram.trim(),
      },
      map: { lat: shared.map.lat, lon: shared.map.lon },
      menu: shared.menu,
      tracking: {
        ga4: shared.tracking.ga4.trim().toUpperCase(),
        metrica: shared.tracking.metrica.trim(),
        pixel: shared.tracking.pixel.trim(),
      },
    },
    locales: { uz: {} },
  }
}

import { createHash } from 'node:crypto'
import { DEFAULT_LOCALE, type Locale } from './locales.js'
import { isEmptyRichText, isRichText } from './rich-text.js'

/**
 * The shape of every content document: fields that are the same in all languages, plus one
 * block per language. Uzbek is always there; Russian and English may be missing or partial.
 */
export type DocumentData = {
  shared: Record<string, unknown>
  locales: {
    uz: Record<string, unknown>
    ru?: Record<string, unknown>
    en?: Record<string, unknown>
  }
}

/** JSON with keys sorted at every level, so equal content always hashes the same. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** Postgres jsonb reorders keys, so plain JSON.stringify can't tell whether content changed. */
export function hashData(data: unknown): string {
  return createHash('sha256').update(stableStringify(data)).digest('hex')
}

/** Every `mediaId` anywhere in the document: covers, galleries, photos inside the text. */
export function collectMediaIds(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectMediaIds(item, into)
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'mediaId' && typeof item === 'string') into.add(item)
      else collectMediaIds(item, into)
    }
  }
  return into
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (isRichText(value)) return isEmptyRichText(value)
  return false
}

/**
 * What the site shows in one language: shared fields, then the Uzbek fields, then whatever the
 * requested language actually has. An untranslated field — or a whole untranslated document —
 * shows in Uzbek.
 */
export function localize(
  data: DocumentData,
  locale: Locale,
): { fields: Record<string, unknown>; translated: boolean } {
  const fields: Record<string, unknown> = { ...data.shared, ...data.locales[DEFAULT_LOCALE] }
  if (locale === DEFAULT_LOCALE) return { fields, translated: true }

  const own = data.locales[locale]
  let translated = false
  for (const [key, value] of Object.entries(own ?? {})) {
    if (isEmptyValue(value)) continue
    fields[key] = value
    translated = true
  }
  return { fields, translated }
}

/** Which languages have any content, for the dashboard's language tabs. */
export function filledLocales(data: DocumentData): Locale[] {
  const locales: Locale[] = [DEFAULT_LOCALE]
  for (const locale of ['ru', 'en'] as const) {
    const own = data.locales[locale]
    if (own && Object.values(own).some((value) => !isEmptyValue(value))) locales.push(locale)
  }
  return locales
}

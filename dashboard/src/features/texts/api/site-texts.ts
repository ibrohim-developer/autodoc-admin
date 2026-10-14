import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { request } from '@/lib/api-client'
import type { DocumentData, Issue } from '@/lib/content'
import { LOCALES, type Locale } from '@/lib/media'

/**
 * "Тексты сайта": the site's defaults (messages/*.json as deployed) and the document with what
 * marketing changed, per language, as "Hero.title" → text. The rules: api/src/site-content/site-texts.ts.
 */

const messagesSchema = z.record(z.string(), z.unknown())
const defaultsSchema = z.object({ uz: messagesSchema, ru: messagesSchema, en: messagesSchema })
export type TextDefaults = z.infer<typeof defaultsSchema>

export function useTextDefaults() {
  return useQuery({
    queryKey: ['site-texts', 'defaults'],
    queryFn: () => request('admin/site-texts/defaults', { schema: defaultsSchema }),
    staleTime: 60_000,
  })
}

/** Every text of a messages object as "Hero.title" → text. */
export function flatten(messages: unknown, prefix = '', into: Record<string, string> = {}) {
  if (typeof messages === 'string') {
    if (prefix) into[prefix] = messages
  } else if (messages && typeof messages === 'object') {
    for (const [key, value] of Object.entries(messages)) {
      flatten(value, prefix ? `${prefix}.${key}` : key, into)
    }
  }
  return into
}

/** The other way round, for the form: field names with dots are nested objects there. */
export function unflatten(flat: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(flat)) {
    const path = key.split('.')
    const last = path.pop()
    let node = result
    for (const segment of path) {
      if (!node[segment] || typeof node[segment] !== 'object') node[segment] = {}
      node = node[segment] as Record<string, unknown>
    }
    if (last) node[last] = value
  }
  return result
}

/** `{network}` and `{count, plural, …}`: what the site fills in, so an edited text must keep it. */
export function placeholdersOf(text: string): string[] {
  return [
    ...new Set([...text.matchAll(/\{\s*([A-Za-z0-9_]+)\s*[,}]/g)].map((m) => m[1] ?? '')),
  ].sort()
}

/** Shown on this screen: SEO titles and descriptions are edited under "Страницы". */
export function isEditableText(key: string): boolean {
  return !key.startsWith('Metadata.') && !/\.meta(Title|Description)$/.test(key)
}

export type TextsForm = {
  shared: { overrides: Record<Locale, Record<string, unknown>> }
  locales: { uz: Record<string, never> }
}

export function emptyTexts(): TextsForm {
  return { shared: { overrides: { uz: {}, ru: {}, en: {} } }, locales: { uz: {} } }
}

export function textsFromData(data: DocumentData): TextsForm {
  const overrides = (data.shared.overrides ?? {}) as Partial<Record<Locale, Record<string, string>>>
  return {
    shared: {
      overrides: {
        uz: unflatten(overrides.uz ?? {}),
        ru: unflatten(overrides.ru ?? {}),
        en: unflatten(overrides.en ?? {}),
      },
    },
    locales: { uz: {} },
  }
}

/** Only what differs from the code is kept: an emptied field means "back to the default". */
export function textsToData(values: TextsForm): DocumentData {
  const overrides = Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      Object.fromEntries(
        Object.entries(flatten(values.shared.overrides[locale]))
          .map(([key, value]) => [key, value.trim()] as const)
          .filter(([, value]) => value !== ''),
      ),
    ]),
  )
  return { shared: { overrides }, locales: { uz: {} } }
}

export function textsHasLocale(values: TextsForm, locale: Locale): boolean {
  return Object.values(flatten(values.shared.overrides[locale])).some((value) => value.trim())
}

/** Every changed text that lost or gained a {placeholder} compared with its default. */
export function placeholderIssues(values: TextsForm, defaults: TextDefaults): Issue[] {
  const issues: Issue[] = []
  for (const locale of LOCALES) {
    const own = flatten(defaults[locale])
    for (const [key, value] of Object.entries(flatten(values.shared.overrides[locale]))) {
      const fallback = own[key]
      if (!value.trim() || fallback === undefined) continue
      const expected = placeholdersOf(fallback)
      if (expected.join() !== placeholdersOf(value).join()) {
        issues.push({
          path: `shared.overrides.${locale}.${key}`,
          message: expected.length
            ? `Оставьте в тексте ${expected.map((name) => `{${name}}`).join(', ')}: сайт подставляет туда значение`
            : 'Уберите фигурные скобки: в этом тексте сайт ничего не подставляет',
        })
      }
    }
  }
  return issues
}

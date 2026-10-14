import { z } from 'zod'
import type { ContentTypeDef } from '../content/content-types.js'
import { CONTENT, localePath } from './fields.js'

/**
 * "Тексты сайта": every text and button of the site can be changed here. The defaults stay in
 * the site's messages/{uz,ru,en}.json; this document holds only what marketing changed, per
 * language, as "Hero.title" → text. A text not changed here follows the code.
 *
 * Unlike other content, a missing translation does not fall back to Uzbek: it falls back to
 * that language's own default. So the changes live in `shared`, outside the per-language part.
 */
export const TEXT_KEY = /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9]+){0,6}$/

/** `{name}` and `{count, plural, …}` arguments: an edited text must keep its default's. */
export function placeholdersOf(text: string): string[] {
  return [
    ...new Set([...text.matchAll(/\{\s*([A-Za-z0-9_]+)\s*[,}]/g)].map((match) => match[1] ?? '')),
  ].sort()
}

/** Braces must pair up, or the site's message formatter fails on the text. */
export function bracesBalanced(text: string): boolean {
  let depth = 0
  for (const char of text) {
    if (char === '{') depth += 1
    else if (char === '}') depth -= 1
    if (depth < 0) return false
  }
  return depth === 0
}

const overrides = z.record(
  z.string().regex(TEXT_KEY),
  z
    .string()
    .trim()
    .min(1, 'Пустой текст: чтобы вернуть исходный, сбросьте его')
    .max(5000, 'Не длиннее 5000 символов')
    .refine(bracesBalanced, 'Фигурные скобки { } должны быть парными'),
  // A key that isn't a message key: zod's own wording would reach the editor otherwise.
  { error: (issue) => (issue.code === 'invalid_key' ? 'Неизвестный текст' : undefined) },
)

export const siteTextsType: ContentTypeDef = {
  type: 'site_texts',
  label: 'Тексты сайта',
  permissions: CONTENT,
  singleton: true,
  shared: z.object({
    overrides: z.object({ uz: overrides, ru: overrides, en: overrides }),
  }),
  localized: z.object({}),
  title: () => 'Тексты сайта',
  // "Предпросмотр" opens the home page with the unpublished texts.
  sitePath: (_data, _slug, locale) => localePath(locale, '/'),
}

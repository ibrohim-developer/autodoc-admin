import type { JSONContent } from '@tiptap/core'

/**
 * The editor's content as stored: TipTap JSON. The API validates it against the same short list
 * of elements (api/src/content/rich-text.ts), so the editor only offers what the site renders.
 */
export type RichTextDoc = JSONContent & { type: 'doc' }

export const EMPTY_DOC: RichTextDoc = { type: 'doc', content: [{ type: 'paragraph' }] }

/** Same rule as the API: web, mail and phone links, or a path on the site. */
export function isSafeHref(href: string): boolean {
  if (href.startsWith('/') && !href.startsWith('//')) return true
  if (href.startsWith('#')) return true
  try {
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(new URL(href).protocol)
  } catch {
    return false
  }
}

/** "autodoc.uz/about" → "https://autodoc.uz/about"; "+998 55…" → "tel:+99855…". */
export function normalizeHref(input: string): string {
  const value = input.trim()
  if (!value) return ''
  if (/^\+?[\d\s()-]{7,}$/.test(value)) return `tel:${value.replace(/[^\d+]/g, '')}`
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(value)) return value
  return `https://${value}`
}

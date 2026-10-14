import { z } from 'zod'
import type { ContentTypeDef } from '../src/content/content-types.js'
import { richTextSchema } from '../src/content/rich-text.js'

/**
 * A content type that exists only in tests: a title, a body, a cover photo and a page of its
 * own, which is everything the core has to handle for the real types in Stage 3.
 */
export const noteType: ContentTypeDef = {
  type: 'note',
  label: 'Заметка',
  permissions: {
    read: 'content.read',
    write: 'content.write',
    publish: 'content.publish',
    trash: 'trash.content',
  },
  shared: z.object({
    slug: z.string().max(80).optional(),
    cover: z.object({ mediaId: z.uuid() }).nullable().optional(),
  }),
  localized: z.object({
    title: z.string().trim().min(1, 'Укажите заголовок').max(200),
    body: richTextSchema,
  }),
  title: (data) => String(data.locales.uz.title ?? ''),
  slug: (data) => (data.shared.slug as string | undefined) || String(data.locales.uz.title ?? ''),
  sitePath: (_data, slug, locale) =>
    slug ? `${locale === 'uz' ? '' : `/${locale}`}/notes/${slug}/` : null,
}

export const paragraph = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

export function note(title: string, extra: { ru?: object; en?: object; shared?: object } = {}) {
  return {
    shared: { ...(extra.shared ?? {}) },
    locales: {
      uz: { title, body: paragraph(`${title} matni`) },
      ...(extra.ru ? { ru: extra.ru } : {}),
      ...(extra.en ? { en: extra.en } : {}),
    },
  }
}

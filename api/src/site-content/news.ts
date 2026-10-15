import { z } from 'zod'
import type { ContentTypeDef } from '../content/content-types.js'
import { excerpt, isRichText, richTextSchema, richTextToPlain } from '../content/rich-text.js'
import {
  CONTENT,
  focalPoint,
  isoDate,
  localePath,
  mediaRef,
  requiredText,
  slugField,
  text,
  videoUrl,
} from './fields.js'

/** Characters of the text a news card shows under its title. */
const EXCERPT_LENGTH = 200

/** Categories for the news list's filter. Saved = live: there is nothing to preview. */
export const postCategoryType: ContentTypeDef = {
  type: 'post_category',
  label: 'Категория новостей',
  permissions: CONTENT,
  shared: z.object({
    slug: slugField,
    order: z.number().int().min(0).max(9999).optional(),
  }),
  localized: z.object({ name: requiredText(60, 'Укажите название') }),
  title: (data) => String(data.locales.uz.name ?? ''),
  slug: (data) => String(data.shared.slug || data.locales.uz.name || ''),
  publishOnSave: true,
  order: [{ field: 'order', direction: 'asc', cast: 'number' }],
  adminOrder: true,
  summary: { shared: ['order'], localized: ['name'] },
}

/**
 * A news post (the site calls the section "Блог"). Its page is /blog/<slug>/; posts moved from
 * the old site keep their numeric addresses (/blog/14/).
 */
export const postType: ContentTypeDef = {
  type: 'post',
  label: 'Новость',
  permissions: CONTENT,
  shared: z.object({
    slug: slugField,
    /** The date on the card and the article. The list is ordered by publication, pinned first. */
    date: isoDate,
    cover: mediaRef.nullable().optional(),
    coverPosition: focalPoint.optional(),
    /** The article shows the whole photo instead of the cropped banner. */
    coverFull: z.boolean().optional(),
    pinned: z.boolean().optional(),
    categoryId: z.uuid().nullable().optional(),
    gallery: z.array(mediaRef).max(40, 'Не больше 40 фото').optional(),
    videoUrl: videoUrl.nullable().optional(),
    /** For link previews in messengers and social networks; the cover when empty. */
    ogImage: mediaRef.nullable().optional(),
  }),
  localized: z.object({
    title: requiredText(200, 'Укажите заголовок'),
    body: richTextSchema,
    tags: z.array(requiredText(40, 'Пустой тег')).max(10, 'Не больше 10 тегов').optional(),
    seoTitle: text(120).optional(),
    seoDescription: text(300).optional(),
  }),
  title: (data) => String(data.locales.uz.title ?? ''),
  slug: (data) => String(data.shared.slug || data.locales.uz.title || ''),
  sitePath: (_data, slug, locale) => (slug ? localePath(locale, `/blog/${slug}/`) : null),
  /** The card's lines under the title (and the SEO description fallback): the text's beginning. */
  computed: (fields) => ({
    excerpt: isRichText(fields.body) ? excerpt(richTextToPlain(fields.body), EXCERPT_LENGTH) : '',
  }),
  publishCheck: (data) =>
    data.shared.cover ? [] : [{ path: 'shared.cover', message: 'Выберите обложку' }],
  order: [{ field: 'pinned', direction: 'desc', cast: 'boolean' }],
  summary: {
    shared: ['date', 'cover', 'coverPosition', 'pinned', 'categoryId'],
    localized: ['title', 'excerpt'],
  },
  references: [{ field: 'categoryId', type: 'post_category', label: 'Категория' }],
}

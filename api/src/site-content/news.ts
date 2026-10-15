import { z } from 'zod'
import type { ContentTypeDef } from '../content/content-types.js'
import type { DocumentData } from '../content/document-data.js'
import type { Locale } from '../content/locales.js'
import {
  excerpt,
  isEmptyRichText,
  isRichText,
  type RichText,
  richTextSchema,
  richTextToPlain,
} from '../content/rich-text.js'
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

/** A block's id: short, stable through reordering, and the key of its texts per language. */
const blockId = z.string().regex(/^[a-z0-9]{1,24}$/, 'Неверный id блока')

/**
 * The article as an ordered list of blocks. Photos, galleries and videos are the same in every
 * language; a text block's text and a photo's caption are per language (`locales.*.blocks`).
 */
const blockSchema = z.discriminatedUnion('type', [
  z.object({ id: blockId, type: z.literal('text') }),
  z.object({ id: blockId, type: z.literal('image'), image: mediaRef.nullable() }),
  z.object({
    id: blockId,
    type: z.literal('gallery'),
    items: z.array(mediaRef).max(40, 'Не больше 40 фото в галерее'),
  }),
  z.object({ id: blockId, type: z.literal('video'), url: videoUrl.or(z.literal('')) }),
])
type Block = z.infer<typeof blockSchema>

/** A block's words in one language. */
const blockTextSchema = z.object({
  text: richTextSchema.optional(),
  caption: text(300).optional(),
})

const MAX_BLOCKS = 100

/** Characters of the text a news card shows under its title. */
const EXCERPT_LENGTH = 200

type BlockTexts = Record<string, { text?: RichText; caption?: string }>

function blockTexts(data: DocumentData, locale: Locale): BlockTexts {
  return (data.locales[locale]?.blocks as BlockTexts | undefined) ?? {}
}

/**
 * The article as the site renders it, in one language: each block with its own words, a
 * text or caption not yet translated taken from Uzbek block by block.
 */
export function resolveBlocks(data: DocumentData, locale: Locale): Record<string, unknown>[] {
  const blocks = (data.shared.blocks as Block[] | undefined) ?? []
  const own = blockTexts(data, locale)
  const uz = blockTexts(data, 'uz')
  const pick = (id: string) => {
    const mine = own[id] ?? {}
    const base = uz[id] ?? {}
    return {
      text: mine.text && !isEmptyRichText(mine.text) ? mine.text : base.text,
      caption: mine.caption?.trim() ? mine.caption : base.caption,
    }
  }
  return blocks.flatMap((block): Record<string, unknown>[] => {
    switch (block.type) {
      case 'text': {
        const { text: body } = pick(block.id)
        return body && !isEmptyRichText(body) ? [{ type: 'text', id: block.id, body }] : []
      }
      case 'image': {
        if (!block.image) return []
        return [
          {
            type: 'image',
            id: block.id,
            image: block.image,
            caption: pick(block.id).caption ?? '',
          },
        ]
      }
      case 'gallery':
        return block.items.length > 0 ? [{ type: 'gallery', id: block.id, items: block.items }] : []
      case 'video':
        return block.url ? [{ type: 'video', id: block.id, url: block.url }] : []
      default:
        return []
    }
  })
}

/**
 * The fields the site read before blocks existed, made from the blocks: one text (with the
 * photos in it), one gallery, one video. A site not yet rendering `blocks` keeps working.
 */
function legacyFields(blocks: Record<string, unknown>[]) {
  const content: RichText['content'] = []
  const gallery: { mediaId: string }[] = []
  let video: string | null = null
  for (const block of blocks) {
    if (block.type === 'text') content.push(...((block.body as RichText).content ?? []))
    if (block.type === 'image') {
      content.push({
        type: 'image',
        attrs: { mediaId: (block.image as { mediaId: string }).mediaId },
      })
    }
    if (block.type === 'gallery') gallery.push(...(block.items as { mediaId: string }[]))
    if (block.type === 'video') video ??= block.url as string
  }
  return { body: { type: 'doc', content } satisfies RichText, gallery, videoUrl: video }
}

/** Uzbek text of the article, for the excerpt and the publish check. */
function plainText(fields: Record<string, unknown>, blocks: Record<string, unknown>[] | null) {
  if (blocks) {
    return blocks
      .filter((block) => block.type === 'text')
      .map((block) => richTextToPlain(block.body as RichText))
      .join(' ')
  }
  return isRichText(fields.body) ? richTextToPlain(fields.body) : ''
}

/**
 * A news post (the site calls the section "Блог"). Its page is /blog/<slug>/; posts moved from
 * the old site keep their numeric addresses (/blog/14/).
 *
 * The text is a list of blocks (`shared.blocks` + `locales.*.blocks`). Posts saved before
 * blocks existed still have `body`, `gallery` and `videoUrl`; the editor turns them into blocks
 * the first time it opens them.
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
    blocks: z
      .array(blockSchema)
      .max(MAX_BLOCKS, `Не больше ${MAX_BLOCKS} блоков`)
      .refine((blocks) => new Set(blocks.map((b) => b.id)).size === blocks.length, 'Блок дважды')
      .optional(),
    /** Before blocks: kept for posts not yet re-saved. */
    gallery: z.array(mediaRef).max(40, 'Не больше 40 фото').optional(),
    videoUrl: videoUrl.nullable().optional(),
    /** For link previews in messengers and social networks; the cover when empty. */
    ogImage: mediaRef.nullable().optional(),
  }),
  localized: z.object({
    title: requiredText(200, 'Укажите заголовок'),
    blocks: z.record(blockId, blockTextSchema).optional(),
    /** Before blocks. */
    body: richTextSchema.optional(),
    tags: z.array(requiredText(40, 'Пустой тег')).max(10, 'Не больше 10 тегов').optional(),
    seoTitle: text(120).optional(),
    seoDescription: text(300).optional(),
  }),
  title: (data) => String(data.locales.uz.title ?? ''),
  slug: (data) => String(data.shared.slug || data.locales.uz.title || ''),
  sitePath: (_data, slug, locale) => (slug ? localePath(locale, `/blog/${slug}/`) : null),
  /**
   * `blocks` in the visitor's language, the fields of the old single-text layout made from them,
   * and the card's lines under the title (also the SEO description fallback): the text's start.
   */
  computed: (fields, data, locale) => {
    const blocks = Array.isArray(data.shared.blocks) ? resolveBlocks(data, locale) : null
    return {
      ...(blocks ? { blocks, ...legacyFields(blocks) } : {}),
      excerpt: excerpt(plainText(fields, blocks), EXCERPT_LENGTH),
    }
  },
  publishCheck: (data) => {
    const issues = data.shared.cover ? [] : [{ path: 'shared.cover', message: 'Выберите обложку' }]
    const blocks = Array.isArray(data.shared.blocks) ? resolveBlocks(data, 'uz') : null
    if (!plainText(data.locales.uz, blocks).trim() && !blocks?.some((b) => b.type !== 'text')) {
      issues.push({ path: 'shared.blocks', message: 'Добавьте текст материала' })
    }
    return issues
  },
  order: [{ field: 'pinned', direction: 'desc', cast: 'boolean' }],
  adminOrder: true,
  summary: {
    shared: ['date', 'cover', 'coverPosition', 'pinned', 'categoryId'],
    localized: ['title', 'excerpt'],
  },
  references: [{ field: 'categoryId', type: 'post_category', label: 'Категория' }],
}

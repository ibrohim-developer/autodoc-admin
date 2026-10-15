import type { MediaRef } from '@/components/content/media-fields'
import { compactTranslation, type DocumentData, todayInTashkent } from '@/lib/content'
import type { Locale } from '@/lib/media'
import { EMPTY_DOC, excerpt, type RichTextDoc, richTextToPlain } from '@/lib/rich-text'

/**
 * A news post as the form holds it. The API's rules: api/src/site-content/news.ts.
 *
 * The article is a list of blocks. Their order, photos, galleries and videos are shared by all
 * languages (`shared.blocks`); a text block's text and a photo's caption are per language
 * (`locales.<lang>.blocks.<id>`), and an untranslated one shows the Uzbek one on the site.
 */
export type BlockType = 'text' | 'image' | 'gallery' | 'video'

export type FormBlock = {
  id: string
  type: BlockType
  image: MediaRef | null
  items: MediaRef[]
  url: string
}

export type BlockWords = { text: RichTextDoc; caption: string }

export type PostLocale = {
  title: string
  blocks: Record<string, BlockWords>
  tags: string[]
  seoTitle: string
  seoDescription: string
}

export type PostForm = {
  shared: {
    slug: string
    date: string
    cover: MediaRef | null
    coverPosition: string
    coverFull: boolean
    pinned: boolean
    categoryId: string | null
    blocks: FormBlock[]
    ogImage: MediaRef | null
  }
  locales: Record<Locale, PostLocale>
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  text: 'Текст',
  image: 'Фото',
  gallery: 'Галерея',
  video: 'Видео',
}

/** Short, unique within the post, stable when blocks move. */
export function newBlockId(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, '0')
}

export function newBlock(type: BlockType): FormBlock {
  return { id: newBlockId(), type, image: null, items: [], url: '' }
}

export const emptyWords = (): BlockWords => ({ text: EMPTY_DOC, caption: '' })

const text = (value: unknown) => (typeof value === 'string' ? value : '')

const ref = (value: unknown): MediaRef | null =>
  value && typeof value === 'object' && typeof (value as MediaRef).mediaId === 'string'
    ? { mediaId: (value as MediaRef).mediaId }
    : null

const refs = (value: unknown): MediaRef[] =>
  Array.isArray(value) ? value.map(ref).filter((item): item is MediaRef => item !== null) : []

const doc = (value: unknown): RichTextDoc =>
  value && typeof value === 'object' && (value as { type?: unknown }).type === 'doc'
    ? (value as RichTextDoc)
    : EMPTY_DOC

const emptyLocale = (blocks: FormBlock[]): PostLocale => ({
  title: '',
  blocks: Object.fromEntries(blocks.map((block) => [block.id, emptyWords()])),
  tags: [],
  seoTitle: '',
  seoDescription: '',
})

export function emptyPost(): PostForm {
  const blocks = [newBlock('text')]
  return {
    shared: {
      slug: '',
      date: todayInTashkent(),
      cover: null,
      coverPosition: '',
      coverFull: false,
      pinned: false,
      categoryId: null,
      blocks,
      ogImage: null,
    },
    locales: { uz: emptyLocale(blocks), ru: emptyLocale(blocks), en: emptyLocale(blocks) },
  }
}

const BLOCK_TYPES = ['text', 'image', 'gallery', 'video'] as const

function blocksOf(data: DocumentData): { blocks: FormBlock[]; legacyTextId: string | null } {
  if (Array.isArray(data.shared.blocks)) {
    const blocks = data.shared.blocks.flatMap((raw): FormBlock[] => {
      const item = raw as Record<string, unknown>
      const type = BLOCK_TYPES.find((value) => value === item.type)
      if (!type || typeof item.id !== 'string') return []
      return [
        { id: item.id, type, image: ref(item.image), items: refs(item.items), url: text(item.url) },
      ]
    })
    return { blocks, legacyTextId: null }
  }
  // Saved before blocks: the text, the gallery and the video become three blocks.
  const textBlock = newBlock('text')
  const blocks = [textBlock]
  const gallery = refs(data.shared.gallery)
  if (gallery.length > 0) blocks.push({ ...newBlock('gallery'), items: gallery })
  const video = text(data.shared.videoUrl)
  if (video) blocks.push({ ...newBlock('video'), url: video })
  return { blocks, legacyTextId: textBlock.id }
}

export function postFromData(data: DocumentData): PostForm {
  const shared = data.shared
  const { blocks, legacyTextId } = blocksOf(data)
  const locale = (code: Locale): PostLocale => {
    const fields = data.locales[code] ?? {}
    const stored = (fields.blocks ?? {}) as Record<string, { text?: unknown; caption?: unknown }>
    return {
      title: text(fields.title),
      blocks: Object.fromEntries(
        blocks.map((block) => [
          block.id,
          block.id === legacyTextId
            ? { text: doc(fields.body), caption: '' }
            : { text: doc(stored[block.id]?.text), caption: text(stored[block.id]?.caption) },
        ]),
      ),
      tags: Array.isArray(fields.tags) ? fields.tags.filter((tag) => typeof tag === 'string') : [],
      seoTitle: text(fields.seoTitle),
      seoDescription: text(fields.seoDescription),
    }
  }
  return {
    shared: {
      slug: text(shared.slug),
      date: text(shared.date) || todayInTashkent(),
      cover: ref(shared.cover),
      coverPosition: text(shared.coverPosition),
      coverFull: shared.coverFull === true,
      pinned: shared.pinned === true,
      categoryId: typeof shared.categoryId === 'string' ? shared.categoryId : null,
      blocks,
      ogImage: ref(shared.ogImage),
    },
    locales: { uz: locale('uz'), ru: locale('ru'), en: locale('en') },
  }
}

const hasText = (value: RichTextDoc | undefined) => richTextToPlain(value).length > 0

/** One language's words for the blocks that exist; empty ones are left out. */
function wordsToData(blocks: FormBlock[], words: Record<string, BlockWords>) {
  const out: Record<string, { text?: RichTextDoc; caption?: string }> = {}
  for (const block of blocks) {
    const entry = words[block.id]
    if (!entry) continue
    if (block.type === 'text' && hasText(entry.text)) out[block.id] = { text: entry.text }
    if (block.type === 'image' && entry.caption.trim()) {
      out[block.id] = { caption: entry.caption.trim() }
    }
  }
  return out
}

function localeToData(values: PostLocale, blocks: FormBlock[], full: boolean) {
  const { blocks: words, ...rest } = values
  const blockData = wordsToData(blocks, words)
  const fields = full ? rest : compactTranslation(rest)
  return Object.keys(blockData).length > 0 ? { ...fields, blocks: blockData } : fields
}

export function postToData(values: PostForm): DocumentData {
  const shared = values.shared
  const blocks = shared.blocks
  const ru = localeToData(values.locales.ru, blocks, false)
  const en = localeToData(values.locales.en, blocks, false)
  return {
    shared: {
      slug: shared.slug,
      date: shared.date,
      cover: shared.cover,
      ...(shared.coverPosition ? { coverPosition: shared.coverPosition } : {}),
      coverFull: shared.coverFull,
      pinned: shared.pinned,
      categoryId: shared.categoryId,
      blocks: blocks.map((block) => {
        if (block.type === 'image') return { id: block.id, type: block.type, image: block.image }
        if (block.type === 'gallery') return { id: block.id, type: block.type, items: block.items }
        if (block.type === 'video') return { id: block.id, type: block.type, url: block.url.trim() }
        return { id: block.id, type: block.type }
      }),
      ogImage: shared.ogImage,
    },
    locales: {
      uz: localeToData(values.locales.uz, blocks, true),
      ...(Object.keys(ru).length > 0 ? { ru } : {}),
      ...(Object.keys(en).length > 0 ? { en } : {}),
    },
  }
}

export function postHasLocale(values: PostForm, locale: Locale): boolean {
  const fields = values.locales[locale]
  if (!fields) return false
  const { blocks, ...rest } = fields
  return (
    Object.keys(compactTranslation(rest)).length > 0 ||
    Object.keys(wordsToData(values.shared.blocks, blocks)).length > 0
  )
}

/** The start of the text in a language (Uzbek where it isn't translated): the card's lines. */
export function postExcerpt(values: PostForm, locale: Locale, max = 200): string {
  const words = values.shared.blocks
    .filter((block) => block.type === 'text')
    .map((block) => {
      const own = values.locales[locale]?.blocks[block.id]?.text
      return richTextToPlain(hasText(own) ? own : values.locales.uz.blocks[block.id]?.text)
    })
    .join(' ')
    .trim()
  return excerpt(words, max)
}

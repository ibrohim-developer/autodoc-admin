import type { MediaRef } from '@/components/content/media-fields'
import { compactTranslation, type DocumentData, todayInTashkent } from '@/lib/content'
import type { Locale } from '@/lib/media'
import { EMPTY_DOC, excerpt, type RichTextDoc, richTextToPlain } from '@/lib/rich-text'

/**
 * A news post as the form holds it. The API's rules: api/src/site-content/news.ts.
 *
 * The article has three fixed sections, always in this order: the text (photos go inside it,
 * between paragraphs), a gallery and a video link. The API keeps them as blocks with fixed ids;
 * the gallery and the video are the same in every language, the text is per language and an
 * untranslated one shows the Uzbek text on the site.
 */
export type PostLocale = {
  title: string
  text: RichTextDoc
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
    gallery: MediaRef[]
    videoUrl: string
    ogImage: MediaRef | null
  }
  locales: Record<Locale, PostLocale>
}

/** The blocks' ids in the stored document. */
export const BLOCK = { text: 'text', gallery: 'gallery', video: 'video' } as const

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

const emptyLocale = (): PostLocale => ({
  title: '',
  text: EMPTY_DOC,
  tags: [],
  seoTitle: '',
  seoDescription: '',
})

export function emptyPost(): PostForm {
  return {
    shared: {
      slug: '',
      date: todayInTashkent(),
      cover: null,
      coverPosition: '',
      coverFull: false,
      pinned: false,
      categoryId: null,
      gallery: [],
      videoUrl: '',
      ogImage: null,
    },
    locales: { uz: emptyLocale(), ru: emptyLocale(), en: emptyLocale() },
  }
}

type StoredBlock = { id?: unknown; type?: unknown; image?: unknown; items?: unknown; url?: unknown }

/** Several texts in one: what earlier free-form posts had in separate text blocks. */
function joinDocs(docs: RichTextDoc[]): RichTextDoc {
  const content = docs.flatMap((item) => item.content ?? [])
  return content.length > 0 ? { type: 'doc', content } : EMPTY_DOC
}

/**
 * The stored post as the three sections. Posts made before have other shapes: free blocks
 * (texts are joined, single photos join the gallery, the first video stays) or, older still,
 * `body` / `gallery` / `videoUrl`.
 */
export function postFromData(data: DocumentData): PostForm {
  const shared = data.shared
  const stored = Array.isArray(shared.blocks) ? (shared.blocks as StoredBlock[]) : null
  const textIds = stored?.filter((b) => b.type === 'text').map((b) => String(b.id)) ?? []
  const gallery = stored
    ? stored.flatMap((b) =>
        b.type === 'gallery' ? refs(b.items) : b.type === 'image' ? refs([b.image]) : [],
      )
    : refs(shared.gallery)
  const videoUrl = stored
    ? text(stored.find((b) => b.type === 'video' && text(b.url))?.url)
    : text(shared.videoUrl)

  const locale = (code: Locale): PostLocale => {
    const fields = data.locales[code] ?? {}
    const words = (fields.blocks ?? {}) as Record<string, { text?: unknown }>
    return {
      title: text(fields.title),
      text: stored ? joinDocs(textIds.map((id) => doc(words[id]?.text))) : doc(fields.body),
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
      gallery,
      videoUrl,
      ogImage: ref(shared.ogImage),
    },
    locales: { uz: locale('uz'), ru: locale('ru'), en: locale('en') },
  }
}

const hasText = (value: RichTextDoc | undefined) =>
  richTextToPlain(value).length > 0 || JSON.stringify(value ?? {}).includes('"mediaId"')

function localeToData(values: PostLocale, full: boolean) {
  const { text: body, ...rest } = values
  const fields = full ? rest : compactTranslation(rest)
  return hasText(body) ? { ...fields, blocks: { [BLOCK.text]: { text: body } } } : fields
}

export function postToData(values: PostForm): DocumentData {
  const shared = values.shared
  const ru = localeToData(values.locales.ru, false)
  const en = localeToData(values.locales.en, false)
  const videoUrl = shared.videoUrl.trim()
  return {
    shared: {
      slug: shared.slug,
      date: shared.date,
      cover: shared.cover,
      ...(shared.coverPosition ? { coverPosition: shared.coverPosition } : {}),
      coverFull: shared.coverFull,
      pinned: shared.pinned,
      categoryId: shared.categoryId,
      blocks: [
        { id: BLOCK.text, type: 'text' },
        ...(shared.gallery.length > 0
          ? [{ id: BLOCK.gallery, type: 'gallery', items: shared.gallery }]
          : []),
        ...(videoUrl ? [{ id: BLOCK.video, type: 'video', url: videoUrl }] : []),
      ],
      ogImage: shared.ogImage,
    },
    locales: {
      uz: localeToData(values.locales.uz, true),
      ...(Object.keys(ru).length > 0 ? { ru } : {}),
      ...(Object.keys(en).length > 0 ? { en } : {}),
    },
  }
}

export function postHasLocale(values: PostForm, locale: Locale): boolean {
  const fields = values.locales[locale]
  if (!fields) return false
  const { text: body, ...rest } = fields
  return Object.keys(compactTranslation(rest)).length > 0 || hasText(body)
}

/** The start of the text in a language (Uzbek where it isn't translated): the card's lines. */
export function postExcerpt(values: PostForm, locale: Locale, max = 200): string {
  const own = values.locales[locale]?.text
  const body = richTextToPlain(own).length > 0 ? own : values.locales.uz.text
  return excerpt(richTextToPlain(body).trim(), max)
}

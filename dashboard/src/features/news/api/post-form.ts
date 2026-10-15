import type { MediaRef } from '@/components/content/media-fields'
import { compactTranslation, type DocumentData, todayInTashkent, toLocales } from '@/lib/content'
import type { Locale } from '@/lib/media'
import { EMPTY_DOC, type RichTextDoc } from '@/lib/rich-text'

/** A news post as the form holds it. The API's rules: api/src/site-content/news.ts. */
export type PostLocale = {
  title: string
  body: RichTextDoc
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
  body: EMPTY_DOC,
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

export function postFromData(data: DocumentData): PostForm {
  const shared = data.shared
  const locale = (code: Locale): PostLocale => {
    const fields = data.locales[code] ?? {}
    return {
      title: text(fields.title),
      body: doc(fields.body),
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
      gallery: refs(shared.gallery),
      videoUrl: text(shared.videoUrl),
      ogImage: ref(shared.ogImage),
    },
    locales: { uz: locale('uz'), ru: locale('ru'), en: locale('en') },
  }
}

export function postToData(values: PostForm): DocumentData {
  const shared = values.shared
  return {
    shared: {
      slug: shared.slug,
      date: shared.date,
      cover: shared.cover,
      ...(shared.coverPosition ? { coverPosition: shared.coverPosition } : {}),
      coverFull: shared.coverFull,
      pinned: shared.pinned,
      categoryId: shared.categoryId,
      gallery: shared.gallery,
      videoUrl: shared.videoUrl.trim() || null,
      ogImage: shared.ogImage,
    },
    locales: toLocales(values.locales),
  }
}

export function postHasLocale(values: PostForm, locale: Locale): boolean {
  return Object.keys(compactTranslation(values.locales[locale] ?? {})).length > 0
}

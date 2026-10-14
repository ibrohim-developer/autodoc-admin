import type { MediaRef } from '@/components/content/media-fields'
import { compactTranslation, type DocumentData, toLocales } from '@/lib/content'
import type { Locale } from '@/lib/media'
import { EMPTY_DOC, type RichTextDoc } from '@/lib/rich-text'

/**
 * The site's pages, their blocks and main photos, with Russian names for this screen. The keys
 * match the API (api/src/site-content/pages.ts) and the site's pages.
 */
export type PageSpec = {
  key: string
  label: string
  path: string
  blocks: { key: string; label: string }[]
  photos: { key: string; label: string }[]
}

const feedback = { key: 'feedback', label: 'Форма обратной связи' }

export const PAGES: PageSpec[] = [
  {
    key: 'home',
    label: 'Главная',
    path: '/',
    blocks: [
      { key: 'hero', label: 'Первый экран' },
      { key: 'partnerStrip', label: 'Лента партнёров' },
      { key: 'stats', label: 'Цифры холдинга' },
      { key: 'position', label: 'О холдинге: фото и текст' },
      { key: 'video', label: 'Видео' },
      { key: 'directions', label: 'Направления и проекты' },
      { key: 'photoBandBuilding', label: 'Фото-лента: здание' },
      feedback,
      { key: 'leaders', label: 'Руководство' },
      { key: 'trustedBy', label: 'Нам доверяют' },
      { key: 'photoBandInspection', label: 'Фото-лента: техосмотр' },
      { key: 'news', label: 'Новости' },
    ],
    photos: [
      { key: 'hero', label: 'Фон первого экрана' },
      { key: 'photoBandBuilding', label: 'Фото-лента: здание' },
      { key: 'photoBandInspection', label: 'Фото-лента: техосмотр' },
    ],
  },
  {
    key: 'about',
    label: 'О компании',
    path: '/about/',
    blocks: [
      { key: 'history', label: 'История' },
      { key: 'leaders', label: 'Руководство' },
      feedback,
    ],
    photos: [],
  },
  {
    key: 'projects',
    label: 'Проекты',
    path: '/projects/',
    blocks: [{ key: 'catalog', label: 'Каталог проектов' }, feedback],
    photos: [],
  },
  {
    key: 'vacancies',
    label: 'Карьера',
    path: '/vacancies/',
    blocks: [
      { key: 'hero', label: 'Первый экран' },
      { key: 'stats', label: 'Цифры холдинга' },
      { key: 'advantages', label: 'Почему мы' },
      { key: 'vacancies', label: 'Вакансии' },
      feedback,
    ],
    photos: [
      { key: 'hero', label: 'Фон первого экрана' },
      { key: 'advantages', label: 'Фон блока «Почему мы»' },
    ],
  },
  {
    key: 'partners',
    label: 'Партнёры',
    path: '/partners/',
    blocks: [
      { key: 'hero', label: 'Первый экран' },
      { key: 'catalog', label: 'Каталог партнёров' },
      feedback,
    ],
    photos: [{ key: 'hero', label: 'Фон первого экрана' }],
  },
  {
    key: 'blog',
    label: 'Блог',
    path: '/blog/',
    blocks: [
      { key: 'catalog', label: 'Список новостей' },
      { key: 'reels', label: 'Видео из Instagram' },
      feedback,
    ],
    photos: [],
  },
  {
    key: 'contacts',
    label: 'Контакты',
    path: '/contacts/',
    blocks: [{ key: 'office', label: 'Офис, контакты и карта' }, feedback],
    photos: [{ key: 'office', label: 'Фото офиса' }],
  },
]

export const LEGAL = [
  { key: 'privacy', label: 'Политика конфиденциальности', path: '/privacy/' },
  { key: 'terms', label: 'Условия использования', path: '/terms/' },
] as const

export function pageSpec(key: string | undefined): PageSpec | undefined {
  return PAGES.find((page) => page.key === key)
}

const text = (value: unknown) => (typeof value === 'string' ? value : '')

const ref = (value: unknown): MediaRef | null =>
  value && typeof value === 'object' && typeof (value as MediaRef).mediaId === 'string'
    ? { mediaId: (value as MediaRef).mediaId }
    : null

type Seo = { seoTitle: string; seoDescription: string }

export type PageForm = {
  shared: {
    visible: Record<string, boolean>
    photos: Record<string, MediaRef | null>
    ogImage: MediaRef | null
  }
  locales: Record<Locale, Seo>
}

const seoOf = (fields: Record<string, unknown> | undefined): Seo => ({
  seoTitle: text(fields?.seoTitle),
  seoDescription: text(fields?.seoDescription),
})

export function pageForm(spec: PageSpec) {
  return {
    empty: (): PageForm => ({
      shared: {
        visible: Object.fromEntries(spec.blocks.map((block) => [block.key, true])),
        photos: Object.fromEntries(spec.photos.map((photo) => [photo.key, null])),
        ogImage: null,
      },
      locales: { uz: seoOf(undefined), ru: seoOf(undefined), en: seoOf(undefined) },
    }),
    fromData: (data: DocumentData): PageForm => {
      const hidden = Array.isArray(data.shared.hidden) ? data.shared.hidden : []
      const photos = (data.shared.photos ?? {}) as Record<string, unknown>
      return {
        shared: {
          visible: Object.fromEntries(
            spec.blocks.map((block) => [block.key, !hidden.includes(block.key)]),
          ),
          photos: Object.fromEntries(
            spec.photos.map((photo) => [photo.key, ref(photos[photo.key])]),
          ),
          ogImage: ref(data.shared.ogImage),
        },
        locales: {
          uz: seoOf(data.locales.uz),
          ru: seoOf(data.locales.ru),
          en: seoOf(data.locales.en),
        },
      }
    },
    toData: (values: PageForm): DocumentData => ({
      shared: {
        hidden: spec.blocks
          .filter((block) => !values.shared.visible[block.key])
          .map((block) => block.key),
        photos: Object.fromEntries(
          Object.entries(values.shared.photos).filter(([, photo]) => photo !== null),
        ),
        ogImage: values.shared.ogImage,
      },
      locales: toLocales(values.locales),
    }),
    hasLocale: (values: PageForm, locale: Locale) =>
      Object.keys(compactTranslation(values.locales[locale] ?? {})).length > 0,
  }
}

export type LegalLocale = Seo & { title: string; body: RichTextDoc }
export type LegalForm = { shared: Record<string, never>; locales: Record<Locale, LegalLocale> }

const legalLocale = (fields?: Record<string, unknown>): LegalLocale => {
  const body = fields?.body as RichTextDoc | undefined
  return {
    title: text(fields?.title),
    body: body?.type === 'doc' ? body : EMPTY_DOC,
    ...seoOf(fields),
  }
}

export const legalForm = {
  empty: (): LegalForm => ({
    shared: {},
    locales: { uz: legalLocale(), ru: legalLocale(), en: legalLocale() },
  }),
  fromData: (data: DocumentData): LegalForm => ({
    shared: {},
    locales: {
      uz: legalLocale(data.locales.uz),
      ru: legalLocale(data.locales.ru),
      en: legalLocale(data.locales.en),
    },
  }),
  toData: (values: LegalForm): DocumentData => ({ shared: {}, locales: toLocales(values.locales) }),
  hasLocale: (values: LegalForm, locale: Locale) =>
    Object.keys(compactTranslation(values.locales[locale] ?? {})).length > 0,
}

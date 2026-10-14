import { z } from 'zod'
import type { ContentTypeDef } from '../content/content-types.js'
import { richTextSchema } from '../content/rich-text.js'
import { CONTENT, localePath, mediaRef, requiredText, text } from './fields.js'

/**
 * "Страницы": each page of the site is one document — its SEO texts, which of its blocks are
 * hidden, and replacements for its main photos (empty = the photo from the design). Block and
 * photo names must match what the site's page renders (src/lib/content/pages.ts there).
 */
type PageSpec = {
  key: string
  label: string
  path: string
  blocks: string[]
  photos: string[]
}

export const PAGES: PageSpec[] = [
  {
    key: 'home',
    label: 'Главная',
    path: '/',
    blocks: [
      'hero',
      'partnerStrip',
      'stats',
      'position',
      'video',
      'directions',
      'photoBandBuilding',
      'feedback',
      'leaders',
      'trustedBy',
      'photoBandInspection',
      'news',
    ],
    photos: ['hero', 'photoBandBuilding', 'photoBandInspection'],
  },
  {
    key: 'about',
    label: 'О компании',
    path: '/about/',
    blocks: ['history', 'leaders', 'feedback'],
    photos: [],
  },
  {
    key: 'projects',
    label: 'Проекты',
    path: '/projects/',
    blocks: ['catalog', 'feedback'],
    photos: [],
  },
  {
    key: 'vacancies',
    label: 'Карьера',
    path: '/vacancies/',
    blocks: ['hero', 'stats', 'advantages', 'vacancies', 'feedback'],
    photos: ['hero', 'advantages'],
  },
  {
    key: 'partners',
    label: 'Партнёры',
    path: '/partners/',
    blocks: ['hero', 'catalog', 'feedback'],
    photos: ['hero'],
  },
  {
    key: 'blog',
    label: 'Блог',
    path: '/blog/',
    blocks: ['catalog', 'reels', 'feedback'],
    photos: [],
  },
  {
    key: 'contacts',
    label: 'Контакты',
    path: '/contacts/',
    blocks: ['office', 'feedback'],
    photos: ['office'],
  },
]

const seo = {
  seoTitle: text(120).optional(),
  seoDescription: text(300).optional(),
}

function pageType(page: PageSpec): ContentTypeDef {
  const blocks = z.enum(page.blocks as [string, ...string[]], { message: 'Неизвестный блок' })
  return {
    type: `page_${page.key}`,
    label: `Страница «${page.label}»`,
    permissions: CONTENT,
    singleton: true,
    shared: z.object({
      /** Blocks taken off the page. A block added to the site later shows until hidden here. */
      hidden: z.array(blocks).max(page.blocks.length).optional(),
      photos: z
        .object(
          Object.fromEntries(page.photos.map((name) => [name, mediaRef.nullable().optional()])),
        )
        .optional(),
      ogImage: mediaRef.nullable().optional(),
    }),
    localized: z.object(seo),
    title: () => `Страница «${page.label}»`,
    sitePath: (_data, _slug, locale) => localePath(locale, page.path),
  }
}

export const PAGE_TYPES = PAGES.map(pageType)

/** "Политика конфиденциальности" and "Условия использования": one long text each, in the footer. */
function legalType(key: 'privacy' | 'terms', label: string): ContentTypeDef {
  return {
    type: `legal_${key}`,
    label,
    permissions: CONTENT,
    singleton: true,
    shared: z.object({}),
    localized: z.object({
      title: requiredText(160, 'Укажите заголовок'),
      body: richTextSchema,
      ...seo,
    }),
    title: (data) => String(data.locales.uz.title ?? label),
    sitePath: (_data, _slug, locale) => localePath(locale, `/${key}/`),
  }
}

export const LEGAL_TYPES = [
  legalType('privacy', 'Политика конфиденциальности'),
  legalType('terms', 'Условия использования'),
]

/** The menu items the site has; settings choose their order and which are shown. */
export const NAV_KEYS = [
  'home',
  'media',
  'history',
  'leadership',
  'projects',
  'career',
  'partners',
  'contacts',
] as const

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine(
    (value) => value === '' || /^https:\/\//.test(value),
    'Ссылка должна начинаться с https://',
  )
  .optional()

/** An id the tracker issues, or empty: GA4 G-XXXXXXX, Yandex Metrica counter, Meta Pixel. */
const trackingId = (pattern: RegExp, message: string) =>
  z
    .string()
    .trim()
    .max(40)
    .refine((value) => value === '' || pattern.test(value), message)
    .optional()

/**
 * Counters the site loads only after the visitor accepts cookies (the cookie banner). Empty =
 * not used. The site's own statistics don't need any of these.
 */
export const trackingSchema = z.object({
  ga4: trackingId(/^G-[A-Z0-9]{4,15}$/, 'Идентификатор GA4 выглядит так: G-XXXXXXXXXX'),
  metrica: trackingId(/^\d{5,12}$/, 'Номер счётчика Метрики — от 5 до 12 цифр'),
  pixel: trackingId(/^\d{10,20}$/, 'ID пикселя Meta — от 10 до 20 цифр'),
})

/** Contacts, social links, the map pin, the menu and the tracking codes. Saved = live. */
export const siteSettingsType: ContentTypeDef = {
  type: 'site_settings',
  label: 'Настройки сайта',
  permissions: CONTENT,
  singleton: true,
  publishOnSave: true,
  shared: z.object({
    phone: requiredText(40, 'Укажите телефон').regex(
      /^\+?[\d\s()-]{7,}$/,
      'Телефон из цифр, пробелов и скобок: +998 55 505 75 75',
    ),
    email: z.email({ message: 'Укажите email' }),
    socials: z.object({ linkedin: optionalUrl, instagram: optionalUrl }),
    /** The office on the contacts page map. */
    map: z.object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
    }),
    /** In this order; `visible: false` keeps an item out of the header menu and the footer. */
    menu: z
      .array(z.object({ key: z.enum(NAV_KEYS), visible: z.boolean() }))
      .max(NAV_KEYS.length)
      .refine(
        (items) => new Set(items.map((item) => item.key)).size === items.length,
        'Пункт меню дважды',
      ),
    tracking: trackingSchema.optional(),
  }),
  localized: z.object({}),
  title: () => 'Настройки сайта',
}

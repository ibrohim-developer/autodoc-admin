import { compactTranslation, type DocumentData, toLocales } from '@/lib/content'
import type { Locale } from '@/lib/media'
import { EMPTY_DOC, type RichTextDoc } from '@/lib/rich-text'

/** A vacancy as the form holds it. The API's rules: api/src/site-content/vacancies.ts. */
export const EMPLOYMENT = {
  fullTime: 'Полная занятость',
  partTime: 'Частичная занятость',
  remote: 'Удалённая работа',
  internship: 'Стажировка',
} as const
export type Employment = keyof typeof EMPLOYMENT

export const MAX_REQUIREMENTS = 4

export type VacancyLocale = {
  title: string
  city: string
  description: string
  requirements: string[]
  body: RichTextDoc
  seoTitle: string
  seoDescription: string
}

export type VacancyForm = {
  shared: { slug: string; directionId: string | null; employment: Employment; closed: boolean }
  locales: Record<Locale, VacancyLocale>
}

const text = (value: unknown) => (typeof value === 'string' ? value : '')

const emptyLocale = (): VacancyLocale => ({
  title: '',
  city: '',
  description: '',
  requirements: [],
  body: EMPTY_DOC,
  seoTitle: '',
  seoDescription: '',
})

export function emptyVacancy(): VacancyForm {
  return {
    shared: { slug: '', directionId: null, employment: 'fullTime', closed: false },
    locales: {
      uz: { ...emptyLocale(), city: 'Toshkent' },
      ru: { ...emptyLocale(), city: 'Ташкент' },
      en: { ...emptyLocale(), city: 'Tashkent' },
    },
  }
}

export function vacancyFromData(data: DocumentData): VacancyForm {
  const shared = data.shared
  const locale = (code: Locale): VacancyLocale => {
    const fields = data.locales[code] ?? {}
    const body = fields.body as RichTextDoc | undefined
    return {
      title: text(fields.title),
      city: text(fields.city),
      description: text(fields.description),
      requirements: Array.isArray(fields.requirements)
        ? fields.requirements.filter((item) => typeof item === 'string')
        : [],
      body: body?.type === 'doc' ? body : EMPTY_DOC,
      seoTitle: text(fields.seoTitle),
      seoDescription: text(fields.seoDescription),
    }
  }
  const employment = text(shared.employment)
  return {
    shared: {
      slug: text(shared.slug),
      directionId: typeof shared.directionId === 'string' ? shared.directionId : null,
      employment: employment in EMPLOYMENT ? (employment as Employment) : 'fullTime',
      closed: shared.closed === true,
    },
    locales: { uz: locale('uz'), ru: locale('ru'), en: locale('en') },
  }
}

export function vacancyToData(values: VacancyForm): DocumentData {
  const clean = (fields: VacancyLocale) => ({
    ...fields,
    // A line added and left empty is not a requirement.
    requirements: fields.requirements.map((item) => item.trim()).filter(Boolean),
  })
  return {
    shared: {
      slug: values.shared.slug,
      // Sent even when empty: the API then says "Выберите направление" on that field.
      ...(values.shared.directionId ? { directionId: values.shared.directionId } : {}),
      employment: values.shared.employment,
      closed: values.shared.closed,
    },
    locales: toLocales({
      uz: clean(values.locales.uz),
      ru: clean(values.locales.ru),
      en: clean(values.locales.en),
    }),
  }
}

export function vacancyHasLocale(values: VacancyForm, locale: Locale): boolean {
  const { city: _city, ...rest } = values.locales[locale] ?? emptyLocale()
  // The city is filled in by default: on its own it isn't a translation.
  return Object.keys(compactTranslation(rest)).length > 0
}

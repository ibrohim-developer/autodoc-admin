/** Site languages. Uzbek is the default and the one every document must have. */
export const LOCALES = ['uz', 'ru', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'uz'
/** The languages a document may leave out; their fields fall back to Uzbek on the site. */
export const OPTIONAL_LOCALES = ['ru', 'en'] as const satisfies readonly Locale[]

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

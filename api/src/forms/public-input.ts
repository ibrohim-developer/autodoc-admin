import { z } from 'zod'
import { LOCALES } from '../content/locales.js'
import { LEAD_FORMS } from './workflow.js'

/** What the site's forms send. Messages are Russian like everywhere in the API; the site shows its own. */

const name = z.string().trim().min(1, 'Укажите имя').max(120, 'Имя не длиннее 120 символов')

/** 7 to 15 digits with any separators: +998 90 123 45 67, (90) 123-45-67. */
export const phone = z
  .string()
  .trim()
  .max(40, 'Телефон не длиннее 40 символов')
  .refine((value) => {
    const digits = value.replace(/\D/g, '').length
    return /^[+\d\s()-]+$/.test(value) && digits >= 7 && digits <= 15
  }, 'Укажите телефон: +998 90 123 45 67')

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Не длиннее ${max} символов`)
    .optional()
    .transform((value) => value || null)

/** Where the form was: a path on the site, no host. */
const page = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((value) => (value && /^\/(?!\/)[^\s\\]*$/.test(value) ? value : null))

/** A checkbox: JSON true, or "true" / "on" / "1" from a multipart form. */
const consent = z.preprocess(
  (value) => value === true || value === 'true' || value === 'on' || value === '1',
  z.literal(true, { message: 'Нужно согласие на обработку персональных данных' }),
)

const common = {
  name,
  phone,
  locale: z.enum(LOCALES, { message: 'Неизвестный язык' }),
  page,
  consent,
  /** The honeypot: hidden from people, filled in by bots. */
  website: z.string().max(500).optional(),
}

export const leadInput = z.object({
  form: z.enum(LEAD_FORMS, { message: 'Неизвестная форма' }),
  ...common,
  topic: optionalText(200),
  message: optionalText(4000),
})
export type LeadInput = z.infer<typeof leadInput>

export const applicationInput = z.object({
  ...common,
  /** Empty or "other": no particular vacancy. */
  vacancyId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value !== 'other' ? value : null))
    .pipe(z.uuid({ message: 'Неизвестная вакансия' }).nullable()),
  email: z
    .string()
    .trim()
    .max(254)
    .optional()
    .transform((value) => value || null)
    .pipe(z.email({ message: 'Неверный email' }).nullable()),
  about: optionalText(4000),
})
export type ApplicationInput = z.infer<typeof applicationInput>

/** A bot filled the hidden field: answer as if all went well and keep nothing. */
export function isBot(input: { website?: string }): boolean {
  return Boolean(input.website?.trim())
}

/**
 * Statuses and sources of form submissions ("Заявки") and job applications ("Отклики"). Both
 * follow the same workflow: a status, one comment, and the trash.
 */

export const LEAD_STATUSES = ['new', 'in_progress', 'done', 'spam'] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Обработана',
  spam: 'Спам',
}

export const APPLICATION_STATUSES = ['new', 'reviewing', 'interview', 'hired', 'rejected'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: 'Новый',
  reviewing: 'На рассмотрении',
  interview: 'Собеседование',
  hired: 'Принят',
  rejected: 'Отказ',
}

/** Where a candidate came from. The site's form is always `site`; HR adds the others by hand. */
export const APPLICATION_SOURCES = [
  'site',
  'hh',
  'instagram',
  'telegram',
  'linkedin',
  'referral',
  'other',
] as const
export type ApplicationSource = (typeof APPLICATION_SOURCES)[number]

export const APPLICATION_SOURCE_LABELS: Record<ApplicationSource, string> = {
  site: 'Сайт',
  hh: 'hh.uz',
  instagram: 'Instagram',
  telegram: 'Telegram',
  linkedin: 'LinkedIn',
  referral: 'Рекомендация',
  other: 'Другое',
}

/** The site's forms that send submissions. Each has its own rate limit. */
export const LEAD_FORMS = ['feedback'] as const
export type LeadForm = (typeof LEAD_FORMS)[number]

export const LEAD_FORM_LABELS: Record<LeadForm, string> = {
  feedback: 'Обратная связь',
}

/** The resume form's rate limit key. */
export const APPLICATION_FORM = 'resume'

export const MAX_COMMENT_LENGTH = 4000

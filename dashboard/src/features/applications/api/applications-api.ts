import { z } from 'zod'
import type { InboxTone } from '@/components/inbox/inbox-status'
import { request, requestFile } from '@/lib/api-client'

/** Mirrors api/src/forms/workflow.ts. */
export const APPLICATION_STATUSES = ['new', 'reviewing', 'interview', 'hired', 'rejected'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: 'Новый',
  reviewing: 'На рассмотрении',
  interview: 'Собеседование',
  hired: 'Принят',
  rejected: 'Отказ',
}

export const APPLICATION_STATUS_TONES: Record<ApplicationStatus, InboxTone> = {
  new: 'new',
  reviewing: 'active',
  interview: 'active',
  hired: 'done',
  rejected: 'closed',
}

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

export const SOURCE_LABELS: Record<ApplicationSource, string> = {
  site: 'Сайт',
  hh: 'hh.uz',
  instagram: 'Instagram',
  telegram: 'Telegram',
  linkedin: 'LinkedIn',
  referral: 'Рекомендация',
  other: 'Другое',
}

const userRef = z.object({ id: z.string(), name: z.string() }).nullable()

export const applicationSchema = z.object({
  id: z.uuid(),
  number: z.number(),
  vacancy: z.object({ id: z.string().nullable(), title: z.string() }).nullable(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  about: z.string().nullable(),
  resume: z.object({ name: z.string(), size: z.number(), mime: z.string() }).nullable(),
  source: z.enum(APPLICATION_SOURCES),
  sourceLabel: z.string(),
  locale: z.string().nullable(),
  page: z.string().nullable(),
  status: z.enum(APPLICATION_STATUSES),
  comment: z.string().nullable(),
  consentAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: userRef,
  updatedBy: userRef,
})
export type Application = z.infer<typeof applicationSchema>

const listSchema = z.object({
  items: z.array(applicationSchema),
  total: z.number(),
  counts: z.record(z.enum(APPLICATION_STATUSES), z.number()),
})

export const vacancyOptionSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  closed: z.boolean(),
  isLive: z.boolean(),
  applications: z.number(),
  newApplications: z.number(),
})
export type VacancyOption = z.infer<typeof vacancyOptionSchema>

/** `vacancyId: 'none'` — applications to no particular vacancy ("другая позиция"). */
export type ApplicationFilters = {
  status?: ApplicationStatus
  vacancyId?: string
  source?: ApplicationSource
  q?: string
  from?: string
  to?: string
}

function clean<T extends Record<string, unknown>>(filters: T) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
  ) as Record<string, string | number>
}

export function fetchApplications(
  filters: ApplicationFilters & { page: number; pageSize: number },
) {
  return request('admin/applications', { schema: listSchema, searchParams: clean(filters) })
}

export function fetchApplication(id: string) {
  return request(`admin/applications/${id}`, { schema: applicationSchema })
}

export function fetchVacancyOptions() {
  return request('admin/applications/vacancies', {
    schema: z.object({ items: z.array(vacancyOptionSchema) }),
  })
}

export type ApplicationChanges = { status?: ApplicationStatus; comment?: string | null }

export function updateApplication(id: string, changes: ApplicationChanges) {
  return request(`admin/applications/${id}`, {
    method: 'PATCH',
    body: changes,
    schema: applicationSchema,
  })
}

export function deleteApplication(id: string) {
  return request(`admin/applications/${id}`, { method: 'DELETE', schema: z.null() })
}

export type NewApplication = {
  name: string
  phone: string
  email: string
  vacancyId: string
  source: Exclude<ApplicationSource, 'site'>
  about: string
  comment: string
  resume: File | null
}

export function createApplication(input: NewApplication) {
  const form = new FormData()
  for (const key of [
    'name',
    'phone',
    'email',
    'vacancyId',
    'source',
    'about',
    'comment',
  ] as const) {
    const value = input[key].trim()
    if (value) form.set(key, value)
  }
  if (input.resume) form.set('resume', input.resume)
  return request('admin/applications', {
    method: 'POST',
    formData: form,
    schema: applicationSchema,
  })
}

export function downloadResume(id: string) {
  return requestFile(`admin/applications/${id}/resume`, { fallbackName: 'resume' })
}

export function exportApplications(filters: ApplicationFilters) {
  return requestFile('admin/applications/export', {
    searchParams: clean(filters),
    fallbackName: 'otkliki.xlsx',
  })
}

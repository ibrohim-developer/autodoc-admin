import { z } from 'zod'
import type { InboxTone } from '@/components/inbox/inbox-status'
import { request, requestFile } from '@/lib/api-client'

/** Mirrors api/src/forms/workflow.ts. */
export const LEAD_STATUSES = ['new', 'in_progress', 'done', 'spam'] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Обработана',
  spam: 'Спам',
}

export const LEAD_STATUS_TONES: Record<LeadStatus, InboxTone> = {
  new: 'new',
  in_progress: 'active',
  done: 'done',
  spam: 'closed',
}

const userRef = z.object({ id: z.string(), name: z.string() }).nullable()

export const leadSchema = z.object({
  id: z.uuid(),
  number: z.number(),
  form: z.string(),
  formLabel: z.string(),
  name: z.string(),
  phone: z.string(),
  topic: z.string().nullable(),
  message: z.string().nullable(),
  locale: z.string(),
  page: z.string().nullable(),
  status: z.enum(LEAD_STATUSES),
  comment: z.string().nullable(),
  consentAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  updatedBy: userRef,
})
export type Lead = z.infer<typeof leadSchema>

const leadListSchema = z.object({
  items: z.array(leadSchema),
  total: z.number(),
  counts: z.record(z.enum(LEAD_STATUSES), z.number()),
})
export type LeadList = z.infer<typeof leadListSchema>

export type LeadFilters = { status?: LeadStatus; q?: string; from?: string; to?: string }

export function fetchLeads(filters: LeadFilters & { page: number; pageSize: number }) {
  return request('admin/leads', { schema: leadListSchema, searchParams: clean(filters) })
}

export function fetchLead(id: string) {
  return request(`admin/leads/${id}`, { schema: leadSchema })
}

export type LeadChanges = { status?: LeadStatus; comment?: string | null }

export function updateLead(id: string, changes: LeadChanges) {
  return request(`admin/leads/${id}`, { method: 'PATCH', body: changes, schema: leadSchema })
}

export function deleteLead(id: string) {
  return request(`admin/leads/${id}`, { method: 'DELETE', schema: z.null() })
}

export function exportLeads(filters: LeadFilters) {
  return requestFile('admin/leads/export', {
    searchParams: clean(filters),
    fallbackName: 'zayavki.xlsx',
  })
}

function clean<T extends Record<string, unknown>>(filters: T) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
  ) as Record<string, string | number>
}

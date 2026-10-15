import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { ApiError, request } from './api-client'
import { LOCALES, type Locale } from './media'

/**
 * Content documents (news, vacancies, projects, pages…): one API for every type, so one set of
 * hooks. Each section's form decides which fields its documents have.
 */

export const documentStatusSchema = z.enum(['draft', 'published', 'changed', 'scheduled'])
export type DocumentStatus = z.infer<typeof documentStatusSchema>

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: 'Черновик',
  published: 'Опубликовано',
  changed: 'Есть неопубликованные изменения',
  scheduled: 'Запланировано',
}

const localeSchema = z.enum(LOCALES)
const userRefSchema = z.object({ id: z.string(), name: z.string() }).nullable()
const fieldsSchema = z.record(z.string(), z.unknown())

export const documentDataSchema = z.object({
  shared: fieldsSchema,
  locales: z.object({ uz: fieldsSchema, ru: fieldsSchema.optional(), en: fieldsSchema.optional() }),
})
export type DocumentData = z.infer<typeof documentDataSchema>

export const documentSummarySchema = z.object({
  id: z.uuid(),
  type: z.string(),
  typeLabel: z.string(),
  slug: z.string().nullable(),
  title: z.string(),
  status: documentStatusSchema,
  locales: z.array(localeSchema),
  firstPublishedAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  scheduledAt: z.string().nullable(),
  updatedAt: z.string(),
  updatedBy: userRefSchema,
  shared: fieldsSchema,
})
export type DocumentSummary = z.infer<typeof documentSummarySchema>

export const documentViewSchema = documentSummarySchema.extend({
  data: documentDataSchema,
  revision: z.number(),
  isLive: z.boolean(),
  publishedSlug: z.string().nullable(),
  previewLocales: z.array(localeSchema),
  liveUrl: z.string().nullable(),
})
export type DocumentView = z.infer<typeof documentViewSchema>

const documentListSchema = z.object({
  items: z.array(documentSummarySchema),
  total: z.number(),
  /** How many documents of the type are in each state, whatever the filter. */
  counts: z
    .object({
      draft: z.number(),
      published: z.number(),
      changed: z.number(),
      scheduled: z.number(),
      live: z.number(),
    })
    .optional(),
})
export type DocumentList = z.infer<typeof documentListSchema>

export const VERSION_KIND_LABELS = {
  created: 'Создано',
  saved: 'Сохранено',
  published: 'Опубликовано',
  unpublished: 'Снято с публикации',
  restored: 'Восстановлена версия',
} as const

export const versionSchema = z.object({
  // A bigint column: the API sends it as a string.
  id: z.union([z.string(), z.number()]).transform(String),
  kind: z.enum(['created', 'saved', 'published', 'unpublished', 'restored']),
  title: z.string(),
  createdAt: z.string(),
  createdBy: userRefSchema,
  isDraft: z.boolean(),
  isLive: z.boolean(),
})
export type Version = z.infer<typeof versionSchema>

export type ListParams = {
  /** `live`: on the site, with or without unpublished changes. */
  status?: DocumentStatus | 'live'
  q?: string
  /** A reference field and the document it points at: `categoryId:<uuid>`. */
  ref?: string
  page?: number
  pageSize?: number
}

export const contentKeys = {
  all: ['content'] as const,
  type: (type: string) => ['content', type] as const,
  list: (type: string, params: ListParams) => ['content', type, 'list', params] as const,
  doc: (id: string) => ['content', 'doc', id] as const,
  versions: (id: string) => ['content', 'doc', id, 'versions'] as const,
  singleton: (type: string) => ['content', type, 'singleton'] as const,
}

export function fetchDocuments(type: string, params: ListParams = {}): Promise<DocumentList> {
  return request('admin/content', {
    schema: documentListSchema,
    searchParams: { type, ...params, q: params.q || undefined },
  })
}

export function useDocuments(type: string, params: ListParams = {}) {
  return useQuery({
    queryKey: contentKeys.list(type, params),
    queryFn: () => fetchDocuments(type, params),
    placeholderData: keepPreviousData,
  })
}

export function fetchDocument(id: string): Promise<DocumentView> {
  return request(`admin/content/${id}`, { schema: documentViewSchema })
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: contentKeys.doc(id ?? ''),
    queryFn: () => fetchDocument(id ?? ''),
    enabled: Boolean(id),
  })
}

/**
 * Pages and settings: the type's one document, or null before it is first saved. It also goes
 * into the document cache, where saves and publishes keep it current.
 */
export function useSingleton(type: string, enabled = true) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: contentKeys.singleton(type),
    queryFn: async () => {
      const doc = await request(`admin/content/singleton/${type}`, {
        schema: documentViewSchema.nullable(),
      })
      if (doc) queryClient.setQueryData(contentKeys.doc(doc.id), doc)
      return doc
    },
    enabled,
  })
}

export function useVersions(id: string, enabled: boolean) {
  return useQuery({
    queryKey: contentKeys.versions(id),
    queryFn: () => request(`admin/content/${id}/versions`, { schema: z.array(versionSchema) }),
    enabled,
  })
}

export function fetchVersion(id: string, versionId: string) {
  return request(`admin/content/${id}/versions/${versionId}`, {
    schema: z.object({ data: documentDataSchema }),
  })
}

/**
 * Every change returns the document as it now is; the cache takes it as is, and lists of that
 * type refetch (status, title and order may have changed).
 */
function useDocumentMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<DocumentView>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (doc) => {
      queryClient.setQueryData(contentKeys.doc(doc.id), doc)
      void queryClient.invalidateQueries({ queryKey: contentKeys.type(doc.type) })
      void queryClient.invalidateQueries({ queryKey: contentKeys.versions(doc.id) })
      // "Used in" on photos.
      void queryClient.invalidateQueries({ queryKey: ['media'] })
    },
  })
}

export function useCreateDocument() {
  return useDocumentMutation(({ type, data }: { type: string; data: DocumentData }) =>
    request('admin/content', { method: 'POST', body: { type, data }, schema: documentViewSchema }),
  )
}

export function useSaveDocument() {
  return useDocumentMutation(
    ({ id, data, revision }: { id: string; data: DocumentData; revision: number }) =>
      request(`admin/content/${id}`, {
        method: 'PUT',
        body: { data, revision },
        schema: documentViewSchema,
      }),
  )
}

export function usePublishDocument() {
  return useDocumentMutation(({ id, revision }: { id: string; revision?: number }) =>
    request(`admin/content/${id}/publish`, {
      method: 'POST',
      body: { revision },
      schema: documentViewSchema,
    }),
  )
}

export function useUnpublishDocument() {
  return useDocumentMutation((id: string) =>
    request(`admin/content/${id}/unpublish`, { method: 'POST', schema: documentViewSchema }),
  )
}

export function useScheduleDocument() {
  return useDocumentMutation(({ id, at }: { id: string; at: string | null }) =>
    at
      ? request(`admin/content/${id}/schedule`, {
          method: 'PUT',
          body: { at },
          schema: documentViewSchema,
        })
      : request(`admin/content/${id}/schedule`, { method: 'DELETE', schema: documentViewSchema }),
  )
}

/** A one-click yes/no from the list (a post's "pinned"); the live copy changes too. */
export function useSetFlag() {
  return useDocumentMutation(
    ({ id, field, value }: { id: string; field: string; value: boolean }) =>
      request(`admin/content/${id}/flags/${field}`, {
        method: 'PUT',
        body: { value },
        schema: documentViewSchema,
      }),
  )
}

export function useRestoreVersion() {
  return useDocumentMutation(
    ({ id, versionId, revision }: { id: string; versionId: string; revision: number }) =>
      request(`admin/content/${id}/versions/${versionId}/restore`, {
        method: 'POST',
        body: { revision },
        schema: documentViewSchema,
      }),
  )
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; type: string }) =>
      request(`admin/content/${id}`, { method: 'DELETE', schema: z.null() }),
    onSuccess: (_result, { id, type }) => {
      queryClient.removeQueries({ queryKey: contentKeys.doc(id) })
      void queryClient.invalidateQueries({ queryKey: contentKeys.type(type) })
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
      void queryClient.invalidateQueries({ queryKey: ['media'] })
    },
  })
}

export function previewLink(id: string, locale: Locale) {
  return request(`admin/content/${id}/preview-link`, {
    method: 'POST',
    body: { locale },
    schema: z.object({ url: z.url() }),
  })
}

export type Issue = { path: string; message: string }

/** Field problems the API reported (`locales.uz.title`, `shared.cover`…), if any. */
export function issuesOf(error: unknown): Issue[] {
  if (!(error instanceof ApiError)) return []
  const issues = (error.body as { issues?: unknown } | null)?.issues
  if (!Array.isArray(issues)) return []
  return issues.filter(
    (issue): issue is Issue =>
      typeof issue?.path === 'string' && typeof issue?.message === 'string',
  )
}

const isEmpty = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === 'object' &&
    (value as { type?: unknown }).type === 'doc' &&
    !JSON.stringify(value).includes('"text"') &&
    !JSON.stringify(value).includes('"mediaId"'))

/**
 * Russian and English are partial: an empty field is left out, so the site shows the Uzbek one
 * instead of an empty one (and the API's "required" rules don't apply to a field not sent).
 */
export function compactTranslation(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => !isEmpty(value)))
}

/** `{ uz, ru, en }` as the API stores it: Uzbek as is, translations without empty fields. */
export function toLocales<T extends Record<string, unknown>>(
  locales: Record<Locale, T>,
): DocumentData['locales'] {
  const ru = compactTranslation(locales.ru)
  const en = compactTranslation(locales.en)
  return {
    uz: locales.uz,
    ...(Object.keys(ru).length > 0 ? { ru } : {}),
    ...(Object.keys(en).length > 0 ? { en } : {}),
  }
}

/** "2026-10-13" in Tashkent, for date fields' defaults. */
export function todayInTashkent(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date())
}

/** Where the dashboard edits a document of this type. */
export function editorPath(type: string, id: string): string {
  if (type === 'post') return `/news/${id}`
  if (type === 'vacancy') return `/vacancies/${id}`
  if (type.startsWith('legal_')) return `/pages/legal/${type.slice('legal_'.length)}`
  if (type.startsWith('page_')) return `/pages/${type.slice('page_'.length)}`
  if (type === 'post_category') return '/news/categories'
  if (type === 'vacancy_direction') return '/vacancies/directions'
  if (type === 'redirect') return '/redirects'
  if (type === 'site_settings') return '/settings'
  if (type === 'site_texts') return '/texts'
  return '/'
}

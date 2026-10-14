import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { request } from './api-client'

/**
 * The media library's data, shared by the Медиатека screen and the photo picker that the
 * text editor and content forms use.
 */

export const LOCALES = ['uz', 'ru', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const LOCALE_LABELS: Record<Locale, string> = {
  uz: 'Oʻzbekcha',
  ru: 'Русский',
  en: 'English',
}

const altSchema = z.object({
  uz: z.string().optional(),
  ru: z.string().optional(),
  en: z.string().optional(),
})

export const mediaSchema = z.object({
  id: z.uuid(),
  originalName: z.string(),
  mime: z.string(),
  size: z.number(),
  width: z.number(),
  height: z.number(),
  alt: altSchema,
  url: z.string(),
  thumbUrl: z.string(),
  variants: z.array(z.object({ width: z.number(), height: z.number(), url: z.string() })),
  createdAt: z.string(),
  usageCount: z.number(),
})
export type Media = z.infer<typeof mediaSchema>

const mediaDetailsSchema = mediaSchema.extend({
  usages: z.array(
    z.object({ documentId: z.uuid(), type: z.string(), typeLabel: z.string(), title: z.string() }),
  ),
})
export type MediaDetails = z.infer<typeof mediaDetailsSchema>

const mediaListSchema = z.object({ items: z.array(mediaSchema), total: z.number() })
export type MediaList = z.infer<typeof mediaListSchema>

export const MAX_UPLOAD_MB = 20
export const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/webp,image/avif'

export const mediaKeys = {
  all: ['media'] as const,
  list: (q: string, page: number) => ['media', 'list', q, page] as const,
  details: (id: string) => ['media', 'details', id] as const,
}

export function fetchMedia(q: string, page: number, pageSize = 60): Promise<MediaList> {
  return request('admin/media', {
    schema: mediaListSchema,
    searchParams: { q: q || undefined, page, pageSize },
  })
}

export function useMediaList(q: string, page = 1) {
  return useQuery({
    queryKey: mediaKeys.list(q, page),
    queryFn: () => fetchMedia(q, page),
    placeholderData: keepPreviousData,
  })
}

/** The photos a form already uses (cover, gallery…), in one request: id → photo. */
export function useMediaByIds(ids: string[]) {
  const unique = [...new Set(ids)].sort()
  return useQuery({
    queryKey: [...mediaKeys.all, 'ids', unique] as const,
    queryFn: () =>
      request('admin/media', {
        schema: mediaListSchema,
        searchParams: { ids: unique.join(','), pageSize: 200 },
      }),
    enabled: unique.length > 0,
    placeholderData: keepPreviousData,
    select: (list) => new Map(list.items.map((media) => [media.id, media])),
  })
}

export function useMediaDetails(id: string | null) {
  return useQuery({
    queryKey: mediaKeys.details(id ?? ''),
    queryFn: () => request(`admin/media/${id}`, { schema: mediaDetailsSchema }),
    enabled: id !== null,
  })
}

export type UploadedMedia = Media & { duplicate: boolean }

/** Uploads one file. A photo already in the library comes back with `duplicate: true`. */
export function uploadMedia(file: File): Promise<UploadedMedia> {
  const formData = new FormData()
  formData.append('file', file)
  return request('admin/media', {
    method: 'POST',
    formData,
    schema: mediaSchema.extend({ duplicate: z.boolean() }),
  })
}

export function useUploadMedia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: uploadMedia,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mediaKeys.all }),
  })
}

export function useUpdateMediaAlt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, alt }: { id: string; alt: Partial<Record<Locale, string>> }) =>
      request(`admin/media/${id}`, { method: 'PATCH', body: { alt }, schema: mediaSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mediaKeys.all }),
  })
}

export function useDeleteMedia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      request(`admin/media/${id}`, { method: 'DELETE', schema: z.null() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mediaKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
    },
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`
}

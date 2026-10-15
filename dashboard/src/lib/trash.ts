import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { request } from './api-client'
import { mediaKeys } from './media'

/** The trash: deleted documents, photos and submissions, until they are purged. */

export const trashItemSchema = z.object({
  kind: z.enum(['document', 'media', 'lead', 'application']),
  id: z.uuid(),
  type: z.string(),
  typeLabel: z.string(),
  title: z.string(),
  thumbUrl: z.string().nullable(),
  deletedAt: z.string(),
  deletedBy: z.object({ id: z.string(), name: z.string() }).nullable(),
  purgeAt: z.string(),
})
export type TrashItem = z.infer<typeof trashItemSchema>

export function fetchTrash() {
  return request('admin/trash', { schema: z.object({ items: z.array(trashItemSchema) }) })
}

export function restoreItem(item: Pick<TrashItem, 'kind' | 'id'>) {
  return request(`admin/trash/${item.kind}/${item.id}/restore`, {
    method: 'POST',
    schema: z.null(),
  })
}

export function purgeItem(item: Pick<TrashItem, 'kind' | 'id'>) {
  return request(`admin/trash/${item.kind}/${item.id}`, { method: 'DELETE', schema: z.null() })
}

export const trashKeys = { all: ['trash'] as const }

export function useTrash() {
  return useQuery({ queryKey: trashKeys.all, queryFn: fetchTrash })
}

function useTrashMutation(mutationFn: typeof restoreItem) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: trashKeys.all })
      // Whatever comes back (a photo, a document, a submission, an application) is in its list again.
      void queryClient.invalidateQueries({ queryKey: mediaKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['content'] })
      void queryClient.invalidateQueries({ queryKey: ['leads'] })
      void queryClient.invalidateQueries({ queryKey: ['applications'] })
    },
  })
}

export function useRestoreItem() {
  return useTrashMutation(restoreItem)
}

export function usePurgeItem() {
  return useTrashMutation(purgeItem)
}

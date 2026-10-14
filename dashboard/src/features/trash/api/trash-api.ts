import { z } from 'zod'
import { request } from '@/lib/api-client'

export const trashItemSchema = z.object({
  kind: z.enum(['document', 'media']),
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

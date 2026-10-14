import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { mediaKeys } from '@/lib/media'
import { fetchTrash, purgeItem, restoreItem } from '../api/trash-api'

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

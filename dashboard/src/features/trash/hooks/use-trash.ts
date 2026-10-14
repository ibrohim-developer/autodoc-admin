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
      // A restored photo is back in the library; restored documents are back in their lists.
      void queryClient.invalidateQueries({ queryKey: mediaKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['content'] })
    },
  })
}

export function useRestoreItem() {
  return useTrashMutation(restoreItem)
}

export function usePurgeItem() {
  return useTrashMutation(purgeItem)
}

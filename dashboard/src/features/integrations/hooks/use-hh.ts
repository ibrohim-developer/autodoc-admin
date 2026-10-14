import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchDirections, fetchHh, syncHh, updateHh } from '../api/integrations-api'

export const hhKey = ['integrations', 'hh'] as const

export function useHh() {
  return useQuery({ queryKey: hhKey, queryFn: fetchHh })
}

export function useDirections() {
  return useQuery({ queryKey: ['integrations', 'directions'], queryFn: fetchDirections })
}

export function useUpdateHh() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateHh,
    onSuccess: (data) => queryClient.setQueryData(hhKey, data),
  })
}

export function useSyncHh() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: syncHh,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hhKey })
      void queryClient.invalidateQueries({ queryKey: ['content'] })
    },
  })
}

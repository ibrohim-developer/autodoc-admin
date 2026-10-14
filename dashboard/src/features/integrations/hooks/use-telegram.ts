import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTelegram, testTelegram, updateTelegram } from '../api/integrations-api'

export const telegramKey = ['integrations', 'telegram'] as const

export function useTelegram() {
  return useQuery({ queryKey: telegramKey, queryFn: fetchTelegram })
}

export function useUpdateTelegram() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateTelegram,
    onSuccess: (data) => queryClient.setQueryData(telegramKey, data),
  })
}

export function useTestTelegram() {
  return useMutation({ mutationFn: testTelegram })
}

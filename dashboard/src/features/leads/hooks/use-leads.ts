import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteLead,
  fetchLead,
  fetchLeads,
  type LeadChanges,
  type LeadFilters,
  updateLead,
} from '../api/leads-api'

export const leadKeys = {
  all: ['leads'] as const,
  list: (filters: object) => ['leads', 'list', filters] as const,
  one: (id: string) => ['leads', 'one', id] as const,
}

export function useLeads(filters: LeadFilters & { page: number; pageSize: number }) {
  return useQuery({
    queryKey: leadKeys.list(filters),
    queryFn: () => fetchLeads(filters),
    placeholderData: keepPreviousData,
  })
}

export function useLead(id: string) {
  return useQuery({ queryKey: leadKeys.one(id), queryFn: () => fetchLead(id) })
}

export function useUpdateLead(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (changes: LeadChanges) => updateLead(id, changes),
    onSuccess: (lead) => {
      queryClient.setQueryData(leadKeys.one(id), lead)
      void queryClient.invalidateQueries({ queryKey: leadKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['home'] })
    },
  })
}

export function useDeleteLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteLead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leadKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['home'] })
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
    },
  })
}

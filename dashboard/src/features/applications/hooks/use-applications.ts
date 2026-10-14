import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type ApplicationChanges,
  type ApplicationFilters,
  createApplication,
  deleteApplication,
  fetchApplication,
  fetchApplications,
  fetchVacancyOptions,
  updateApplication,
} from '../api/applications-api'

export const applicationKeys = {
  all: ['applications'] as const,
  list: (filters: object) => ['applications', 'list', filters] as const,
  one: (id: string) => ['applications', 'one', id] as const,
  vacancies: ['applications', 'vacancies'] as const,
}

export function useApplications(filters: ApplicationFilters & { page: number; pageSize: number }) {
  return useQuery({
    queryKey: applicationKeys.list(filters),
    queryFn: () => fetchApplications(filters),
    placeholderData: keepPreviousData,
  })
}

export function useApplication(id: string) {
  return useQuery({ queryKey: applicationKeys.one(id), queryFn: () => fetchApplication(id) })
}

export function useVacancyOptions() {
  return useQuery({ queryKey: applicationKeys.vacancies, queryFn: fetchVacancyOptions })
}

function useRefresh() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: applicationKeys.all })
    void queryClient.invalidateQueries({ queryKey: ['home'] })
  }
}

export function useUpdateApplication(id: string) {
  const queryClient = useQueryClient()
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (changes: ApplicationChanges) => updateApplication(id, changes),
    onSuccess: (application) => {
      queryClient.setQueryData(applicationKeys.one(id), application)
      refresh()
    },
  })
}

export function useCreateApplication() {
  const refresh = useRefresh()
  return useMutation({ mutationFn: createApplication, onSuccess: refresh })
}

export function useDeleteApplication() {
  const queryClient = useQueryClient()
  const refresh = useRefresh()
  return useMutation({
    mutationFn: deleteApplication,
    onSuccess: () => {
      refresh()
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
    },
  })
}

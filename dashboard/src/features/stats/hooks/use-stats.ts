import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  fetchContentStats,
  fetchOverview,
  fetchVacancyStats,
  type PeriodQuery,
} from '../api/stats-api'

const stale = 60_000

export function useOverview(period: PeriodQuery) {
  return useQuery({
    queryKey: ['stats', 'overview', period],
    queryFn: () => fetchOverview(period),
    placeholderData: keepPreviousData,
    staleTime: stale,
  })
}

export function useContentStats(period: PeriodQuery) {
  return useQuery({
    queryKey: ['stats', 'content', period],
    queryFn: () => fetchContentStats(period),
    placeholderData: keepPreviousData,
    staleTime: stale,
  })
}

export function useVacancyStats(period: PeriodQuery) {
  return useQuery({
    queryKey: ['stats', 'vacancies', period],
    queryFn: () => fetchVacancyStats(period),
    placeholderData: keepPreviousData,
    staleTime: stale,
  })
}

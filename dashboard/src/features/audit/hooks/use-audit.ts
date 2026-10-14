import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { type AuditFilters, fetchAudit, fetchAuditUsers } from '../api/audit-api'

export function useAudit(filters: AuditFilters & { page: number; pageSize: number }) {
  return useQuery({
    queryKey: ['audit', filters],
    queryFn: () => fetchAudit(filters),
    placeholderData: keepPreviousData,
  })
}

export function useAuditUsers() {
  return useQuery({ queryKey: ['audit', 'users'], queryFn: fetchAuditUsers })
}

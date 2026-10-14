import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { ApiError, request } from './api-client'

/**
 * Mirrors api/src/auth/permissions.ts. The API is the authority (it answers
 * 403); the dashboard only uses these to decide what to show.
 */
export const PERMISSIONS = [
  'home.view',
  'content.read',
  'content.write',
  'content.publish',
  'media.read',
  'media.write',
  'vacancies.read',
  'vacancies.write',
  'vacancies.publish',
  'applications.read',
  'applications.write',
  'applications.export',
  'leads.read',
  'leads.write',
  'leads.export',
  'stats.general',
  'stats.content',
  'stats.vacancies',
  'trash.content',
  'trash.vacancies',
  'users.read',
  'users.manage',
  'audit.read',
  'integrations.manage',
] as const
export type Permission = (typeof PERMISSIONS)[number]

export const roleSchema = z.enum(['admin', 'marketing', 'hr'])
export type Role = z.infer<typeof roleSchema>

export const meSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
  roleLabel: z.string(),
  // Plain strings: an API that grows a new permission must not break the dashboard.
  permissions: z.array(z.string()),
  totpEnabled: z.boolean(),
  assignableRoles: z.array(z.object({ value: roleSchema, label: z.string() })),
})
export type Me = z.infer<typeof meSchema>

export const sessionKey = ['session'] as const

/** The logged-in user, or null when there is no session (never throws for 401). */
export async function fetchSession(): Promise<Me | null> {
  try {
    return await request('admin/auth/me', { schema: meSchema })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: fetchSession,
    staleTime: 5 * 60_000,
  })
}

export function can(me: Me | null | undefined, permission: Permission): boolean {
  return me?.permissions.includes(permission) ?? false
}

/** For components below the session guard, where a user is always present. */
export function useMe(): Me {
  const { data } = useSession()
  if (!data) throw new Error('useMe() used outside the authenticated layout')
  return data
}

export function useCan(permission: Permission): boolean {
  return can(useSession().data, permission)
}

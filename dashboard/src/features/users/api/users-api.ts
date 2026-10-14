import { z } from 'zod'
import { request } from '@/lib/api-client'
import { type Role, roleSchema } from '@/lib/session'

export const userSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
  roleLabel: z.string(),
  /** invited: the link was sent but no password set yet. */
  status: z.enum(['active', 'invited', 'disabled']),
  totpEnabled: z.boolean(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
})
export type User = z.infer<typeof userSchema>

const roleOptionSchema = z.object({ value: roleSchema, label: z.string() })
export type RoleOption = z.infer<typeof roleOptionSchema>

const usersListSchema = z.object({
  items: z.array(userSchema),
  /** The roles the current user may give to others. */
  assignableRoles: z.array(roleOptionSchema),
})
export type UsersList = z.infer<typeof usersListSchema>

const linkSchema = z.object({ link: z.string() })

export function fetchUsers(): Promise<UsersList> {
  return request('admin/users', { schema: usersListSchema })
}

export type InviteInput = { email: string; name: string; role: Role }

export function inviteUser(input: InviteInput) {
  return request('admin/users', {
    method: 'POST',
    body: input,
    schema: z.object({ user: userSchema, link: z.string() }),
  })
}

export type UserChanges = { name?: string; role?: Role; isActive?: boolean }

export function updateUser(id: string, changes: UserChanges): Promise<User> {
  return request(`admin/users/${id}`, { method: 'PATCH', body: changes, schema: userSchema })
}

export function createResetLink(id: string) {
  return request(`admin/users/${id}/reset-link`, { method: 'POST', schema: linkSchema })
}

export function resetTwoFactor(id: string): Promise<User> {
  return request(`admin/users/${id}/reset-2fa`, { method: 'POST', schema: userSchema })
}

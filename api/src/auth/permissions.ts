/**
 * Who may do what. The dashboard builds its menu and routes from the same list
 * (GET /api/admin/auth/me), and every admin endpoint checks it, so a screen
 * that is hidden in the menu also answers 403 when called directly.
 */
export const ROLES = ['admin', 'marketing', 'hr'] as const
export type Role = (typeof ROLES)[number]

export const PERMISSIONS = [
  'home.view',
  // News, projects, pages, site texts, site settings, redirects.
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

const ADMIN_ONLY: readonly Permission[] = ['audit.read', 'integrations.manage']

const HR: readonly Permission[] = [
  'home.view',
  'vacancies.read',
  'vacancies.write',
  'vacancies.publish',
  'applications.read',
  'applications.write',
  'applications.export',
  'stats.vacancies',
  'trash.vacancies',
]

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  marketing: PERMISSIONS.filter((permission) => !ADMIN_ONLY.includes(permission)),
  hr: HR,
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Администратор',
  marketing: 'Маркетинг',
  hr: 'HR',
}

export function permissionsOf(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role]
}

/** Roles a user may give to others: marketing invites marketing and HR, only admin creates admins. */
export function assignableRoles(role: Role): Role[] {
  if (role === 'admin') return [...ROLES]
  if (role === 'marketing') return ['marketing', 'hr']
  return []
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

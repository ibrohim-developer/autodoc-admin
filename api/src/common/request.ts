import type { Request } from 'express'
import type { Permission, Role } from '../auth/permissions.js'

/** The logged-in dashboard user, attached to the request by AuthGuard. */
export type AuthUser = {
  id: string
  email: string
  name: string
  role: Role
  permissions: readonly Permission[]
  /** Refresh-token family of the current login, so "log out other sessions" can keep this one. */
  sessionFamilyId: string
}

export type AppRequest = Request & { user?: AuthUser }

export type ClientMeta = { ip: string | null; userAgent: string | null }

/** `req.ip` is the real client address because `trust proxy` is set for the local nginx. */
export function clientMeta(req: Request): ClientMeta {
  return {
    ip: req.ip ?? null,
    userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

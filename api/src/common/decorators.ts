import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common'
import type { Permission } from '../auth/permissions.js'
import type { AppRequest, AuthUser } from './request.js'

export const IS_PUBLIC_KEY = 'isPublic'
/** Skips AuthGuard: login, refresh, invite links, health, and the public site endpoints. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

export const PERMISSIONS_KEY = 'permissions'
/** The current user needs every listed permission, otherwise 403. */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions)

export const AUDIT_KEY = 'audit'
export type AuditMeta = { action: string; entityType?: string }
/** Writes an audit entry after the handler succeeds. `:id` becomes the entity id. */
export const Audit = (action: string, entityType?: string) =>
  SetMetadata(AUDIT_KEY, { action, entityType } satisfies AuditMeta)
/** The handler writes its own, more detailed audit entries. */
export const SkipAudit = () => SetMetadata(AUDIT_KEY, false)

/** The user AuthGuard attached. Only valid on routes that aren't @Public(). */
export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const user = context.switchToHttp().getRequest<AppRequest>().user
  if (!user) throw new Error('CurrentUser used on a route without an authenticated user')
  return user satisfies AuthUser
})

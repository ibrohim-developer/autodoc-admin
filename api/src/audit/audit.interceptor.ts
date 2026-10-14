import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { type Observable, tap } from 'rxjs'
import { AUDIT_KEY, type AuditMeta } from '../common/decorators.js'
import type { AppRequest } from '../common/request.js'
import { AuditService } from './audit.service.js'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Every successful change made through the admin API lands in the audit log,
 * even on handlers nobody remembered to annotate: those get a generic
 * `PATCH /admin/users/:id` action. @Audit() names it, @SkipAudit() opts out
 * for handlers that write their own entries.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle()

    const req = context.switchToHttp().getRequest<AppRequest>()
    if (!MUTATING.has(req.method) || !req.originalUrl.startsWith('/api/admin/')) {
      return next.handle()
    }

    const meta = this.reflector.getAllAndOverride<AuditMeta | false | undefined>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (meta === false) return next.handle()

    return next.handle().pipe(
      tap(() => {
        const entityId = typeof req.params.id === 'string' ? req.params.id : undefined
        void this.audit.record({
          action: meta?.action ?? `${req.method} ${req.route?.path ?? req.path}`,
          entityType: meta?.entityType,
          entityId,
          user: req.user,
          req,
        })
      }),
    )
  }
}

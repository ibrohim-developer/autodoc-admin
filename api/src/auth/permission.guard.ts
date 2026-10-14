import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PERMISSIONS_KEY } from '../common/decorators.js'
import type { AppRequest } from '../common/request.js'
import type { Permission } from './permissions.js'

/** Global, after AuthGuard: enforces @RequirePermission(). */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required?.length) return true

    const user = context.switchToHttp().getRequest<AppRequest>().user
    if (!user) throw new UnauthorizedException()
    if (!required.every((permission) => user.permissions.includes(permission))) {
      throw new ForbiddenException({ code: 'forbidden', message: 'Недостаточно прав' })
    }
    return true
  }
}

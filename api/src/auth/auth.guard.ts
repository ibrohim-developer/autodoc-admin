import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { IS_PUBLIC_KEY } from '../common/decorators.js'
import type { AppRequest } from '../common/request.js'
import { SessionsService } from '../users/sessions.service.js'
import { UsersService } from '../users/users.service.js'
import { ACCESS_COOKIE } from './cookies.js'
import { permissionsOf } from './permissions.js'

const unauthorized = () =>
  new UnauthorizedException({ code: 'unauthorized', message: 'Нужно войти' })

/**
 * Global: every route needs a valid access cookie unless it is @Public().
 * The user and their login are re-read on each request, so disabling a user,
 * changing a role or logging out takes effect immediately, not when the
 * 15-minute token expires.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest<AppRequest>()
    const token: unknown = req.cookies?.[ACCESS_COOKIE]
    if (typeof token !== 'string') throw unauthorized()

    let payload: { sub: string; fam: string }
    try {
      payload = await this.sessions.verifyAccess(token)
    } catch {
      throw unauthorized()
    }

    const [user, sessionActive] = await Promise.all([
      this.users.findActive(payload.sub),
      this.sessions.isFamilyActive(payload.fam),
    ])
    if (!user || !sessionActive) throw unauthorized()

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: permissionsOf(user.role),
      sessionFamilyId: payload.fam,
    }
    return true
  }
}

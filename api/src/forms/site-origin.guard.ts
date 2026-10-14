import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import type { Env } from '../config/env.js'

/**
 * The site's forms post from the site itself (nginx routes autodoc.uz/api/v1/… here). A
 * browser always names the page's origin on a cross-site POST, so another site's form is
 * refused; no Origin at all (curl, a test) is let through to the limits and checks.
 */
@Injectable()
export class SiteOriginGuard implements CanActivate {
  private readonly allowed: string

  constructor(config: ConfigService<Env, true>) {
    this.allowed = new URL(config.get('SITE_ORIGIN', { infer: true })).origin
  }

  canActivate(context: ExecutionContext): boolean {
    const origin = context.switchToHttp().getRequest<Request>().get('origin')
    if (origin && origin !== this.allowed) {
      throw new ForbiddenException({ code: 'bad_origin', message: 'Запрос с чужого сайта' })
    }
    return true
  }
}

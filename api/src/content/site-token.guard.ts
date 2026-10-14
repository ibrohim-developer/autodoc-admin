import { timingSafeEqual } from 'node:crypto'
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import type { Env } from '../config/env.js'

/**
 * The content API is for the site's server only (nginx doesn't expose it). It sends the shared
 * SITE_API_TOKEN in `x-site-token`.
 */
@Injectable()
export class SiteTokenGuard implements CanActivate {
  private readonly token: Buffer

  constructor(config: ConfigService<Env, true>) {
    this.token = Buffer.from(config.get('SITE_API_TOKEN', { infer: true }))
  }

  canActivate(context: ExecutionContext): boolean {
    const given = Buffer.from(
      context.switchToHttp().getRequest<Request>().get('x-site-token') ?? '',
    )
    if (given.length !== this.token.length || !timingSafeEqual(given, this.token)) {
      throw new UnauthorizedException({ code: 'bad_site_token', message: 'Invalid site token' })
    }
    return true
  }
}

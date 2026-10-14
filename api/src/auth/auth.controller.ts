import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Throttle } from '@nestjs/throttler'
import type { Response } from 'express'
import { CurrentUser, Public, SkipAudit } from '../common/decorators.js'
import type { AppRequest, AuthUser } from '../common/request.js'
import type { Env } from '../config/env.js'
import { UsersService } from '../users/users.service.js'
import {
  ChangePasswordDto,
  CodeDto,
  LoginDto,
  PasswordDto,
  TokenDto,
  UsePasswordTokenDto,
} from './auth.dto.js'
import { AuthService } from './auth.service.js'
import { clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from './cookies.js'

const FIFTEEN_MINUTES = 15 * 60_000

/** AuthService writes the audit entries for everything here. */
@Controller('admin/auth')
@SkipAudit()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get secure(): boolean {
    return this.config.get('COOKIE_SECURE', { infer: true })
  }

  /** Two steps when 2FA is on: the first answer is `two_factor_required`, then resend with `code`. */
  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, req)
    if (result.status === 'two_factor_required') return { status: result.status }
    setSessionCookies(res, result.session, this.secure)
    return { status: result.status, user: result.me }
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async refresh(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const token: unknown = req.cookies?.[REFRESH_COOKIE]
    if (typeof token !== 'string') {
      throw new UnauthorizedException({ code: 'no_session', message: 'Нужно войти' })
    }

    const result = await this.auth.refresh(token, req)
    if (result.status === 'ok') {
      setSessionCookies(res, result.session, this.secure)
      return { user: result.me }
    }
    // `stale`: another tab already rotated the token and the browser holds the new cookies.
    if (result.status !== 'stale') clearSessionCookies(res, this.secure)
    throw new UnauthorizedException({
      code: result.status === 'stale' ? 'stale_session' : 'session_expired',
      message: 'Сессия завершена, войдите снова',
    })
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const token: unknown = req.cookies?.[REFRESH_COOKIE]
    await this.auth.logout(typeof token === 'string' ? token : undefined, req)
    clearSessionCookies(res, this.secure)
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id)
  }

  @Post('2fa/setup')
  @HttpCode(200)
  setupTwoFactor(@CurrentUser() user: AuthUser) {
    return this.auth.startTwoFactorSetup(user)
  }

  @Post('2fa/enable')
  @HttpCode(200)
  enableTwoFactor(@CurrentUser() user: AuthUser, @Body() dto: CodeDto, @Req() req: AppRequest) {
    return this.auth.enableTwoFactor(user, dto.code, req)
  }

  @Post('2fa/disable')
  @HttpCode(204)
  async disableTwoFactor(
    @CurrentUser() user: AuthUser,
    @Body() dto: PasswordDto,
    @Req() req: AppRequest,
  ) {
    await this.auth.disableTwoFactor(user, dto.password, req)
  }

  @Post('2fa/recovery-codes')
  @HttpCode(200)
  regenerateRecoveryCodes(
    @CurrentUser() user: AuthUser,
    @Body() dto: CodeDto,
    @Req() req: AppRequest,
  ) {
    return this.auth.regenerateRecoveryCodes(user, dto.code, req)
  }

  @Post('password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: AppRequest,
  ) {
    await this.auth.changePassword(user, dto.currentPassword, dto.newPassword, req)
  }

  /** The set-password page (invite or reset) checks its link before showing the form. */
  @Public()
  @Post('password-token/inspect')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: FIFTEEN_MINUTES } })
  inspectPasswordToken(@Body() dto: TokenDto) {
    return this.users.inspectPasswordToken(dto.token)
  }

  @Public()
  @Post('password-token/use')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES } })
  async usePasswordToken(@Body() dto: UsePasswordTokenDto, @Req() req: AppRequest) {
    await this.users.setPasswordWithToken(dto.token, dto.password, req)
  }
}

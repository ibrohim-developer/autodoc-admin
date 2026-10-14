import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import { AuditService } from '../audit/audit.service.js'
import { decrypt, encrypt } from '../common/crypto.js'
import { type AuthUser, clientMeta, normalizeEmail } from '../common/request.js'
import type { Env } from '../config/env.js'
import { type RotateResult, type Session, SessionsService } from '../users/sessions.service.js'
import type { User } from '../users/user.entity.js'
import { UsersService } from '../users/users.service.js'
import type { LoginDto } from './auth.dto.js'
import {
  assertPasswordPolicy,
  burnPasswordCheck,
  hashPassword,
  verifyPassword,
} from './password.js'
import {
  assignableRoles,
  type Permission,
  permissionsOf,
  ROLE_LABELS,
  type Role,
} from './permissions.js'
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  isTotpCode,
  normalizeCode,
  TotpService,
} from './totp.service.js'

const MAX_FAILED_LOGINS = 5
const LOCK_MS = 15 * 60 * 1000

export type MeView = {
  id: string
  email: string
  name: string
  role: Role
  roleLabel: string
  permissions: readonly Permission[]
  totpEnabled: boolean
  assignableRoles: { value: Role; label: string }[]
}

export type LoginResult =
  | { status: 'ok'; session: Session; me: MeView }
  | { status: 'two_factor_required' }

export type RefreshResult =
  | { status: 'ok'; session: Session; me: MeView }
  | { status: Exclude<RotateResult['status'], 'ok'> }

const invalidCredentials = () =>
  new UnauthorizedException({ code: 'invalid_credentials', message: 'Неверный email или пароль' })

export function toMeView(
  user: Pick<User, 'id' | 'email' | 'name' | 'role' | 'totpEnabled'>,
): MeView {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role],
    permissions: permissionsOf(user.role),
    totpEnabled: user.totpEnabled,
    assignableRoles: assignableRoles(user.role).map((role) => ({
      value: role,
      label: ROLE_LABELS[role],
    })),
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly totp: TotpService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get encryptionKey(): Buffer {
    return Buffer.from(this.config.get('DATA_ENCRYPTION_KEY', { infer: true }), 'base64')
  }

  async login(dto: LoginDto, req: Request): Promise<LoginResult> {
    const email = normalizeEmail(dto.email)
    const user = await this.users.findWithSecrets({ email })

    if (!user?.isActive || !user.passwordHash) {
      await burnPasswordCheck(dto.password)
      await this.audit.record({ action: 'auth.login_failed', userEmail: email, req })
      throw invalidCredentials()
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000)
      throw new HttpException(
        {
          code: 'locked',
          message: `Слишком много неудачных попыток. Попробуйте через ${minutes} мин.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    if (!(await verifyPassword(user.passwordHash, dto.password))) {
      await this.registerFailure(user, req, 'password')
      throw invalidCredentials()
    }

    if (user.totpEnabled) {
      if (!dto.code) return { status: 'two_factor_required' }
      if (!(await this.checkSecondFactor(user, dto.code, req))) {
        await this.registerFailure(user, req, 'code')
        throw new UnauthorizedException({ code: 'invalid_code', message: 'Неверный код' })
      }
    }

    await this.users.updateFields(user.id, {
      failedLogins: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    })
    const session = await this.sessions.issue(user.id, clientMeta(req))
    await this.audit.record({ action: 'auth.login', user, req })
    return { status: 'ok', session, me: toMeView(user) }
  }

  async refresh(refresh: string, req: Request): Promise<RefreshResult> {
    const result = await this.sessions.rotate(refresh, clientMeta(req))
    if (result.status === 'reuse') {
      await this.audit.record({
        action: 'auth.refresh_reuse',
        user: await this.users.findActive(result.userId),
        summary: 'Старый токен предъявлен повторно: этот вход завершён на всех устройствах',
        req,
      })
      return { status: 'reuse' }
    }
    if (result.status !== 'ok') return result

    const user = await this.users.findActive(result.userId)
    if (!user) {
      await this.sessions.revokeFamily(result.session.familyId)
      return { status: 'invalid' }
    }
    return { status: 'ok', session: result.session, me: toMeView(user) }
  }

  async logout(refresh: string | undefined, req: Request): Promise<void> {
    if (!refresh) return
    const userId = await this.sessions.revokeByRefresh(refresh)
    if (!userId) return
    const user = await this.users.findActive(userId)
    if (user) await this.audit.record({ action: 'auth.logout', user, req })
  }

  async me(userId: string): Promise<MeView> {
    const user = await this.users.findActive(userId)
    if (!user) throw new UnauthorizedException()
    return toMeView(user)
  }

  /** Step 1: a new secret is stored, but 2FA stays off until a code proves the app has it. */
  async startTwoFactorSetup(actor: AuthUser): Promise<{ secret: string; uri: string; qr: string }> {
    const user = await this.users.findWithSecrets({ id: actor.id })
    if (!user) throw new UnauthorizedException()
    if (user.totpEnabled) {
      throw new ConflictException({ code: 'already_enabled', message: '2FA уже включена' })
    }
    const secret = this.totp.generateSecret()
    await this.users.updateFields(user.id, { totpSecretEnc: encrypt(secret, this.encryptionKey) })
    const uri = this.totp.uri(secret, user.email)
    return { secret, uri, qr: await this.totp.qrDataUrl(uri) }
  }

  /** Step 2: the first code turns 2FA on. Recovery codes are returned once and never again. */
  async enableTwoFactor(
    actor: AuthUser,
    code: string,
    req: Request,
  ): Promise<{ recoveryCodes: string[] }> {
    const user = await this.users.findWithSecrets({ id: actor.id })
    if (!user) throw new UnauthorizedException()
    if (user.totpEnabled) {
      throw new ConflictException({ code: 'already_enabled', message: '2FA уже включена' })
    }
    if (!user.totpSecretEnc) {
      throw new BadRequestException({
        code: 'setup_required',
        message: 'Сначала отсканируйте QR-код',
      })
    }

    const step = await this.totp.verify(
      decrypt(user.totpSecretEnc, this.encryptionKey),
      normalizeCode(code),
    )
    if (step === null) {
      throw new BadRequestException({
        code: 'invalid_code',
        message: 'Неверный код. Проверьте время на телефоне.',
      })
    }

    const recoveryCodes = generateRecoveryCodes()
    await this.users.updateFields(user.id, {
      totpEnabled: true,
      totpLastStep: step,
      recoveryCodes: recoveryCodes.map(hashRecoveryCode),
    })
    await this.audit.record({ action: 'auth.2fa_enabled', user, req })
    return { recoveryCodes }
  }

  async disableTwoFactor(actor: AuthUser, password: string, req: Request): Promise<void> {
    const user = await this.users.findWithSecrets({ id: actor.id })
    if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
      throw new BadRequestException({ code: 'invalid_password', message: 'Неверный пароль' })
    }
    await this.users.updateFields(user.id, {
      totpEnabled: false,
      totpSecretEnc: null,
      totpLastStep: null,
      recoveryCodes: [],
    })
    await this.audit.record({ action: 'auth.2fa_disabled', user, req })
  }

  /** New set of recovery codes; the old ones stop working. Needs a current authenticator code. */
  async regenerateRecoveryCodes(
    actor: AuthUser,
    code: string,
    req: Request,
  ): Promise<{ recoveryCodes: string[] }> {
    const user = await this.users.findWithSecrets({ id: actor.id })
    if (!user?.totpEnabled || !user.totpSecretEnc) {
      throw new BadRequestException({ code: 'not_enabled', message: '2FA не включена' })
    }
    const step = await this.totp.verify(
      decrypt(user.totpSecretEnc, this.encryptionKey),
      normalizeCode(code),
      user.totpLastStep,
    )
    if (step === null)
      throw new BadRequestException({ code: 'invalid_code', message: 'Неверный код' })

    const recoveryCodes = generateRecoveryCodes()
    await this.users.updateFields(user.id, {
      totpLastStep: step,
      recoveryCodes: recoveryCodes.map(hashRecoveryCode),
    })
    await this.audit.record({ action: 'auth.recovery_codes_regenerated', user, req })
    return { recoveryCodes }
  }

  /** Other logins end; the one making the change stays signed in. */
  async changePassword(
    actor: AuthUser,
    currentPassword: string,
    newPassword: string,
    req: Request,
  ): Promise<void> {
    const user = await this.users.findWithSecrets({ id: actor.id })
    if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, currentPassword))) {
      throw new BadRequestException({
        code: 'invalid_password',
        message: 'Текущий пароль указан неверно',
      })
    }
    assertPasswordPolicy(newPassword, user.email)
    await this.users.updateFields(user.id, {
      passwordHash: await hashPassword(newPassword),
      passwordChangedAt: new Date(),
    })
    await this.sessions.revokeAllForUser(user.id, actor.sessionFamilyId)
    await this.audit.record({ action: 'auth.password_changed', user, req })
  }

  private async checkSecondFactor(user: User, code: string, req: Request): Promise<boolean> {
    if (isTotpCode(code)) {
      if (!user.totpSecretEnc) return false
      const step = await this.totp.verify(
        decrypt(user.totpSecretEnc, this.encryptionKey),
        normalizeCode(code),
        user.totpLastStep,
      )
      if (step === null) return false
      await this.users.updateFields(user.id, { totpLastStep: step })
      return true
    }

    const hash = hashRecoveryCode(code)
    if (!user.recoveryCodes.includes(hash)) return false
    const remaining = user.recoveryCodes.filter((stored) => stored !== hash)
    await this.users.updateFields(user.id, { recoveryCodes: remaining })
    await this.audit.record({
      action: 'auth.recovery_code_used',
      user,
      summary: `Осталось кодов: ${remaining.length}`,
      req,
    })
    return true
  }

  private async registerFailure(
    user: User,
    req: Request,
    reason: 'password' | 'code',
  ): Promise<void> {
    const failures = user.failedLogins + 1
    if (failures >= MAX_FAILED_LOGINS) {
      await this.users.updateFields(user.id, {
        failedLogins: 0,
        lockedUntil: new Date(Date.now() + LOCK_MS),
      })
      await this.audit.record({
        action: 'auth.locked',
        user,
        summary: `${MAX_FAILED_LOGINS} неудачных попыток подряд, вход закрыт на 15 минут`,
        req,
      })
    } else {
      await this.users.incrementFailedLogins(user.id)
    }
    await this.audit.record({ action: 'auth.login_failed', user, meta: { reason }, req })
  }
}

import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import type { Request } from 'express'
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm'
import { AuditService } from '../audit/audit.service.js'
import { assertPasswordPolicy, hashPassword } from '../auth/password.js'
import { assignableRoles, ROLE_LABELS, type Role } from '../auth/permissions.js'
import { randomToken, sha256 } from '../common/crypto.js'
import { type AuthUser, normalizeEmail } from '../common/request.js'
import type { Env } from '../config/env.js'
import { PasswordToken, type PasswordTokenPurpose } from './password-token.entity.js'
import { SessionsService } from './sessions.service.js'
import { User } from './user.entity.js'
import type { CreateUserDto, UpdateUserDto } from './users.dto.js'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const RESET_TTL_MS = 24 * 60 * 60 * 1000

export type UserStatus = 'active' | 'invited' | 'disabled'

export type UserView = {
  id: string
  email: string
  name: string
  role: Role
  roleLabel: string
  status: UserStatus
  totpEnabled: boolean
  lastLoginAt: Date | null
  createdAt: Date
}

export function toUserView(user: User): UserView {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role],
    status: !user.isActive ? 'disabled' : user.passwordChangedAt ? 'active' : 'invited',
    totpEnabled: user.totpEnabled,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  }
}

/** Secrets are `select: false`; login and 2FA need them, so they ask for them explicitly. */
const WITH_SECRETS = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  passwordHash: true,
  passwordChangedAt: true,
  totpEnabled: true,
  totpSecretEnc: true,
  totpLastStep: true,
  recoveryCodes: true,
  failedLogins: true,
  lockedUntil: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(PasswordToken) private readonly passwordTokens: Repository<PasswordToken>,
    private readonly dataSource: DataSource,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  findActive(id: string): Promise<User | null> {
    return this.users.findOneBy({ id, isActive: true })
  }

  findWithSecrets(where: { id: string } | { email: string }): Promise<User | null> {
    const filter = 'email' in where ? { email: normalizeEmail(where.email) } : where
    return this.users.findOne({ where: filter, select: WITH_SECRETS })
  }

  save(user: User): Promise<User> {
    return this.users.save(user)
  }

  updateFields(id: string, changes: Partial<User>): Promise<unknown> {
    return this.users.update(id, changes)
  }

  incrementFailedLogins(id: string): Promise<unknown> {
    return this.users.increment({ id }, 'failedLogins', 1)
  }

  async list(): Promise<UserView[]> {
    const rows = await this.users.find({ order: { createdAt: 'ASC' } })
    return rows.map(toUserView)
  }

  async create(
    dto: CreateUserDto,
    actor: AuthUser,
    req: Request,
  ): Promise<{ user: UserView; link: string }> {
    this.assertCanAssign(actor, dto.role)
    const email = normalizeEmail(dto.email)
    if (await this.users.existsBy({ email })) {
      throw new ConflictException({
        code: 'email_taken',
        message: 'Пользователь с таким email уже есть',
      })
    }

    const user = await this.users.save(this.users.create({ email, name: dto.name, role: dto.role }))
    const link = await this.issuePasswordLink(user.id, 'invite', actor.id)
    await this.audit.record({
      action: 'users.invite',
      user: actor,
      entityType: 'user',
      entityId: user.id,
      summary: `${email}, ${ROLE_LABELS[dto.role]}`,
      req,
    })
    return { user: toUserView(user), link }
  }

  /** For the server CLI that creates the first administrator. */
  async createInitialAdmin(emailInput: string, name: string): Promise<string> {
    const email = normalizeEmail(emailInput)
    if (await this.users.existsBy({ email })) {
      throw new ConflictException(`A user with email ${email} already exists`)
    }
    const user = await this.users.save(this.users.create({ email, name, role: 'admin' }))
    const link = await this.issuePasswordLink(user.id, 'invite', null)
    await this.audit.record({
      action: 'users.invite',
      userEmail: 'cli',
      entityType: 'user',
      entityId: user.id,
      summary: `${email}, ${ROLE_LABELS.admin} (CLI)`,
    })
    return link
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser, req: Request): Promise<UserView> {
    const user = await this.getManageable(id, actor)
    if (user.id === actor.id && (dto.role !== undefined || dto.isActive === false)) {
      throw new ForbiddenException({
        code: 'self_change',
        message: 'Нельзя менять свою роль или отключать свою учётную запись',
      })
    }

    const changes: string[] = []
    if (dto.name !== undefined && dto.name !== user.name) {
      user.name = dto.name
      changes.push('имя')
    }
    if (dto.role !== undefined && dto.role !== user.role) {
      this.assertCanAssign(actor, dto.role)
      changes.push(`роль: ${ROLE_LABELS[user.role]} → ${ROLE_LABELS[dto.role]}`)
      user.role = dto.role
    }
    if (dto.isActive !== undefined && dto.isActive !== user.isActive) {
      user.isActive = dto.isActive
      changes.push(dto.isActive ? 'включён' : 'отключён')
    }

    await this.users.save(user)
    if (dto.isActive === false) await this.sessions.revokeAllForUser(user.id)
    if (changes.length > 0) {
      await this.audit.record({
        action: 'users.update',
        user: actor,
        entityType: 'user',
        entityId: user.id,
        summary: `${user.email}: ${changes.join(', ')}`,
        req,
      })
    }
    return toUserView(user)
  }

  async createResetLink(id: string, actor: AuthUser, req: Request): Promise<{ link: string }> {
    const user = await this.getManageable(id, actor)
    if (!user.isActive) {
      throw new ForbiddenException({ code: 'user_disabled', message: 'Учётная запись отключена' })
    }
    const purpose: PasswordTokenPurpose = user.passwordChangedAt ? 'reset' : 'invite'
    const link = await this.issuePasswordLink(user.id, purpose, actor.id)
    await this.audit.record({
      action: purpose === 'reset' ? 'users.reset_link' : 'users.invite_link',
      user: actor,
      entityType: 'user',
      entityId: user.id,
      summary: user.email,
      req,
    })
    return { link }
  }

  /** For a lost phone: the user logs in with the password alone and can set 2FA up again. */
  async resetTwoFactor(id: string, actor: AuthUser, req: Request): Promise<UserView> {
    const user = await this.getManageable(id, actor)
    await this.users.update(user.id, {
      totpEnabled: false,
      totpSecretEnc: null,
      totpLastStep: null,
      recoveryCodes: [],
    })
    await this.audit.record({
      action: 'users.reset_2fa',
      user: actor,
      entityType: 'user',
      entityId: user.id,
      summary: user.email,
      req,
    })
    return toUserView({ ...user, totpEnabled: false })
  }

  /** What the set-password page shows before the user types anything. */
  async inspectPasswordToken(
    token: string,
  ): Promise<{ email: string; name: string; purpose: PasswordTokenPurpose }> {
    const row = await this.findUsableToken(token)
    return { email: row.user.email, name: row.user.name, purpose: row.purpose }
  }

  async setPasswordWithToken(token: string, password: string, req: Request): Promise<void> {
    const row = await this.findUsableToken(token)
    assertPasswordPolicy(password, row.user.email)
    const passwordHash = await hashPassword(password)

    await this.dataSource.transaction(async (manager) => {
      const used = await manager.update(
        PasswordToken,
        { id: row.id, usedAt: IsNull() },
        { usedAt: new Date() },
      )
      if (!used.affected)
        throw new GoneException({ code: 'link_used', message: 'Ссылка уже использована' })
      await manager.update(User, row.userId, {
        passwordHash,
        passwordChangedAt: new Date(),
        failedLogins: 0,
        lockedUntil: null,
      })
    })
    // A new password ends every existing login.
    await this.sessions.revokeAllForUser(row.userId)
    await this.audit.record({
      action: row.purpose === 'invite' ? 'auth.invite_accepted' : 'auth.password_reset',
      user: row.user,
      entityType: 'user',
      entityId: row.userId,
      req,
    })
  }

  private async findUsableToken(token: string) {
    const row = await this.passwordTokens.findOne({
      where: { tokenHash: sha256(token), usedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      relations: { user: true },
    })
    if (!row?.user.isActive) {
      throw new GoneException({
        code: 'link_invalid',
        message: 'Ссылка недействительна или устарела. Попросите новую у администратора.',
      })
    }
    return row
  }

  private async issuePasswordLink(
    userId: string,
    purpose: PasswordTokenPurpose,
    createdBy: string | null,
  ): Promise<string> {
    // Only the newest link works.
    await this.passwordTokens.update({ userId, usedAt: IsNull() }, { usedAt: new Date() })
    const token = randomToken(32)
    await this.passwordTokens.insert({
      userId,
      tokenHash: sha256(token),
      purpose,
      expiresAt: new Date(Date.now() + (purpose === 'invite' ? INVITE_TTL_MS : RESET_TTL_MS)),
      createdBy,
    })
    // In the fragment, so the token never reaches a server log.
    return `${this.config.get('ADMIN_ORIGIN', { infer: true })}/set-password#${token}`
  }

  /** Marketing manages marketing and HR accounts; only an administrator touches administrators. */
  private async getManageable(id: string, actor: AuthUser): Promise<User> {
    const user = await this.users.findOneBy({ id })
    if (!user)
      throw new NotFoundException({ code: 'user_not_found', message: 'Пользователь не найден' })
    if (user.role === 'admin' && actor.role !== 'admin') {
      throw new ForbiddenException({
        code: 'admin_only',
        message: 'Учётные записи администраторов меняет только администратор',
      })
    }
    return user
  }

  private assertCanAssign(actor: AuthUser, role: Role): void {
    if (!assignableRoles(actor.role).includes(role)) {
      throw new ForbiddenException({
        code: 'role_not_allowed',
        message: `Вы не можете назначать роль «${ROLE_LABELS[role]}»`,
      })
    }
  }
}

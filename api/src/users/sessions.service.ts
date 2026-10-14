import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, MoreThan, Not, Repository } from 'typeorm'
import { randomToken, sha256 } from '../common/crypto.js'
import type { ClientMeta } from '../common/request.js'
import { RefreshToken } from './refresh-token.entity.js'

export const ACCESS_TTL_SECONDS = 15 * 60
/** Sliding: every refresh starts a new 14 days. */
export const REFRESH_TTL_MS = 14 * 24 * 60 * 60 * 1000
/** Two tabs refreshing at once send the same token; the second one within this window is not an attack. */
const REUSE_GRACE_MS = 30_000

export type Session = {
  access: string
  refresh: string
  familyId: string
  tokenId: string
}

export type AccessPayload = { sub: string; fam: string }

export type RotateResult =
  | { status: 'ok'; userId: string; session: Session }
  /** Lost a race with another tab; that tab already has fresh cookies. */
  | { status: 'stale' }
  /** An old token came back long after rotation: treated as stolen, the login is ended. */
  | { status: 'reuse'; userId: string }
  | { status: 'invalid' }

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(RefreshToken) private readonly tokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
  ) {}

  async issue(userId: string, meta: ClientMeta, familyId: string = randomUUID()): Promise<Session> {
    const refresh = randomToken(32)
    const row = await this.tokens.save(
      this.tokens.create({
        userId,
        tokenHash: sha256(refresh),
        familyId,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        ip: meta.ip,
        userAgent: meta.userAgent,
      }),
    )
    const access = await this.jwt.signAsync({ sub: userId, fam: familyId } satisfies AccessPayload)
    return { access, refresh, familyId, tokenId: row.id }
  }

  async rotate(refresh: string, meta: ClientMeta): Promise<RotateResult> {
    const row = await this.tokens.findOneBy({ tokenHash: sha256(refresh) })
    if (!row) return { status: 'invalid' }

    const now = Date.now()
    if (row.revokedAt) {
      if (now - row.revokedAt.getTime() < REUSE_GRACE_MS) return { status: 'stale' }
      await this.revokeFamily(row.familyId)
      return { status: 'reuse', userId: row.userId }
    }
    if (row.expiresAt.getTime() <= now) return { status: 'invalid' }

    // The new token exists before the old one is revoked, so the family never
    // has a moment with no live token (AuthGuard checks for one on every request).
    const session = await this.issue(row.userId, meta, row.familyId)
    const claimed = await this.tokens.update(
      { id: row.id, revokedAt: IsNull() },
      { revokedAt: new Date(now), replacedBy: session.tokenId },
    )
    if (!claimed.affected) {
      // Someone else rotated this token first; drop ours.
      await this.tokens.update(session.tokenId, { revokedAt: new Date(now) })
      return { status: 'stale' }
    }
    return { status: 'ok', userId: row.userId, session }
  }

  verifyAccess(token: string): Promise<AccessPayload> {
    return this.jwt.verifyAsync<AccessPayload>(token)
  }

  /** A login stays valid while its family has a live refresh token: logout and revocation are immediate. */
  isFamilyActive(familyId: string): Promise<boolean> {
    return this.tokens.existsBy({
      familyId,
      revokedAt: IsNull(),
      expiresAt: MoreThan(new Date()),
    })
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.tokens.update({ familyId, revokedAt: IsNull() }, { revokedAt: new Date() })
  }

  /** Ends every login of the user, optionally keeping the current one. */
  async revokeAllForUser(userId: string, exceptFamilyId?: string): Promise<void> {
    await this.tokens.update(
      {
        userId,
        revokedAt: IsNull(),
        ...(exceptFamilyId ? { familyId: Not(exceptFamilyId) } : {}),
      },
      { revokedAt: new Date() },
    )
  }

  /** Logout: ends the login the refresh token belongs to. Returns its user, if any. */
  async revokeByRefresh(refresh: string): Promise<string | null> {
    const row = await this.tokens.findOneBy({ tokenHash: sha256(refresh) })
    if (!row) return null
    await this.revokeFamily(row.familyId)
    return row.userId
  }
}

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import type { Request } from 'express'
import { Repository } from 'typeorm'
import { AuditService } from '../audit/audit.service.js'
import { decrypt, encrypt } from '../common/crypto.js'
import type { AuthUser } from '../common/request.js'
import type { Env } from '../config/env.js'
import { AppSetting } from './app-setting.entity.js'

const TELEGRAM_KEY = 'telegram'

/** Stored in app_settings; the bot token is encrypted with DATA_ENCRYPTION_KEY. */
type StoredTelegram = {
  enabled: boolean
  tokenEnc: string | null
  leadsChatId: string | null
  applicationsChatId: string | null
}

export type TelegramConfig = {
  enabled: boolean
  token: string | null
  leadsChatId: string | null
  applicationsChatId: string | null
}

/** What the dashboard sees: never the token itself. */
export type TelegramView = {
  enabled: boolean
  hasToken: boolean
  leadsChatId: string | null
  applicationsChatId: string | null
  updatedAt: Date | null
}

export type TelegramChanges = {
  enabled?: boolean
  /** A new token; an empty string removes it. Left out: the token stays as it is. */
  token?: string
  leadsChatId?: string | null
  applicationsChatId?: string | null
}

const EMPTY: StoredTelegram = {
  enabled: false,
  tokenEnc: null,
  leadsChatId: null,
  applicationsChatId: null,
}

@Injectable()
export class IntegrationsService {
  private readonly key: Buffer

  constructor(
    @InjectRepository(AppSetting) private readonly settings: Repository<AppSetting>,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    this.key = Buffer.from(config.get('DATA_ENCRYPTION_KEY', { infer: true }), 'base64')
  }

  async telegram(): Promise<TelegramConfig> {
    const { stored } = await this.storedTelegram()
    let token: string | null = null
    if (stored.tokenEnc) {
      try {
        token = decrypt(stored.tokenEnc, this.key)
      } catch {
        // DATA_ENCRYPTION_KEY changed: the token has to be entered again.
        token = null
      }
    }
    return {
      enabled: stored.enabled,
      token,
      leadsChatId: stored.leadsChatId,
      applicationsChatId: stored.applicationsChatId,
    }
  }

  async telegramView(): Promise<TelegramView> {
    const { stored, updatedAt } = await this.storedTelegram()
    return {
      enabled: stored.enabled,
      hasToken: Boolean(stored.tokenEnc),
      leadsChatId: stored.leadsChatId,
      applicationsChatId: stored.applicationsChatId,
      updatedAt,
    }
  }

  async updateTelegram(
    changes: TelegramChanges,
    actor: AuthUser,
    req: Request,
  ): Promise<TelegramView> {
    const { stored } = await this.storedTelegram()
    const next: StoredTelegram = { ...stored }
    if (changes.enabled !== undefined) next.enabled = changes.enabled
    if (changes.token !== undefined) {
      const token = changes.token.trim()
      next.tokenEnc = token ? encrypt(token, this.key) : null
    }
    if (changes.leadsChatId !== undefined) next.leadsChatId = changes.leadsChatId?.trim() || null
    if (changes.applicationsChatId !== undefined) {
      next.applicationsChatId = changes.applicationsChatId?.trim() || null
    }
    await this.settings.save(
      this.settings.create({ key: TELEGRAM_KEY, value: next, updatedBy: actor.id }),
    )
    await this.audit.record({
      action: 'integrations.telegram.update',
      user: actor,
      entityType: 'integration',
      entityId: TELEGRAM_KEY,
      // Which settings changed, never the token.
      meta: {
        changed: Object.keys(changes).filter(
          (key) => changes[key as keyof TelegramChanges] !== undefined,
        ),
      },
      req,
    })
    return this.telegramView()
  }

  private async storedTelegram(): Promise<{ stored: StoredTelegram; updatedAt: Date | null }> {
    const row = await this.settings.findOneBy({ key: TELEGRAM_KEY })
    return {
      stored: { ...EMPTY, ...(row?.value as Partial<StoredTelegram> | undefined) },
      updatedAt: row?.updatedAt ?? null,
    }
  }
}

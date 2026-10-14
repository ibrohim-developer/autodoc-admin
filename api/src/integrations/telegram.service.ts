import { setTimeout as delay } from 'node:timers/promises'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../config/env.js'
import { IntegrationsService } from './integrations.service.js'

export type TelegramChannel = 'leads' | 'applications'

export type TelegramResult = { ok: true } | { ok: false; error: string }

const ATTEMPTS = 3

/**
 * Alerts in the marketing and HR chats. Plain text with a link to the admin and never any
 * personal data: no names, phones or messages (the chat is not where those are kept). Fire and
 * forget, like the site refresh: a submission is saved whether or not Telegram answers.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name)
  private readonly apiUrl: string

  constructor(
    private readonly integrations: IntegrationsService,
    config: ConfigService<Env, true>,
  ) {
    this.apiUrl = config.get('TELEGRAM_API_URL', { infer: true }).replace(/\/$/, '')
  }

  notify(channel: TelegramChannel, text: string): void {
    void this.deliver(channel, text)
  }

  /** Exposed for tests; resolves once delivered or given up. */
  async deliver(channel: TelegramChannel, text: string): Promise<TelegramResult | null> {
    const config = await this.integrations.telegram()
    const chatId = channel === 'leads' ? config.leadsChatId : config.applicationsChatId
    if (!config.enabled || !config.token || !chatId) return null
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const result = await this.send(config.token, chatId, text)
      if (result.ok) return result
      if (attempt === ATTEMPTS) {
        this.logger.warn(`Telegram alert to ${channel} failed: ${result.error}`)
        return result
      }
      await delay(attempt * 2_000)
    }
    return null
  }

  /** "Проверить": one message to each chat that is set, with Telegram's own answer on failure. */
  async test(): Promise<Record<TelegramChannel, TelegramResult | null>> {
    const config = await this.integrations.telegram()
    const run = async (chatId: string | null, label: string) => {
      if (!config.token) return { ok: false as const, error: 'Не указан токен бота' }
      if (!chatId) return null
      return this.send(config.token, chatId, `Проверка связи: сюда будут приходить ${label}.`)
    }
    const [leads, applications] = await Promise.all([
      run(config.leadsChatId, 'новые заявки с сайта'),
      run(config.applicationsChatId, 'новые отклики на вакансии'),
    ])
    return { leads, applications }
  }

  private async send(token: string, chatId: string, text: string): Promise<TelegramResult> {
    try {
      const response = await fetch(`${this.apiUrl}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(10_000),
      })
      if (response.ok) return { ok: true }
      const body = (await response.json().catch(() => null)) as { description?: string } | null
      return { ok: false, error: body?.description ?? `HTTP ${response.status}` }
    } catch (error) {
      // The error can carry the URL, and the URL carries the token: keep only the reason.
      const reason = error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network'
      return {
        ok: false,
        error: reason === 'timeout' ? 'Telegram не ответил' : 'Нет связи с Telegram',
      }
    }
  }
}

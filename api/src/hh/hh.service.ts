import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditService } from '../audit/audit.service.js'
import { permissionsOf } from '../auth/permissions.js'
import type { AuthUser } from '../common/request.js'
import type { Env } from '../config/env.js'
import { ContentTypeRegistry } from '../content/content-types.js'
import { ContentDocument } from '../content/document.entity.js'
import { type DocumentData, hashData } from '../content/document-data.js'
import { DocumentsService } from '../content/documents.service.js'
import { type HhRun, IntegrationsService } from '../integrations/integrations.service.js'
import { User } from '../users/user.entity.js'
import { SYSTEM_EMAIL_DOMAIN } from '../users/users.service.js'
import { HhError, type HhVacancy, hhClient } from './hh-api.js'
import { excerpt, htmlToPlain, htmlToRichText } from './html-to-rich-text.js'

const VACANCY = 'vacancy'
const SYSTEM_EMAIL = `hh${SYSTEM_EMAIL_DOMAIN}`

type HhRef = { id: string; hash: string }

/** What the sync writes and watches: not the direction (HR's to choose), slug, closed or hh. */
export function contentHash(data: DocumentData): string {
  return hashData({ employment: data.shared.employment ?? null, locales: data.locales })
}

function employmentOf(vacancy: HhVacancy): string {
  if (vacancy.schedule?.id === 'remote') return 'remote'
  if (vacancy.employment?.id === 'probation') return 'internship'
  if (vacancy.employment?.id === 'part' || vacancy.employment?.id === 'project') return 'partTime'
  return 'fullTime'
}

/**
 * The vacancy as the site's type wants it. hh texts are usually Russian; they go into Uzbek
 * (required) and Russian alike, and HR translates the Uzbek when there's time.
 */
export function toVacancyData(vacancy: HhVacancy): Omit<DocumentData, 'shared'> & {
  shared: { employment: string }
} {
  const plain = htmlToPlain(vacancy.description)
  const fields = {
    title: vacancy.name.trim().slice(0, 120),
    city: (vacancy.area?.name ?? 'Ташкент').trim().slice(0, 60),
    description: excerpt(plain || vacancy.name.trim(), 400),
    requirements: vacancy.key_skills
      .map((skill) => skill.name.trim().slice(0, 120))
      .filter(Boolean)
      .slice(0, 4),
    body: htmlToRichText(vacancy.description),
  }
  return { shared: { employment: employmentOf(vacancy) }, locales: { uz: fields, ru: fields } }
}

const emptyRun = (): HhRun => ({
  at: new Date().toISOString(),
  ok: true,
  error: null,
  created: 0,
  updated: 0,
  closed: 0,
  reopened: 0,
  protected: 0,
  failed: 0,
})

/**
 * Every hour: the company's open vacancies on hh.uz come in as vacancies here (drafts, or live
 * with auto-publish), changes on hh follow, and a vacancy closed on hh is closed on the site.
 * Once someone edits an imported vacancy in the admin, its text is theirs: the sync only opens
 * and closes it. A vacancy put in the trash here is not brought back. Responses (отклики) on
 * hh are not imported: that needs paid employer API access.
 */
@Injectable()
export class HhService {
  private readonly logger = new Logger(HhService.name)
  private readonly apiUrl: string
  private running: Promise<HhRun> | null = null

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly documents: DocumentsService,
    @InjectRepository(ContentDocument) private readonly rows: Repository<ContentDocument>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly audit: AuditService,
    private readonly registry: ContentTypeRegistry,
    config: ConfigService<Env, true>,
  ) {
    this.apiUrl = config.get('HH_API_URL', { infer: true })
  }

  @Cron('7 * * * *', { name: 'hh-sync', timeZone: 'Asia/Tashkent' })
  async scheduled(): Promise<void> {
    const config = await this.integrations.hh()
    if (config.enabled) await this.sync()
  }

  /** One run at a time: a second call waits for the one under way. */
  sync(): Promise<HhRun> {
    this.running ??= this.run().finally(() => {
      this.running = null
    })
    return this.running
  }

  private async run(): Promise<HhRun> {
    const result = emptyRun()
    const previous = await this.integrations.lastHhRun()
    try {
      const config = await this.integrations.hh()
      if (!config.token) throw new HhError('Не указан токен приложения hh.uz')
      if (!config.employerId) throw new HhError('Не указан ID работодателя на hh.uz')
      if (!config.directionId) throw new HhError('Не выбрано направление для новых вакансий')
      const client = hhClient(this.apiUrl, config.token)
      const actor = await this.actor()

      const open = new Set(await client.openIds(config.employerId))
      const known = await this.importedVacancies()

      for (const id of open) {
        const existing = known.get(id)
        // Deleted here on purpose: stays deleted.
        if (existing?.deletedAt) continue
        try {
          const vacancy = await client.vacancy(id)
          if (vacancy.archived) {
            if (existing) await this.close(existing, actor, result)
            continue
          }
          if (existing) await this.update(existing, vacancy, actor, result)
          else await this.create(vacancy, config.directionId, config.autoPublish, actor, result)
        } catch (error) {
          if (error instanceof HhError) throw error
          result.failed += 1
          result.error ??= `Вакансия ${id}: ${error instanceof Error ? error.message : String(error)}`
          this.logger.warn(`hh vacancy ${id} not synced: ${String(error)}`)
        }
      }

      // Synced before, no longer open on hh: closed there.
      for (const [id, doc] of known) {
        if (!open.has(id) && !doc.deletedAt) await this.close(doc, actor, result)
      }
    } catch (error) {
      result.ok = false
      result.error = error instanceof Error ? error.message : String(error)
      this.logger.warn(`hh sync failed: ${result.error}`)
    }

    await this.integrations.saveHhRun(result)
    const changed = result.created + result.updated + result.closed + result.reopened > 0
    // A failure is logged when it starts (or changes), not every hour while it lasts.
    const newFailure = !result.ok && previous?.error !== result.error
    if (changed || newFailure || result.failed > 0) {
      await this.audit.record({
        action: 'hh.sync',
        userEmail: 'hh.uz',
        summary: result.ok
          ? `hh.uz: новых ${result.created}, обновлено ${result.updated}, закрыто ${result.closed}, открыто снова ${result.reopened}`
          : `hh.uz: ошибка — ${result.error}`,
        meta: result,
      })
    }
    return result
  }

  private async create(
    vacancy: HhVacancy,
    directionId: string,
    autoPublish: boolean,
    actor: AuthUser,
    result: HhRun,
  ): Promise<void> {
    const base = toVacancyData(vacancy)
    const data = this.normalize({ ...base, shared: { ...base.shared, directionId, closed: false } })
    const hh: HhRef = { id: vacancy.id, hash: contentHash(data) }
    const created = await this.documents.create(
      VACANCY,
      { ...data, shared: { ...data.shared, hh } },
      actor,
    )
    if (autoPublish) await this.documents.publish(created.id, {}, actor)
    result.created += 1
  }

  private async update(
    doc: ContentDocument,
    vacancy: HhVacancy,
    actor: AuthUser,
    result: HhRun,
  ): Promise<void> {
    const ref = doc.draft.shared.hh as HhRef
    const edited = contentHash(doc.draft) !== ref.hash
    const reopen = doc.draft.shared.closed === true

    if (edited) {
      result.protected += 1
      if (reopen)
        await this.write(doc, { ...doc.draft.shared, closed: false }, doc.draft.locales, actor)
      if (reopen) result.reopened += 1
      return
    }

    const fresh = toVacancyData(vacancy)
    const next = this.normalize({
      shared: { ...doc.draft.shared, ...fresh.shared },
      locales: fresh.locales,
    })
    const hash = contentHash(next)
    if (hash === ref.hash && !reopen) return
    await this.write(
      doc,
      { ...next.shared, closed: false, hh: { id: ref.id, hash } },
      next.locales,
      actor,
    )
    if (hash !== ref.hash) result.updated += 1
    if (reopen) result.reopened += 1
  }

  private async close(doc: ContentDocument, actor: AuthUser, result: HhRun): Promise<void> {
    if (doc.draft.shared.closed === true) return
    await this.write(doc, { ...doc.draft.shared, closed: true }, doc.draft.locales, actor)
    result.closed += 1
  }

  /**
   * Saves the working copy and, if the vacancy is live, publishes it — unless someone has
   * unpublished changes waiting: those are theirs to publish, so the draft just keeps the change.
   */
  private async write(
    doc: ContentDocument,
    shared: DocumentData['shared'],
    locales: DocumentData['locales'],
    actor: AuthUser,
  ): Promise<void> {
    const pending = doc.published !== null && doc.draftHash !== doc.publishedHash
    // The address stays as it is, whatever the title becomes.
    const data = { shared: { ...shared, slug: doc.slug ?? undefined }, locales }
    const saved = await this.documents.save(doc.id, { data, revision: doc.revision }, actor)
    if (doc.published && !pending) await this.documents.publish(saved.id, {}, actor)
  }

  /** As the vacancy type stores it (trimmed, unknown keys dropped), so hashes compare equal. */
  private normalize(data: DocumentData): DocumentData {
    return this.registry.get(VACANCY).dataSchema.parse(data)
  }

  /** Vacancies imported earlier, by hh id, the trash included. */
  private async importedVacancies(): Promise<Map<string, ContentDocument>> {
    const rows = await this.rows
      .createQueryBuilder('d')
      .withDeleted()
      .where('d.type = :type', { type: VACANCY })
      .andWhere(`d.draft #>> '{shared,hh,id}' IS NOT NULL`)
      .getMany()
    return new Map(rows.map((row) => [String((row.draft.shared.hh as HhRef).id), row]))
  }

  /** "hh.uz": the author of what the sync does, in history and the audit log. Can't log in. */
  private async actor(): Promise<AuthUser> {
    let user = await this.users.findOneBy({ email: SYSTEM_EMAIL })
    if (!user) {
      user = await this.users.save(
        this.users.create({ email: SYSTEM_EMAIL, name: 'hh.uz', role: 'hr', isActive: false }),
      )
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'hr',
      permissions: permissionsOf('hr'),
      sessionFamilyId: '',
    }
  }
}

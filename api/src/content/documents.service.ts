import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import type { Request } from 'express'
import {
  DataSource,
  type EntityManager,
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  Not,
  Repository,
  type SelectQueryBuilder,
} from 'typeorm'
import { AuditService } from '../audit/audit.service.js'
import type { AuthUser } from '../common/request.js'
import type { Env } from '../config/env.js'
import { MediaService, type PublicMedia } from '../media/media.service.js'
import { User } from '../users/user.entity.js'
import { type ContentTypeDef, ContentTypeRegistry, type RegisteredType } from './content-types.js'
import { ContentDocument } from './document.entity.js'
import {
  collectMediaIds,
  type DocumentData,
  filledLocales,
  hashData,
  localize,
} from './document-data.js'
import { DocumentVersion, type VersionKind } from './document-version.entity.js'
import { LOCALES, type Locale } from './locales.js'
import { previewUrl } from './preview.js'
import { SiteRevalidationService } from './site-revalidation.service.js'
import { slugify } from './slug.js'

/** Versions kept per document; older ones are pruned on every new version. */
export const MAX_VERSIONS = 100
/** Days a deleted document or photo waits in the trash before it is removed for good. */
export const TRASH_DAYS = 30
/** A document over this many bytes of JSON is refused (a normal long article is ~50 KB). */
const MAX_DOCUMENT_BYTES = 1_000_000
/** The type the site's redirects are stored as (src/site-content/redirects.ts). */
export const REDIRECT_TYPE = 'redirect'

export type DocumentStatus = 'draft' | 'published' | 'changed' | 'scheduled'

export type DocumentSummary = {
  id: string
  type: string
  typeLabel: string
  slug: string | null
  title: string
  status: DocumentStatus
  /** Languages with any content; Uzbek is always first. */
  locales: Locale[]
  firstPublishedAt: Date | null
  publishedAt: Date | null
  scheduledAt: Date | null
  updatedAt: Date
  updatedBy: { id: string; name: string } | null
  /** The type's list fields from the working copy (date, category…), for the admin's tables. */
  shared: Record<string, unknown>
}

export type DocumentView = DocumentSummary & {
  data: DocumentData
  revision: number
  isLive: boolean
  publishedSlug: string | null
  /** Languages for which "Предпросмотр" can open a page on the site. */
  previewLocales: Locale[]
  /** The page on the site while it is live (Uzbek address), for "Открыть на сайте". */
  liveUrl: string | null
}

export type VersionSummary = {
  id: string
  kind: VersionKind
  title: string
  createdAt: Date
  createdBy: { id: string; name: string } | null
  /** Same content as the current working copy. */
  isDraft: boolean
  /** Same content as what the site shows. */
  isLive: boolean
}

export type PublicDocument = {
  id: string
  type: string
  slug: string | null
  locale: Locale
  /** False when the requested language had nothing and everything is in Uzbek. */
  translated: boolean
  firstPublishedAt: Date | null
  publishedAt: Date | null
  updatedAt: Date
  data: Record<string, unknown>
  media: Record<string, PublicMedia>
}

function statusOf(doc: ContentDocument): DocumentStatus {
  if (doc.scheduledAt) return 'scheduled'
  if (!doc.published) return 'draft'
  return doc.draftHash === doc.publishedHash ? 'published' : 'changed'
}

const conflict = () =>
  new ConflictException({
    code: 'conflict',
    message:
      'Документ уже изменил другой пользователь. Обновите страницу, чтобы увидеть его версию.',
  })

const notFound = () =>
  new NotFoundException({ code: 'document_not_found', message: 'Документ не найден' })

const versionNotFound = () =>
  new NotFoundException({ code: 'version_not_found', message: 'Версия не найдена' })

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name)

  constructor(
    @InjectRepository(ContentDocument) private readonly documents: Repository<ContentDocument>,
    @InjectRepository(DocumentVersion) private readonly versions: Repository<DocumentVersion>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly registry: ContentTypeRegistry,
    private readonly media: MediaService,
    private readonly revalidation: SiteRevalidationService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ── Admin: reading ──────────────────────────────────────────────────────────

  async list(
    typeName: string,
    query: { status?: DocumentStatus; q?: string; page: number; pageSize: number },
    actor: AuthUser,
  ): Promise<{ items: DocumentSummary[]; total: number }> {
    const type = this.registry.get(typeName)
    this.assert(actor, type, 'read')

    const qb = this.documents.createQueryBuilder('d').where('d.type = :type', { type: type.type })
    if (query.status === 'draft') qb.andWhere('d.published IS NULL AND d.scheduled_at IS NULL')
    if (query.status === 'published') {
      qb.andWhere(
        'd.published IS NOT NULL AND d.draft_hash = d.published_hash AND d.scheduled_at IS NULL',
      )
    }
    if (query.status === 'changed') {
      qb.andWhere(
        'd.published IS NOT NULL AND d.draft_hash <> d.published_hash AND d.scheduled_at IS NULL',
      )
    }
    if (query.status === 'scheduled') qb.andWhere('d.scheduled_at IS NOT NULL')
    // The documents are small and few: a text match over the JSON is fast enough and finds any field.
    if (query.q) qb.andWhere('d.draft::text ILIKE :q', { q: `%${query.q}%` })

    if (type.adminOrder) this.applyOrder(qb, type, 'draft')
    const [rows, total] = await qb
      .addOrderBy('d.updated_at', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount()
    const names = await this.userNames(rows.map((row) => row.updatedBy))
    return { items: rows.map((row) => this.summary(type, row, names)), total }
  }

  async get(id: string, actor: AuthUser): Promise<DocumentView> {
    const doc = await this.documents.findOneBy({ id })
    if (!doc) throw notFound()
    const type = this.registry.get(doc.type)
    this.assert(actor, type, 'read')
    return this.view(type, doc)
  }

  /** For singletons (a page, a settings block): the one document of the type, if created yet. */
  async getSingleton(typeName: string, actor: AuthUser): Promise<DocumentView | null> {
    const type = this.registry.get(typeName)
    this.assert(actor, type, 'read')
    const doc = await this.documents.findOneBy({ type: type.type })
    return doc ? this.view(type, doc) : null
  }

  // ── Admin: writing ──────────────────────────────────────────────────────────

  async create(
    typeName: string,
    input: unknown,
    actor: AuthUser,
    req?: Request,
  ): Promise<DocumentView> {
    const type = this.registry.get(typeName)
    this.assert(actor, type, 'write')
    if (type.publishOnSave) this.assert(actor, type, 'publish')
    const data = this.validate(type, input)
    if (type.publishOnSave) this.checkPublishable(type, data)

    const doc = await this.dataSource.transaction(async (manager) => {
      if (type.singleton && (await manager.existsBy(ContentDocument, { type: type.type }))) {
        throw new ConflictException({
          code: 'singleton_exists',
          message: `${type.label}: уже создан`,
        })
      }
      await this.checkReferences(manager, type, data)
      await this.checkUnique(manager, type, data, null)
      const slug = await this.resolveSlug(manager, type, data, null, 'create')
      const hash = hashData(data)
      const created = await manager.save(
        manager.create(ContentDocument, {
          type: type.type,
          slug,
          draft: data,
          draftHash: hash,
          revision: 1,
          createdBy: actor.id,
          updatedBy: actor.id,
        }),
      )
      await this.addVersion(manager, created.id, 'created', data, hash, actor.id)
      await this.media.syncUsages(manager, created.id, collectMediaIds(data))
      if (type.publishOnSave) await this.applyPublish(manager, created, actor.id)
      return created
    })

    await this.record('documents.create', type, doc, actor, req)
    if (type.publishOnSave) this.refreshSite(type, doc, null)
    return this.view(type, doc)
  }

  /**
   * Saves the working copy. `revision` is the one the editor started from: if someone saved in
   * between, the save is refused rather than silently overwriting their work.
   */
  async save(
    id: string,
    input: { data: unknown; revision: number },
    actor: AuthUser,
    req?: Request,
  ): Promise<DocumentView> {
    const result = await this.dataSource.transaction(async (manager) => {
      const doc = await this.lock(manager, id)
      const type = this.registry.get(doc.type)
      this.assert(actor, type, 'write')
      if (type.publishOnSave) this.assert(actor, type, 'publish')
      if (input.revision !== doc.revision) throw conflict()

      const data = this.validate(type, input.data)
      const hash = hashData(data)
      const previousSlug = doc.publishedSlug
      if (hash === doc.draftHash) return { doc, type, changed: false, previousSlug }
      if (type.publishOnSave) this.checkPublishable(type, data)

      await this.checkReferences(manager, type, data)
      await this.checkUnique(manager, type, data, doc.id)
      doc.slug = await this.resolveSlug(manager, type, data, doc.id, 'save')
      doc.draft = data
      doc.draftHash = hash
      doc.revision += 1
      doc.updatedBy = actor.id
      await manager.save(doc)
      await this.addVersion(manager, doc.id, 'saved', data, hash, actor.id)
      await this.syncMedia(manager, doc)
      if (type.publishOnSave) await this.applyPublish(manager, doc, actor.id)
      return { doc, type, changed: true, previousSlug }
    })

    if (result.changed) {
      await this.record('documents.save', result.type, result.doc, actor, req)
      if (result.type.publishOnSave) this.refreshSite(result.type, result.doc, result.previousSlug)
    }
    return this.view(result.type, result.doc)
  }

  async publish(
    id: string,
    input: { revision?: number },
    actor: AuthUser,
    req?: Request,
  ): Promise<DocumentView> {
    const { doc, type, previousSlug } = await this.dataSource.transaction(async (manager) => {
      const doc = await this.lock(manager, id)
      const type = this.registry.get(doc.type)
      this.assert(actor, type, 'publish')
      if (input.revision !== undefined && input.revision !== doc.revision) throw conflict()
      // The type's rules may have tightened since the draft was saved.
      this.validate(type, doc.draft)
      this.checkPublishable(type, doc.draft)
      const previousSlug = doc.publishedSlug
      await this.applyPublish(manager, doc, actor.id)
      return { doc, type, previousSlug }
    })
    await this.record('documents.publish', type, doc, actor, req)
    this.refreshSite(type, doc, previousSlug)
    return this.view(type, doc)
  }

  /** Takes it off the site. The working copy and the history stay. */
  async unpublish(id: string, actor: AuthUser, req: Request): Promise<DocumentView> {
    const { doc, type, wasLive, previousSlug } = await this.dataSource.transaction(
      async (manager) => {
        const doc = await this.lock(manager, id)
        const type = this.registry.get(doc.type)
        this.assert(actor, type, 'publish')
        if (type.publishOnSave) {
          throw new BadRequestException({
            code: 'cannot_unpublish',
            message: 'Этот раздел всегда опубликован',
          })
        }
        const published = doc.published
        if (!published) return { doc, type, wasLive: false, previousSlug: null }

        const previousSlug = doc.publishedSlug
        const hash = doc.publishedHash ?? hashData(published)
        await this.addVersion(manager, doc.id, 'unpublished', published, hash, actor.id)
        doc.published = null
        doc.publishedHash = null
        doc.publishedSlug = null
        doc.scheduledAt = null
        doc.scheduledBy = null
        await manager.save(doc)
        return { doc, type, wasLive: true, previousSlug }
      },
    )
    if (wasLive) {
      await this.record('documents.unpublish', type, doc, actor, req)
      this.refreshSite(type, doc, previousSlug)
    }
    return this.view(type, doc)
  }

  /** Publishes the working copy as it is at that moment. */
  async schedule(id: string, at: Date, actor: AuthUser, req: Request): Promise<DocumentView> {
    const now = Date.now()
    if (at.getTime() < now + 60_000) {
      throw new BadRequestException({
        code: 'schedule_too_soon',
        message: 'Выберите время хотя бы на минуту позже текущего',
      })
    }
    if (at.getTime() > now + 366 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException({
        code: 'schedule_too_far',
        message: 'Не дальше чем через год',
      })
    }
    const { doc, type } = await this.dataSource.transaction(async (manager) => {
      const doc = await this.lock(manager, id)
      const type = this.registry.get(doc.type)
      this.assert(actor, type, 'publish')
      if (type.publishOnSave) {
        throw new BadRequestException({
          code: 'cannot_schedule',
          message: 'Этот раздел публикуется сразу',
        })
      }
      this.validate(type, doc.draft)
      this.checkPublishable(type, doc.draft)
      doc.scheduledAt = at
      doc.scheduledBy = actor.id
      await manager.save(doc)
      return { doc, type }
    })
    await this.record('documents.schedule', type, doc, actor, req, {
      summary: `${type.title(doc.draft)} — ${formatTashkent(at)}`,
    })
    return this.view(type, doc)
  }

  async unschedule(id: string, actor: AuthUser, req: Request): Promise<DocumentView> {
    const { doc, type } = await this.dataSource.transaction(async (manager) => {
      const doc = await this.lock(manager, id)
      const type = this.registry.get(doc.type)
      this.assert(actor, type, 'publish')
      doc.scheduledAt = null
      doc.scheduledBy = null
      await manager.save(doc)
      return { doc, type }
    })
    await this.record('documents.unschedule', type, doc, actor, req)
    return this.view(type, doc)
  }

  /** Called every minute by the scheduler. Returns how many documents went live. */
  async publishDue(now = new Date()): Promise<number> {
    const due = await this.documents.find({
      where: { scheduledAt: LessThanOrEqual(now) },
      order: { scheduledAt: 'ASC' },
      take: 50,
    })
    let published = 0
    for (const candidate of due) {
      const type = this.registry.find(candidate.type)
      if (!type) continue
      try {
        const result = await this.dataSource.transaction(async (manager) => {
          const doc = await this.lock(manager, candidate.id)
          // Unscheduled or moved since the query: leave it.
          if (!doc.scheduledAt || doc.scheduledAt.getTime() > now.getTime()) return null
          const actorId = doc.scheduledBy
          this.validate(type, doc.draft)
          this.checkPublishable(type, doc.draft)
          const previousSlug = doc.publishedSlug
          await this.applyPublish(manager, doc, actorId)
          return { doc, actorId, previousSlug }
        })
        if (!result) continue
        published += 1
        const actor = result.actorId ? await this.users.findOneBy({ id: result.actorId }) : null
        await this.audit.record({
          action: 'documents.publish',
          user: actor,
          userEmail: actor ? undefined : 'scheduler',
          entityType: type.type,
          entityId: result.doc.id,
          summary: `${type.title(result.doc.draft)} — по расписанию`,
        })
        this.refreshSite(type, result.doc, result.previousSlug)
      } catch (error) {
        // A draft that no longer passes its rules can't go live: drop the schedule, say so.
        this.logger.error(`Scheduled publish of ${candidate.id} failed: ${String(error)}`)
        await this.documents.update(candidate.id, { scheduledAt: null, scheduledBy: null })
        await this.audit.record({
          action: 'documents.schedule_failed',
          userEmail: 'scheduler',
          entityType: candidate.type,
          entityId: candidate.id,
          summary: type.title(candidate.draft),
          meta: { error: error instanceof Error ? error.message : String(error) },
        })
      }
    }
    return published
  }

  // ── History ─────────────────────────────────────────────────────────────────

  async listVersions(id: string, actor: AuthUser): Promise<VersionSummary[]> {
    const doc = await this.documents.findOneBy({ id })
    if (!doc) throw notFound()
    const type = this.registry.get(doc.type)
    this.assert(actor, type, 'read')
    const rows = await this.versions.find({
      where: { documentId: id },
      order: { id: 'DESC' },
      take: MAX_VERSIONS,
    })
    const names = await this.userNames(rows.map((row) => row.createdBy))
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: type.title(row.data),
      createdAt: row.createdAt,
      createdBy: row.createdBy
        ? { id: row.createdBy, name: names.get(row.createdBy) ?? '—' }
        : null,
      isDraft: row.dataHash === doc.draftHash,
      isLive: row.dataHash === doc.publishedHash,
    }))
  }

  async getVersion(
    id: string,
    versionId: string,
    actor: AuthUser,
  ): Promise<{ data: DocumentData }> {
    const doc = await this.documents.findOneBy({ id })
    if (!doc) throw notFound()
    this.assert(actor, this.registry.get(doc.type), 'read')
    const version = await this.versions.findOneBy({ id: versionId, documentId: id })
    if (!version) throw versionNotFound()
    return { data: version.data }
  }

  /** Puts an old version back into the working copy; publishing it is a separate step. */
  async restoreVersion(
    id: string,
    versionId: string,
    input: { revision: number },
    actor: AuthUser,
    req: Request,
  ): Promise<DocumentView> {
    const { doc, type, restoredFrom } = await this.dataSource.transaction(async (manager) => {
      const doc = await this.lock(manager, id)
      const type = this.registry.get(doc.type)
      this.assert(actor, type, 'write')
      if (input.revision !== doc.revision) throw conflict()
      const version = await manager.findOneBy(DocumentVersion, { id: versionId, documentId: id })
      if (!version) throw versionNotFound()

      let data: DocumentData
      try {
        data = this.validate(type, version.data)
      } catch {
        throw new UnprocessableEntityException({
          code: 'version_incompatible',
          message: 'Эту версию нельзя восстановить: с тех пор изменились правила заполнения.',
        })
      }
      const hash = hashData(data)
      await this.checkReferences(manager, type, data)
      await this.checkUnique(manager, type, data, doc.id)
      doc.slug = await this.resolveSlug(manager, type, data, doc.id, 'save')
      doc.draft = data
      doc.draftHash = hash
      doc.revision += 1
      doc.updatedBy = actor.id
      await manager.save(doc)
      await this.addVersion(manager, doc.id, 'restored', data, hash, actor.id)
      await this.syncMedia(manager, doc)
      return { doc, type, restoredFrom: version.createdAt }
    })
    await this.record('documents.restore_version', type, doc, actor, req, {
      summary: `${type.title(doc.draft)} — версия от ${formatTashkent(restoredFrom)}`,
    })
    return this.view(type, doc)
  }

  // ── Trash ───────────────────────────────────────────────────────────────────

  async remove(id: string, actor: AuthUser, req: Request): Promise<void> {
    const doc = await this.documents.findOneBy({ id })
    if (!doc) throw notFound()
    const type = this.registry.get(doc.type)
    this.assert(actor, type, 'write')
    if (type.singleton) {
      throw new BadRequestException({
        code: 'cannot_delete',
        message: `${type.label}: удалить нельзя`,
      })
    }
    await this.assertNotReferenced(type, doc)
    await this.documents.update(id, {
      deletedAt: new Date(),
      deletedBy: actor.id,
      scheduledAt: null,
      scheduledBy: null,
    })
    await this.record('documents.delete', type, doc, actor, req)
    // Gone from the site at once: public reads skip documents in the trash.
    if (doc.published) this.refreshSite(type, doc, doc.publishedSlug)
  }

  async listTrashed(types: ContentTypeDef[]): Promise<ContentDocument[]> {
    if (types.length === 0) return []
    return this.documents.find({
      where: { type: In(types.map((type) => type.type)), deletedAt: Not(IsNull()) },
      withDeleted: true,
      order: { deletedAt: 'DESC' },
      take: 500,
    })
  }

  async restoreFromTrash(id: string, actor: AuthUser, req: Request): Promise<void> {
    const doc = await this.documents.findOne({
      where: { id, deletedAt: Not(IsNull()) },
      withDeleted: true,
    })
    if (!doc) throw notFound()
    const type = this.registry.get(doc.type)
    this.assert(actor, type, 'trash')
    this.assert(actor, type, 'write')
    if (doc.slug && (await this.documents.existsBy({ type: doc.type, slug: doc.slug }))) {
      throw new ConflictException({
        code: 'slug_taken',
        message: `Адрес «${doc.slug}» уже занят другим документом. Измените или удалите его, затем восстановите этот.`,
      })
    }
    await this.documents.update(id, { deletedAt: null, deletedBy: null })
    await this.record('documents.restore', type, doc, actor, req)
    if (doc.published) this.refreshSite(type, doc, doc.publishedSlug)
  }

  async purge(id: string, actor: AuthUser | null, req?: Request): Promise<void> {
    const doc = await this.documents.findOne({
      where: { id, deletedAt: Not(IsNull()) },
      withDeleted: true,
    })
    if (!doc) throw notFound()
    const type = this.registry.find(doc.type)
    if (actor && type) {
      this.assert(actor, type, 'trash')
      this.assert(actor, type, 'write')
    }
    // Versions and media usages go with it (ON DELETE CASCADE).
    await this.documents.delete(id)
    await this.audit.record({
      action: 'documents.purge',
      user: actor,
      userEmail: actor ? undefined : 'system',
      entityType: doc.type,
      entityId: id,
      summary: type ? type.title(doc.draft) : id,
      req,
    })
  }

  async purgeExpired(cutoff: Date): Promise<number> {
    const rows = await this.documents.find({
      select: { id: true },
      where: { deletedAt: LessThan(cutoff) },
      withDeleted: true,
    })
    for (const row of rows) await this.purge(row.id, null)
    return rows.length
  }

  // ── Preview ─────────────────────────────────────────────────────────────────

  async previewLink(id: string, locale: Locale, actor: AuthUser): Promise<{ url: string }> {
    const doc = await this.documents.findOneBy({ id })
    if (!doc) throw notFound()
    const type = this.registry.get(doc.type)
    this.assert(actor, type, 'read')
    const path = type.sitePath?.(doc.draft, doc.slug, locale) ?? null
    if (!path) {
      throw new BadRequestException({
        code: 'no_preview',
        message: 'У этого раздела нет своей страницы на сайте',
      })
    }
    return {
      url: previewUrl(
        this.config.get('SITE_ORIGIN', { infer: true }),
        path,
        this.config.get('PREVIEW_SECRET', { infer: true }),
      ),
    }
  }

  // ── Public (the site) ───────────────────────────────────────────────────────

  /** Live documents, newest first. `draft` (preview mode) returns working copies instead. */
  async publicList(
    typeName: string,
    query: { locale: Locale; limit: number; offset: number; draft: boolean },
  ): Promise<{ items: PublicDocument[]; total: number }> {
    const type = this.registry.get(typeName)
    const qb = this.documents.createQueryBuilder('d').where('d.type = :type', { type: type.type })
    if (!query.draft) qb.andWhere('d.published IS NOT NULL')
    this.applyOrder(qb, type, query.draft ? 'draft' : 'published')
    // A draft that was never published sorts where it will appear once it is: first.
    const [rows, total] = await qb
      .addOrderBy('d.first_published_at', 'DESC', 'NULLS FIRST')
      .addOrderBy('d.updated_at', 'DESC')
      .addOrderBy('d.id', 'DESC')
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount()
    return {
      items: await this.serialize(rows, query.locale, query.draft, type.summary),
      total,
    }
  }

  async publicGet(
    typeName: string,
    slug: string,
    query: { locale: Locale; draft: boolean },
  ): Promise<PublicDocument> {
    const type = this.registry.get(typeName)
    const doc = query.draft
      ? await this.documents.findOneBy({ type: type.type, slug })
      : await this.documents.findOne({
          where: { type: type.type, publishedSlug: slug, published: Not(IsNull()) },
        })
    if (!doc) throw notFound()
    const [item] = await this.serialize([doc], query.locale, query.draft)
    return item as PublicDocument
  }

  /** The one document of a singleton type (a page, settings), live or as a draft. */
  async publicSingleton(
    typeName: string,
    query: { locale: Locale; draft: boolean },
  ): Promise<PublicDocument> {
    const type = this.registry.get(typeName)
    const doc = await this.documents.findOneBy({ type: type.type })
    if (!doc || (!query.draft && !doc.published)) throw notFound()
    const [item] = await this.serialize([doc], query.locale, query.draft)
    return item as PublicDocument
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private async serialize(
    rows: ContentDocument[],
    locale: Locale,
    draft: boolean,
    only?: ContentTypeDef['summary'],
  ): Promise<PublicDocument[]> {
    const keep = only ? new Set([...(only.shared ?? []), ...(only.localized ?? [])]) : null
    const localized = rows.map((row) => {
      const data = (draft ? row.draft : row.published) as DocumentData
      const { fields, translated } = localize(data, locale)
      if (!keep) return { row, fields, translated }
      const picked = Object.fromEntries(Object.entries(fields).filter(([key]) => keep.has(key)))
      return { row, fields: picked, translated }
    })
    const mediaIds = new Set<string>()
    for (const item of localized) collectMediaIds(item.fields, mediaIds)
    const media = await this.media.publicInfo(mediaIds, locale)

    return localized.map(({ row, fields, translated }) => {
      const own: Record<string, PublicMedia> = {}
      for (const mediaId of collectMediaIds(fields)) {
        const info = media[mediaId]
        if (info) own[mediaId] = info
      }
      return {
        id: row.id,
        type: row.type,
        slug: draft ? row.slug : row.publishedSlug,
        locale,
        translated,
        firstPublishedAt: row.firstPublishedAt,
        publishedAt: row.publishedAt,
        updatedAt: row.updatedAt,
        data: fields,
        media: own,
      }
    })
  }

  private async applyPublish(
    manager: EntityManager,
    doc: ContentDocument,
    actorId: string | null,
  ): Promise<void> {
    const before =
      doc.published && doc.publishedSlug ? { data: doc.published, slug: doc.publishedSlug } : null
    const now = new Date()
    doc.published = doc.draft
    doc.publishedHash = doc.draftHash
    doc.publishedSlug = doc.slug
    doc.publishedAt = now
    doc.firstPublishedAt ??= now
    doc.scheduledAt = null
    doc.scheduledBy = null
    await manager.save(doc)
    await this.addVersion(manager, doc.id, 'published', doc.draft, doc.draftHash, actorId)
    await this.syncMedia(manager, doc)
    if (before && before.slug !== doc.publishedSlug) {
      await this.redirectRenamed(manager, doc, before, actorId)
    }
  }

  /**
   * A live page moved to a new address: the old one redirects to it, in every language, so
   * links and search results keep working. Same transaction as the publish.
   */
  private async redirectRenamed(
    manager: EntityManager,
    doc: ContentDocument,
    before: { data: DocumentData; slug: string },
    actorId: string | null,
  ): Promise<void> {
    const type = this.registry.find(doc.type)
    if (!type?.sitePath || !this.registry.find(REDIRECT_TYPE) || !doc.published) return
    for (const locale of LOCALES) {
      const from = type.sitePath(before.data, before.slug, locale)
      const to = type.sitePath(doc.published, doc.publishedSlug, locale)
      if (from && to && from !== to) await this.upsertRedirect(manager, from, to, actorId)
    }
  }

  private async upsertRedirect(
    manager: EntityManager,
    from: string,
    to: string,
    actorId: string | null,
  ): Promise<void> {
    const rows = await manager
      .createQueryBuilder(ContentDocument, 'd')
      .where('d.type = :type', { type: REDIRECT_TYPE })
      .andWhere(`(d.draft->'shared'->>'from' IN (:...paths) OR d.draft->'shared'->>'to' = :from)`, {
        paths: [from, to],
        from,
      })
      .setLock('pessimistic_write')
      .getMany()

    let covered = false
    for (const row of rows) {
      const shared = row.draft.shared as { from: string; to: string }
      if (shared.from === to) {
        // The new address had a redirect of its own: the page lives there now.
        row.deletedAt = new Date()
        row.deletedBy = actorId
        await manager.save(row)
        continue
      }
      // The old address, and anything that pointed at it, now leads straight to the new one.
      if (shared.from === from) covered = true
      const data = { ...row.draft, shared: { ...row.draft.shared, to } }
      row.draft = data
      row.draftHash = hashData(data)
      row.revision += 1
      row.updatedBy = actorId
      await manager.save(row)
      await this.addVersion(manager, row.id, 'saved', data, row.draftHash, actorId)
      await this.applyPublish(manager, row, actorId)
    }
    if (covered) return

    const data: DocumentData = {
      shared: { from, to, permanent: true, enabled: true, auto: true },
      locales: { uz: {} },
    }
    const row = await manager.save(
      manager.create(ContentDocument, {
        type: REDIRECT_TYPE,
        slug: null,
        draft: data,
        draftHash: hashData(data),
        revision: 1,
        createdBy: actorId,
        updatedBy: actorId,
      }),
    )
    await this.addVersion(manager, row.id, 'created', data, row.draftHash, actorId)
    await this.applyPublish(manager, row, actorId)
  }

  /** Every live document's shared fields: small lists the site loads whole (redirects). */
  async publicShared(typeName: string): Promise<Record<string, unknown>[]> {
    const type = this.registry.get(typeName)
    const rows = await this.documents.find({
      select: { id: true, published: true },
      where: { type: type.type, published: Not(IsNull()) },
      order: { createdAt: 'ASC' },
    })
    return rows.map((row) => (row.published as DocumentData).shared)
  }

  private async addVersion(
    manager: EntityManager,
    documentId: string,
    kind: VersionKind,
    data: DocumentData,
    hash: string,
    userId: string | null,
  ): Promise<void> {
    await manager.save(
      manager.create(DocumentVersion, {
        documentId,
        kind,
        data,
        dataHash: hash,
        createdBy: userId,
      }),
    )
    await manager.query(
      `DELETE FROM document_versions
        WHERE document_id = $1
          AND id NOT IN (SELECT id FROM document_versions WHERE document_id = $1 ORDER BY id DESC LIMIT $2)`,
      [documentId, MAX_VERSIONS],
    )
  }

  /** A photo counts as used while it is in the draft or in what the site shows. */
  private async syncMedia(manager: EntityManager, doc: ContentDocument): Promise<void> {
    const ids = collectMediaIds(doc.draft)
    if (doc.published) collectMediaIds(doc.published, ids)
    await this.media.syncUsages(manager, doc.id, ids)
  }

  private async lock(manager: EntityManager, id: string): Promise<ContentDocument> {
    const doc = await manager.findOne(ContentDocument, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    })
    if (!doc) throw notFound()
    return doc
  }

  private validate(type: RegisteredType, input: unknown): DocumentData {
    const result = type.dataSchema.safeParse(input)
    if (!result.success) {
      throw new BadRequestException({
        code: 'invalid_document',
        message: 'Проверьте заполнение полей',
        issues: result.error.issues.slice(0, 50).map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      })
    }
    if (Buffer.byteLength(JSON.stringify(result.data)) > MAX_DOCUMENT_BYTES) {
      throw new BadRequestException({
        code: 'document_too_large',
        message: 'Документ слишком большой',
      })
    }
    return result.data
  }

  private checkPublishable(type: RegisteredType, data: DocumentData): void {
    const issues = type.publishCheck?.(data) ?? []
    if (issues.length > 0) {
      throw new BadRequestException({
        code: 'not_publishable',
        message: `Чтобы опубликовать: ${issues.map((issue) => issue.message.toLowerCase()).join(', ')}`,
        issues,
      })
    }
  }

  /** E.g. one redirect per source address. */
  private async checkUnique(
    manager: EntityManager,
    type: RegisteredType,
    data: DocumentData,
    currentId: string | null,
  ): Promise<void> {
    const rule = type.unique
    const value = rule ? data.shared[rule.field] : undefined
    if (!rule || typeof value !== 'string' || value === '') return
    const qb = manager
      .createQueryBuilder(ContentDocument, 'd')
      .where('d.type = :type', { type: type.type })
      .andWhere(`d.draft->'shared'->>'${rule.field}' = :value`, { value })
    if (currentId) qb.andWhere('d.id <> :id', { id: currentId })
    if (await qb.getExists()) {
      throw new ConflictException({
        code: 'duplicate',
        message: rule.message,
        issues: [{ path: `shared.${rule.field}`, message: rule.message }],
      })
    }
  }

  /** A category, direction… chosen in the document must exist and not be in the trash. */
  private async checkReferences(
    manager: EntityManager,
    type: RegisteredType,
    data: DocumentData,
  ): Promise<void> {
    for (const reference of type.references ?? []) {
      const id = data.shared[reference.field]
      if (typeof id !== 'string' || id === '') continue
      if (!(await manager.existsBy(ContentDocument, { id, type: reference.type }))) {
        throw new BadRequestException({
          code: 'invalid_reference',
          message: `${reference.label}: выбранное значение удалено. Выберите другое.`,
          issues: [
            { path: `shared.${reference.field}`, message: `${reference.label}: не найдено` },
          ],
        })
      }
    }
  }

  /** A category still chosen in some news (or a direction in vacancies) can't go to the trash. */
  private async assertNotReferenced(type: RegisteredType, doc: ContentDocument): Promise<void> {
    for (const { type: user, reference } of this.registry.referencing(type.type)) {
      const field = reference.field
      const count = await this.documents
        .createQueryBuilder('d')
        .where('d.type = :type', { type: user.type })
        .andWhere(
          `(d.draft->'shared'->>'${field}' = :id OR d.published->'shared'->>'${field}' = :id)`,
          { id: doc.id },
        )
        .getCount()
      if (count > 0) {
        throw new ConflictException({
          code: 'document_in_use',
          message: `Нельзя удалить «${type.title(doc.draft)}»: используется (${user.label}: ${count}). Сначала выберите там другое значение.`,
        })
      }
    }
  }

  /** The type's own order (pinned first, set order…) as the leading sort keys. */
  private applyOrder(
    qb: SelectQueryBuilder<ContentDocument>,
    type: RegisteredType,
    column: 'draft' | 'published',
  ): void {
    for (const [index, order] of (type.order ?? []).entries()) {
      // Field names are checked when the type is registered (plain identifiers only).
      const value = `d.${column}->'shared'->>'${order.field}'`
      const expression =
        order.cast === 'boolean'
          ? `COALESCE((${value})::boolean, false)`
          : order.cast === 'number'
            ? `(${value})::numeric`
            : value
      const alias = `sort_${index}`
      qb.addSelect(expression, alias).addOrderBy(
        alias,
        order.direction === 'asc' ? 'ASC' : 'DESC',
        'NULLS LAST',
      )
    }
  }

  /**
   * New documents get a free variant of the slug (`-2`, `-3`…); renaming an existing one to a
   * taken slug is refused, so a live address never changes behind the editor's back.
   */
  private async resolveSlug(
    manager: EntityManager,
    type: RegisteredType,
    data: DocumentData,
    currentId: string | null,
    mode: 'create' | 'save',
  ): Promise<string | null> {
    const wanted = type.slug?.(data)
    if (!wanted) return null
    const base = slugify(wanted)
    if (!base) {
      throw new BadRequestException({
        code: 'invalid_slug',
        message: 'Адрес страницы должен содержать латинские буквы или цифры',
      })
    }
    const taken = (slug: string) =>
      manager.existsBy(ContentDocument, {
        type: type.type,
        slug,
        ...(currentId ? { id: Not(currentId) } : {}),
      })
    if (!(await taken(base))) return base
    if (mode === 'save') {
      throw new ConflictException({ code: 'slug_taken', message: `Адрес «${base}» уже занят` })
    }
    for (let n = 2; n < 100; n++) {
      const candidate = `${base}-${n}`
      if (!(await taken(candidate))) return candidate
    }
    throw new ConflictException({ code: 'slug_taken', message: `Адрес «${base}» уже занят` })
  }

  /** Lists and the page itself, under the old address too when the slug changed. */
  private refreshSite(
    type: RegisteredType,
    doc: ContentDocument,
    previousSlug: string | null,
  ): void {
    const tags = [`content:${type.type}`, `content:doc:${doc.id}`]
    for (const slug of [doc.publishedSlug, doc.slug, previousSlug]) {
      if (slug) tags.push(`content:${type.type}:${slug}`)
    }
    this.revalidation.revalidate(tags)
  }

  private assert(
    actor: AuthUser,
    type: ContentTypeDef,
    action: keyof ContentTypeDef['permissions'],
  ): void {
    if (!actor.permissions.includes(type.permissions[action])) {
      throw new ForbiddenException({ code: 'forbidden', message: 'Недостаточно прав' })
    }
  }

  private async record(
    action: string,
    type: RegisteredType,
    doc: ContentDocument,
    actor: AuthUser,
    req?: Request,
    extra: { summary?: string } = {},
  ): Promise<void> {
    await this.audit.record({
      action,
      user: actor,
      entityType: type.type,
      entityId: doc.id,
      summary: extra.summary ?? `${type.label}: ${type.title(doc.draft)}`,
      req,
    })
  }

  private async userNames(ids: (string | null)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
    if (unique.length === 0) return new Map()
    const rows = await this.users.find({
      select: { id: true, name: true },
      where: { id: In(unique) },
    })
    return new Map(rows.map((row) => [row.id, row.name]))
  }

  private summary(
    type: RegisteredType,
    doc: ContentDocument,
    names: Map<string, string>,
  ): DocumentSummary {
    return {
      id: doc.id,
      type: doc.type,
      typeLabel: type.label,
      slug: doc.slug,
      title: type.title(doc.draft),
      status: statusOf(doc),
      locales: filledLocales(doc.draft),
      firstPublishedAt: doc.firstPublishedAt,
      publishedAt: doc.publishedAt,
      scheduledAt: doc.scheduledAt,
      updatedAt: doc.updatedAt,
      updatedBy: doc.updatedBy
        ? { id: doc.updatedBy, name: names.get(doc.updatedBy) ?? '—' }
        : null,
      shared: Object.fromEntries(
        (type.summary?.shared ?? [])
          .filter((key) => key in doc.draft.shared)
          .map((key) => [key, doc.draft.shared[key]]),
      ),
    }
  }

  private async view(type: RegisteredType, doc: ContentDocument): Promise<DocumentView> {
    const names = await this.userNames([doc.updatedBy])
    const sitePath = type.sitePath
    return {
      ...this.summary(type, doc, names),
      data: doc.draft,
      revision: doc.revision,
      isLive: doc.published !== null,
      publishedSlug: doc.publishedSlug,
      previewLocales: sitePath
        ? LOCALES.filter((locale) => sitePath(doc.draft, doc.slug, locale) !== null)
        : [],
      liveUrl: this.liveUrl(type, doc),
    }
  }

  private liveUrl(type: RegisteredType, doc: ContentDocument): string | null {
    if (!doc.published || !type.sitePath) return null
    const path = type.sitePath(doc.published, doc.publishedSlug, 'uz')
    return path ? new URL(path, this.config.get('SITE_ORIGIN', { infer: true })).toString() : null
  }
}

function formatTashkent(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Tashkent',
  }).format(date)
}

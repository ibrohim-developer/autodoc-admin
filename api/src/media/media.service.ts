import { createHash, randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import type { Request } from 'express'
import { type EntityManager, In, IsNull, LessThan, Not, Repository } from 'typeorm'
import { AuditService } from '../audit/audit.service.js'
import type { AuthUser } from '../common/request.js'
import type { Env } from '../config/env.js'
import { ContentTypeRegistry } from '../content/content-types.js'
import { ContentDocument } from '../content/document.entity.js'
import { DEFAULT_LOCALE, LOCALES, type Locale } from '../content/locales.js'
import { processImage } from './image-processing.js'
import { Media, type MediaVariant } from './media.entity.js'
import { MediaUsage } from './media-usage.entity.js'

/** What multer hands over for one uploaded file. */
export type UploadedFile = { buffer: Buffer; originalname: string; size: number }

export type MediaView = {
  id: string
  originalName: string
  mime: string
  size: number
  width: number
  height: number
  alt: Partial<Record<Locale, string>>
  /** A copy good for previews (up to 1280 px wide). */
  url: string
  /** The smallest copy, for grids. */
  thumbUrl: string
  variants: { width: number; height: number; url: string }[]
  createdAt: Date
  usageCount: number
}

export type MediaUsageView = { documentId: string; type: string; typeLabel: string; title: string }

/** What the site gets for one photo used in a document. */
export type PublicMedia = {
  id: string
  src: string
  srcSet: string
  width: number
  height: number
  alt: string
}

const PREVIEW_WIDTH = 1280

export function mediaUrl(file: string): string {
  return `/media/${file}`
}

function pick(variants: MediaVariant[], maxWidth: number): MediaVariant {
  const sorted = [...variants].sort((a, b) => a.width - b.width)
  return sorted.filter((v) => v.width <= maxWidth).at(-1) ?? (sorted[0] as MediaVariant)
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name)
  private readonly publicDir: string
  private readonly privateDir: string

  constructor(
    @InjectRepository(Media) private readonly media: Repository<Media>,
    @InjectRepository(MediaUsage) private readonly usages: Repository<MediaUsage>,
    private readonly registry: ContentTypeRegistry,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    const storage = resolve(config.get('STORAGE_DIR', { infer: true }))
    this.publicDir = join(storage, 'public', 'media')
    this.privateDir = join(storage, 'private')
  }

  async upload(
    file: UploadedFile,
    actor: AuthUser,
    req: Request,
  ): Promise<MediaView & { duplicate: boolean }> {
    const sha256 = createHash('sha256').update(file.buffer).digest('hex')
    const existing = await this.media.findOneBy({ sha256 })
    if (existing) return { ...(await this.view(existing)), duplicate: true }

    const image = await processImage(file.buffer)
    const id = randomUUID()
    const now = new Date()
    const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`

    const variants: MediaVariant[] = image.variants.map((variant) => ({
      width: variant.width,
      height: variant.height,
      size: variant.buffer.length,
      file: `${folder}/${id}-${variant.width}.webp`,
    }))
    const originalFile = `originals/${folder}/${id}.${image.extension}`
    const written: string[] = []

    try {
      for (const [index, variant] of variants.entries()) {
        const path = join(this.publicDir, variant.file)
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, image.variants[index]?.buffer ?? Buffer.alloc(0))
        written.push(path)
      }
      const originalPath = join(this.privateDir, originalFile)
      await mkdir(dirname(originalPath), { recursive: true })
      await writeFile(originalPath, file.buffer)
      written.push(originalPath)

      const saved = await this.media.save(
        this.media.create({
          id,
          originalName: file.originalname.slice(0, 255),
          mime: image.mime,
          size: file.size,
          width: image.width,
          height: image.height,
          variants,
          originalFile,
          alt: {},
          sha256,
          createdBy: actor.id,
        }),
      )
      await this.audit.record({
        action: 'media.upload',
        user: actor,
        entityType: 'media',
        entityId: id,
        summary: saved.originalName,
        req,
      })
      return { ...(await this.view(saved)), duplicate: false }
    } catch (error) {
      // No half-saved photos: files without a row would never be cleaned up.
      await Promise.all(written.map((path) => rm(path, { force: true })))
      throw error
    }
  }

  async list(query: { q?: string; ids?: string[]; page: number; pageSize: number }): Promise<{
    items: MediaView[]
    total: number
  }> {
    const qb = this.media.createQueryBuilder('m').where('m.deleted_at IS NULL')
    if (query.ids) {
      if (query.ids.length === 0) return { items: [], total: 0 }
      qb.andWhere('m.id IN (:...ids)', { ids: query.ids })
    }
    if (query.q) {
      // File name or any language's alt text.
      qb.andWhere('(m.original_name ILIKE :q OR m.alt::text ILIKE :q)', { q: `%${query.q}%` })
    }
    const [rows, total] = await qb
      .orderBy('m.created_at', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount()
    return { items: await this.views(rows), total }
  }

  async get(id: string): Promise<MediaView & { usages: MediaUsageView[] }> {
    const row = await this.media.findOneBy({ id })
    if (!row) throw this.notFound()
    return { ...(await this.view(row)), usages: await this.usagesOf(id) }
  }

  async updateAlt(
    id: string,
    alt: Partial<Record<Locale, string>>,
    actor: AuthUser,
    req: Request,
  ): Promise<MediaView> {
    const row = await this.media.findOneBy({ id })
    if (!row) throw this.notFound()
    const clean: Partial<Record<Locale, string>> = {}
    for (const locale of LOCALES) {
      const value = alt[locale]?.trim()
      if (value) clean[locale] = value.slice(0, 300)
    }
    row.alt = clean
    await this.media.save(row)
    await this.audit.record({
      action: 'media.update',
      user: actor,
      entityType: 'media',
      entityId: id,
      summary: row.originalName,
      req,
    })
    return this.view(row)
  }

  /** To the trash. A photo still used somewhere (even by a document in the trash) stays. */
  async remove(id: string, actor: AuthUser, req: Request): Promise<void> {
    const row = await this.media.findOneBy({ id })
    if (!row) throw this.notFound()
    const usages = await this.usagesOf(id)
    if (usages.length > 0) {
      const names = usages
        .slice(0, 3)
        .map((usage) => `«${usage.title}»`)
        .join(', ')
      throw new ConflictException({
        code: 'media_in_use',
        message: `Фото используется: ${names}${usages.length > 3 ? ` и ещё ${usages.length - 3}` : ''}. Сначала уберите его оттуда.`,
      })
    }
    await this.media.update(id, { deletedAt: new Date(), deletedBy: actor.id })
    await this.audit.record({
      action: 'media.delete',
      user: actor,
      entityType: 'media',
      entityId: id,
      summary: row.originalName,
      req,
    })
  }

  async listTrashed(): Promise<Media[]> {
    return this.media.find({
      where: { deletedAt: Not(IsNull()) },
      withDeleted: true,
      order: { deletedAt: 'DESC' },
      take: 500,
    })
  }

  async restoreFromTrash(id: string, actor: AuthUser, req: Request): Promise<void> {
    const row = await this.media.findOne({
      where: { id, deletedAt: Not(IsNull()) },
      withDeleted: true,
    })
    if (!row) throw this.notFound()
    await this.media.update(id, { deletedAt: null, deletedBy: null })
    await this.audit.record({
      action: 'media.restore',
      user: actor,
      entityType: 'media',
      entityId: id,
      summary: row.originalName,
      req,
    })
  }

  /** Gone for good: the row and every file. */
  async purge(id: string, actor: AuthUser | null, req?: Request): Promise<void> {
    const row = await this.media.findOne({
      where: { id, deletedAt: Not(IsNull()) },
      withDeleted: true,
    })
    if (!row) throw this.notFound()
    await this.deleteFiles(row)
    await this.media.delete(id)
    await this.audit.record({
      action: 'media.purge',
      user: actor,
      userEmail: actor ? undefined : 'system',
      entityType: 'media',
      entityId: id,
      summary: row.originalName,
      req,
    })
  }

  async purgeExpired(cutoff: Date): Promise<number> {
    const rows = await this.media.find({
      where: { deletedAt: LessThan(cutoff) },
      withDeleted: true,
    })
    for (const row of rows) await this.purge(row.id, null)
    return rows.length
  }

  /** Called inside the document's save transaction: which photos it now uses. */
  async syncUsages(
    manager: EntityManager,
    documentId: string,
    mediaIds: Iterable<string>,
  ): Promise<void> {
    await manager.delete(MediaUsage, { documentId })
    const ids = [...new Set(mediaIds)]
    if (ids.length === 0) return
    // Only ids of photos that exist (also in the trash): a stale id must not break the save.
    const existing = await manager.find(Media, {
      select: { id: true },
      where: { id: In(ids) },
      withDeleted: true,
    })
    if (existing.length === 0) return
    await manager.insert(
      MediaUsage,
      existing.map((row) => ({ mediaId: row.id, documentId })),
    )
  }

  /** Photos for the site, with alt text in the requested language (Uzbek as fallback). */
  async publicInfo(ids: Iterable<string>, locale: Locale): Promise<Record<string, PublicMedia>> {
    const list = [...new Set(ids)]
    if (list.length === 0) return {}
    const rows = await this.media.find({ where: { id: In(list) } })
    const result: Record<string, PublicMedia> = {}
    for (const row of rows) {
      const sorted = [...row.variants].sort((a, b) => a.width - b.width)
      const main = pick(row.variants, PREVIEW_WIDTH)
      result[row.id] = {
        id: row.id,
        src: mediaUrl(main.file),
        srcSet: sorted.map((v) => `${mediaUrl(v.file)} ${v.width}w`).join(', '),
        width: row.width,
        height: row.height,
        alt: row.alt[locale] ?? row.alt[DEFAULT_LOCALE] ?? '',
      }
    }
    return result
  }

  private async usagesOf(mediaId: string): Promise<MediaUsageView[]> {
    const rows: { document_id: string; type: string; draft: ContentDocument['draft'] }[] =
      await this.usages.query(
        `SELECT d.id AS document_id, d.type, d.draft
           FROM media_usages u JOIN documents d ON d.id = u.document_id
          WHERE u.media_id = $1
          ORDER BY d.updated_at DESC`,
        [mediaId],
      )
    return rows.map((row) => {
      const type = this.registry.find(row.type)
      return {
        documentId: row.document_id,
        type: row.type,
        typeLabel: type?.label ?? row.type,
        title: type ? type.title(row.draft) : row.document_id,
      }
    })
  }

  private async views(rows: Media[]): Promise<MediaView[]> {
    if (rows.length === 0) return []
    const counts: { media_id: string; count: string }[] = await this.usages.query(
      `SELECT media_id, count(*) AS count FROM media_usages WHERE media_id = ANY($1) GROUP BY media_id`,
      [rows.map((row) => row.id)],
    )
    const byId = new Map(counts.map((c) => [c.media_id, Number(c.count)]))
    return rows.map((row) => this.toView(row, byId.get(row.id) ?? 0))
  }

  private async view(row: Media): Promise<MediaView> {
    const [view] = await this.views([row])
    return view as MediaView
  }

  private toView(row: Media, usageCount: number): MediaView {
    const sorted = [...row.variants].sort((a, b) => a.width - b.width)
    return {
      id: row.id,
      originalName: row.originalName,
      mime: row.mime,
      size: row.size,
      width: row.width,
      height: row.height,
      alt: row.alt,
      url: mediaUrl(pick(row.variants, PREVIEW_WIDTH).file),
      thumbUrl: mediaUrl((sorted[0] as MediaVariant).file),
      variants: sorted.map((v) => ({ width: v.width, height: v.height, url: mediaUrl(v.file) })),
      createdAt: row.createdAt,
      usageCount,
    }
  }

  private async deleteFiles(row: Media): Promise<void> {
    const paths = [
      ...row.variants.map((variant) => join(this.publicDir, variant.file)),
      join(this.privateDir, row.originalFile),
    ]
    for (const path of paths) {
      try {
        await rm(path, { force: true })
      } catch (error) {
        this.logger.warn(`Could not delete ${path}: ${String(error)}`)
      }
    }
  }

  private notFound() {
    return new NotFoundException({ code: 'media_not_found', message: 'Фото не найдено' })
  }
}

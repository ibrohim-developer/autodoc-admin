import { ForbiddenException, Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import type { Request } from 'express'
import { In, Repository } from 'typeorm'
import type { AuthUser } from '../common/request.js'
import { ContentTypeRegistry } from '../content/content-types.js'
import { DocumentsService, TRASH_DAYS } from '../content/documents.service.js'
import { ApplicationsService } from '../forms/applications.service.js'
import { LeadsService } from '../forms/leads.service.js'
import { MediaService, mediaUrl } from '../media/media.service.js'
import { User } from '../users/user.entity.js'

export type TrashKind = 'document' | 'media' | 'lead' | 'application'

export type TrashItem = {
  kind: TrashKind
  id: string
  /** Content type, or `media`, `lead`, `application`. */
  type: string
  typeLabel: string
  title: string
  thumbUrl: string | null
  deletedAt: Date
  deletedBy: { id: string; name: string } | null
  /** When the nightly cleanup removes it for good. */
  purgeAt: Date
}

const DAY_MS = 24 * 60 * 60 * 1000

function purgeDate(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + TRASH_DAYS * DAY_MS)
}

/** Photos in the trash: whoever manages content may restore or remove them. */
function canHandleMedia(actor: AuthUser): boolean {
  return actor.permissions.includes('trash.content') && actor.permissions.includes('media.write')
}

/** Form submissions belong with marketing's trash. */
function canHandleLeads(actor: AuthUser): boolean {
  return actor.permissions.includes('trash.content') && actor.permissions.includes('leads.write')
}

/** Job applications belong with the vacancies: HR's trash. */
function canHandleApplications(actor: AuthUser): boolean {
  return (
    actor.permissions.includes('trash.vacancies') &&
    actor.permissions.includes('applications.write')
  )
}

const forbidden = () => new ForbiddenException({ code: 'forbidden', message: 'Недостаточно прав' })

@Injectable()
export class TrashService {
  private readonly logger = new Logger(TrashService.name)

  constructor(
    private readonly documents: DocumentsService,
    private readonly media: MediaService,
    private readonly leads: LeadsService,
    private readonly applications: ApplicationsService,
    private readonly registry: ContentTypeRegistry,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Everything this user may restore, newest deletion first. */
  async list(actor: AuthUser): Promise<TrashItem[]> {
    const types = this.registry.withPermission(actor, 'trash')
    const [documents, photos, leads, applications] = await Promise.all([
      this.documents.listTrashed(types),
      canHandleMedia(actor) ? this.media.listTrashed() : Promise.resolve([]),
      canHandleLeads(actor) ? this.leads.listTrashed() : Promise.resolve([]),
      canHandleApplications(actor) ? this.applications.listTrashed() : Promise.resolve([]),
    ])

    const deleters = [documents, photos, leads, applications].flatMap((rows) =>
      rows.map((row) => row.deletedBy),
    )
    const ids = [...new Set(deleters.filter((id): id is string => Boolean(id)))]
    const users = ids.length
      ? await this.users.find({ select: { id: true, name: true }, where: { id: In(ids) } })
      : []
    const names = new Map(users.map((user) => [user.id, user.name]))
    const by = (id: string | null) => (id ? { id, name: names.get(id) ?? '—' } : null)

    const items: TrashItem[] = [
      ...documents.map((doc) => {
        const type = this.registry.get(doc.type)
        const deletedAt = doc.deletedAt as Date
        return {
          kind: 'document' as const,
          id: doc.id,
          type: doc.type,
          typeLabel: type.label,
          title: type.title(doc.draft),
          thumbUrl: null,
          deletedAt,
          deletedBy: by(doc.deletedBy),
          purgeAt: purgeDate(deletedAt),
        }
      }),
      ...photos.map((photo) => {
        const deletedAt = photo.deletedAt as Date
        const smallest = [...photo.variants].sort((a, b) => a.width - b.width)[0]
        return {
          kind: 'media' as const,
          id: photo.id,
          type: 'media',
          typeLabel: 'Фото',
          title: photo.originalName,
          thumbUrl: smallest ? mediaUrl(smallest.file) : null,
          deletedAt,
          deletedBy: by(photo.deletedBy),
          purgeAt: purgeDate(deletedAt),
        }
      }),
      ...leads.map((lead) => {
        const deletedAt = lead.deletedAt as Date
        return {
          kind: 'lead' as const,
          id: lead.id,
          type: 'lead',
          typeLabel: 'Заявка',
          title: `Заявка №${lead.number} · ${lead.name}`,
          thumbUrl: null,
          deletedAt,
          deletedBy: by(lead.deletedBy),
          purgeAt: purgeDate(deletedAt),
        }
      }),
      ...applications.map((application) => {
        const deletedAt = application.deletedAt as Date
        return {
          kind: 'application' as const,
          id: application.id,
          type: 'application',
          typeLabel: 'Отклик',
          title: `Отклик №${application.number} · ${application.name}`,
          thumbUrl: null,
          deletedAt,
          deletedBy: by(application.deletedBy),
          purgeAt: purgeDate(deletedAt),
        }
      }),
    ]
    return items.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime())
  }

  async restore(kind: TrashKind, id: string, actor: AuthUser, req: Request): Promise<void> {
    switch (kind) {
      case 'media':
        if (!canHandleMedia(actor)) throw forbidden()
        return this.media.restoreFromTrash(id, actor, req)
      case 'lead':
        if (!canHandleLeads(actor)) throw forbidden()
        return this.leads.restoreFromTrash(id, actor, req)
      case 'application':
        if (!canHandleApplications(actor)) throw forbidden()
        return this.applications.restoreFromTrash(id, actor, req)
      default:
        return this.documents.restoreFromTrash(id, actor, req)
    }
  }

  async purge(kind: TrashKind, id: string, actor: AuthUser, req: Request): Promise<void> {
    switch (kind) {
      case 'media':
        if (!canHandleMedia(actor)) throw forbidden()
        return this.media.purge(id, actor, req)
      case 'lead':
        if (!canHandleLeads(actor)) throw forbidden()
        return this.leads.purge(id, actor, req)
      case 'application':
        if (!canHandleApplications(actor)) throw forbidden()
        return this.applications.purge(id, actor, req)
      default:
        return this.documents.purge(id, actor, req)
    }
  }

  /** Every night at 03:30 Tashkent time: items deleted more than 30 days ago go for good. */
  @Cron('30 3 * * *', { name: 'purge-trash', timeZone: 'Asia/Tashkent' })
  async purgeExpired(
    now = new Date(),
  ): Promise<{ documents: number; media: number; leads: number; applications: number }> {
    const cutoff = new Date(now.getTime() - TRASH_DAYS * DAY_MS)
    try {
      // Documents first: their media usages go with them, which frees the photos.
      const documents = await this.documents.purgeExpired(cutoff)
      const media = await this.media.purgeExpired(cutoff)
      const leads = await this.leads.purgeExpired(cutoff)
      const applications = await this.applications.purgeExpired(cutoff)
      if (documents + media + leads + applications > 0) {
        this.logger.log(
          `Trash cleanup: ${documents} document(s), ${media} photo(s), ${leads} submission(s), ${applications} application(s) removed`,
        )
      }
      return { documents, media, leads, applications }
    } catch (error) {
      this.logger.error(`Trash cleanup failed: ${String(error)}`)
      return { documents: 0, media: 0, leads: 0, applications: 0 }
    }
  }
}

import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Request } from 'express'
import { Repository } from 'typeorm'
import { clientMeta } from '../common/request.js'
import { AuditLog } from './audit-log.entity.js'

export type AuditEntry = {
  action: string
  user?: { id: string; email: string } | null
  /** When there is no user yet, e.g. a failed login. */
  userEmail?: string
  entityType?: string
  entityId?: string
  summary?: string
  meta?: Record<string, unknown>
  req?: Request
}

export type AuditQuery = {
  page: number
  pageSize: number
  action?: string
  /** The part before the dot: `leads`, `documents`, `auth`… */
  section?: string
  q?: string
  userId?: string
  entityType?: string
  entityId?: string
  from?: Date
  to?: Date
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name)

  constructor(@InjectRepository(AuditLog) private readonly entries: Repository<AuditLog>) {}

  async record(entry: AuditEntry): Promise<void> {
    const client = entry.req ? clientMeta(entry.req) : null
    try {
      await this.entries.save(
        this.entries.create({
          action: entry.action,
          userId: entry.user?.id ?? null,
          userEmail: entry.user?.email ?? entry.userEmail ?? null,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          summary: entry.summary ?? null,
          ip: client?.ip ?? null,
          userAgent: client?.userAgent ?? null,
          meta: entry.meta ?? null,
        }),
      )
    } catch (error) {
      // A failed audit write must not undo the action it describes; it surfaces in the logs.
      this.logger.error(
        `Audit write failed for ${entry.action}`,
        error instanceof Error ? error.stack : String(error),
      )
    }
  }

  async list(query: AuditQuery): Promise<{ items: AuditLog[]; total: number }> {
    const qb = this.entries.createQueryBuilder('a')
    if (query.action) qb.andWhere('a.action = :action', { action: query.action })
    // "leads" matches leads.update, leads.export…
    if (query.section) {
      qb.andWhere('a.action LIKE :section', {
        section: `${query.section.replace(/[\\%_]/g, '')}.%`,
      })
    }
    if (query.userId) qb.andWhere('a.user_id = :userId', { userId: query.userId })
    if (query.entityType)
      qb.andWhere('a.entity_type = :entityType', { entityType: query.entityType })
    if (query.entityId) qb.andWhere('a.entity_id = :entityId', { entityId: query.entityId })
    if (query.from) qb.andWhere('a.created_at >= :from', { from: query.from })
    if (query.to) qb.andWhere('a.created_at < :to', { to: query.to })
    if (query.q) {
      qb.andWhere('(a.summary ILIKE :q OR a.user_email ILIKE :q OR a.entity_id = :exact)', {
        q: `%${query.q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`,
        exact: query.q,
      })
    }
    const [items, total] = await qb
      .orderBy('a.created_at', 'DESC')
      .addOrderBy('a.id', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount()
    return { items, total }
  }

  /** Entries older than `cutoff` go (retention: 12 months). */
  async purgeBefore(cutoff: Date): Promise<number> {
    const result = await this.entries
      .createQueryBuilder()
      .delete()
      .where('created_at < :cutoff', { cutoff })
      .execute()
    return result.affected ?? 0
  }
}

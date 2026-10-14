import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Request } from 'express'
import {
  Between,
  type FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm'
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
    const where: FindOptionsWhere<AuditLog> = {}
    if (query.action) where.action = query.action
    if (query.userId) where.userId = query.userId
    if (query.entityType) where.entityType = query.entityType
    if (query.entityId) where.entityId = query.entityId
    if (query.from && query.to) where.createdAt = Between(query.from, query.to)
    else if (query.from) where.createdAt = MoreThanOrEqual(query.from)
    else if (query.to) where.createdAt = LessThanOrEqual(query.to)

    const [items, total] = await this.entries.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    })
    return { items, total }
  }
}

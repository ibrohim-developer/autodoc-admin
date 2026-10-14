import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import type { Request } from 'express'
import { IsNull, LessThan, Not, Repository } from 'typeorm'
import { AuditService } from '../audit/audit.service.js'
import type { AuthUser } from '../common/request.js'
import { buildXlsx } from '../common/xlsx.js'
import type { Env } from '../config/env.js'
import type { Locale } from '../content/locales.js'
import { TelegramService } from '../integrations/telegram.service.js'
import { User } from '../users/user.entity.js'
import { Lead } from './lead.entity.js'
import type { LeadInput } from './public-input.js'
import {
  dayRange,
  formatDateTime,
  likePattern,
  type UserRef,
  userNames,
  userRef,
} from './shared.js'
import {
  LEAD_FORM_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  type LeadForm,
  type LeadStatus,
} from './workflow.js'

export type LeadQuery = {
  status?: LeadStatus
  q?: string
  from?: string
  to?: string
  page: number
  pageSize: number
}

export type LeadView = {
  id: string
  number: number
  form: string
  formLabel: string
  name: string
  phone: string
  topic: string | null
  message: string | null
  locale: Locale
  page: string | null
  status: LeadStatus
  comment: string | null
  consentAt: Date
  createdAt: Date
  updatedAt: Date
  updatedBy: UserRef
}

export type LeadChanges = { status?: LeadStatus; comment?: string | null }

const MAX_EXPORT_ROWS = 10_000

const notFound = () =>
  new NotFoundException({ code: 'lead_not_found', message: 'Заявка не найдена' })

/** "Заявки": submissions of the site's forms, with a status and a comment. */
@Injectable()
export class LeadsService {
  private readonly adminOrigin: string

  constructor(
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly audit: AuditService,
    private readonly telegram: TelegramService,
    config: ConfigService<Env, true>,
  ) {
    this.adminOrigin = config.get('ADMIN_ORIGIN', { infer: true }).replace(/\/$/, '')
  }

  /** From the site. The alert says which form and language, never who wrote or what. */
  async submit(input: LeadInput): Promise<Lead> {
    const lead = await this.leads.save(
      this.leads.create({
        form: input.form,
        name: input.name,
        phone: input.phone,
        topic: input.topic,
        message: input.message,
        locale: input.locale,
        page: input.page,
        status: 'new',
        consentAt: new Date(),
      }),
    )
    this.telegram.notify(
      'leads',
      `Новая заявка №${lead.number} с сайта: форма «${LEAD_FORM_LABELS[input.form]}», язык ${input.locale.toUpperCase()}.\n${this.adminOrigin}/leads/${lead.id}`,
    )
    return lead
  }

  async list(query: LeadQuery): Promise<{
    items: LeadView[]
    total: number
    counts: Record<LeadStatus, number>
  }> {
    const qb = this.filtered(query)
    const [rows, total] = await qb
      .orderBy('l.created_at', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount()
    return { items: await this.views(rows), total, counts: await this.counts() }
  }

  async get(id: string): Promise<LeadView> {
    const row = await this.leads.findOneBy({ id })
    if (!row) throw notFound()
    const [view] = await this.views([row])
    return view as LeadView
  }

  async update(id: string, changes: LeadChanges, actor: AuthUser, req: Request): Promise<LeadView> {
    const row = await this.leads.findOneBy({ id })
    if (!row) throw notFound()
    const before = { status: row.status, comment: row.comment }
    if (changes.status !== undefined) row.status = changes.status
    if (changes.comment !== undefined) row.comment = changes.comment?.trim() || null
    row.updatedBy = actor.id
    await this.leads.save(row)
    await this.audit.record({
      action: 'leads.update',
      user: actor,
      entityType: 'lead',
      entityId: id,
      summary: `Заявка №${row.number}`,
      meta: {
        ...(before.status !== row.status
          ? { status: { from: before.status, to: row.status } }
          : {}),
        ...(before.comment !== row.comment ? { comment: true } : {}),
      },
      req,
    })
    return this.get(id)
  }

  async export(query: Omit<LeadQuery, 'page' | 'pageSize'>, actor: AuthUser, req: Request) {
    const rows = await this.filtered(query)
      .orderBy('l.created_at', 'DESC')
      .take(MAX_EXPORT_ROWS)
      .getMany()
    const file = buildXlsx(
      'Заявки',
      [
        { header: '№', width: 7 },
        { header: 'Дата', width: 18 },
        { header: 'Форма', width: 18 },
        { header: 'Имя', width: 24 },
        { header: 'Телефон', width: 18 },
        { header: 'Тема', width: 28 },
        { header: 'Сообщение', width: 60 },
        { header: 'Язык', width: 6 },
        { header: 'Страница', width: 24 },
        { header: 'Статус', width: 14 },
        { header: 'Комментарий', width: 40 },
      ],
      rows.map((row) => [
        row.number,
        formatDateTime(row.createdAt),
        LEAD_FORM_LABELS[row.form as LeadForm] ?? row.form,
        row.name,
        row.phone,
        row.topic,
        row.message,
        row.locale.toUpperCase(),
        row.page,
        LEAD_STATUS_LABELS[row.status],
        row.comment,
      ]),
    )
    await this.audit.record({
      action: 'leads.export',
      user: actor,
      entityType: 'lead',
      summary: `Выгрузка заявок: ${rows.length}`,
      meta: { count: rows.length, filters: { ...query } },
      req,
    })
    return file
  }

  // ── Trash ───────────────────────────────────────────────────────────────────

  async remove(id: string, actor: AuthUser, req: Request): Promise<void> {
    const row = await this.leads.findOneBy({ id })
    if (!row) throw notFound()
    await this.leads.update(id, { deletedAt: new Date(), deletedBy: actor.id })
    await this.record('leads.delete', row, actor, req)
  }

  listTrashed(): Promise<Lead[]> {
    return this.leads.find({
      where: { deletedAt: Not(IsNull()) },
      withDeleted: true,
      order: { deletedAt: 'DESC' },
      take: 500,
    })
  }

  async restoreFromTrash(id: string, actor: AuthUser, req: Request): Promise<void> {
    const row = await this.trashed(id)
    await this.leads.update(id, { deletedAt: null, deletedBy: null })
    await this.record('leads.restore', row, actor, req)
  }

  async purge(id: string, actor: AuthUser | null, req?: Request): Promise<void> {
    const row = await this.trashed(id)
    await this.leads.delete(id)
    await this.record('leads.purge', row, actor, req)
  }

  async purgeExpired(cutoff: Date): Promise<number> {
    const rows = await this.leads.find({
      where: { deletedAt: LessThan(cutoff) },
      withDeleted: true,
    })
    for (const row of rows) await this.purge(row.id, null)
    return rows.length
  }

  /** For the start screen. */
  async countNew(): Promise<number> {
    return this.leads.countBy({ status: 'new' })
  }

  async latest(limit: number): Promise<LeadView[]> {
    return this.views(await this.leads.find({ order: { createdAt: 'DESC' }, take: limit }))
  }

  /** Submissions in a period, spam aside and the trash included (statistics). */
  async countBetween(start: Date, end: Date): Promise<number> {
    return this.leads
      .createQueryBuilder('l')
      .withDeleted()
      .where('l.created_at >= :start AND l.created_at < :end', { start, end })
      .andWhere("l.status <> 'spam'")
      .getCount()
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private filtered(query: Omit<LeadQuery, 'page' | 'pageSize'>) {
    const qb = this.leads.createQueryBuilder('l')
    if (query.status) qb.andWhere('l.status = :status', { status: query.status })
    const { start, end } = dayRange(query.from, query.to)
    if (start) qb.andWhere('l.created_at >= :start', { start })
    if (end) qb.andWhere('l.created_at < :end', { end })
    if (query.q) {
      const q = query.q.trim()
      const number = /^№?\s*(\d{1,9})$/.exec(q)?.[1]
      qb.andWhere(
        `(l.name ILIKE :q OR l.phone ILIKE :q OR l.topic ILIKE :q OR l.message ILIKE :q OR l.comment ILIKE :q${number ? ' OR l.number = :number' : ''})`,
        { q: likePattern(q), number: number ? Number(number) : undefined },
      )
    }
    return qb
  }

  private async counts(): Promise<Record<LeadStatus, number>> {
    const rows: { status: LeadStatus; count: string }[] = await this.leads
      .createQueryBuilder('l')
      .select('l.status', 'status')
      .addSelect('count(*)', 'count')
      .groupBy('l.status')
      .getRawMany()
    const counts = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<
      LeadStatus,
      number
    >
    for (const row of rows) counts[row.status] = Number(row.count)
    return counts
  }

  private async views(rows: Lead[]): Promise<LeadView[]> {
    const names = await userNames(
      this.users,
      rows.map((row) => row.updatedBy),
    )
    return rows.map((row) => ({
      id: row.id,
      number: row.number,
      form: row.form,
      formLabel: LEAD_FORM_LABELS[row.form as LeadForm] ?? row.form,
      name: row.name,
      phone: row.phone,
      topic: row.topic,
      message: row.message,
      locale: row.locale,
      page: row.page,
      status: row.status,
      comment: row.comment,
      consentAt: row.consentAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      updatedBy: userRef(names, row.updatedBy),
    }))
  }

  private async trashed(id: string): Promise<Lead> {
    const row = await this.leads.findOne({
      where: { id, deletedAt: Not(IsNull()) },
      withDeleted: true,
    })
    if (!row) throw notFound()
    return row
  }

  private record(action: string, row: Lead, actor: AuthUser | null, req?: Request) {
    return this.audit.record({
      action,
      user: actor,
      userEmail: actor ? undefined : 'system',
      entityType: 'lead',
      entityId: row.id,
      summary: `Заявка №${row.number}`,
      req,
    })
  }
}

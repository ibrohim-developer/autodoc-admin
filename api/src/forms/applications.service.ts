import { randomUUID } from 'node:crypto'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import type { Request } from 'express'
import { IsNull, LessThan, Not, Repository } from 'typeorm'
import { AuditService } from '../audit/audit.service.js'
import type { AuthUser } from '../common/request.js'
import { buildXlsx } from '../common/xlsx.js'
import type { Env } from '../config/env.js'
import { ContentDocument } from '../content/document.entity.js'
import type { Locale } from '../content/locales.js'
import { TelegramService } from '../integrations/telegram.service.js'
import { User } from '../users/user.entity.js'
import { Application } from './application.entity.js'
import type { ApplicationInput } from './public-input.js'
import { assertResume, cleanFileName } from './resume.js'
import {
  dayRange,
  formatDateTime,
  likePattern,
  type UserRef,
  userNames,
  userRef,
} from './shared.js'
import {
  APPLICATION_SOURCE_LABELS,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
  type ApplicationSource,
  type ApplicationStatus,
} from './workflow.js'

/** The vacancy content type (src/site-content/vacancies.ts). */
const VACANCY_TYPE = 'vacancy'
const MAX_EXPORT_ROWS = 10_000

export type UploadedResume = { buffer: Buffer; originalname: string; size: number }

export type ApplicationQuery = {
  status?: ApplicationStatus
  vacancyId?: string
  /** `none`: applications for no particular vacancy. */
  noVacancy?: boolean
  source?: ApplicationSource
  q?: string
  from?: string
  to?: string
  page: number
  pageSize: number
}

export type ApplicationView = {
  id: string
  number: number
  vacancy: { id: string | null; title: string } | null
  name: string
  phone: string
  email: string | null
  about: string | null
  resume: { name: string; size: number; mime: string } | null
  source: ApplicationSource
  sourceLabel: string
  locale: Locale | null
  page: string | null
  status: ApplicationStatus
  comment: string | null
  consentAt: Date | null
  createdAt: Date
  updatedAt: Date
  createdBy: UserRef
  updatedBy: UserRef
}

export type ApplicationChanges = { status?: ApplicationStatus; comment?: string | null }

export type ManualApplication = {
  name: string
  phone: string
  email?: string | null
  vacancyId?: string | null
  source: Exclude<ApplicationSource, 'site'>
  about?: string | null
  comment?: string | null
}

export type VacancyOption = {
  id: string
  title: string
  closed: boolean
  isLive: boolean
  applications: number
  newApplications: number
}

const notFound = () =>
  new NotFoundException({ code: 'application_not_found', message: 'Отклик не найден' })

/** "Отклики": job applications from the site and those HR adds by hand, with resumes. */
@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name)
  private readonly privateDir: string
  private readonly adminOrigin: string

  constructor(
    @InjectRepository(Application) private readonly applications: Repository<Application>,
    @InjectRepository(ContentDocument) private readonly documents: Repository<ContentDocument>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly audit: AuditService,
    private readonly telegram: TelegramService,
    config: ConfigService<Env, true>,
  ) {
    this.privateDir = join(resolve(config.get('STORAGE_DIR', { infer: true })), 'private')
    this.adminOrigin = config.get('ADMIN_ORIGIN', { infer: true }).replace(/\/$/, '')
  }

  /** From the site's resume form: the vacancy must be on the site and open. */
  async submit(input: ApplicationInput, file: UploadedResume | undefined): Promise<Application> {
    if (!file) {
      throw new UnprocessableEntityException({ code: 'no_resume', message: 'Приложите резюме' })
    }
    let vacancyTitle: string | null = null
    if (input.vacancyId) {
      const vacancy = await this.documents.findOneBy({ id: input.vacancyId, type: VACANCY_TYPE })
      const live = vacancy?.published
      if (!live) {
        throw new UnprocessableEntityException({
          code: 'vacancy_not_found',
          message: 'Вакансия не найдена',
        })
      }
      if (live.shared.closed === true) {
        throw new UnprocessableEntityException({
          code: 'vacancy_closed',
          message: 'Вакансия закрыта',
        })
      }
      vacancyTitle = String(live.locales.uz.title ?? '').slice(0, 200) || null
    }

    const resume = await this.storeResume(file)
    try {
      const saved = await this.applications.save(
        this.applications.create({
          vacancyId: input.vacancyId,
          vacancyTitle,
          name: input.name,
          phone: input.phone,
          email: input.email,
          about: input.about,
          ...resume,
          source: 'site',
          locale: input.locale,
          page: input.page,
          status: 'new',
          consentAt: new Date(),
        }),
      )
      this.telegram.notify(
        'applications',
        `Новый отклик №${saved.number}: ${vacancyTitle ? `«${vacancyTitle}»` : 'другая позиция'}.\n${this.adminOrigin}/applications/${saved.id}`,
      )
      return saved
    } catch (error) {
      await this.deleteResume(resume.resumeFile)
      throw error
    }
  }

  /** HR adds a candidate who wrote on hh.uz, Instagram, Telegram… */
  async create(
    input: ManualApplication,
    file: UploadedResume | undefined,
    actor: AuthUser,
    req: Request,
  ): Promise<ApplicationView> {
    let vacancyTitle: string | null = null
    if (input.vacancyId) {
      const vacancy = await this.documents.findOneBy({ id: input.vacancyId, type: VACANCY_TYPE })
      if (!vacancy) {
        throw new UnprocessableEntityException({
          code: 'vacancy_not_found',
          message: 'Вакансия не найдена',
        })
      }
      vacancyTitle = String(vacancy.draft.locales.uz.title ?? '').slice(0, 200) || null
    }
    const resume = file ? await this.storeResume(file) : null
    try {
      const saved = await this.applications.save(
        this.applications.create({
          vacancyId: input.vacancyId ?? null,
          vacancyTitle,
          name: input.name.trim(),
          phone: input.phone.trim(),
          email: input.email?.trim() || null,
          about: input.about?.trim() || null,
          comment: input.comment?.trim() || null,
          ...(resume ?? {}),
          source: input.source,
          status: 'new',
          createdBy: actor.id,
          updatedBy: actor.id,
        }),
      )
      await this.record('applications.create', saved, actor, req)
      return this.get(saved.id)
    } catch (error) {
      if (resume) await this.deleteResume(resume.resumeFile)
      throw error
    }
  }

  async list(query: ApplicationQuery): Promise<{
    items: ApplicationView[]
    total: number
    counts: Record<ApplicationStatus, number>
  }> {
    const [rows, total] = await this.filtered(query)
      .orderBy('a.created_at', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount()
    return { items: await this.views(rows), total, counts: await this.counts() }
  }

  async get(id: string): Promise<ApplicationView> {
    const row = await this.applications.findOneBy({ id })
    if (!row) throw notFound()
    const [view] = await this.views([row])
    return view as ApplicationView
  }

  /** Every vacancy (live, draft or closed) with how many applications it has, for the filter. */
  async vacancies(): Promise<VacancyOption[]> {
    const rows: {
      id: string
      title: string | null
      closed: boolean | null
      live: boolean
      total: string
      fresh: string
    }[] = await this.documents.query(
      `SELECT d.id,
              d.draft #>> '{locales,uz,title}' AS title,
              (d.published #>> '{shared,closed}')::boolean AS closed,
              d.published IS NOT NULL AS live,
              count(a.id) AS total,
              count(a.id) FILTER (WHERE a.status = 'new') AS fresh
         FROM documents d
         LEFT JOIN applications a ON a.vacancy_id = d.id AND a.deleted_at IS NULL
        WHERE d.type = $1 AND d.deleted_at IS NULL
        GROUP BY d.id
        ORDER BY d.published IS NULL, d.updated_at DESC`,
      [VACANCY_TYPE],
    )
    return rows.map((row) => ({
      id: row.id,
      title: row.title ?? '—',
      closed: row.closed === true,
      isLive: row.live,
      applications: Number(row.total),
      newApplications: Number(row.fresh),
    }))
  }

  async update(
    id: string,
    changes: ApplicationChanges,
    actor: AuthUser,
    req: Request,
  ): Promise<ApplicationView> {
    const row = await this.applications.findOneBy({ id })
    if (!row) throw notFound()
    const before = { status: row.status, comment: row.comment }
    if (changes.status !== undefined) row.status = changes.status
    if (changes.comment !== undefined) row.comment = changes.comment?.trim() || null
    row.updatedBy = actor.id
    await this.applications.save(row)
    await this.record('applications.update', row, actor, req, {
      ...(before.status !== row.status ? { status: { from: before.status, to: row.status } } : {}),
      ...(before.comment !== row.comment ? { comment: true } : {}),
    })
    return this.get(id)
  }

  /** The file for a permitted user; every download is in the audit log. */
  async resume(
    id: string,
    actor: AuthUser,
    req: Request,
  ): Promise<{ path: string; name: string; mime: string; size: number }> {
    const row = await this.applications.findOneBy({ id })
    if (!row) throw notFound()
    if (!row.resumeFile) {
      throw new NotFoundException({ code: 'no_resume', message: 'Резюме не приложено' })
    }
    const path = join(this.privateDir, row.resumeFile)
    const info = await stat(path).catch(() => null)
    if (!info) {
      this.logger.error(`Resume file missing for application ${row.id}: ${row.resumeFile}`)
      throw new NotFoundException({ code: 'resume_missing', message: 'Файл резюме не найден' })
    }
    await this.record('applications.resume_download', row, actor, req)
    return {
      path,
      name: row.resumeName ?? `resume-${row.number}`,
      mime: row.resumeMime ?? 'application/octet-stream',
      size: info.size,
    }
  }

  async export(query: Omit<ApplicationQuery, 'page' | 'pageSize'>, actor: AuthUser, req: Request) {
    const rows = await this.filtered(query)
      .orderBy('a.created_at', 'DESC')
      .take(MAX_EXPORT_ROWS)
      .getMany()
    const file = buildXlsx(
      'Отклики',
      [
        { header: '№', width: 7 },
        { header: 'Дата', width: 18 },
        { header: 'Вакансия', width: 30 },
        { header: 'Имя', width: 24 },
        { header: 'Телефон', width: 18 },
        { header: 'Email', width: 24 },
        { header: 'О себе', width: 50 },
        { header: 'Источник', width: 14 },
        { header: 'Статус', width: 16 },
        { header: 'Комментарий', width: 40 },
        { header: 'Резюме', width: 24 },
      ],
      rows.map((row) => [
        row.number,
        formatDateTime(row.createdAt),
        row.vacancyTitle ?? 'Другая позиция',
        row.name,
        row.phone,
        row.email,
        row.about,
        APPLICATION_SOURCE_LABELS[row.source],
        APPLICATION_STATUS_LABELS[row.status],
        row.comment,
        row.resumeName,
      ]),
    )
    await this.audit.record({
      action: 'applications.export',
      user: actor,
      entityType: 'application',
      summary: `Выгрузка откликов: ${rows.length}`,
      meta: { count: rows.length, filters: { ...query } },
      req,
    })
    return file
  }

  // ── Trash ───────────────────────────────────────────────────────────────────

  async remove(id: string, actor: AuthUser, req: Request): Promise<void> {
    const row = await this.applications.findOneBy({ id })
    if (!row) throw notFound()
    await this.applications.update(id, { deletedAt: new Date(), deletedBy: actor.id })
    await this.record('applications.delete', row, actor, req)
  }

  listTrashed(): Promise<Application[]> {
    return this.applications.find({
      where: { deletedAt: Not(IsNull()) },
      withDeleted: true,
      order: { deletedAt: 'DESC' },
      take: 500,
    })
  }

  async restoreFromTrash(id: string, actor: AuthUser, req: Request): Promise<void> {
    const row = await this.trashed(id)
    await this.applications.update(id, { deletedAt: null, deletedBy: null })
    await this.record('applications.restore', row, actor, req)
  }

  /** Gone for good, the resume file with it. */
  async purge(id: string, actor: AuthUser | null, req?: Request): Promise<void> {
    const row = await this.trashed(id)
    await this.deleteResume(row.resumeFile)
    await this.applications.delete(id)
    await this.record('applications.purge', row, actor, req)
  }

  async purgeExpired(cutoff: Date): Promise<number> {
    const rows = await this.applications.find({
      where: { deletedAt: LessThan(cutoff) },
      withDeleted: true,
    })
    for (const row of rows) await this.purge(row.id, null)
    return rows.length
  }

  /** Retention: applications untouched since `cutoff` go for good, resumes with them. */
  async purgeUnchangedSince(cutoff: Date): Promise<number> {
    const rows = await this.applications.find({
      select: { id: true, resumeFile: true },
      where: { updatedAt: LessThan(cutoff) },
      withDeleted: true,
    })
    for (const row of rows) {
      await this.deleteResume(row.resumeFile)
      await this.applications.delete(row.id)
    }
    return rows.length
  }

  // ── Start screen and statistics ─────────────────────────────────────────────

  countNew(): Promise<number> {
    return this.applications.countBy({ status: 'new' })
  }

  async latest(limit: number): Promise<ApplicationView[]> {
    return this.views(await this.applications.find({ order: { createdAt: 'DESC' }, take: limit }))
  }

  /** Applications in a period, the trash included (statistics). */
  countBetween(start: Date, end: Date): Promise<number> {
    return this.applications
      .createQueryBuilder('a')
      .withDeleted()
      .where('a.created_at >= :start AND a.created_at < :end', { start, end })
      .getCount()
  }

  /** Applications in a period per vacancy (null: no particular one), the trash included. */
  async countByVacancy(start: Date, end: Date): Promise<Map<string | null, number>> {
    const rows: { vacancy_id: string | null; count: string }[] = await this.applications.query(
      `SELECT vacancy_id, count(*) AS count FROM applications
        WHERE created_at >= $1 AND created_at < $2
        GROUP BY vacancy_id`,
      [start, end],
    )
    return new Map(rows.map((row) => [row.vacancy_id, Number(row.count)]))
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private async storeResume(file: UploadedResume) {
    const format = assertResume(file.buffer)
    const now = new Date()
    const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    const relative = `resumes/${folder}/${randomUUID()}.${format.extension}`
    const path = join(this.privateDir, relative)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, file.buffer, { mode: 0o600 })
    return {
      resumeFile: relative,
      resumeName: cleanFileName(file.originalname, format.extension),
      resumeMime: format.mime,
      resumeSize: file.size,
    }
  }

  private async deleteResume(file: string | null): Promise<void> {
    if (!file) return
    try {
      await rm(join(this.privateDir, file), { force: true })
    } catch (error) {
      this.logger.warn(`Could not delete resume ${file}: ${String(error)}`)
    }
  }

  private filtered(query: Omit<ApplicationQuery, 'page' | 'pageSize'>) {
    const qb = this.applications.createQueryBuilder('a')
    if (query.status) qb.andWhere('a.status = :status', { status: query.status })
    if (query.noVacancy) qb.andWhere('a.vacancy_id IS NULL')
    else if (query.vacancyId)
      qb.andWhere('a.vacancy_id = :vacancyId', { vacancyId: query.vacancyId })
    if (query.source) qb.andWhere('a.source = :source', { source: query.source })
    const { start, end } = dayRange(query.from, query.to)
    if (start) qb.andWhere('a.created_at >= :start', { start })
    if (end) qb.andWhere('a.created_at < :end', { end })
    if (query.q) {
      const q = query.q.trim()
      const number = /^№?\s*(\d{1,9})$/.exec(q)?.[1]
      qb.andWhere(
        `(a.name ILIKE :q OR a.phone ILIKE :q OR a.email ILIKE :q OR a.about ILIKE :q OR a.comment ILIKE :q OR a.vacancy_title ILIKE :q${number ? ' OR a.number = :number' : ''})`,
        { q: likePattern(q), number: number ? Number(number) : undefined },
      )
    }
    return qb
  }

  private async counts(): Promise<Record<ApplicationStatus, number>> {
    const rows: { status: ApplicationStatus; count: string }[] = await this.applications
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('count(*)', 'count')
      .groupBy('a.status')
      .getRawMany()
    const counts = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as Record<
      ApplicationStatus,
      number
    >
    for (const row of rows) counts[row.status] = Number(row.count)
    return counts
  }

  private async views(rows: Application[]): Promise<ApplicationView[]> {
    const names = await userNames(this.users, [
      ...rows.map((row) => row.createdBy),
      ...rows.map((row) => row.updatedBy),
    ])
    return rows.map((row) => ({
      id: row.id,
      number: row.number,
      vacancy:
        row.vacancyId || row.vacancyTitle
          ? { id: row.vacancyId, title: row.vacancyTitle ?? '—' }
          : null,
      name: row.name,
      phone: row.phone,
      email: row.email,
      about: row.about,
      resume:
        row.resumeFile && row.resumeName
          ? { name: row.resumeName, size: row.resumeSize ?? 0, mime: row.resumeMime ?? '' }
          : null,
      source: row.source,
      sourceLabel: APPLICATION_SOURCE_LABELS[row.source],
      locale: row.locale,
      page: row.page,
      status: row.status,
      comment: row.comment,
      consentAt: row.consentAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: userRef(names, row.createdBy),
      updatedBy: userRef(names, row.updatedBy),
    }))
  }

  private async trashed(id: string): Promise<Application> {
    const row = await this.applications.findOne({
      where: { id, deletedAt: Not(IsNull()) },
      withDeleted: true,
    })
    if (!row) throw notFound()
    return row
  }

  private record(
    action: string,
    row: Application,
    actor: AuthUser | null,
    req?: Request,
    meta?: Record<string, unknown>,
  ) {
    return this.audit.record({
      action,
      user: actor,
      userEmail: actor ? undefined : 'system',
      entityType: 'application',
      entityId: row.id,
      summary: `Отклик №${row.number}`,
      meta,
      req,
    })
  }
}

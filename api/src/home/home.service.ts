import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { AuthUser } from '../common/request.js'
import { ContentTypeRegistry } from '../content/content-types.js'
import { ContentDocument } from '../content/document.entity.js'
import { ApplicationsService } from '../forms/applications.service.js'
import { LeadsService } from '../forms/leads.service.js'
import { CAREER_LIST_PATHS, StatsService } from '../stats/stats.service.js'

const LATEST = 5
const DRAFTS = 8

export type DraftItem = {
  id: string
  type: string
  typeLabel: string
  title: string
  status: 'draft' | 'changed' | 'scheduled'
  updatedAt: Date
}

/**
 * The start screen ("Главная"): each widget only for the roles it concerns. Marketing sees
 * submissions, applications, site views and drafts; HR sees applications, vacancy views and
 * vacancy drafts; the administrator sees everything.
 */
@Injectable()
export class HomeService {
  constructor(
    @InjectRepository(ContentDocument) private readonly documents: Repository<ContentDocument>,
    private readonly registry: ContentTypeRegistry,
    private readonly leads: LeadsService,
    private readonly applications: ApplicationsService,
    private readonly stats: StatsService,
  ) {}

  async widgets(actor: AuthUser, now = new Date()) {
    const can = (permission: string) =>
      (actor.permissions as readonly string[]).includes(permission)
    const [leads, applications, views, drafts] = await Promise.all([
      can('leads.read') ? this.leadsWidget() : null,
      can('applications.read') ? this.applicationsWidget() : null,
      can('stats.general')
        ? this.viewsWidget('site', now)
        : can('stats.vacancies')
          ? this.viewsWidget('vacancies', now)
          : null,
      this.draftsWidget(actor),
    ])
    return { leads, applications, views, drafts }
  }

  private async leadsWidget() {
    const [count, latest] = await Promise.all([this.leads.countNew(), this.leads.latest(LATEST)])
    return {
      new: count,
      latest: latest.map((lead) => ({
        id: lead.id,
        number: lead.number,
        name: lead.name,
        topic: lead.topic,
        status: lead.status,
        createdAt: lead.createdAt,
      })),
    }
  }

  private async applicationsWidget() {
    const [count, latest] = await Promise.all([
      this.applications.countNew(),
      this.applications.latest(LATEST),
    ])
    return {
      new: count,
      latest: latest.map((application) => ({
        id: application.id,
        number: application.number,
        name: application.name,
        vacancyTitle: application.vacancy?.title ?? null,
        status: application.status,
        createdAt: application.createdAt,
      })),
    }
  }

  /** The last 7 days against the 7 before: the whole site, or only the vacancies for HR. */
  private async viewsWidget(scope: 'site' | 'vacancies', now: Date) {
    const week = this.stats.lastDays(7, now)
    const where = scope === 'vacancies' ? `content_type = 'vacancy' OR path = ANY($3)` : 'TRUE'
    const params = scope === 'vacancies' ? [CAREER_LIST_PATHS] : []
    const [current, previous, daily] = await Promise.all([
      this.stats.totals(week, where, params),
      this.stats.totals(this.stats.previous(week), where, params),
      this.stats.daily(week, where, params),
    ])
    return { scope, totals: current, previous, daily }
  }

  /** Unpublished work in the sections this user edits; settings-like types go live on save. */
  private async draftsWidget(actor: AuthUser) {
    const types = this.registry.withPermission(actor, 'write').filter((type) => !type.publishOnSave)
    if (types.length === 0) return null
    const qb = this.documents
      .createQueryBuilder('d')
      .where('d.type IN (:...types)', { types: types.map((type) => type.type) })
      .andWhere(
        '(d.published IS NULL OR d.draft_hash <> d.published_hash OR d.scheduled_at IS NOT NULL)',
      )
    const [rows, total] = await qb.orderBy('d.updated_at', 'DESC').take(DRAFTS).getManyAndCount()
    const items: DraftItem[] = rows.map((row) => {
      const type = this.registry.get(row.type)
      return {
        id: row.id,
        type: row.type,
        typeLabel: type.label,
        title: type.title(row.draft) || 'Без названия',
        status: row.scheduledAt ? 'scheduled' : row.published ? 'changed' : 'draft',
        updatedAt: row.updatedAt,
      }
    })
    return { total, items }
  }
}

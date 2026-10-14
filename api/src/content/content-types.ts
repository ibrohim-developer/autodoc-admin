import { Injectable, NotFoundException } from '@nestjs/common'
import { z } from 'zod'
import type { Permission } from '../auth/permissions.js'
import type { AuthUser } from '../common/request.js'
import type { DocumentData } from './document-data.js'
import type { Locale } from './locales.js'

/** A sort key from the shared fields, e.g. pinned news first or projects in their set order. */
export type OrderBy = {
  field: string
  direction: 'asc' | 'desc'
  cast: 'boolean' | 'number' | 'text'
}

/** A shared field holding the id of another document, e.g. a news post's category. */
export type Reference = { field: string; type: string; label: string }

export type Issue = { path: string; message: string }

/**
 * One kind of content: news post, vacancy, project, page… (src/site-content registers them).
 * Everything else — drafts, publishing, history, trash, scheduling, preview, site refresh —
 * is the same for every type and lives in DocumentsService.
 */
export type ContentTypeDef = {
  /** Stored in documents.type, used in URLs of the admin API: `post`, `vacancy`. */
  type: string
  /** Russian, for the trash, the audit log and messages: «Новость». */
  label: string
  permissions: { read: Permission; write: Permission; publish: Permission; trash: Permission }
  /** Fields that are the same in every language (slug, dates, photos…). */
  shared: z.ZodObject
  /** Fields written per language. Uzbek must pass in full; Russian and English may be partial. */
  localized: z.ZodObject
  /** Shown in lists, the trash and the audit log. */
  title(data: DocumentData): string
  /** The slug the document should have; null for types without their own page. */
  slug?(data: DocumentData): string | null
  /** The page on the site that shows this document, for preview and cache refresh. */
  sitePath?(data: DocumentData, slug: string | null, locale: Locale): string | null
  /** Exactly one document of this type exists (a page, a settings block): it can't be deleted. */
  singleton?: boolean
  /** Saving goes live at once (settings). Most content waits for "Опубликовать". */
  publishOnSave?: boolean
  /**
   * Rules for going live on top of the schema: a draft may lack its cover, the site may not.
   * Checked on publish, on scheduling and again when the schedule fires.
   */
  publishCheck?(data: DocumentData): Issue[]
  /** Sort order on the site, before newest-first. */
  order?: OrderBy[]
  /** The admin list follows `order` too (directions, projects), instead of last-edited first. */
  adminOrder?: boolean
  /** Fields the site's lists get; its own page gets everything. Keeps lists of articles light. */
  summary?: { shared?: string[]; localized?: string[] }
  /** Fields pointing at other documents: checked on save, and those can't be deleted while used. */
  references?: Reference[]
  /** A shared field no two documents of the type may share (a redirect's source address). */
  unique?: { field: string; message: string }
}

const FIELD_NAME = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/

export type RegisteredType = ContentTypeDef & {
  /** Validates a whole document: Uzbek in full, the other languages partial or absent. */
  dataSchema: z.ZodType<DocumentData>
}

@Injectable()
export class ContentTypeRegistry {
  private readonly types = new Map<string, RegisteredType>()

  register(def: ContentTypeDef): RegisteredType {
    if (this.types.has(def.type)) throw new Error(`Content type "${def.type}" is registered twice`)
    // These names end up in SQL (sorting, reference lookups): only plain identifiers.
    const fields = [
      ...(def.order ?? []),
      ...(def.references ?? []),
      ...(def.unique ? [def.unique] : []),
    ]
    for (const name of fields.map((f) => f.field)) {
      if (!FIELD_NAME.test(name)) throw new Error(`Content type "${def.type}": bad field "${name}"`)
    }
    const partial = def.localized.partial()
    const dataSchema = z.object({
      shared: def.shared,
      locales: z.object({
        uz: def.localized,
        ru: partial.optional(),
        en: partial.optional(),
      }),
    }) as unknown as z.ZodType<DocumentData>
    const registered = { ...def, dataSchema }
    this.types.set(def.type, registered)
    return registered
  }

  get(type: string): RegisteredType {
    const registered = this.types.get(type)
    if (!registered) {
      throw new NotFoundException({ code: 'unknown_type', message: `Неизвестный тип: ${type}` })
    }
    return registered
  }

  find(type: string): RegisteredType | undefined {
    return this.types.get(type)
  }

  all(): RegisteredType[] {
    return [...this.types.values()]
  }

  /** Types with a field pointing at `type`: what to check before a document of it is deleted. */
  referencing(type: string): { type: RegisteredType; reference: Reference }[] {
    return this.all().flatMap((candidate) =>
      (candidate.references ?? [])
        .filter((reference) => reference.type === type)
        .map((reference) => ({ type: candidate, reference })),
    )
  }

  /** Types whose trash the user may see, e.g. HR sees vacancies but not news. */
  withPermission(user: AuthUser, action: keyof ContentTypeDef['permissions']): RegisteredType[] {
    return this.all().filter((type) => user.permissions.includes(type.permissions[action]))
  }
}

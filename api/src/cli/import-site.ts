import 'reflect-metadata'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import type { INestApplicationContext } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { Request } from 'express'
import { DataSource } from 'typeorm'
import { permissionsOf } from '../auth/permissions.js'
import type { AuthUser } from '../common/request.js'
import { ContentDocument } from '../content/document.entity.js'
import type { DocumentData } from '../content/document-data.js'
import { DocumentsService } from '../content/documents.service.js'
import { LOCALES, type Locale } from '../content/locales.js'
import { SiteRevalidationService } from '../content/site-revalidation.service.js'
import { slugify } from '../content/slug.js'
import { MediaService } from '../media/media.service.js'
import { UsersService } from '../users/users.service.js'
import { ImportModule } from './import.module.js'

/**
 * Moves today's hard-coded content of autodoc.uz into the admin, once, before the site starts
 * reading from it:
 *   pnpm --filter @autodoc/api content:import --site ../../autodoc-landing --as admin@autodoc.uz
 *
 * Reads the landing checkout (scripts/export-site-content.mjs), uploads its photos to the media
 * library and creates published documents in the same order as on the site. Safe to run again:
 * what is already there (same address, same photo) is skipped.
 */
const { values } = parseArgs({
  options: {
    site: { type: 'string' },
    as: { type: 'string' },
  },
})
if (!values.site || !values.as) {
  console.error('Usage: content:import --site <path to autodoc-landing> --as <admin email>')
  process.exit(1)
}

type Texts<T> = Record<Locale, T | null>
type ExportedPost = {
  id: string
  key: string
  date: string
  link: string | null
  imagePosition: string | null
  fullImage: boolean
  image: string
  texts: Texts<{ title: string; excerpt?: string; body?: string[] }>
}
type ExportedVacancy = {
  key: string
  category: string
  employment: string
  texts: Texts<{ title: string; city: string; description: string; requirements?: string[] }>
}
type ExportedDirection = { key: string; names: Texts<string> }
type Bundle = {
  site: string
  posts?: ExportedPost[]
  vacancies?: ExportedVacancy[]
  vacancyCategories?: ExportedDirection[]
}

const here = dirname(fileURLToPath(import.meta.url))
const exporter = resolve(here, '../../scripts/export-site-content.mjs')
const bundle = JSON.parse(
  execFileSync(process.execPath, ['--no-warnings', exporter, '--site', values.site], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }),
) as Bundle

// Audit entries need a request; this one says where the change came from.
const req = { ip: null, get: () => 'content:import' } as unknown as Request

/** "…watch <link>here</link>." → text with a link mark on "here". */
function paragraph(text: string, href: string | null) {
  const content = text
    .split(/<link>(.*?)<\/link>/)
    .map((part, index) =>
      index % 2 === 1 && href
        ? { type: 'text', text: part, marks: [{ type: 'link', attrs: { href } }] }
        : { type: 'text', text: part },
    )
    .filter((node) => node.text !== '')
  return { type: 'paragraph', content }
}

async function actorFor(app: INestApplicationContext, email: string): Promise<AuthUser> {
  const user = await app.get(UsersService).findWithSecrets({ email })
  if (!user) throw new Error(`No user ${email}: create the administrator first (user:create-admin)`)
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: permissionsOf(user.role),
    sessionFamilyId: 'content-import',
  }
}

async function uploadPhoto(
  app: INestApplicationContext,
  path: string,
  alt: Partial<Record<Locale, string>>,
  actor: AuthUser,
): Promise<string> {
  const media = app.get(MediaService)
  const buffer = await readFile(path)
  const uploaded = await media.upload(
    { buffer, originalname: basename(path), size: buffer.length },
    actor,
    req,
  )
  if (!uploaded.duplicate) await media.updateAlt(uploaded.id, alt, actor, req)
  return uploaded.id
}

async function importPosts(app: INestApplicationContext, posts: ExportedPost[], actor: AuthUser) {
  const documents = app.get(DocumentsService)
  const repository = app.get(DataSource).getRepository(ContentDocument)
  // The site lists posts newest first by first publication: one minute apart keeps the order.
  const newest = Date.now()

  for (const [index, post] of posts.entries()) {
    if (await repository.existsBy({ type: 'post', slug: post.id })) {
      console.log(`  news /blog/${post.id}/ is already there, skipped`)
      continue
    }
    const titles = Object.fromEntries(
      LOCALES.flatMap((locale) => (post.texts[locale] ? [[locale, post.texts[locale].title]] : [])),
    )
    const cover = await uploadPhoto(app, post.image, titles, actor)
    const locales = Object.fromEntries(
      LOCALES.flatMap((locale) => {
        const texts = post.texts[locale]
        if (!texts) return []
        return [
          [
            locale,
            {
              title: texts.title,
              body: {
                type: 'doc',
                // The card's lines are now made from the text: a post that only had its two
                // lines on the old site keeps them as its text.
                content: (texts.body?.length
                  ? texts.body
                  : texts.excerpt
                    ? [texts.excerpt]
                    : []
                ).map((text) => paragraph(text, post.link)),
              },
            },
          ],
        ]
      }),
    ) as unknown as DocumentData['locales']
    const data: DocumentData = {
      shared: {
        slug: post.id,
        date: post.date,
        cover: { mediaId: cover },
        ...(post.imagePosition && /^\d{1,3}% \d{1,3}%$/.test(post.imagePosition)
          ? { coverPosition: post.imagePosition }
          : {}),
        coverFull: post.fullImage,
      },
      locales,
    }

    const created = await documents.create('post', data, actor, req)
    await documents.publish(created.id, {}, actor, req)
    const at = new Date(newest - index * 60_000)
    await repository.update(created.id, { firstPublishedAt: at, publishedAt: at })
    console.log(`  news /blog/${post.id}/ — ${data.locales.uz.title}`)
  }
}

/** Translations that exist, as a document's `locales` (Uzbek is always there on the site). */
function localesOf<T>(texts: Texts<T>, pick: (value: T) => Record<string, unknown>) {
  return Object.fromEntries(
    LOCALES.flatMap((locale) => {
      const value = texts[locale]
      return value ? [[locale, pick(value)]] : []
    }),
  ) as unknown as DocumentData['locales']
}

/** Directions by their key on the old site (development, sales…) → document id. */
async function importDirections(
  app: INestApplicationContext,
  directions: ExportedDirection[],
  actor: AuthUser,
): Promise<Map<string, string>> {
  const documents = app.get(DocumentsService)
  const repository = app.get(DataSource).getRepository(ContentDocument)
  const ids = new Map<string, string>()
  for (const [index, direction] of directions.entries()) {
    const slug = slugify(direction.key.replace(/([a-z])([A-Z])/g, '$1-$2'))
    const existing = await repository.findOneBy({ type: 'vacancy_direction', slug })
    if (existing) {
      ids.set(direction.key, existing.id)
      continue
    }
    const created = await documents.create(
      'vacancy_direction',
      {
        shared: { slug, order: index + 1 },
        locales: localesOf(direction.names, (name) => ({ name })),
      },
      actor,
      req,
    )
    ids.set(direction.key, created.id)
    console.log(`  direction ${direction.names.uz}`)
  }
  return ids
}

async function importVacancies(
  app: INestApplicationContext,
  vacancies: ExportedVacancy[],
  directions: Map<string, string>,
  actor: AuthUser,
) {
  const documents = app.get(DocumentsService)
  const repository = app.get(DataSource).getRepository(ContentDocument)
  const newest = Date.now()
  for (const [index, vacancy] of vacancies.entries()) {
    const uz = vacancy.texts.uz
    const directionId = directions.get(vacancy.category)
    if (!uz || !directionId) {
      console.log(`  vacancy ${vacancy.key}: no Uzbek text or direction, skipped`)
      continue
    }
    if (await repository.existsBy({ type: 'vacancy', slug: slugify(uz.title) })) {
      console.log(`  vacancy «${uz.title}» is already there, skipped`)
      continue
    }
    const created = await documents.create(
      'vacancy',
      {
        shared: { directionId, employment: vacancy.employment },
        locales: localesOf(vacancy.texts, (texts) => ({
          title: texts.title,
          city: texts.city,
          description: texts.description,
          requirements: (texts.requirements ?? []).slice(0, 4),
        })),
      },
      actor,
      req,
    )
    await documents.publish(created.id, {}, actor, req)
    const at = new Date(newest - index * 60_000)
    await repository.update(created.id, { firstPublishedAt: at, publishedAt: at })
    console.log(`  vacancy /vacancies/${created.slug}/ — ${uz.title}`)
  }
}

const app = await NestFactory.createApplicationContext(ImportModule, { logger: ['error', 'warn'] })
// One refresh per type at the end instead of one per document: the site is usually rebuilt
// right after the import anyway, and may not be running yet.
const revalidation = app.get(SiteRevalidationService)
revalidation.revalidate = () => {}
try {
  const actor = await actorFor(app, values.as)
  console.log(`Importing from ${bundle.site} as ${actor.email}`)
  if (bundle.posts) {
    console.log(`News (${bundle.posts.length}):`)
    await importPosts(app, bundle.posts, actor)
  }
  if (bundle.vacancies && bundle.vacancyCategories) {
    console.log(`Vacancy directions (${bundle.vacancyCategories.length}):`)
    const directions = await importDirections(app, bundle.vacancyCategories, actor)
    console.log(`Vacancies (${bundle.vacancies.length}):`)
    await importVacancies(app, bundle.vacancies, directions, actor)
  }
  const refreshed = await revalidation.send(
    ['post', 'post_category', 'vacancy', 'vacancy_direction'].map((type) => `content:${type}`),
  )
  console.log(
    refreshed
      ? 'Done. The running site has refreshed its pages.'
      : 'Done. The site was not reachable: its next build shows the imported content.',
  )
} finally {
  await app.close()
}

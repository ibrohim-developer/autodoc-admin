// Reads today's hard-coded content from a checkout of the landing (autodoc-landing) and prints
// it as JSON: news posts, vacancies… with texts in every language and photos as file paths.
// The importer (src/cli/import-site.ts) runs this; on its own:
//   node scripts/export-site-content.mjs --site ../../autodoc-landing > content.json
import { existsSync, readFileSync } from 'node:fs'
import { register } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const { values } = parseArgs({ options: { site: { type: 'string' } } })
if (!values.site) {
  console.error('Usage: export-site-content.mjs --site <path to autodoc-landing>')
  process.exit(1)
}
const site = resolve(values.site)
if (!existsSync(join(site, 'messages', 'uz.json'))) {
  console.error(`Not a landing checkout: ${site}`)
  process.exit(1)
}

register('./site-hooks.mjs', import.meta.url, { data: { site } })

const LOCALES = ['uz', 'ru', 'en']
const messages = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(readFileSync(join(site, 'messages', `${locale}.json`), 'utf8')),
  ]),
)
const perLocale = (pick) =>
  Object.fromEntries(LOCALES.map((locale) => [locale, pick(messages[locale])]))

async function content(name) {
  const file = join(site, 'src', 'content', `${name}.ts`)
  return existsSync(file) ? import(pathToFileURL(file).href) : null
}

const bundle = { site, exportedAt: new Date().toISOString() }

// News: src/content/blog.ts (order = newest first) + Blog.posts.<key> in messages.
const blog = await content('blog')
if (blog?.blogPosts) {
  bundle.posts = blog.blogPosts.map((post) => ({
    id: post.id,
    key: post.key,
    date: post.date,
    link: post.link ?? null,
    imagePosition: post.imagePosition ?? null,
    fullImage: Boolean(post.fullImage),
    image: post.image.src,
    texts: perLocale((m) => m.Blog?.posts?.[post.key] ?? null),
  }))
}

// Vacancies: src/content/vacancies.ts + Career.vacancies in messages.
const vacancies = await content('vacancies')
if (vacancies?.vacancies) {
  bundle.vacancies = vacancies.vacancies.map((vacancy) => ({
    key: vacancy.key,
    category: vacancy.category,
    employment: vacancy.employment,
    texts: perLocale((m) => m.Career?.vacancies?.items?.[vacancy.key] ?? null),
  }))
  const categories = [...new Set(vacancies.vacancies.map((vacancy) => vacancy.category))]
  const allCategories = Object.keys(messages.uz.Career?.vacancies?.categories ?? {})
  bundle.vacancyCategories = [...new Set([...allCategories, ...categories])].map((key) => ({
    key,
    names: perLocale((m) => m.Career?.vacancies?.categories?.[key] ?? null),
  }))
  bundle.employment = perLocale((m) => m.Career?.vacancies?.employment ?? null)
}

process.stdout.write(JSON.stringify(bundle, null, 2))

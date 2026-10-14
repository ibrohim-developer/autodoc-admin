# CLAUDE.md

Guidance for Claude Code in this repo. Human docs: [README.md](README.md). Dashboard
conventions (feature segments, `request()` with Zod, `cn()`, TS 7 traps): [dashboard/CLAUDE.md](dashboard/CLAUDE.md).

## Commands

```bash
pnpm dev:db          # local Postgres 17 on :5433 (embedded, data in api/.pgdata)
pnpm dev:api         # Nest watch mode on :4000
pnpm dev:dashboard   # Vite on :5173, proxies /api and /media/ to :4000
pnpm lint:fix && pnpm typecheck && pnpm test     # before calling anything done
pnpm --filter @autodoc/api test:e2e              # API against a throwaway Postgres
```

## Traps

**The API is ESM (`"type": "module"`, NodeNext).** Relative imports need the `.js` suffix:
`import { User } from './user.entity.js'`. Nest 12 packages are ESM-only.

**Two TypeScript versions on purpose.** `api/` is on TypeScript 6 because the Nest CLI and
TypeORM need the JS compiler API that TypeScript 7 removed; `dashboard/` is on TypeScript 7
like starter-pack. Don't "align" them.

**Migrations are hand-written SQL** in `api/src/database/migrations/` and listed explicitly in
`typeorm.config.ts` (no globs in ESM). They run on API start. Don't use `migration:generate`:
index and constraint names don't follow TypeORM's generated ones.

**Permissions live in two places.** `api/src/auth/permissions.ts` is the authority;
`dashboard/src/lib/session.ts` mirrors the list for typing and the menu. Change both.

**Biome lints both packages** from the root `biome.json`. For `api/**` it turns off
`useImportType` (Nest injects by constructor type, so those imports must stay value imports)
and the React hook rules (`app.useGlobalPipes` is not a hook).

**e2e tests:** `test/test-app.ts` sets the environment *before* importing `AppModule`, because
`ConfigModule` validates at import time, and in tests it ignores `api/.env`. Logins in tests go
through `login()`/`nextIp()` so the per-IP rate limit (10 logins per 15 min) doesn't trip.

**Every admin route is behind the global AuthGuard** unless marked `@Public()`. Give mutating
handlers `@RequirePermission(...)`; the AuditInterceptor logs them automatically (`@Audit()` to
name the action, `@SkipAudit()` when the service writes richer entries itself).

**API errors carry a Russian `message` and a `code`.** The dashboard shows `message` via
`errorMessage()`; branch on `code`, never on the text.

**Dashboard routes never start with `/api` or `/media`.** nginx, the API's static handler and
the Vite proxy send those prefixes to the API, so such a page opens from the menu but 404s on
reload. Медиатека is `/library`; `navigation.test.ts` checks the menu.

**Content types are code, not tables.** One `documents` table holds every type. A type is a
`ContentTypeDef` (zod schemas for shared and per-language fields) registered in
`ContentTypeRegistry`: Uzbek must validate in full, ru/en are partial and fall back to Uzbek
field by field. A new type needs no migration.

**The site tags its fetches with the names the API revalidates:** `content:<type>`,
`content:<type>:<slug>`, `content:doc:<id>` (`refreshSite` in `documents.service.ts`; the
site's `src/lib/content/client.ts`). Rename one side, rename both.

**Preview signing exists twice:** `api/src/content/preview.ts` and the site's
`src/lib/content/preview.ts`. Change both.

**e2e apps use `NestFactory.create`, not `Test.createTestingModule`:** under the testing module
ServeStatic registers a no-op loader and `/media` answers 404. Uploads go to a per-run folder
(`storageDirOf(app)`).

**The rich-text editor is uncontrolled:** `initialValue` is read on mount only. To show other
content, remount it with a new `key`; feeding the value back as a prop drops keystrokes.

**Every content screen is `DocumentEditor`** (`dashboard/src/components/content/`): a section
supplies its form's `empty` / `fromData` / `toData` and the fields. Form field names follow the
document (`locales.uz.title`, `shared.cover`) so the API's error paths land on them. Short
name lists (categories, directions) are `NamedListPage`.

**Site texts keep their changes in `shared.overrides.<locale>`**, not in `locales`: the
content fallback would show Uzbek on the Russian site. The dashboard gets the defaults from the
site (`/api/texts/`, through `GET /api/admin/site-texts/defaults`).

**Page, block and photo keys live in three places:** `api/src/site-content/pages.ts`,
`dashboard/src/features/pages/api/page-specs.ts` and the site's page files. Add a block in all
three.

**Automatic redirects** are written by `DocumentsService` (`REDIRECT_TYPE`) when a live
document's slug changes; the redirect type itself is `site-content/redirects.ts`.

**Dashboard tests that use `useBlocker`** (every editor) need a data router: pass `path` to
`renderWithProviders`. The helper pins the test session in the cache so screens that show
their own spinner first don't lose it.

**The landing's message files are edited as text**, never rewritten through JSON.parse /
stringify: they contain hand-formatted one-line objects, and a reflowed file conflicts with
every parallel edit.

## Commits

Never add Claude as author or co-author (no `Co-Authored-By` / `Claude-Session` trailers):
this goes to the company GitLab.

# CLAUDE.md

Guidance for Claude Code working in the dashboard. Full docs for humans are in
[README.md](README.md) — this file covers only what is easy to get wrong. Repo-wide rules
(API, permissions, commits) are in [../CLAUDE.md](../CLAUDE.md).

**Session and permissions** come from `src/lib/session.ts` (`useSession`, `useMe`, `useCan`).
Screens behind login use `useMe()`; wrap a route in `<RequirePermission>` in `app/router.tsx`
and add its menu entry in `app/navigation.ts`. UI text is Russian, written inline.

## Commands

```bash
pnpm dev              # dev server on :5173
pnpm lint:fix         # Biome: format + safe fixes — run after editing
pnpm typecheck        # tsc --noEmit (TypeScript 7 native compiler)
pnpm test:run         # Vitest once
pnpm e2e              # Playwright (boots the dev server itself)
```

Before calling any change done: `pnpm lint:fix && pnpm typecheck && pnpm test:run`.

## Traps — these differ from the common defaults

**Do not add ESLint or `typescript-eslint`.** This project is on TypeScript 7, whose npm
package no longer exposes the JS compiler API (`"." → ./lib/version.cjs`, everything else
under `./unstable/*`). `@typescript-eslint/typescript-estree` peers on
`typescript >=4.8.4 <6.1.0` and calls that API for plain parsing — its parser cannot load
at all on TS 7. **Biome** is the linter and formatter here and handles both.

**`pnpm ci` is a reserved pnpm command** and never reaches package.json. The script is
`pnpm lint:ci`.

**TypeScript 7 removed `baseUrl`.** `paths` in tsconfig.json resolve relative to the config
file. Do not add `baseUrl` back — `tsc` errors out. TS 7 also ships no `tsserver`, so do
not set `typescript.tsdk` in VS Code settings.

**Routing imports come from `react-router`, not `react-router-dom`.** The `-dom` package
stopped at 7.18.2 and was never published for v8. Data mode: `createBrowserRouter` +
`RouterProvider`.

**Zod 4 moved string formats to the top level.** Write `z.email()`, `z.url()`, `z.uuid()`
— not `z.string().email()`.

**Tailwind v4 has no `tailwind.config.js`.** Design tokens live in the `@theme` block in
[src/styles/index.css](src/styles/index.css); dark mode is the `@custom-variant dark` there.
Do not create a config file.

**Formatting is Biome's job.** Don't hand-format; run `pnpm lint:fix`. Biome config quirks
already settled: `linter.rules.preset` (not the deprecated `recommended`),
`css.parser.tailwindDirectives: true` so `@theme` parses, and two rules scoped off via
`overrides` for `src/components/ui/**` and `src/styles/**`.

## Conventions

**Feature segments.** Every feature in `src/features/<name>/` uses the same layout:
`api/` (fetch functions + Zod schemas), `components/`, `hooks/` (query keys + Query hooks),
`pages/`, and `index.ts`. Create a segment only when there is something to put in it.

**Import features through their barrel.** `import { PostsPage } from '@/features/posts'` —
never a path into the feature. Anything not re-exported from `index.ts` is private.

**A feature never imports another feature.** Shared code goes in `lib/`, `components/` or
`stores/`. (There is deliberately no `shared/` folder — those three are the shared layer.)

**All HTTP goes through `request()`** in [src/lib/api-client.ts](src/lib/api-client.ts),
which requires a Zod `schema` and returns the inferred type. Never call `fetch` directly in
a feature — that is how unvalidated data reaches components.

**Class names go through `cn()`** from `@/lib/cn` so `className` props can override
component defaults.

**Tests sit beside the code** they cover, inside the segment (`components/foo.test.tsx`).
Use `renderWithProviders` from `@/test/render-with-providers` (fresh QueryClient per test,
retries off, MemoryRouter). Stub the network with
`vi.stubGlobal('fetch', stubFetchJson(...))`; `src/test/setup.ts` unstubs after each test.
Playwright specs mock via `page.route()`. `e2e/**` is excluded from Vitest in
vite.config.ts — Vitest's default include would otherwise swallow the `.spec.ts` files.

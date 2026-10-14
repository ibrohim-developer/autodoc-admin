# autodoc.uz admin — dashboard

The admin UI, in Russian. Built from the team's `starter-pack`: the stack, layout and rules
below are the starter's, unchanged. The API and how to run everything together are described
in the [repo README](../README.md).

```bash
pnpm dev          # http://localhost:5173 — proxies /api to the API on :4000
```

No `.env` needed to start: `VITE_API_URL` defaults to `/api` on the same origin, as in production.

Features so far: `auth` (login with optional 2FA, invite and reset links), `users` (roles,
invites, disable, 2FA reset), `profile` (password, 2FA setup, recovery codes). The menu lists
every planned section and marks the ones not built yet as «скоро».

## Stack

| Concern        | Choice                          | Version |
| -------------- | ------------------------------- | ------- |
| Build          | Vite                            | 8.2.1   |
| UI             | React                           | 19.2.8  |
| Language       | TypeScript (native Go compiler) | 7.0.2   |
| Routing        | react-router (data mode)        | 8.3.0   |
| Server state   | TanStack Query                  | 5.101.4 |
| Forms          | react-hook-form + Zod           | 7.85.0 / 4.4.3 |
| Client state   | Zustand                         | 5.0.15  |
| Styling        | Tailwind CSS + shadcn/ui        | 4.3.3   |
| Lint + format  | Biome                           | 2.5.8   |
| Unit tests     | Vitest + Testing Library        | 4.1.10  |
| E2E tests      | Playwright                      | 1.62.1  |

## Scripts

| Script            | Does                                                     |
| ----------------- | -------------------------------------------------------- |
| `pnpm dev`        | Dev server on :5173                                       |
| `pnpm build`      | Typecheck, then production build                          |
| `pnpm preview`    | Serve the production build locally                        |
| `pnpm typecheck`  | `tsc --noEmit` (TS 7 native compiler)                     |
| `pnpm lint`       | Biome check — lint + format + import order, read-only     |
| `pnpm lint:fix`   | Same, writing safe fixes                                  |
| `pnpm format`     | Format only                                               |
| `pnpm lint:ci`    | Non-writing check used by CI (not `ci` — pnpm reserves that name) |
| `pnpm test`       | Vitest in watch mode                                      |
| `pnpm test:run`   | Vitest once                                               |
| `pnpm test:coverage` | Vitest with a v8 coverage report                       |
| `pnpm e2e`        | Playwright (starts the dev server itself)                 |
| `pnpm e2e:ui`     | Playwright in UI mode                                     |

## Project layout

```
src/
├─ app/          router, providers, root layout, shared pages
├─ features/     posts/, contact/ — self-contained, see segments below
├─ components/   ui/ primitives (button, input, label, textarea, card) + shared components
├─ lib/          api-client, cn, env
├─ stores/       global client state (theme)
├─ styles/       Tailwind entry + design tokens
└─ test/         setup, render helper, fixtures
e2e/             Playwright specs
```

### Feature segments

Every feature uses the same four segments, so there is never a question about where a file
goes:

```
src/features/posts/
├─ api/          HTTP calls + Zod schemas      posts-api.ts
├─ components/   feature-owned components      create-post-form.tsx (+ test)
├─ hooks/        query keys + Query hooks      post-keys.ts, use-posts.ts, use-create-post.ts
├─ pages/        route entry points            posts-page.tsx (+ test)
└─ index.ts      the feature's public surface
```

Create a segment when you have something to put in it — `contact/` has no `hooks/` because
it has no hooks yet. Tests live beside the code they cover, inside the segment.

### The two structural rules

1. **Import features through their barrel.** `app/router.tsx` does
   `import { PostsPage } from '@/features/posts'`, never from a file inside it. Whatever
   `index.ts` doesn't re-export is private, so you can move things between segments freely.
2. **A feature never imports another feature.** It may import from `lib/`, `components/`
   and `stores/`. When two features need the same thing, move it down into one of those.

Together these keep a feature deletable in one `rm -rf`, and mean the shared layers would
lift cleanly into a `packages/` workspace if you ever add a second app.

There is deliberately no `shared/` folder and no `packages/` workspace — `lib/`,
`components/` and `stores/` are already the shared layer, and a monorepo only pays for
itself with multiple deployable apps.

## Things worth knowing

### Why Biome instead of ESLint + Prettier

**Don't try to re-add `typescript-eslint` — it cannot work on TypeScript 7.**

TS 7 (the native Go compiler) no longer exposes the JavaScript compiler API. Its package
exports are `"." → ./lib/version.cjs` — the main entry is a version string — with the rest
moved to `./unstable/*` subpaths, and it ships no `tsserver` binary.
`@typescript-eslint/typescript-estree` peers on `typescript >=4.8.4 <6.1.0` and calls that
API for plain parsing, not just for type information. On TS 7 its parser cannot load at
all, so ESLint could not lint `.ts`/`.tsx` files.

Biome is Rust-based with its own TS/TSX parser and never touches the TS compiler API, so it
works. Tracking issue for the eventual fix:
[typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)
— it is blocked on ESLint core gaining async parser support, with no milestone. If it ever
lands, swapping `biome.json` for `eslint.config.js` touches config only; no source moves.

Trade-offs accepted: no ESLint plugin ecosystem, and no type-aware rules. The important
react-hooks rules are covered by Biome's `useExhaustiveDependencies` and `useHookAtTopLevel`
(both `correctness`, both on).

### TypeScript 7 notes

- `baseUrl` was **removed**. `paths` in `tsconfig.json` now resolve relative to the config
  file, which is why there is no `baseUrl` entry.
- VS Code cannot use TS 7 as its language service (no `tsserver`), so it falls back to its
  bundled TypeScript for IntelliSense. `pnpm typecheck` is the source of truth.

### Styling

Tailwind v4 has **no `tailwind.config.js`**. Everything lives in
[`src/styles/index.css`](src/styles/index.css): the `@theme` block defines design tokens,
and `@custom-variant dark` wires class-based dark mode. Add tokens there, not in a config
file.

`cn()` in [`src/lib/cn.ts`](src/lib/cn.ts) merges classes so a `className` prop can
override a component's defaults — `cn('px-4', 'px-8')` yields `px-8`, not both.

### Adding shadcn/ui components

The four primitives in `src/components/ui/` are vendored by hand. For more:

```bash
pnpm dlx shadcn@latest add dialog
```

`components.json` is already configured. The CLI brings its own TypeScript (via `ts-morph`),
so TS 7 in this project doesn't affect it.

### Data fetching

[`src/lib/api-client.ts`](src/lib/api-client.ts) wraps `fetch` with a base URL, typed errors
(`ApiError` carries the status, `ApiParseError` carries Zod issues) and **response
validation**. The return type is inferred from the Zod schema you pass, so unvalidated data
cannot reach a component. See `src/features/posts/` for the pattern: `api.ts` (schemas +
functions) → `queries.ts` (key factory + hooks) → page.

### Environment variables

Parsed and validated once by [`src/lib/env.ts`](src/lib/env.ts). `VITE_API_URL` has a
default so the starter runs with no setup; for a real secret, drop the `.default()` so a
missing value fails the build instead of pointing somewhere wrong. Copy `.env.example` to
`.env` to override.

### Git hooks

`.husky/pre-commit` runs `lint-staged`, which runs `biome check --write` on staged files
only. Formatting is fixed automatically; unfixable lint errors block the commit. Bypass with
`git commit --no-verify`. CI is the real gate — the hook is a convenience.

## Testing

Unit tests sit next to the code they cover (`*.test.tsx`). Use `renderWithProviders` from
[`src/test/render-with-providers.tsx`](src/test/render-with-providers.tsx) — it wraps the UI
in a **fresh** QueryClient per test (retries off) plus a `MemoryRouter`, and returns a
`user` from `user-event`.

Network is stubbed with `vi.stubGlobal('fetch', stubFetchJson(...))`; `setup.ts` unstubs
after each test. Playwright specs mock at the network layer with `page.route()`, so neither
suite depends on the live demo API.

Vitest's default include pattern matches `*.spec.ts`, so `e2e/**` is explicitly excluded in
`vite.config.ts` — otherwise Vitest would try to run the Playwright specs.

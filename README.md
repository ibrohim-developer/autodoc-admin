# autodoc-admin

The admin panel for [autodoc.uz](https://autodoc.uz): marketing and HR edit the site, handle
form submissions and job applications, and see site statistics, without a developer.

**Plan, stages and status: [docs/ROADMAP.md](docs/ROADMAP.md).**

| Folder | What | Stack |
| --- | --- | --- |
| [`api/`](api/) | REST API, auth, roles, audit log; serves the built dashboard | NestJS 12, TypeORM 1, PostgreSQL 17, TypeScript 6 |
| [`dashboard/`](dashboard/) | The admin UI (Russian) | Vite 8, React 19, TanStack Query, Tailwind 4 + shadcn, TypeScript 7 — from `starter-pack` |
| [`deploy/`](deploy/) | pm2, nginx, deploy and backup scripts | |

The public site is a separate repo (`autodoc-landing`, Next.js). It reads content from this API
server-to-server and posts its forms to it.

## Local development

Needs Node 22+ and pnpm 10. No system Postgres: `pnpm dev:db` runs real Postgres 17 binaries from
the `embedded-postgres` dev dependency, with data in `api/.pgdata`.

```bash
pnpm install
cp api/.env.example api/.env           # works as is for local development
pnpm dev:db                            # terminal 1: Postgres on :5433, Ctrl+C stops it
pnpm --filter @autodoc/api build && pnpm --filter @autodoc/api user:create-admin --email you@autodoc.uz --name "Имя Фамилия"
pnpm dev:api                           # terminal 2: API on :4000 (migrations run on start)
pnpm dev:dashboard                     # terminal 3: http://localhost:5173 (proxies /api and /media/ to :4000)
```

The admin CLI prints a one-time link; open it to set your password, then log in.
API docs (development only, `SWAGGER=true`): http://localhost:4000/api/docs

## Checks

```bash
pnpm lint            # Biome, both packages
pnpm typecheck
pnpm test            # unit tests (Vitest) in api/ and dashboard/
pnpm --filter @autodoc/api test:e2e    # API end to end against a throwaway Postgres
```

## Content and the site

- Every content item (news post, vacancy, page…) is a document: shared fields plus fields per
  language, checked against its type's schema (Uzbek required). Editors change a working copy;
  publishing makes a snapshot, and the site only ever reads snapshots.
- The site reads `GET /api/v1/content/…` on `127.0.0.1:4000` with the `x-site-token` header.
  The API fills missing ru/en fields from Uzbek.
- After a change the API calls the site's `/api/revalidate/` with the cache tags of what
  changed, so the page updates at once. Failures are retried and logged; publishing never waits.
- "Предпросмотр" gives a signed link to the site's `/api/draft/`, valid 10 minutes, which turns
  on Next's draft mode in that browser.
- Photos: `POST /api/admin/media` → WebP copies from 320 up to 2560 px wide (never wider than
  the original) in `storage/public/media`, served at `/media/`; the original goes to
  `storage/private`. A photo in use can't be deleted.
- Deleted items and photos wait 30 days in Корзина; a nightly job removes older ones.

## Forms and statistics

- The site's forms post from the visitor's browser to `POST /api/v1/leads` and
  `/api/v1/applications`, and its script reports page views to `/api/v1/collect`. Contracts:
  [docs/site-integration.md](docs/site-integration.md).
- Resumes are kept in `storage/private/resumes` and only come out through
  `GET /api/admin/applications/:id/resume` (logged).
- Telegram alerts: **Интеграции** in the dashboard (bot token, two chats). `TELEGRAM_API_URL`
  only changes in tests.
- Statistics keep no cookies and no addresses: see the Stage 5 notes in the roadmap.

The content types are in [`api/src/site-content/`](api/src/site-content/): news and their
categories, vacancies and directions, site texts, settings, the seven pages, the privacy policy
and terms, redirects. When a live page's address changes, redirects from the old address are
made automatically.

### Moving the site's current content in

Once per environment, before the site starts reading from the admin:

```bash
pnpm --filter @autodoc/api build
pnpm --filter @autodoc/api content:import --site ../../autodoc-landing --as admin@autodoc.uz
```

It reads the landing checkout's hard-coded news and vacancies (so point it at a version that
still has them, e.g. `main` before the switch), uploads their photos to the media library and
publishes them in the same order and at the same addresses. Run again, it skips what exists.

## Roles

The permission map is [`api/src/auth/permissions.ts`](api/src/auth/permissions.ts). The dashboard
builds its menu and routes from `GET /api/admin/auth/me`, and every admin endpoint checks the
same permissions, so a hidden screen also answers 403 when called directly.

| | Администратор | Маркетинг | HR |
| --- | --- | --- | --- |
| Site content, media, settings | ✓ | ✓ | — |
| Vacancies, applications | ✓ | ✓ | ✓ |
| Form submissions (leads) | ✓ | ✓ | — |
| Statistics | all | all | vacancies only |
| Users | ✓ | invite/manage Маркетинг and HR | — |
| Audit log, integrations | ✓ | — | — |

## Security in short

- Sessions: 15-minute access token and a rotating 14-day refresh token, both in httpOnly,
  SameSite=Strict cookies. A refresh token presented again after rotation ends that login on
  every device. Logout, deactivation and password changes take effect on the next request.
- Optional TOTP 2FA per user (any authenticator app) with 10 one-time recovery codes; secrets
  are AES-256-GCM encrypted at rest (`DATA_ENCRYPTION_KEY`).
- 5 wrong passwords lock an account for 15 minutes; login is also rate-limited per IP.
- State-changing admin requests from another origin are refused.
- Invite and reset links carry their token in the URL fragment, so it never reaches a log.
- Every change through the admin API is written to the audit log.

## Production

One Linux server in Uzbekistan (Ubuntu 24.04): Node 22 LTS, pnpm, pm2, nginx, PostgreSQL 17.

1. Create the database and `api/.env` from `api/.env.example` with real secrets
   (`openssl rand -base64 48` for `JWT_ACCESS_SECRET`, `openssl rand -base64 32` for
   `DATA_ENCRYPTION_KEY`), `NODE_ENV=production`, `COOKIE_SECURE=true`, `SWAGGER=false`,
   `ADMIN_ORIGIN=https://admin.autodoc.uz`, `SITE_ORIGIN=https://autodoc.uz`. `SITE_API_TOKEN`,
   `REVALIDATE_SECRET` and `PREVIEW_SECRET` (`openssl rand -base64 48` each) go into the site's
   `.env` too, with the same values.
2. `bash deploy/deploy.sh`, then `pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup`.
3. nginx: [`deploy/nginx.conf`](deploy/nginx.conf) for `admin.autodoc.uz` (HTTPS required:
   the cookies are Secure). The public endpoints are routed from the `autodoc.uz` block in the
   landing repo.
4. First administrator: `pnpm --filter @autodoc/api user:create-admin --email … --name "…"`.
5. Backups: [`deploy/backup.sh`](deploy/backup.sh) from cron (database + uploaded files, 14
   daily and 8 weekly, mirrored to a second machine). Test a restore into a scratch database
   once a month.

Deploys after that: push to `main`; [`.gitlab-ci.yml`](.gitlab-ci.yml) runs the checks and then
`deploy/deploy.sh` over SSH. Not zero-downtime: the API restarts for a few seconds.

`DATA_ENCRYPTION_KEY` can't be changed casually: it decrypts the 2FA secrets, and with a new key
every user has to set 2FA up again.

# Security pass (Stage 8, 2026-10-14)

What was checked before go-live, how, and what changed. Re-run the automated parts with
`pnpm --filter @autodoc/api test:e2e` (`test/security.e2e-spec.ts` and the specs per module).

## Sign-in and sessions

| Check | Result |
|---|---|
| Unknown email and wrong password answer the same (`invalid_credentials`), with the same password-hash cost | ✓ (`burnPasswordCheck`) |
| 5 wrong passwords lock the account for 15 minutes; 10 logins per 15 minutes per address | ✓ tested in `auth.e2e-spec.ts` |
| Access cookie 15 min, refresh 14 days, both httpOnly + SameSite=Strict (+ Secure in production) | ✓ |
| A refresh token used twice ends that login everywhere | ✓ |
| Deactivation, logout and password change take effect on the next request | ✓ |
| 2FA secrets and recovery codes encrypted / hashed at rest | ✓ AES-256-GCM, `DATA_ENCRYPTION_KEY` |
| Invite and reset tokens never reach a server log (URL fragment) | ✓ |
| System accounts (the hh.uz import) can't log in, aren't listed, can't be re-enabled | ✓ new in Stage 7 |

## Access control

| Check | Result |
|---|---|
| Every `/api/admin` route answers 401 without a session (all 60+ swept from the route table) | ✓ `security.e2e-spec.ts` |
| Each role gets 403 on what it may not do (content, leads, statistics tabs, integrations, audit) | ✓ per-module e2e specs |
| State-changing admin requests from another origin are refused | ✓ |
| The site's content API requires `x-site-token`; the public form endpoints refuse other origins | ✓ |

## Uploads and files

| Check | Result |
|---|---|
| Photos re-encoded to WebP (metadata stripped, SVG refused, decompression bombs refused) | ✓ |
| Resumes recognised by content: PDF, Word 97–2003, Word 2007+ without macros; 10 MB limit before the disk | ✓ |
| Resumes stored under random names with mode 600 in `storage/private`, which is never served — `../` tricks included | ✓ `security.e2e-spec.ts` |
| Resume downloads: attachment, `nosniff`, `no-store`, permission checked, each one logged | ✓ |
| Excel exports write text as text: a cell starting with `=` is not a formula | ✓ |

## Headers and caching

| Check | Result |
|---|---|
| CSP (`default-src 'self'`, `frame-ancestors 'none'`), `nosniff`, Referrer-Policy, COOP/CORP, HSTS in production | ✓ helmet |
| `Permissions-Policy` (no camera, microphone, location, payment) | **added** |
| Admin answers (names, phones) are `Cache-Control: no-store`, without ETag | **added** — before, browsers and proxies could keep them |
| No `X-Powered-By` | ✓ |

## Personal data

| Check | Result |
|---|---|
| Telegram alerts carry no names, phones or messages | ✓ tested |
| Visitors' IP addresses are never stored (forms: keyed hash for limits, a day; statistics: daily-salted hash) | ✓ tested |
| Retention: applications 12 months, submissions 24, audit 12, statistics 13, trash 30 days | ✓ nightly job, tested |
| Bot and hh tokens encrypted, never sent back to the dashboard, never in the audit log | ✓ tested |

## Dependencies

`pnpm audit --prod`: no known vulnerabilities (2026-10-14). Versions are pinned exactly and the
lockfile decides; run `pnpm audit` before every release.

## For the server (not checkable from the code)

- HTTPS only for both domains, `COOKIE_SECURE=true`, `SWAGGER=false`, `NODE_ENV=production`.
- The API listens on `127.0.0.1` only; nginx is the only way in, and it doesn't route
  `/api/v1/content` or `/api/v1/redirects` from outside.
- `api/.env` readable by the deploy user only (`chmod 600`); `storage/private` likewise.
- Optional: allow `admin.autodoc.uz` from the office network and VPN only (`deploy/nginx.conf`).
- Backups mirrored to the second machine; `deploy/restore-test.sh` monthly from cron.

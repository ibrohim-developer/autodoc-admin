# autodoc.uz admin — roadmap

What we are building, in what order, and where each stage stands. Updated at the end of every
stage. How to run things is in the [README](../README.md).

**Goal:** marketing and HR update autodoc.uz without a developer, handle form submissions and
job applications, and see site statistics. Based on the spec «ТЗ: админ-панель сайта autodoc.uz»
([SPEC.md](SPEC.md)).

## Status

| # | Stage | Estimate | Status |
|---|---|---|---|
| 1 | Foundations: repo, auth, roles, users, audit log, deploy, site on `next start` | 9–11 days | **Done** (2026-10-13) |
| 2 | Content core: drafts and publishing, history, trash, scheduling, media library, editor | 12–14 days | **Done** (2026-10-13) |
| 3 | Content screens and site wiring: news, vacancies, projects, pages, site texts, settings, redirects | 16–20 days | **In progress** — all but Projects done (2026-10-14) |
| 4 | Forms: form submissions and job applications, resumes, Telegram, Excel | 7–9 days | **Admin side done** (2026-10-14); site wiring left |
| 5 | Cookie banner, tracking codes, own statistics, start-screen widgets | 9–11 days | **Admin side done** (2026-10-14); banner and script on the site left |
| 6 | Audit log screen, data retention, backups and restore test | 3–4 days | **Done** (2026-10-14) |
| 7 | hh.uz import | 3–4 days | **Done** (2026-10-14); needs the hh application token |
| 8 | Hardening: browser tests of key flows, security pass, docs | 6–8 days | **Done** for the admin (2026-10-14); repeat on the site once it is wired |
| | **Total** | **~65–81 days (≈3–4 months, one developer)** | |

## Decisions

- **Own backend on NestJS + our own dashboard**, not Strapi: no vendor and no paid tiers, so a
  future request from marketing can never be blocked by a pricing plan. About twice the effort;
  accepted.
- **Servers in Uzbekistan** (personal data of Uzbek citizens must be stored in the country).
- **Statistics are our own**; GA4 and Yandex Metrica data are not rebuilt inside the admin.
- **Page blocks:** show/hide only, no reordering. Blog = News.
- **Page editing:** every text and button, each block's main photo, the holding numbers. Of the
  other sections only Projects becomes a content type; partners, leaders, history and reels stay
  in code (their texts are still editable).
- **Languages:** Uzbek is required; a missing Russian or English translation falls back to Uzbek.
- **Roles:** Администратор, Маркетинг (full access, applications included), HR.
- **Telegram alerts:** plain text with no personal data.
- **Forms:** rate-limited, resume up to 10 MB, consent checkbox on the resume form too.
- **2FA:** optional per user (can be made mandatory later).
- **Form submissions** get the same status + comment workflow as job applications.
- **No video file uploads** for now (YouTube / Instagram links only).
- **Privacy policy:** written by marketing, reviewed by the lawyer.

### Answers given during planning

- **Cookie "Reject":** we can't load GA4, Metrica or Meta Pixel or set tracking cookies. We can
  still keep form submissions (they have their own consent), strictly necessary cookies, and our
  own anonymous statistics (no cookies, IP never stored, a hash that changes daily). To be
  disclosed in the privacy policy; the lawyer confirms the wording.
- **Hiding pages per role:** one permission list in the API drives the dashboard menu, the
  dashboard routes and the API's 403 answers.

## Architecture

```
autodoc.uz                       nginx → Next.js `next start` (pm2, :3000)
autodoc.uz/api/v1/{leads,applications,collect}
                                 nginx → admin API public endpoints (pm2, :4000)
autodoc.uz/media/*               nginx → api/storage/public/media (uploaded photos)
admin.autodoc.uz                 nginx → admin API: dashboard + /api/admin/*
PostgreSQL 17 on the same server; resumes in api/storage/private (never served)
```

- The site reads content server-to-server (`127.0.0.1:4000/api/v1`, with a site token) and gets
  published content only.
- Publishing calls the site's `/api/revalidate`, so changes appear without a rebuild.
- "Предпросмотр" opens the real site in draft mode with a short-lived signed link.

| Repo | Stack |
| --- | --- |
| `autodoc-admin/api` | NestJS 12, TypeORM 1, PostgreSQL 17, TypeScript 6, Vitest |
| `autodoc-admin/dashboard` | from `starter-pack`: Vite 8, React 19, TanStack Query, Tailwind 4 + shadcn, TypeScript 7 |
| `autodoc-landing` | Next.js 16, next-intl (site changes live in branch `feat/admin-platform`) |

## Roles

| Screen | Администратор | Маркетинг | HR |
|---|---|---|---|
| Главная (widgets) | all | leads, applications, views, drafts | applications, vacancy drafts |
| Новости, Проекты, Страницы, Тексты сайта, Настройки сайта, Медиатека, Редиректы | ✓ | ✓ | — |
| Вакансии, Направления, Отклики | ✓ | ✓ | ✓ |
| Заявки | ✓ | ✓ | — |
| Статистика | all tabs | all tabs | vacancies tab |
| Корзина | ✓ | ✓ | vacancies and applications |
| Пользователи | ✓ | Маркетинг and HR accounts | — |
| Журнал действий, Интеграции | ✓ | — | — |

## Stage 1 — Foundations (done)

- **Admin repo:** `api/` + `dashboard/` + `deploy/`, one pnpm workspace, Biome, GitLab CI
  (checks, then SSH deploy like portal24).
- **Sign-in:** 15-minute session renewed silently; a stolen refresh token used again ends that
  login everywhere; 5 wrong passwords lock the account for 15 minutes; login rate-limited per IP.
- **2FA:** optional, any authenticator app, 10 one-time recovery codes; secrets encrypted.
- **Users:** invite by one-time link, change role, disable (signs out at once), new password
  link, reset 2FA. Marketing manages Маркетинг/HR accounts only.
- **Audit log:** every change in the admin, plus sign-ins and failures.
- **Deploy kit:** pm2, nginx for both domains, deploy script, nightly backups (14 daily + 8
  weekly, mirrored to a second machine).
- **Site:** runs on `next start` + `proxy.ts` instead of a static export; every URL answers as
  before, no language cookie. Not merged: it must wait for the new server.
- **Checked:** 43 API tests and 31 dashboard tests; invite → set password → log in → 2FA → log
  out in a real browser; the built dashboard served by the API.

## Stage 2 — Content core (done)

The base every content section runs on. Built once, reused by news, vacancies, projects, pages
and settings in Stage 3.

- **Content documents.** Every content item (a news post, a vacancy, a page…) is one document:
  shared fields plus one block of fields per language. The type's schema validates it; Uzbek is
  required.
- **Drafts and publishing.** Editors change a working copy; the site sees only what was last
  published. "Есть неопубликованные изменения" when the two differ. Unpublish takes it off the site.
- **Two editors at once:** the second save is refused instead of silently overwriting the first.
- **Scheduled publishing:** publish at a set date and time (checked every minute).
- **Version history:** every save and publish is kept (last 100 per item); any version can be
  restored into the working copy.
- **Trash:** deleted items stay 30 days and can be restored, then are removed for good.
- **Translations:** a missing Russian or English field shows the Uzbek one on the site.
- **Site refresh:** publishing tells the site exactly which pages to rebuild; failures are retried
  and logged, never block publishing.
- **Preview:** a short-lived signed link opens the real site showing the draft.
- **Media library:** photo upload up to 20 MB, automatic compression into sizes for phone,
  tablet and desktop (WebP), rotation fixed and camera metadata removed, alt text in uz/ru/en,
  "where is it used", deleting a photo that is in use is refused.
- **Text editor:** headings, bold/italic, lists, quotes, links, photos from the media library.
  Content is stored as structured data, not HTML, so no script can be smuggled into the site.
- **Site side:** renderer for editor content; `/api/revalidate` (secret and tag check, refused
  from outside by nginx); `/api/draft` (signed link → draft mode) with a preview bar and
  "Выйти из предпросмотра". Every page is still prerendered; only previews render live.
- **Visible in the dashboard:** Медиатека (`/library`) and Корзина. Drafts, history, scheduling
  and the preview button get their screens with the first content editor in Stage 3.
- **Checked:** 50 API unit tests, 49 API end-to-end tests, 46 dashboard tests. In a real browser:
  upload → alt text → delete → Корзина → restore, duplicate detection, search by description.
  On the site: 21 checks of preview links and cache refresh, with links signed by the API's own
  code; changed, expired and off-site links are refused.

## Stage 3 — Content screens and site wiring (in progress: Projects left)

Every section uses one editor: language tabs, Сохранить / Опубликовать, preview on the real site,
history, scheduling, unsaved-changes warning, Ctrl+S.

- **Новости и блог:** the article has three fixed sections: text (photos go between paragraphs),
  gallery and video link (YouTube / Instagram Reels, the player loads only on click); cover with a
  focus point for the card crop, date, category, pin, tags, SEO with length counters and a search
  snippet, social image. The list has tabs by state with counts, a category filter, views per
  post, and pins or trashes a post in one click (pinning a live post changes the site at once
  and leaves other edits unpublished). Categories filter the news list on the site. Imported
  posts keep their addresses (/blog/14/). One section, as before: no separate «Новость» / «Блог»
  type. Video only by link, not as a file. The admin's look follows the Claude Design handoff
  «News Admin» (dark sidebar, Onest).
- **Вакансии:** direction, employment (full-time, part-time, remote, internship), city, short
  description, up to 4 requirements, full description. **New:** each vacancy has its own page
  (/vacancies/<address>/) with the apply button; a closed vacancy leaves the list and its page
  says so. Directions are a list HR edits.
- **Страницы:** for each of the 7 pages, SEO texts per language, which blocks show, and the main
  photos (empty = the design's photo). Also the privacy policy and terms: the footer links
  appear once they are published.
- **Тексты сайта:** all 300+ texts and buttons by section, per language, with search and
  "только изменённые". Only changes are stored; the code's texts stay the default, and an
  untranslated change never shows Uzbek on the Russian site. A change that drops a {placeholder}
  is refused (and ignored by the site, so a page can't break). Holding numbers are here too.
- **Настройки сайта:** phone, email, LinkedIn / Instagram, the office's map pin, menu order and
  visibility (labels are in Тексты сайта).
- **Редиректы:** by hand (301 or 302), and automatic when a live page's address changes, in
  every language and without chains. The site applies them within a minute.
- **404 page:** in the visitor's language, with header and footer; its texts are editable.
- **Import:** `pnpm --filter @autodoc/api content:import --site <landing checkout> --as <email>`
  moves today's news and vacancies into the admin (photos into the media library, same order,
  same addresses). Safe to run again.
- **Checked:** 69 API end-to-end and 53 unit tests, 58 dashboard tests; in a real browser:
  create → preview → publish a post, translations, pinning, closing a vacancy, editing a site
  text, hiding a block, menu settings, privacy page, redirects by hand and on rename — each
  showing on the site without a rebuild.
- **Left: Проекты.** The project section is being redesigned in the landing's main checkout
  (project pages with posters, new projects). It moves to the admin once that work is committed,
  so the content type matches it.

### Go-live order for the site switch

1. Server with both apps; the admin API's database migrated, the first administrator created.
2. Import from the landing's `main` as it is then (it still has the content in code):
   `content:import --site /var/www/autodoc-landing --as admin@autodoc.uz`.
3. Deploy the landing's `feat/admin-platform` (merged into main): from then on it reads the
   admin. Its build needs the API running.

## Stage 4 — Forms (admin side done; the site's forms still to wire)

- **Заявки:** submissions of the site's forms (today: «Обратная связь») with status (Новая, В
  работе, Обработана, Спам) and a comment; tabs with counts, search (name, phone, text, №),
  period, Excel export, trash.
- **Отклики:** applications from the resume form, plus candidates HR adds by hand with their
  source (hh.uz, Instagram, Telegram, LinkedIn, рекомендация, другое). Statuses: Новый, На
  рассмотрении, Собеседование, Принят, Отказ. Filters by vacancy («другая позиция» too),
  source, period; Excel export; trash. An application keeps its vacancy's title even after
  the vacancy is deleted.
- **Resumes:** PDF/DOC/DOCX up to 10 MB, recognised by content (an HTML file named .pdf, an
  Excel file or a macro-enabled Word file is refused), stored in `storage/private/resumes`,
  downloadable only with `applications.read`; each download is in the audit log. Deleted with
  the application when it leaves the trash.
- **Public endpoints** `POST /api/v1/leads` and `/api/v1/applications`: 5 per 10 minutes and
  20 a day per form and address (counted by a keyed hash, kept a day), honeypot field,
  consent required, other sites' origins refused.
- **Telegram** (Интеграции, administrator only): bot token stored encrypted and never shown
  again, a chat for marketing (submissions) and one for HR (applications), "Проверить" sends a
  test message to each. Alerts carry the number, the form or vacancy and a link — no names,
  phones or texts.
- **Checked:** e2e tests for every rule above (limits, honeypot, origin, consent, file
  checks, vacancy closed, permissions per role, trash with the file, Telegram without
  personal data), the Excel file opened with a spreadsheet library; in a real browser:
  lists, cards, status and comment, resume download, export.
- **Left on the site** ([site-integration.md](site-integration.md)): post the two forms to
  the API, add the consent checkbox to the resume form, route the endpoints in nginx.

## Stage 5 — Cookies and statistics (admin side done; banner and script on the site left)

- **Own statistics without cookies:** the site's script reports page views and time on page
  to `/api/v1/collect`. A visitor is a hash of address + browser + a salt that is deleted
  after the day: visitors are counted per day and can never be followed across days or traced
  back. Addresses are never stored; bots are skipped.
- **Статистика**, a tab per permission: *Общая* (visitors, views, time on page with the
  change against the previous period, visitors per day, sources with top referrers,
  devices, languages, top pages, submissions and applications), *Новости* (views, readers
  and reading time per post), *Вакансии* (career page, views → applications per vacancy,
  conversion). HR sees *Вакансии* only. 7/30/90 days or a year.
- **Tracking codes:** GA4, Yandex Metrica and Meta Pixel ids in **Настройки сайта**, checked
  for format; the site loads them only after "Принять".
- **Start screen:** new applications and submissions with the latest five, the week's views
  (the whole site, or the vacancies for HR) and drafts in the sections the user edits.
- **Checked:** e2e tests for collecting (bots, other origins, nothing personal stored, the
  salt dropped at night), every report, the widgets per role, and the tracking ids; in a real
  browser the statistics and start screen with seeded data, on desktop and phone.
- **Left on the site** ([site-integration.md](site-integration.md)): the cookie banner
  (Accept all / Reject / Configure, texts in the message files), loading the counters after
  consent, and the statistics script.

## Stage 6 — Audit log screen, retention, backups (done)

| Data | Kept |
|---|---|
| Applications + resumes | 12 months after the last change |
| Form submissions | 24 months |
| Trash | 30 days |
| Content versions | last 100 per item |
| Audit log | 12 months |
| Statistics events | 13 months |
| Backups | 14 daily + 8 weekly; restore tested monthly |

- **Журнал действий** (administrator only): every action in Russian, filters by section,
  user, text or object id and period; each entry opens to IP, browser and what changed
  (status from → to…), with a link to the object.
- **Retention:** a nightly job (04:00 Tashkent) deletes for good what is past the periods
  above, resumes with their applications; a run that removed something is logged with the
  counts. Trash, versions, form limits and statistics salts keep their own cleanups.
- **Restore test:** `deploy/restore-test.sh`, monthly from cron, restores the newest dump into
  a scratch database, compares row counts with the live one, checks the files archive and
  drops the scratch database.
- **Checked:** e2e tests for the filters, permissions and every retention period (resume
  files included); the restore script run against a real Postgres.

## Stage 7 — hh.uz import (done; needs the token)

- Anonymous access to hh vacancies returns 403 (checked 2026-10-13): the company's hh.uz
  employer account must register an app at dev.hh.ru and get an application token. It goes
  into **Интеграции → hh.uz** with the employer id and the direction for new vacancies.
- **Hourly sync:** new open vacancies arrive as drafts (or live with "Публиковать новые
  сразу"); the hh text goes into Uzbek and Russian, the description into the editor's format,
  key skills into requirements. Changes on hh follow at the same address; closed on hh →
  closed on the site, back on hh → reopened.
- **HR's edits win:** once an imported vacancy is edited in the admin, the sync leaves its
  text alone and only opens or closes it. A vacancy deleted in the admin is not brought back.
  Unpublished changes are never published by the sync.
- The sync acts as a system account «hh.uz» (shown as the author in history), which can't log
  in and isn't listed among users. The last run's result is on the Интеграции card, with
  "Синхронизировать сейчас"; runs that change something, and failures when they start, are
  in the audit log.
- Not included: importing responses from hh (needs paid employer API access).
- **Checked:** e2e tests against a fake hh API (create, update, close, reopen, protected
  edits, trash, 403 from hh); the HTML conversion unit-tested.

## Stage 8 — Hardening (done for the admin)

- **Browser tests** (`dashboard/e2e`, Playwright, `pnpm --filter @autodoc/dashboard e2e`, a
  `browser` job in GitLab CI): marketing's and HR's menus and the "Нет доступа" pages, login
  with 2FA and with a wrong password, a submission taken into work with a comment, a resume
  downloaded, an application deleted and restored from the trash.
- **Security pass:** [SECURITY.md](SECURITY.md). Every admin route swept for 401 without a
  session, private storage unreachable, headers checked; added `Cache-Control: no-store` for
  admin answers and a `Permissions-Policy`; `pnpm audit` clean.
- **Left:** the same pass on the site once it posts the forms and loads the counters.

## What the business needs to provide

| What | Needed by |
|---|---|
| Server in Uzbekistan: Ubuntu 24.04, 2 vCPU, 4 GB RAM, 40+ GB disk, plus a backup location | first deploy |
| DNS: `admin.autodoc.uz` (and `new.autodoc.uz` for testing) | first deploy |
| GitLab repo `autodoc-admin` | first commit |
| Telegram bot and two chats (marketing, HR) | Stage 4 |
| Lawyer's privacy policy and consent texts (uz/ru/en) | Stage 4–5 |
| hh.uz employer account + app at dev.hh.ru | Stage 7 |
| SMTP (optional, for password-reset emails) | any time |

## Not in this phase

Video file uploads, reordering page blocks, partners/leaders/history/reels as content types,
importing hh responses, GA4/Metrica data inside the admin.

## Changes from the first plan

- **NestJS 12 instead of 11** (released 2026-08-27, all official packages support it): the API is
  ESM, on TypeScript 6, tested with Vitest instead of Jest.
- **Site photos are not re-encoded by Next's optimizer**: they are hand-tuned; photos from the
  admin are pre-sized by the API.
- **Content storage:** one documents table with JSON per language instead of a translations
  table per type. Same behaviour for editors; drafts, history, trash and scheduling are written
  once for every type.
- **Dashboard text is Russian, written inline** (no i18next until an Uzbek admin UI is needed).
- **Invite and reset links are shown on screen** until SMTP is set up.
- **Cookie banner text and tracking IDs** move to Stage 5, where the banner and the tracking
  scripts are built: settings with nothing to apply them to would only confuse.
- **Menu:** order and show/hide of the site's items (labels in Тексты сайта), not free links.
- **Site texts are stored as changes over the code's texts**, not as a full copy: texts added
  to the site later appear in the admin by themselves.
- **Excel files are written by a small built-in writer** (`api/src/common/xlsx.ts`), not a
  spreadsheet library: one sheet, text and numbers, never formulas, so a cell starting with
  "=" can't run anything.
- **Visitors in the statistics are counted per day.** Without cookies a returning visitor
  can't be recognised the next day, so "visitors" over a period is the sum of daily visitors.

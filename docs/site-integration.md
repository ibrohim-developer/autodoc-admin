# Site integration: forms, cookie banner, statistics

What the site (`autodoc-landing`, branch `feat/admin-platform`) has to do for Stages 4 and 5.
The admin side is done and tested; these are the contracts it expects.

All three endpoints are called **from the visitor's browser**, on the site's own origin:
nginx in the landing repo routes `autodoc.uz/api/v1/{leads,applications,collect}` to the API
(`127.0.0.1:4000`). No site token: they are public. A request with an `Origin` other than
`SITE_ORIGIN` is refused (403).

```nginx
# autodoc.uz server block (landing repo, deploy/nginx.conf)
location ~ ^/api/v1/(leads|applications|collect)$ {
    client_max_body_size 12m;          # a resume is up to 10 MB
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

In development the site runs on :3000 and the API on :4000: add a Next rewrite of
`/api/v1/(leads|applications|collect)` to `http://127.0.0.1:4000/api/v1/…` so the browser
still posts to its own origin.

## Forms

### Обратная связь — `POST /api/v1/leads` (JSON)

```json
{
  "form": "feedback",
  "name": "Алишер",
  "phone": "+998 90 123 45 67",
  "topic": "Сотрудничество",
  "message": "…",
  "locale": "ru",
  "page": "/ru/contacts/",
  "consent": true,
  "website": ""
}
```

- `topic`, `message`, `page` are optional. `consent` must be `true`.
- `website` is the honeypot: render it as a visually hidden text input
  (`tabIndex={-1}`, `autoComplete="off"`, not `display: none`), leave it empty. A filled one
  gets a normal `201 {"ok":true}` and nothing is saved.
- Answers: `201 {"ok":true}`; `400 {"code":"invalid_form","fields":{"phone":"…"}}`;
  `429 {"code":"too_many_submissions"}` (5 per 10 minutes, 20 a day per form and address);
  `403 {"code":"bad_origin"}`. Show the site's own texts; branch on `code`, not on `message`.

### Отклик — `POST /api/v1/applications` (multipart/form-data)

Fields: `name`, `phone`, `vacancyId` (the vacancy document's `id` from the content API, or
`other` / empty for "другая позиция"), `about` (optional), `email` (optional), `locale`, `page`,
`consent` (`on`), `website` (honeypot), and the file `resume` (PDF, DOC or DOCX, up to 10 MB,
required).

The resume dialog today sends nothing and has no consent checkbox: **add the checkbox** (the
spec requires it on this form too) and switch the position `<select>` to vacancy ids.

Extra answers: `422 {"code":"no_resume" | "unsupported_resume" | "vacancy_not_found" |
"vacancy_closed"}`, `413` for a file over 10 MB.

## Cookie banner and counters

- Banner: **Принять все / Отклонить / Настроить**. "Настроить" offers one category,
  *Аналитика и реклама* (GA4, Yandex Metrica, Meta Pixel). Strictly necessary cookies need no
  consent and the site sets none for tracking.
- Store the choice in `localStorage` (`autodoc-consent` = `{ "analytics": true|false, "v": 1 }`),
  not in a cookie. Show the banner while it is missing; a "Настройки cookie" link in the footer
  reopens it.
- The counter ids come from **Настройки сайта**: `GET /api/v1/content/single/site_settings`
  → `data.tracking = { ga4, metrica, pixel }` (empty string = not used). Load each script
  **only after** `analytics: true`, and never on "Отклонить".
- Banner texts go into the message files like every other text, so marketing edits them in
  **Тексты сайта** (uz/ru/en). The lawyer confirms the wording (see ROADMAP).

## Own statistics — `POST /api/v1/collect`

Runs for every visitor, banner or not: no cookies, no storage, nothing that identifies anyone
(the API keeps a hash of address + browser with a salt that is deleted every night, never the
address). Send with `navigator.sendBeacon` as JSON:

```ts
// src/lib/stats.ts on the site; call trackView() on every client-side navigation.
function send(event: object) {
  const body = new Blob([JSON.stringify(event)], { type: 'application/json' })
  if (!navigator.sendBeacon?.('/api/v1/collect', body)) {
    void fetch('/api/v1/collect', { method: 'POST', body, keepalive: true })
  }
}

export function trackView(): () => void {
  const id = crypto.randomUUID() // per page view, never stored
  const utm = new URLSearchParams(location.search).get('utm_source') ?? undefined
  send({ t: 'view', id, path: location.pathname, ref: document.referrer, w: screen.width, utm })

  // Time actually spent on the page: only while the tab is visible.
  let visibleSince = document.visibilityState === 'visible' ? Date.now() : null
  let spent = 0
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      if (visibleSince) spent += Date.now() - visibleSince
      visibleSince = null
      send({ t: 'end', id, ms: spent })
    } else {
      visibleSince = Date.now()
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    if (visibleSince) spent += Date.now() - visibleSince
    send({ t: 'end', id, ms: spent })
  }
}
```

- Don't send views in draft/preview mode.
- The API skips bots itself, groups `/blog/<slug>/` and `/vacancies/<slug>/` (any language
  prefix) under their post or vacancy, and treats links from the site itself as internal.
- Always `204`, also for a malformed event. Limit: 120 events a minute per address.

## News article: blocks

A post's page (`GET /api/v1/content/post/<slug>?locale=…`) now has `data.blocks`, the article in
order, each block already in the visitor's language (a text or caption not yet translated comes
from Uzbek, block by block):

```ts
type Block =
  | { type: 'text'; id: string; body: RichText }
  | { type: 'image'; id: string; image: { mediaId: string; … }; caption: string }
  | { type: 'gallery'; id: string; items: { mediaId: string; … }[] }
  | { type: 'video'; id: string; url: string } // YouTube or Instagram Reels
```

Photos are in `media` as before. Until the site renders `blocks`, the old fields are still
there, made from the blocks: `body` (all text blocks, photos inline), `gallery` (all gallery
photos) and `videoUrl` (the first video). `excerpt` is the start of the text, as before.


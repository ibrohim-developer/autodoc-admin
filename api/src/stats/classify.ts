import { DEFAULT_LOCALE, isLocale, type Locale } from '../content/locales.js'

/** Turning one page view into what the reports count: device, source, page. No personal data. */

export type Device = 'mobile' | 'tablet' | 'desktop'
export type Source = 'direct' | 'search' | 'social' | 'referral' | 'campaign' | 'internal'

const BOT =
  /bot|crawl|spider|slurp|scrape|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|whatsapp|telegram|vkshare|curl|wget|python|httpclient|java\/|go-http/i

export function isBot(userAgent: string | null | undefined): boolean {
  return !userAgent || BOT.test(userAgent)
}

/** From the browser's own description, with the screen width as a tie-breaker. */
export function deviceOf(userAgent: string, width?: number): Device {
  if (/iPad|Tablet|PlayBook|Silk|Kindle|(Android(?!.*Mobile))/i.test(userAgent)) return 'tablet'
  if (/Mobi|iPhone|iPod|Android|Windows Phone|Opera Mini/i.test(userAgent)) return 'mobile'
  // iPadOS reports itself as a Mac; a touch-size screen gives it away.
  if (width && width < 768) return 'mobile'
  if (width && width < 1024 && /Macintosh/.test(userAgent)) return 'tablet'
  return 'desktop'
}

const SEARCH = [
  'google.',
  'yandex.',
  'bing.com',
  'duckduckgo.com',
  'yahoo.',
  'mail.ru',
  'ecosia.org',
]
const SOCIAL: Record<string, string> = {
  'instagram.com': 'instagram',
  'l.instagram.com': 'instagram',
  'facebook.com': 'facebook',
  'm.facebook.com': 'facebook',
  'l.facebook.com': 'facebook',
  't.me': 'telegram',
  'web.telegram.org': 'telegram',
  'telegram.org': 'telegram',
  'linkedin.com': 'linkedin',
  'lnkd.in': 'linkedin',
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'x.com': 'x',
  'twitter.com': 'x',
  't.co': 'x',
  'vk.com': 'vk',
  'ok.ru': 'ok',
  'tiktok.com': 'tiktok',
}

function hostOf(url: string): string | null {
  try {
    const parsed = new URL(url)
    return /^https?:$/.test(parsed.protocol)
      ? parsed.hostname.toLowerCase().replace(/^www\./, '')
      : null
  } catch {
    return null
  }
}

/**
 * Where the visit came from. A campaign tag wins; a link from the site itself is `internal`
 * (moving between pages, left out of the sources report).
 */
export function sourceOf(
  referrer: string | null | undefined,
  siteHost: string,
  utmSource?: string | null,
): { source: Source; name: string | null } {
  const campaign = utmSource?.trim().toLowerCase().slice(0, 100)
  if (campaign) return { source: 'campaign', name: campaign }
  const host = referrer ? hostOf(referrer) : null
  if (!host) return { source: 'direct', name: null }
  const site = siteHost.toLowerCase().replace(/^www\./, '')
  if (host === site || host.endsWith(`.${site}`)) return { source: 'internal', name: null }
  if (SEARCH.some((engine) => host.includes(engine))) {
    return { source: 'search', name: host.split('.').find((part) => part !== 'm') ?? host }
  }
  const social =
    SOCIAL[host] ?? Object.entries(SOCIAL).find(([domain]) => host.endsWith(`.${domain}`))?.[1]
  if (social) return { source: 'social', name: social }
  return { source: 'referral', name: host.slice(0, 100) }
}

/** The site's pages with a content item of their own, by address (see the types' sitePath). */
const CONTENT_PAGES: { pattern: RegExp; type: string }[] = [
  { pattern: /^\/blog\/([a-z0-9-]+)\/$/, type: 'post' },
  { pattern: /^\/vacancies\/([a-z0-9-]+)\/$/, type: 'vacancy' },
]

export type PageInfo = {
  path: string
  locale: Locale
  content: { type: string; slug: string } | null
}

/**
 * A path as the reports group it: no query or fragment, ending with a slash like the site's own
 * addresses. Null for anything that isn't a path on the site.
 */
export function pageOf(raw: string): PageInfo | null {
  const value = raw.trim()
  if (!/^\/(?!\/)/.test(value) || value.length > 1000) return null
  let path = value.replace(/[?#].*$/, '')
  try {
    path = decodeURI(path)
  } catch {
    return null
  }
  if (/[\s\\]/.test(path)) return null
  if (!path.endsWith('/') && !/\.[a-z0-9]{2,5}$/i.test(path)) path = `${path}/`
  path = path.toLowerCase().slice(0, 300)

  const prefix = /^\/(ru|en)(\/|$)/.exec(path)?.[1]
  const locale: Locale = prefix && isLocale(prefix) ? prefix : DEFAULT_LOCALE
  const rest = prefix ? path.slice(prefix.length + 1) || '/' : path
  for (const page of CONTENT_PAGES) {
    const slug = page.pattern.exec(rest)?.[1]
    if (slug) return { path, locale, content: { type: page.type, slug } }
  }
  return { path, locale, content: null }
}

const tashkentDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' })

/** YYYY-MM-DD of the day in Tashkent: statistics count Tashkent days. */
export function dayOf(date: Date): string {
  return tashkentDay.format(date)
}

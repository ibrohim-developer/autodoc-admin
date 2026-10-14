import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Preview links: `${site}/api/draft/?path=/blog/foo/&exp=<unix>&sig=<hmac>`. The site checks the
 * signature with the same secret (PREVIEW_SECRET on both sides), switches on Next's draft mode
 * and opens the path. A link works for 10 minutes and only for its own path.
 *
 * The site has a copy of verifyPreview(): keep the two in step.
 */
export const PREVIEW_TTL_SECONDS = 10 * 60

function sign(path: string, exp: number, secret: string): string {
  return createHmac('sha256', secret).update(`${path}\n${exp}`).digest('base64url')
}

export function previewUrl(
  siteOrigin: string,
  path: string,
  secret: string,
  now = Date.now(),
): string {
  const exp = Math.floor(now / 1000) + PREVIEW_TTL_SECONDS
  const url = new URL('/api/draft/', siteOrigin)
  url.searchParams.set('path', path)
  url.searchParams.set('exp', String(exp))
  url.searchParams.set('sig', sign(path, exp, secret))
  return url.toString()
}

export function verifyPreview(
  { path, exp, sig }: { path: string; exp: string; sig: string },
  secret: string,
  now = Date.now(),
): boolean {
  const expires = Number(exp)
  const seconds = Math.floor(now / 1000)
  if (!Number.isInteger(expires) || expires < seconds || expires > seconds + PREVIEW_TTL_SECONDS) {
    return false
  }
  if (!path.startsWith('/') || path.startsWith('//')) return false
  const expected = Buffer.from(sign(path, expires, secret))
  const given = Buffer.from(sig)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

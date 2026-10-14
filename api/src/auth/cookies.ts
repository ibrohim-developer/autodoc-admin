import type { CookieOptions, Response } from 'express'
import { ACCESS_TTL_SECONDS, REFRESH_TTL_MS, type Session } from '../users/sessions.service.js'

export const ACCESS_COOKIE = 'ad_access'
export const REFRESH_COOKIE = 'ad_refresh'

/** The refresh token only travels to the auth endpoints that use it. */
const REFRESH_PATH = '/api/admin/auth'

function base(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'strict' }
}

export function setSessionCookies(res: Response, session: Session, secure: boolean): void {
  res.cookie(ACCESS_COOKIE, session.access, {
    ...base(secure),
    path: '/api',
    maxAge: ACCESS_TTL_SECONDS * 1000,
  })
  res.cookie(REFRESH_COOKIE, session.refresh, {
    ...base(secure),
    path: REFRESH_PATH,
    maxAge: REFRESH_TTL_MS,
  })
}

export function clearSessionCookies(res: Response, secure: boolean): void {
  res.clearCookie(ACCESS_COOKIE, { ...base(secure), path: '/api' })
  res.clearCookie(REFRESH_COOKIE, { ...base(secure), path: REFRESH_PATH })
}

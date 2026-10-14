import type { NextFunction, Request, Response } from 'express'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Rejects state-changing admin requests sent from another site. The session
 * cookies are already SameSite=Strict; this is the second lock on the door.
 * Browsers always send `Origin` with a cross-site POST, so a foreign value is
 * refused and a missing one (curl, server-to-server) is let through to auth.
 */
export function originCheck(adminOrigin: string) {
  const allowed = new URL(adminOrigin).origin

  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) return next()
    const origin = req.get('origin')
    if (origin && origin !== allowed) {
      res
        .status(403)
        .json({ statusCode: 403, code: 'bad_origin', message: 'Запрос с чужого сайта' })
      return
    }
    next()
  }
}

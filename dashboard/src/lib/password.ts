import { z } from 'zod'

/** Same rule as the API (api/src/auth/password.ts); the API has the final say. */
export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 128

export const passwordField = z
  .string()
  .min(PASSWORD_MIN, { message: `Не короче ${PASSWORD_MIN} символов` })
  .max(PASSWORD_MAX, { message: `Не длиннее ${PASSWORD_MAX} символов` })

export const PASSWORD_HINT = `Не короче ${PASSWORD_MIN} символов. Лучше фраза из нескольких слов.`

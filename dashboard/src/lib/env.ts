import { z } from 'zod'

/**
 * Validate `import.meta.env` once, at module load, so a missing or malformed
 * variable fails loudly at startup instead of as `undefined` deep in a fetch.
 *
 * Only keys prefixed `VITE_` are exposed to client code by Vite.
 */
const envSchema = z.object({
  // The API is served from the same origin as the dashboard (nginx in production,
  // the Vite proxy in development), so a path is enough and cookies just work.
  VITE_API_URL: z
    .string()
    .startsWith('/', { message: 'VITE_API_URL must be a path on this origin, e.g. /api' })
    .default('/api'),
})

const parsed = envSchema.safeParse(import.meta.env)

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
  throw new Error(`Invalid environment variables:\n${issues}\n\nDid you copy .env.example to .env?`)
}

export const env = parsed.data

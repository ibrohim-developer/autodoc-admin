import type { z } from 'zod'
import { env } from './env'

/** Thrown for any non-2xx response. Carries the status so callers can branch on it. */
export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }

  /** The API's machine-readable reason, e.g. `invalid_credentials`. */
  get code(): string | undefined {
    const body = this.body as { code?: unknown } | null
    return typeof body?.code === 'string' ? body.code : undefined
  }
}

/** Thrown when a 2xx response body does not match the schema the caller expected. */
export class ApiParseError extends Error {
  readonly issues: z.core.$ZodIssue[]

  constructor(path: string, issues: z.core.$ZodIssue[]) {
    super(`Response from ${path} did not match the expected schema`)
    this.name = 'ApiParseError'
    this.issues = issues
  }
}

/** Text to show a person for any error: the API's Russian message when there is one. */
export function errorMessage(
  error: unknown,
  fallback = 'Что-то пошло не так. Попробуйте ещё раз.',
) {
  if (error instanceof ApiError) {
    // Before the body: the upload limiter answers 413 in English.
    if (error.status === 413) return 'Файл слишком большой'
    const message = (error.body as { message?: unknown } | null)?.message
    if (typeof message === 'string') return message
    if (Array.isArray(message) && typeof message[0] === 'string') return message[0]
    if (error.status === 403) return 'Недостаточно прав'
    if (error.status === 429) return 'Слишком много запросов. Подождите немного.'
  }
  if (error instanceof TypeError) return 'Нет связи с сервером'
  return fallback
}

type RequestOptions<TSchema extends z.ZodType> = Omit<RequestInit, 'body'> & {
  /** Zod schema the response body must satisfy. */
  schema: TSchema
  /** Plain object — serialised as JSON with the right Content-Type. */
  body?: unknown
  /** File uploads. The browser sets the multipart Content-Type with its boundary itself. */
  formData?: FormData
  searchParams?: Record<string, string | number | boolean | undefined>
}

function parseBody(raw: string): unknown {
  if (raw.length === 0) return null
  try {
    return JSON.parse(raw)
  } catch {
    // An HTML error page from a proxy, for example.
    return raw
  }
}

// Auth endpoints answer 401 as a result, not because the session expired.
const NO_REFRESH = /^admin\/auth\/(login|refresh|logout|password-token)/

function apiUrl(path: string): URL {
  const base = new URL(`${env.VITE_API_URL.replace(/\/$/, '')}/`, window.location.origin)
  return new URL(path.replace(/^\//, ''), base)
}

let refreshing: Promise<boolean> | null = null

/**
 * The access cookie lives 15 minutes; when it runs out, one refresh call gets
 * a new one and the original request is retried. Parallel requests share the
 * same refresh, and `stale_session` means another tab already refreshed — the
 * browser already holds the new cookies, so retrying is enough.
 */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(apiUrl('admin/auth/refresh'), {
    method: 'POST',
    headers: { Accept: 'application/json' },
  })
    .then(async (response) => {
      if (response.ok) return true
      const body = (await response.json().catch(() => null)) as { code?: string } | null
      return body?.code === 'stale_session'
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

/** The file name from `Content-Disposition`, preferring the UTF-8 `filename*`. */
function fileNameOf(header: string | null, fallback: string): string {
  if (!header) return fallback
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded)
    } catch {
      // Fall through to the plain name.
    }
  }
  return /filename="([^"]+)"/i.exec(header)?.[1] ?? fallback
}

/**
 * A file from the API (an Excel export, a resume), with the same session refresh and errors as
 * `request()`. Returns the file; `saveFile` hands it to the browser.
 */
export async function requestFile(
  path: string,
  {
    searchParams,
    fallbackName = 'file',
  }: {
    searchParams?: Record<string, string | number | boolean | undefined>
    fallbackName?: string
  } = {},
): Promise<{ blob: Blob; name: string }> {
  const url = apiUrl(path)
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
  }
  const send = () => fetch(url, { headers: { Accept: '*/*' } })
  let response = await send()
  if (response.status === 401 && (await refreshSession())) response = await send()
  if (!response.ok) {
    throw new ApiError(
      `${response.status} ${response.statusText} — ${url.pathname}`,
      response.status,
      parseBody(await response.text()),
    )
  }
  return {
    blob: await response.blob(),
    name: fileNameOf(response.headers.get('content-disposition'), fallbackName),
  }
}

/** Starts the browser's download of a file fetched with `requestFile`. */
export function saveFile({ blob, name }: { blob: Blob; name: string }): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  // Some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * `fetch` with the things every call needs: the API base path, typed errors,
 * a silent session refresh, and runtime validation of the response.
 *
 * The return type is inferred from `schema`, so unvalidated data can never
 * reach the rest of the app.
 */
export async function request<TSchema extends z.ZodType>(
  path: string,
  { schema, body, formData, searchParams, headers, ...init }: RequestOptions<TSchema>,
): Promise<z.infer<TSchema>> {
  const url = apiUrl(path)
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  const json = body !== undefined && formData === undefined
  const send = () =>
    fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(json ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(formData ? { body: formData } : json ? { body: JSON.stringify(body) } : {}),
    })

  let response = await send()
  if (response.status === 401 && !NO_REFRESH.test(path.replace(/^\//, ''))) {
    if (await refreshSession()) response = await send()
  }

  const payload = parseBody(await response.text())

  if (!response.ok) {
    throw new ApiError(
      `${response.status} ${response.statusText} — ${url.pathname}`,
      response.status,
      payload,
    )
  }

  const result = schema.safeParse(payload)
  if (!result.success) {
    throw new ApiParseError(url.pathname, result.error.issues)
  }

  return result.data
}

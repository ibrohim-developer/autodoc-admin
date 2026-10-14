import { z } from 'zod'
import { stubApi } from '@/test/fixtures'
import { ApiError, ApiParseError, errorMessage, request } from './api-client'

const schema = z.object({ id: z.number() })

describe('request', () => {
  it('returns parsed, typed data from the same-origin API', async () => {
    const fetchMock = stubApi({ 'GET admin/thing': { body: { id: 7 } } })
    vi.stubGlobal('fetch', fetchMock)

    await expect(request('admin/thing', { schema })).resolves.toEqual({ id: 7 })
    const url = fetchMock.mock.calls[0]?.[0] as URL
    expect(url.origin).toBe(window.location.origin)
    expect(url.pathname).toBe('/api/admin/thing')
  })

  it('throws ApiError carrying the status and the API code on a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      stubApi({
        'GET admin/thing': { status: 404, body: { code: 'user_not_found', message: 'Нет' } },
      }),
    )

    const error = await request('admin/thing', { schema }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, code: 'user_not_found' })
  })

  it('throws ApiParseError when the body does not match the schema', async () => {
    vi.stubGlobal('fetch', stubApi({ 'GET admin/thing': { body: { id: 'seven' } } }))
    await expect(request('admin/thing', { schema })).rejects.toBeInstanceOf(ApiParseError)
  })

  it('appends defined search params and skips undefined ones', async () => {
    const fetchMock = stubApi({ 'GET admin/thing': { body: { id: 1 } } })
    vi.stubGlobal('fetch', fetchMock)

    await request('admin/thing', { schema, searchParams: { page: 5, cursor: undefined } })

    const url = fetchMock.mock.calls[0]?.[0] as URL
    expect(url.searchParams.get('page')).toBe('5')
    expect(url.searchParams.has('cursor')).toBe(false)
  })

  it('sends a JSON body with the right Content-Type', async () => {
    const fetchMock = stubApi({ 'POST admin/thing': { body: { id: 1 } } })
    vi.stubGlobal('fetch', fetchMock)

    await request('admin/thing', { schema, method: 'POST', body: { name: 'x' } })

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init.body).toBe('{"name":"x"}')
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
  })

  it('accepts an empty 204 body with a null schema', async () => {
    vi.stubGlobal('fetch', stubApi({ 'POST admin/auth/logout': { status: 204, body: null } }))
    await expect(
      request('admin/auth/logout', { method: 'POST', schema: z.null() }),
    ).resolves.toBeNull()
  })
})

describe('session refresh', () => {
  it('refreshes once on 401 and retries the request', async () => {
    let calls = 0
    const fetchMock = stubApi({
      'GET admin/thing': () => {
        calls += 1
        return calls === 1 ? { status: 401, body: { code: 'unauthorized' } } : { body: { id: 3 } }
      },
      'POST admin/auth/refresh': { body: { user: {} } },
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(request('admin/thing', { schema })).resolves.toEqual({ id: 3 })
    const paths = fetchMock.mock.calls.map((call) => (call[0] as URL).pathname)
    expect(paths).toEqual(['/api/admin/thing', '/api/admin/auth/refresh', '/api/admin/thing'])
  })

  it('shares one refresh between parallel requests', async () => {
    const seen = new Set<string>()
    // The first call to each path is a 401; after the refresh both succeed.
    const once = (name: string, id: number) => () => {
      if (seen.has(name)) return { body: { id } }
      seen.add(name)
      return { status: 401, body: {} }
    }
    const fetchMock = stubApi({
      'GET admin/a': once('a', 1),
      'GET admin/b': once('b', 2),
      'POST admin/auth/refresh': { body: { user: {} } },
    })
    vi.stubGlobal('fetch', fetchMock)

    await Promise.all([request('admin/a', { schema }), request('admin/b', { schema })])
    const refreshes = fetchMock.mock.calls.filter((call) =>
      (call[0] as URL).pathname.endsWith('/refresh'),
    )
    expect(refreshes).toHaveLength(1)
  })

  it('retries when another tab already refreshed (stale_session)', async () => {
    let calls = 0
    vi.stubGlobal(
      'fetch',
      stubApi({
        'GET admin/thing': () => {
          calls += 1
          return calls === 1 ? { status: 401, body: {} } : { body: { id: 9 } }
        },
        'POST admin/auth/refresh': { status: 401, body: { code: 'stale_session' } },
      }),
    )
    await expect(request('admin/thing', { schema })).resolves.toEqual({ id: 9 })
  })

  it('gives up with 401 when the session is really over', async () => {
    vi.stubGlobal(
      'fetch',
      stubApi({
        'GET admin/thing': { status: 401, body: { code: 'unauthorized' } },
        'POST admin/auth/refresh': { status: 401, body: { code: 'session_expired' } },
      }),
    )
    await expect(request('admin/thing', { schema })).rejects.toMatchObject({ status: 401 })
  })

  it('never refreshes for the login call itself', async () => {
    const fetchMock = stubApi({
      'POST admin/auth/login': { status: 401, body: { code: 'invalid_credentials' } },
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      request('admin/auth/login', { method: 'POST', body: {}, schema }),
    ).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('errorMessage', () => {
  it("shows the API's message", () => {
    expect(errorMessage(new ApiError('x', 400, { message: 'Неверный код' }))).toBe('Неверный код')
  })

  it('falls back to sensible Russian text', () => {
    expect(errorMessage(new ApiError('x', 403, null))).toBe('Недостаточно прав')
    expect(errorMessage(new TypeError('Failed to fetch'))).toBe('Нет связи с сервером')
    expect(errorMessage(new Error('boom'))).toBe('Что-то пошло не так. Попробуйте ещё раз.')
  })
})

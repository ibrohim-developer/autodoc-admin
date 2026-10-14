import type { Me } from '@/lib/session'

const ALL = [
  'home.view',
  'content.read',
  'content.write',
  'content.publish',
  'media.read',
  'media.write',
  'vacancies.read',
  'vacancies.write',
  'vacancies.publish',
  'applications.read',
  'applications.write',
  'applications.export',
  'leads.read',
  'leads.write',
  'leads.export',
  'stats.general',
  'stats.content',
  'stats.vacancies',
  'trash.content',
  'trash.vacancies',
  'users.read',
  'users.manage',
  'audit.read',
  'integrations.manage',
]

/** Session users as GET /api/admin/auth/me returns them, one per role. */
export const meFixtures = {
  admin: {
    id: '5dbe3ecf-ec4f-4dce-96c2-50cc11deda58',
    email: 'admin@autodoc.uz',
    name: 'Алишер Админов',
    role: 'admin',
    roleLabel: 'Администратор',
    permissions: ALL,
    totpEnabled: false,
    assignableRoles: [
      { value: 'admin', label: 'Администратор' },
      { value: 'marketing', label: 'Маркетинг' },
      { value: 'hr', label: 'HR' },
    ],
  },
  marketing: {
    id: '6f7e1c1a-1d2b-4c3d-8e9f-0a1b2c3d4e5f',
    email: 'marketing@autodoc.uz',
    name: 'Мадина Маркетова',
    role: 'marketing',
    roleLabel: 'Маркетинг',
    permissions: ALL.filter((p) => p !== 'audit.read' && p !== 'integrations.manage'),
    totpEnabled: true,
    assignableRoles: [
      { value: 'marketing', label: 'Маркетинг' },
      { value: 'hr', label: 'HR' },
    ],
  },
  hr: {
    id: '7a8b9c0d-1e2f-4a3b-9c4d-5e6f7a8b9c0d',
    email: 'hr@autodoc.uz',
    name: 'Нигора Кадрова',
    role: 'hr',
    roleLabel: 'HR',
    permissions: [
      'home.view',
      'vacancies.read',
      'vacancies.write',
      'vacancies.publish',
      'applications.read',
      'applications.write',
      'applications.export',
      'stats.vacancies',
      'trash.vacancies',
    ],
    totpEnabled: false,
    assignableRoles: [],
  },
} satisfies Record<string, Me>

type Route = { status?: number; body: unknown }

/**
 * Stub `fetch` by path, e.g. `{ 'POST admin/auth/login': { body: {...} } }`.
 * Paths are matched after /api/; unknown requests answer 404 so a test that
 * forgot a route fails loudly. Undone by `vi.unstubAllGlobals()` in setup.ts.
 */
export function stubApi(routes: Record<string, Route | ((body: unknown) => Route)>) {
  return vi.fn().mockImplementation(async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input))
    const path = url.pathname.replace(/^\/api\//, '')
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${path}`
    const entry = routes[key]
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    const route = typeof entry === 'function' ? entry(body) : entry
    const status = route?.status ?? (route ? 200 : 404)
    const payload = route ? route.body : { message: `No stub for ${key}` }
    // A new Response per call: a body can only be read once.
    return new Response(payload === null ? null : JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
}

type FetchMock = ReturnType<typeof stubApi>

/** The parsed JSON body the app sent with a stubbed request, matched by "METHOD path". */
export function sentBody(fetchMock: FetchMock, key: string, nth = 0): unknown {
  const [method, path] = key.split(' ')
  const calls = fetchMock.mock.calls.filter(([input, init]) => {
    const url = new URL(String(input))
    return (
      ((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase() === method &&
      url.pathname === `/api/${path}`
    )
  })
  const init = calls[nth]?.[1] as RequestInit | undefined
  if (typeof init?.body !== 'string') throw new Error(`No request body for ${key} #${nth}`)
  return JSON.parse(init.body)
}

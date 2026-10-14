import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type RenderOptions, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'
import { createMemoryRouter, MemoryRouter, RouterProvider, useLocation } from 'react-router'
import { type Me, sessionKey } from '@/lib/session'

/** Where the app navigated to, for screens that leave (after a save, on delete). */
function Elsewhere() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname}</p>
}

/**
 * Retries and caching are helpful in the app and hostile in tests — a retried
 * failure turns a clear assertion into a timeout.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

type Options = Omit<RenderOptions, 'wrapper'> & {
  /** Initial URL for the MemoryRouter. */
  route?: string
  /**
   * Renders `ui` as this route of a data router (needed by `useBlocker`); any other URL shows
   * its pathname in `data-testid="location"`.
   */
  path?: string
  /** Logged-in user, for components that live behind the session guard. */
  session?: Me | null
}

/**
 * Renders `ui` inside the providers the app depends on, with a **fresh**
 * QueryClient per call so cache never leaks between tests.
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path, session, ...options }: Options = {},
) {
  const queryClient = createTestQueryClient()
  if (session !== undefined) {
    // The test's user stays put: with gcTime 0 the cache would drop it while a screen still
    // shows its own spinner (nothing watching the session yet), and the refetch has no stub.
    queryClient.setQueryDefaults(sessionKey, {
      gcTime: Number.POSITIVE_INFINITY,
      staleTime: Number.POSITIVE_INFINITY,
    })
    queryClient.setQueryData(sessionKey, session)
  }

  if (path) {
    const router = createMemoryRouter(
      [
        { path, element: ui },
        { path: '*', element: <Elsewhere /> },
      ],
      { initialEntries: [route] },
    )
    return {
      user: userEvent.setup(),
      queryClient,
      router,
      ...render(
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
        options,
      ),
    }
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }

  return {
    user: userEvent.setup(),
    queryClient,
    // Only with `path`: a plain MemoryRouter has no router object to inspect.
    router: undefined,
    ...render(ui, { wrapper: Wrapper, ...options }),
  }
}

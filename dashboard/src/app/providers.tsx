import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import type { ReactNode } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api-client'
import { sessionKey } from '@/lib/session'

/**
 * A 401 that survived the silent refresh means the session is gone (logged out
 * elsewhere, disabled, expired). Clearing the cached user makes the session
 * guard send the person to the login page.
 */
function onError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    queryClient.setQueryData(sessionKey, null)
  }
}

/**
 * Created once at module scope, not inside a component — a QueryClient rebuilt
 * on render would throw the cache away on every render.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      // Retrying a 404 or a 401 just delays the error the user needs to see.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
        return failureCount < 2
      },
    },
    mutations: {
      retry: false,
    },
  },
})

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" richColors closeButton />
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  )
}

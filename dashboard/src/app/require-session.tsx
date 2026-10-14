import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api-client'
import { can, type Permission, useSession } from '@/lib/session'
import { AdminLayout } from './admin-layout'

export function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Загрузка…</span>
    </div>
  )
}

/** Everything behind login renders through here: no session, no admin. */
export function RequireSession() {
  const { data: me, isPending, isError, error, refetch } = useSession()
  const location = useLocation()

  if (isPending) return <FullPageSpinner />
  if (isError) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="font-medium">{errorMessage(error)}</p>
          <Button className="mt-4" variant="outline" onClick={() => refetch()}>
            Повторить
          </Button>
        </div>
      </div>
    )
  }
  if (!me) {
    const next = `${location.pathname}${location.search}`
    return (
      <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />
    )
  }
  return <AdminLayout me={me} />
}

/**
 * A screen the role may not open says so instead of rendering half-broken:
 * the API would answer its requests with 403 anyway. Without children it guards the nested
 * routes (a section's list, editor and sub-pages).
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission
  children?: ReactNode
}) {
  const { data: me } = useSession()
  if (!can(me, permission)) {
    return (
      <div className="py-20 text-center">
        <p className="font-medium text-muted-foreground text-sm">403</p>
        <h1 className="mt-2 font-semibold text-2xl">Нет доступа</h1>
        <p className="mt-2 text-muted-foreground">
          Этот раздел недоступен для вашей роли. Если он нужен, обратитесь к администратору.
        </p>
      </div>
    )
  }
  return children ?? <Outlet />
}

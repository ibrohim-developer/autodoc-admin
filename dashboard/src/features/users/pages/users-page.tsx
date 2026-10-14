import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api-client'
import { useCan, useMe } from '@/lib/session'
import { InviteUserDialog } from '../components/invite-user-dialog'
import { RolesOverview } from '../components/roles-overview'
import { UsersTable } from '../components/users-table'
import { useUsers } from '../hooks/use-users'

export function UsersPage() {
  const me = useMe()
  const canManage = useCan('users.manage')
  const users = useUsers()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Пользователи</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Кто входит в админку и с какой ролью.
          </p>
        </div>
        {canManage && users.data ? <InviteUserDialog roles={users.data.assignableRoles} /> : null}
      </div>

      {users.isPending ? <p className="text-muted-foreground text-sm">Загружаем…</p> : null}
      {users.isError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            {errorMessage(users.error)}
            <Button size="sm" variant="outline" onClick={() => users.refetch()}>
              Повторить
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {users.data ? (
        <UsersTable
          users={users.data.items}
          me={me}
          canManage={canManage}
          roles={users.data.assignableRoles}
        />
      ) : null}

      <RolesOverview />
    </div>
  )
}

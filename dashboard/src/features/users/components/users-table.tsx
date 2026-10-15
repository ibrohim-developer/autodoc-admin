import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CopyField } from '@/components/copy-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { errorMessage } from '@/lib/api-client'
import { formatDateTime } from '@/lib/format'
import type { Me, Role } from '@/lib/session'
import type { RoleOption, User } from '../api/users-api'
import { useResetLink, useResetTwoFactor, useUpdateUser } from '../hooks/use-users'

const STATUS: Record<
  User['status'],
  { label: string; variant: 'secondary' | 'outline' | 'destructive' }
> = {
  active: { label: 'Активен', variant: 'secondary' },
  invited: { label: 'Приглашён', variant: 'outline' },
  disabled: { label: 'Отключён', variant: 'destructive' },
}

type Action =
  | { kind: 'role'; user: User }
  | { kind: 'link'; user: User; link: string }
  | { kind: 'disable'; user: User }
  | { kind: 'reset-2fa'; user: User }

/** Marketing doesn't manage administrators, and nobody edits themselves here (that's the profile). */
function canManageRow(me: Me, user: User, canManage: boolean): boolean {
  if (!canManage || user.id === me.id) return false
  return user.role !== 'admin' || me.role === 'admin'
}

export function UsersTable({
  users,
  me,
  canManage,
  roles,
}: {
  users: User[]
  me: Me
  canManage: boolean
  roles: RoleOption[]
}) {
  const [action, setAction] = useState<Action | null>(null)
  const update = useUpdateUser()
  const resetLink = useResetLink()
  const resetTwoFactor = useResetTwoFactor()

  const close = () => setAction(null)

  async function issueLink(user: User) {
    try {
      const { link } = await resetLink.mutateAsync(user.id)
      setAction({ kind: 'link', user, link })
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function setActive(user: User, isActive: boolean) {
    try {
      await update.mutateAsync({ id: user.id, changes: { isActive } })
      toast.success(isActive ? `${user.name}: доступ включён` : `${user.name}: доступ отключён`)
      close()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead grow>Сотрудник</TableHead>
              <TableHead className="@xl:table-cell hidden">Роль</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="@2xl:table-cell hidden">2FA</TableHead>
              <TableHead className="@4xl:table-cell hidden">Последний вход</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Действия</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow
                key={user.id}
                className={user.status === 'disabled' ? 'opacity-60' : undefined}
              >
                <TableCell grow>
                  <div className="truncate font-medium">
                    {user.name}
                    {user.id === me.id ? (
                      <span className="ml-2 font-normal text-muted-foreground text-xs">это вы</span>
                    ) : null}
                  </div>
                  <div className="truncate text-muted-foreground text-xs">{user.email}</div>
                </TableCell>
                <TableCell className="@xl:table-cell hidden">{user.roleLabel}</TableCell>
                <TableCell>
                  <Badge variant={STATUS[user.status].variant}>{STATUS[user.status].label}</Badge>
                </TableCell>
                <TableCell className="@2xl:table-cell hidden">
                  {user.totpEnabled ? (
                    <Badge>включена</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="@4xl:table-cell hidden text-muted-foreground">
                  {formatDateTime(user.lastLoginAt, 'ещё не входил')}
                </TableCell>
                <TableCell>
                  {canManageRow(me, user, canManage) ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Действия: ${user.name}`}>
                          <MoreHorizontal aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setAction({ kind: 'role', user })}>
                          Изменить роль
                        </DropdownMenuItem>
                        {user.status !== 'disabled' ? (
                          <DropdownMenuItem onSelect={() => issueLink(user)}>
                            {user.status === 'invited'
                              ? 'Новая ссылка-приглашение'
                              : 'Ссылка для смены пароля'}
                          </DropdownMenuItem>
                        ) : null}
                        {user.totpEnabled ? (
                          <DropdownMenuItem onSelect={() => setAction({ kind: 'reset-2fa', user })}>
                            Сбросить 2FA
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        {user.status === 'disabled' ? (
                          <DropdownMenuItem onSelect={() => setActive(user, true)}>
                            Включить доступ
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setAction({ kind: 'disable', user })}
                          >
                            Отключить доступ
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {action?.kind === 'role' ? (
        <RoleDialog
          user={action.user}
          roles={roles}
          pending={update.isPending}
          onClose={close}
          onSave={async (role) => {
            try {
              await update.mutateAsync({ id: action.user.id, changes: { role } })
              toast.success(`${action.user.name}: роль изменена`)
              close()
            } catch (error) {
              toast.error(errorMessage(error))
            }
          }}
        />
      ) : null}

      <Dialog open={action?.kind === 'link'} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ссылка для {action?.user.name}</DialogTitle>
            <DialogDescription>
              {action?.user.status === 'invited'
                ? 'Новая ссылка-приглашение, действует 7 дней. Старая больше не работает.'
                : 'По ссылке сотрудник задаст новый пароль. Действует 24 часа, все его сеансы будут завершены.'}
            </DialogDescription>
          </DialogHeader>
          {action?.kind === 'link' ? <CopyField value={action.link} label="Ссылка" /> : null}
          <DialogFooter>
            <Button onClick={close}>Готово</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={action?.kind === 'disable'}
        onOpenChange={(open) => !open && close()}
        title={`Отключить доступ: ${action?.user.name ?? ''}?`}
        description="Сотрудник сразу выйдет из админки на всех устройствах и не сможет войти. Включить доступ можно в любой момент."
        confirmLabel="Отключить"
        destructive
        pending={update.isPending}
        onConfirm={() => action && setActive(action.user, false)}
      />

      <ConfirmDialog
        open={action?.kind === 'reset-2fa'}
        onOpenChange={(open) => !open && close()}
        title={`Сбросить 2FA: ${action?.user.name ?? ''}?`}
        description="Например, если телефон потерян. Сотрудник войдёт по паролю и сможет заново включить 2FA в профиле."
        confirmLabel="Сбросить"
        destructive
        pending={resetTwoFactor.isPending}
        onConfirm={async () => {
          if (!action) return
          try {
            await resetTwoFactor.mutateAsync(action.user.id)
            toast.success(`${action.user.name}: 2FA сброшена`)
            close()
          } catch (error) {
            toast.error(errorMessage(error))
          }
        }}
      />
    </>
  )
}

function RoleDialog({
  user,
  roles,
  pending,
  onClose,
  onSave,
}: {
  user: User
  roles: RoleOption[]
  pending: boolean
  onClose: () => void
  onSave: (role: Role) => void
}) {
  const [role, setRole] = useState<Role>(user.role)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Роль: {user.name}</DialogTitle>
          <DialogDescription>Новые права начинают действовать сразу.</DialogDescription>
        </DialogHeader>
        <Select value={role} onValueChange={(value) => setRole(value as Role)}>
          <SelectTrigger className="w-full" aria-label="Роль">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={() => onSave(role)} disabled={pending || role === user.role}>
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

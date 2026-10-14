import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { CopyField } from '@/components/copy-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { errorMessage } from '@/lib/api-client'
import { roleSchema } from '@/lib/session'
import type { RoleOption } from '../api/users-api'
import { useInviteUser } from '../hooks/use-users'

const inviteSchema = z.object({
  name: z.string().trim().min(1, { message: 'Укажите имя' }).max(120),
  email: z.email({ message: 'Укажите рабочий email' }),
  role: roleSchema,
})
type InviteForm = z.infer<typeof inviteSchema>

/**
 * There is no email sending yet: the dialog shows the one-time link, and the
 * person who invites passes it on (Telegram, mail). It works for 7 days.
 */
export function InviteUserDialog({ roles }: { roles: RoleOption[] }) {
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const invite = useInviteUser()
  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { name: '', email: '', role: roles.at(-1)?.value ?? 'hr' },
  })
  const { errors } = form.formState

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setLink(null)
      invite.reset()
      form.reset()
    }
  }

  async function submit(values: InviteForm) {
    const result = await invite.mutateAsync(values).catch(() => null)
    if (result) setLink(result.link)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus aria-hidden="true" />
          Пригласить
        </Button>
      </DialogTrigger>
      <DialogContent>
        {link ? (
          <>
            <DialogHeader>
              <DialogTitle>Приглашение готово</DialogTitle>
              <DialogDescription>
                Отправьте ссылку сотруднику — по ней он задаст пароль. Ссылка одноразовая и
                действует 7 дней.
              </DialogDescription>
            </DialogHeader>
            <CopyField value={link} label="Ссылка-приглашение" />
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Готово</Button>
            </DialogFooter>
          </>
        ) : (
          <form noValidate onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Пригласить сотрудника</DialogTitle>
              <DialogDescription>
                Доступ определяется ролью — её можно сменить позже.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="invite-name">Имя и фамилия</Label>
              <Input
                id="invite-name"
                autoFocus
                aria-invalid={errors.name ? true : undefined}
                {...form.register('name')}
              />
              {errors.name ? (
                <p className="text-destructive text-sm">{errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                aria-invalid={errors.email ? true : undefined}
                {...form.register('email')}
              />
              {errors.email ? (
                <p className="text-destructive text-sm">{errors.email.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Роль</Label>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="invite-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {invite.error ? (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage(invite.error)}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? 'Создаём…' : 'Создать приглашение'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

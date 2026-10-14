import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/api-client'
import { PASSWORD_HINT, passwordField } from '@/lib/password'
import { useChangePassword } from '../hooks/use-profile'

const schema = z
  .object({
    currentPassword: z.string().min(1, { message: 'Введите текущий пароль' }),
    newPassword: passwordField,
    confirm: z.string(),
  })
  .refine((values) => values.newPassword === values.confirm, {
    message: 'Пароли не совпадают',
    path: ['confirm'],
  })
type Values = z.infer<typeof schema>

export function ChangePasswordForm() {
  const change = useChangePassword()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  })
  const { errors } = form.formState

  async function submit({ currentPassword, newPassword }: Values) {
    const ok = await change
      .mutateAsync({ currentPassword, newPassword })
      .then(() => true)
      .catch(() => false)
    if (ok) {
      form.reset()
      toast.success('Пароль изменён. На других устройствах нужно будет войти заново.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Пароль</CardTitle>
        <CardDescription>После смены другие сеансы завершатся, этот останется.</CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={form.handleSubmit(submit)} className="max-w-sm space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Текущий пароль</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.currentPassword ? true : undefined}
              {...form.register('currentPassword')}
            />
            {errors.currentPassword ? (
              <p className="text-destructive text-sm">{errors.currentPassword.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Новый пароль</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.newPassword ? true : undefined}
              {...form.register('newPassword')}
            />
            <p
              className={
                errors.newPassword ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'
              }
            >
              {errors.newPassword?.message ?? PASSWORD_HINT}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">Повторите новый пароль</Label>
            <Input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.confirm ? true : undefined}
              {...form.register('confirm')}
            />
            {errors.confirm ? (
              <p className="text-destructive text-sm">{errors.confirm.message}</p>
            ) : null}
          </div>
          {change.error ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(change.error)}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" disabled={change.isPending}>
            {change.isPending ? 'Сохраняем…' : 'Сменить пароль'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

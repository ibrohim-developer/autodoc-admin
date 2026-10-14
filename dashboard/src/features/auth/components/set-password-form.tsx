import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/api-client'
import { PASSWORD_HINT, passwordField } from '@/lib/password'
import { useSetPassword } from '../hooks/use-auth'

const newPasswordSchema = z
  .object({
    password: passwordField,
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: 'Пароли не совпадают',
    path: ['confirm'],
  })
type NewPassword = z.infer<typeof newPasswordSchema>

export function SetPasswordForm({ token, onDone }: { token: string; onDone: () => void }) {
  const setPassword = useSetPassword()
  const form = useForm<NewPassword>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  })
  const { errors } = form.formState

  async function submit({ password }: NewPassword) {
    const ok = await setPassword
      .mutateAsync({ token, password })
      .then(() => true)
      .catch(() => false)
    if (ok) onDone()
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-password">Новый пароль</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          autoFocus
          aria-invalid={errors.password ? true : undefined}
          aria-describedby="new-password-hint"
          {...form.register('password')}
        />
        <p
          id="new-password-hint"
          className={errors.password ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'}
        >
          {errors.password?.message ?? PASSWORD_HINT}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Повторите пароль</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.confirm ? true : undefined}
          aria-describedby={errors.confirm ? 'confirm-password-error' : undefined}
          {...form.register('confirm')}
        />
        {errors.confirm ? (
          <p id="confirm-password-error" className="text-destructive text-sm">
            {errors.confirm.message}
          </p>
        ) : null}
      </div>
      {setPassword.error ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(setPassword.error)}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" className="w-full" disabled={setPassword.isPending}>
        {setPassword.isPending ? 'Сохраняем…' : 'Сохранить пароль'}
      </Button>
    </form>
  )
}

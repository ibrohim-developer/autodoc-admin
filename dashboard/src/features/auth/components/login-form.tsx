import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/api-client'
import { useLogin } from '../hooks/use-auth'

const credentialsSchema = z.object({
  email: z.email({ message: 'Введите email' }),
  password: z.string().min(1, { message: 'Введите пароль' }),
})
type Credentials = z.infer<typeof credentialsSchema>

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(6, { message: 'Код из 6 цифр или резервный код' })
    .max(20, { message: 'Слишком длинный код' }),
})
type CodeForm = z.infer<typeof codeSchema>

/**
 * Step one: email and password. If the account has 2FA, step two asks for the
 * authenticator code (or a recovery code) and resends everything together.
 */
export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const loginMutation = useLogin()
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  const credentialsForm = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: '', password: '' },
  })
  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  })

  async function submitCredentials(values: Credentials) {
    loginMutation.reset()
    const result = await loginMutation.mutateAsync(values).catch(() => null)
    if (!result) return
    if (result.status === 'two_factor_required') setCredentials(values)
    else onSuccess()
  }

  async function submitCode({ code }: CodeForm) {
    if (!credentials) return
    loginMutation.reset()
    const result = await loginMutation.mutateAsync({ ...credentials, code }).catch(() => null)
    if (result?.status === 'ok') onSuccess()
  }

  const error = loginMutation.error ? (
    <Alert variant="destructive">
      <AlertDescription>{errorMessage(loginMutation.error)}</AlertDescription>
    </Alert>
  ) : null

  if (credentials) {
    const { errors } = codeForm.formState
    return (
      <form noValidate onSubmit={codeForm.handleSubmit(submitCode)} className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Введите 6-значный код из приложения-аутентификатора. Если телефона нет под рукой — один из
          резервных кодов.
        </p>
        <div className="space-y-2">
          <Label htmlFor="login-code">Код</Label>
          <Input
            id="login-code"
            autoComplete="one-time-code"
            inputMode="text"
            autoFocus
            aria-invalid={errors.code ? true : undefined}
            aria-describedby={errors.code ? 'login-code-error' : undefined}
            {...codeForm.register('code')}
          />
          {errors.code ? (
            <p id="login-code-error" className="text-destructive text-sm">
              {errors.code.message}
            </p>
          ) : null}
        </div>
        {error}
        <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? 'Проверяем…' : 'Войти'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            setCredentials(null)
            loginMutation.reset()
            codeForm.reset()
          }}
        >
          Назад
        </Button>
      </form>
    )
  }

  const { errors } = credentialsForm.formState
  return (
    <form
      noValidate
      onSubmit={credentialsForm.handleSubmit(submitCredentials)}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="username"
          autoFocus
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          {...credentialsForm.register('email')}
        />
        {errors.email ? (
          <p id="login-email-error" className="text-destructive text-sm">
            {errors.email.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Пароль</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? 'login-password-error' : undefined}
          {...credentialsForm.register('password')}
        />
        {errors.password ? (
          <p id="login-password-error" className="text-destructive text-sm">
            {errors.password.message}
          </p>
        ) : null}
      </div>
      {error}
      <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
        {loginMutation.isPending ? 'Входим…' : 'Войти'}
      </Button>
    </form>
  )
}

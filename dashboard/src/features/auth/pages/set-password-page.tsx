import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { errorMessage } from '@/lib/api-client'
import { AuthShell } from '../components/auth-shell'
import { SetPasswordForm } from '../components/set-password-form'
import { usePasswordTokenInfo } from '../hooks/use-auth'

/**
 * Invite and reset links look like /set-password#<token>. The token sits in the
 * fragment so it never reaches a server log; it is read once and then removed
 * from the address bar.
 */
function readTokenOnce(): string {
  const token = window.location.hash.replace(/^#/, '')
  if (token) window.history.replaceState(null, '', window.location.pathname)
  return token
}

export function SetPasswordPage() {
  const [token] = useState(readTokenOnce)
  const [done, setDone] = useState(false)
  const info = usePasswordTokenInfo(token)

  if (done) {
    return (
      <AuthShell title="Пароль сохранён">
        <div className="space-y-4 text-center">
          <CircleCheck className="mx-auto size-10 text-primary" aria-hidden="true" />
          <p className="text-muted-foreground text-sm">Теперь войдите с новым паролем.</p>
          <Link to="/login" className={buttonVariants({ className: 'w-full' })}>
            Перейти ко входу
          </Link>
        </div>
      </AuthShell>
    )
  }

  if (!token || info.isError) {
    return (
      <AuthShell title="Ссылка не работает">
        <Alert variant="destructive">
          <AlertDescription>
            {token
              ? errorMessage(info.error)
              : 'В ссылке нет ключа. Откройте её целиком из письма или сообщения.'}
          </AlertDescription>
        </Alert>
        <Link
          to="/login"
          className={buttonVariants({ variant: 'outline', className: 'mt-4 w-full' })}
        >
          Ко входу
        </Link>
      </AuthShell>
    )
  }

  if (!info.data) {
    return (
      <AuthShell title="Проверяем ссылку…">
        <p className="text-muted-foreground text-sm">Секунду.</p>
      </AuthShell>
    )
  }

  const invite = info.data.purpose === 'invite'
  return (
    <AuthShell
      title={invite ? 'Добро пожаловать' : 'Новый пароль'}
      description={
        <>
          {invite ? 'Придумайте пароль для входа в админку.' : 'Задайте новый пароль.'}
          <br />
          {info.data.name}, {info.data.email}
        </>
      }
    >
      <SetPasswordForm token={token} onDone={() => setDone(true)} />
    </AuthShell>
  )
}

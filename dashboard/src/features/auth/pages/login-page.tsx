import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useSession } from '@/lib/session'
import { AuthShell } from '../components/auth-shell'
import { LoginForm } from '../components/login-form'

/** Only same-site paths: `?next=https://evil.example` must not redirect anywhere. */
function safeNext(next: string | null): string {
  return next?.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export function LoginPage() {
  const { data: me } = useSession()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNext(params.get('next'))

  if (me) return <Navigate to={next} replace />

  return (
    <AuthShell title="Вход" description="Админ-панель сайта autodoc.uz">
      <LoginForm onSuccess={() => navigate(next, { replace: true })} />
    </AuthShell>
  )
}

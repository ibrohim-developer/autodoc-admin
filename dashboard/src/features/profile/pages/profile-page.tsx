import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMe } from '@/lib/session'
import { ChangePasswordForm } from '../components/change-password-form'
import { TwoFactorCard } from '../components/two-factor-card'

export function ProfilePage() {
  const me = useMe()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Профиль и безопасность</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Имя, email и роль меняет администратор или маркетинг в разделе «Пользователи».
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{me.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{me.email}</dd>
            <dt className="text-muted-foreground">Роль</dt>
            <dd>{me.roleLabel}</dd>
          </dl>
        </CardContent>
      </Card>

      <ChangePasswordForm />
      <TwoFactorCard me={me} />
    </div>
  )
}

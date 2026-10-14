import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/** Plain-language summary of api/src/auth/permissions.ts, for whoever hands out roles. */
const ROLES = [
  {
    title: 'Администратор',
    text: 'Всё, включая интеграции (Telegram, hh.uz), журнал действий и учётные записи администраторов.',
  },
  {
    title: 'Маркетинг',
    text: 'Весь контент сайта, вакансии и отклики, заявки, статистика, корзина, приглашение сотрудников с ролями «Маркетинг» и «HR».',
  },
  {
    title: 'HR',
    text: 'Вакансии и направления, отклики кандидатов с резюме и выгрузкой в Excel, статистика по вакансиям.',
  },
]

export function RolesOverview() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Что доступно каждой роли</CardTitle>
        <CardDescription>
          Разделы, недоступные роли, скрыты из меню, а сервер отвечает на них отказом.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-3">
          {ROLES.map((role) => (
            <div key={role.title}>
              <dt className="font-medium text-sm">{role.title}</dt>
              <dd className="mt-1 text-muted-foreground text-sm">{role.text}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

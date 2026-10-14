import { BarChart3, FilePen, Inbox, UserRoundSearch } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { can, type Permission, useMe } from '@/lib/session'

type Widget = {
  title: string
  description: string
  icon: typeof Inbox
  /** Any one of these makes the widget relevant to the user. */
  permissions: Permission[]
  stage: string
}

/** The start screen from the spec. Each widget fills in when its module ships. */
const WIDGETS: Widget[] = [
  {
    title: 'Новые отклики',
    description: 'Кандидаты, которые откликнулись на вакансии и ещё не просмотрены.',
    icon: UserRoundSearch,
    permissions: ['applications.read'],
    stage: 'Этап 4',
  },
  {
    title: 'Новые заявки',
    description: 'Обращения из форм сайта, которые ждут ответа.',
    icon: Inbox,
    permissions: ['leads.read'],
    stage: 'Этап 4',
  },
  {
    title: 'Просмотры за неделю',
    description: 'Посетители и просмотры сайта за последние 7 дней.',
    icon: BarChart3,
    permissions: ['stats.general', 'stats.vacancies'],
    stage: 'Этап 5',
  },
  {
    title: 'Черновики',
    description: 'Неопубликованные новости, вакансии и проекты.',
    icon: FilePen,
    permissions: ['content.read', 'vacancies.read'],
    stage: 'Этап 3',
  },
]

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat('ru-RU', { hour: 'numeric', timeZone: 'Asia/Tashkent' }).format(
      new Date(),
    ),
  )
  if (hour < 5) return 'Доброй ночи'
  if (hour < 12) return 'Доброе утро'
  if (hour < 18) return 'Добрый день'
  return 'Добрый вечер'
}

export function HomePage() {
  const me = useMe()
  const widgets = WIDGETS.filter((widget) =>
    widget.permissions.some((permission) => can(me, permission)),
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">
          {greeting()}, {me.name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">Роль: {me.roleLabel}</p>
      </div>

      <section aria-labelledby="widgets-title" className="space-y-3">
        <h2 id="widgets-title" className="font-medium text-muted-foreground text-sm">
          Главное за сегодня
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {widgets.map(({ title, description, icon: Icon, stage }) => (
            <Card key={title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="size-4 text-primary" aria-hidden="true" />
                  {title}
                  <Badge variant="outline" className="ml-auto font-normal">
                    {stage}
                  </Badge>
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">Данные появятся вместе с модулем.</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}

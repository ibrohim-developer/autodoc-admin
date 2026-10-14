import { BarChart3, FilePen, Inbox, type LucideIcon, UserRoundSearch } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { DailyChart } from '@/components/charts/daily-chart'
import { formatCount } from '@/components/charts/format'
import { StatTile } from '@/components/charts/stat-tile'
import { StatusBadge } from '@/components/content/status-badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { errorMessage } from '@/lib/api-client'
import { formatDateTime } from '@/lib/format'
import { useCan, useMe } from '@/lib/session'
import { editorPath } from '../api/home-api'
import { useHome } from '../hooks/use-home'

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

function Widget({
  title,
  icon: Icon,
  to,
  count,
  children,
}: {
  title: string
  icon: LucideIcon
  /** "Все →" opens the section. */
  to: string
  /** The badge next to the title: how many wait. */
  count?: number
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-primary" aria-hidden="true" />
          <Link to={to} className="hover:underline">
            {title}
          </Link>
          {count !== undefined && count > 0 ? (
            <Badge className="ml-auto tabular-nums">{count}</Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>
}

export function HomePage() {
  const me = useMe()
  const home = useHome()
  const draftsPath = useCan('content.read') ? '/news' : '/vacancies'
  const data = home.data

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
        {home.isPending ? <p className="text-muted-foreground text-sm">Загружаем…</p> : null}
        {home.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(home.error)}</AlertDescription>
          </Alert>
        ) : null}
        {data ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.applications ? (
              <Widget
                title="Новые отклики"
                icon={UserRoundSearch}
                to="/applications"
                count={data.applications.new}
              >
                {data.applications.latest.length === 0 ? (
                  <Empty>Откликов пока нет.</Empty>
                ) : (
                  <ul className="divide-y text-sm">
                    {data.applications.latest.map((item) => (
                      <li key={item.id} className="flex items-baseline justify-between gap-3 py-2">
                        <Link
                          to={`/applications/${item.id}`}
                          className={
                            item.status === 'new'
                              ? 'font-medium hover:underline'
                              : 'hover:underline'
                          }
                        >
                          {item.name}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {item.vacancyTitle ?? 'Другая позиция'}
                          </span>
                        </Link>
                        <span className="shrink-0 text-muted-foreground text-xs">
                          {formatDateTime(item.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Widget>
            ) : null}

            {data.leads ? (
              <Widget title="Новые заявки" icon={Inbox} to="/leads" count={data.leads.new}>
                {data.leads.latest.length === 0 ? (
                  <Empty>Заявок пока нет.</Empty>
                ) : (
                  <ul className="divide-y text-sm">
                    {data.leads.latest.map((item) => (
                      <li key={item.id} className="flex items-baseline justify-between gap-3 py-2">
                        <Link
                          to={`/leads/${item.id}`}
                          className={
                            item.status === 'new'
                              ? 'font-medium hover:underline'
                              : 'hover:underline'
                          }
                        >
                          {item.name}
                          {item.topic ? (
                            <span className="ml-2 font-normal text-muted-foreground">
                              {item.topic}
                            </span>
                          ) : null}
                        </Link>
                        <span className="shrink-0 text-muted-foreground text-xs">
                          {formatDateTime(item.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Widget>
            ) : null}

            {data.views ? (
              <Widget
                title={data.views.scope === 'site' ? 'Просмотры за неделю' : 'Вакансии за неделю'}
                icon={BarChart3}
                to="/stats"
              >
                <div className="grid grid-cols-2 gap-3">
                  <StatTile
                    label="Посетители"
                    value={formatCount(data.views.totals.visitors)}
                    current={data.views.totals.visitors}
                    previous={data.views.previous.visitors}
                  />
                  <StatTile
                    label="Просмотры"
                    value={formatCount(data.views.totals.views)}
                    current={data.views.totals.views}
                    previous={data.views.previous.views}
                  />
                </div>
                <div className="mt-4">
                  <DailyChart
                    label="Просмотры за 7 дней"
                    unit="просмотров"
                    points={data.views.daily.map((point) => ({
                      day: point.day,
                      value: point.views,
                    }))}
                  />
                </div>
              </Widget>
            ) : null}

            {data.drafts ? (
              <Widget title="Черновики" icon={FilePen} to={draftsPath} count={data.drafts.total}>
                {data.drafts.items.length === 0 ? (
                  <Empty>Всё опубликовано.</Empty>
                ) : (
                  <ul className="divide-y text-sm">
                    {data.drafts.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                        <Link
                          to={editorPath(item.type, item.id)}
                          className="min-w-0 hover:underline"
                        >
                          <span className="block truncate">{item.title}</span>
                          <span className="text-muted-foreground text-xs">{item.typeLabel}</span>
                        </Link>
                        <StatusBadge status={item.status} short />
                      </li>
                    ))}
                  </ul>
                )}
              </Widget>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}

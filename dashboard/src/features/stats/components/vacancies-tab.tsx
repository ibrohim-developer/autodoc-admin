import { formatCount } from '@/components/charts/format'
import { StatTile } from '@/components/charts/stat-tile'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { errorMessage } from '@/lib/api-client'
import type { PeriodQuery } from '../api/stats-api'
import { useVacancyStats } from '../hooks/use-stats'

const percent = (value: number | null) =>
  value === null ? '—' : `${String(value).replace('.', ',')}%`

export function VacanciesTab({ period }: { period: PeriodQuery }) {
  const stats = useVacancyStats(period)
  if (stats.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errorMessage(stats.error)}</AlertDescription>
      </Alert>
    )
  }
  if (!stats.data) return <p className="text-muted-foreground text-sm">Загружаем…</p>
  const { careerPage, totals, applications, vacancies } = stats.data

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Посетители «Карьеры»" value={formatCount(careerPage.visitors)} />
        <StatTile label="Просмотры вакансий" value={formatCount(totals.views)} />
        <StatTile label="Отклики" value={formatCount(applications.total)} />
        <StatTile label="На другую позицию" value={formatCount(applications.otherPosition)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Вакансии</CardTitle>
          <CardDescription>
            Конверсия — сколько откликов приходится на 100 посетителей страницы вакансии.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {vacancies.length === 0 ? (
            <p className="text-muted-foreground text-sm">Опубликованных вакансий пока нет</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Вакансия</TableHead>
                  <TableHead className="text-right">Просмотры</TableHead>
                  <TableHead className="text-right">Посетители</TableHead>
                  <TableHead className="text-right">Отклики</TableHead>
                  <TableHead className="text-right">Конверсия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vacancies.map((vacancy) => (
                  <TableRow key={vacancy.id}>
                    <TableCell className="max-w-80 truncate">
                      {vacancy.title}
                      {vacancy.closed ? (
                        <Badge variant="outline" className="ml-2 font-normal text-muted-foreground">
                          Закрыта
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(vacancy.views)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(vacancy.visitors)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(vacancy.applications)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {percent(vacancy.conversion)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

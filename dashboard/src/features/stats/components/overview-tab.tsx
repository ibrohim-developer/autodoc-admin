import { BarList } from '@/components/charts/bar-list'
import { DailyChart } from '@/components/charts/daily-chart'
import { formatCount, formatDuration } from '@/components/charts/format'
import { StatTile } from '@/components/charts/stat-tile'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { DEVICE_LABELS, LOCALE_NAMES, type PeriodQuery, SOURCE_LABELS } from '../api/stats-api'
import { useOverview } from '../hooks/use-stats'

export function OverviewTab({ period }: { period: PeriodQuery }) {
  const overview = useOverview(period)
  if (overview.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errorMessage(overview.error)}</AlertDescription>
      </Alert>
    )
  }
  if (!overview.data) return <p className="text-muted-foreground text-sm">Загружаем…</p>
  const data = overview.data

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Посетители"
          value={formatCount(data.totals.visitors)}
          current={data.totals.visitors}
          previous={data.previous.visitors}
        />
        <StatTile
          label="Просмотры"
          value={formatCount(data.totals.views)}
          current={data.totals.views}
          previous={data.previous.views}
        />
        <StatTile label="Время на странице" value={formatDuration(data.totals.avgSeconds)} />
        <StatTile
          label="Заявки и отклики"
          value={`${formatCount(data.forms.leads)} · ${formatCount(data.forms.applications)}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Посетители по дням</CardTitle>
          <CardDescription>
            Посетитель считается один раз в день: статистика без cookies не узнаёт его назавтра.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DailyChart
            label="Посетители по дням"
            unit="посетителей"
            points={data.daily.map((point) => ({ day: point.day, value: point.visitors }))}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Откуда приходят</CardTitle>
            <CardDescription>Заходы на сайт извне</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <BarList
              items={data.sources.map((row) => ({
                key: row.source,
                label: SOURCE_LABELS[row.source] ?? row.source,
                value: row.visits,
              }))}
            />
            {data.referrers.length > 0 ? (
              <div>
                <p className="mb-2 font-medium text-muted-foreground text-xs">Чаще всего</p>
                <ul className="space-y-1 text-sm">
                  {data.referrers.map((row) => (
                    <li key={`${row.source}-${row.name}`} className="flex justify-between gap-3">
                      <span className="truncate">{row.name}</span>
                      <span className="tabular-nums">{formatCount(row.visits)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Устройства</CardTitle>
            <CardDescription>Посетители</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              items={data.devices.map((row) => ({
                key: row.device,
                label: DEVICE_LABELS[row.device] ?? row.device,
                value: row.visitors,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Языки сайта</CardTitle>
            <CardDescription>Просмотры</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              items={data.locales.map((row) => ({
                key: row.locale,
                label: LOCALE_NAMES[row.locale] ?? row.locale,
                value: row.views,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Популярные страницы</CardTitle>
        </CardHeader>
        <CardContent>
          {data.pages.length === 0 ? (
            <p className="text-muted-foreground text-sm">Нет данных за период</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead grow>Страница</TableHead>
                  <TableHead className="text-right">Просмотры</TableHead>
                  <TableHead className="text-right">Посетители</TableHead>
                  <TableHead className="@xl:table-cell hidden text-right">Время</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pages.map((row) => (
                  <TableRow key={row.path}>
                    <TableCell grow className="truncate font-mono text-xs">
                      {row.path}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.views)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.visitors)}
                    </TableCell>
                    <TableCell className="@xl:table-cell hidden text-right tabular-nums">
                      {formatDuration(row.avgSeconds)}
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

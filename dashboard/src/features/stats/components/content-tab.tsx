import { formatCount, formatDuration } from '@/components/charts/format'
import { StatTile } from '@/components/charts/stat-tile'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useContentStats } from '../hooks/use-stats'

export function ContentTab({ period }: { period: PeriodQuery }) {
  const stats = useContentStats(period)
  if (stats.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errorMessage(stats.error)}</AlertDescription>
      </Alert>
    )
  }
  if (!stats.data) return <p className="text-muted-foreground text-sm">Загружаем…</p>
  const { totals, posts } = stats.data

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Просмотры новостей" value={formatCount(totals.views)} />
        <StatTile label="Читатели" value={formatCount(totals.visitors)} />
        <StatTile label="Среднее время чтения" value={formatDuration(totals.avgSeconds)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Новости</CardTitle>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <p className="text-muted-foreground text-sm">Опубликованных новостей пока нет</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Новость</TableHead>
                  <TableHead className="text-right">Просмотры</TableHead>
                  <TableHead className="text-right">Читатели</TableHead>
                  <TableHead className="text-right">Время чтения</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="max-w-96 truncate">{post.title}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(post.views)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(post.visitors)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDuration(post.avgSeconds)}
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

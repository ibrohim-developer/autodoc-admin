import { Plus, Search } from 'lucide-react'
import { type ReactNode, useDeferredValue, useState } from 'react'
import { Link } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { errorMessage } from '@/lib/api-client'
import {
  type DocumentStatus,
  type DocumentSummary,
  STATUS_LABELS,
  useDocuments,
} from '@/lib/content'
import { formatDateTime } from '@/lib/format'
import { LOCALE_LABELS } from '@/lib/media'
import { StatusBadge } from './status-badge'

export type Column = {
  header: string
  cell: (item: DocumentSummary) => ReactNode
  className?: string
}

const PAGE_SIZE = 25
const ALL = 'all'

/** The list of one section's documents: search, status filter, pages of 25. */
export function DocumentList({
  type,
  basePath,
  columns = [],
  canCreate,
  createLabel,
  empty,
}: {
  type: string
  /** Each document opens at `${basePath}/${id}`; a new one at `${basePath}/new`. */
  basePath: string
  /** Between the title and the status. */
  columns?: Column[]
  canCreate: boolean
  createLabel: string
  empty: string
}) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<DocumentStatus | typeof ALL>(ALL)
  const [page, setPage] = useState(1)
  const query = useDeferredValue(q.trim())
  const list = useDocuments(type, {
    q: query,
    status: status === ALL ? undefined : status,
    page,
    pageSize: PAGE_SIZE,
  })
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={q}
            onChange={(event) => {
              setQ(event.target.value)
              setPage(1)
            }}
            placeholder="Поиск по тексту"
            aria-label="Поиск"
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as DocumentStatus | typeof ALL)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-60" aria-label="Статус">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Все статусы</SelectItem>
            {(Object.keys(STATUS_LABELS) as DocumentStatus[]).map((value) => (
              <SelectItem key={value} value={value}>
                {STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canCreate ? (
          <Button asChild>
            <Link to={`${basePath}/new`}>
              <Plus aria-hidden="true" />
              {createLabel}
            </Link>
          </Button>
        ) : null}
      </div>

      {list.isError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            {errorMessage(list.error)}
            <Button size="sm" variant="outline" onClick={() => list.refetch()}>
              Повторить
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {list.isPending ? <p className="text-muted-foreground text-sm">Загружаем…</p> : null}

      {list.data && list.data.items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
          {query || status !== ALL ? 'Ничего не найдено' : empty}
        </div>
      ) : null}

      {list.data && list.data.items.length > 0 ? (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                {columns.map((column) => (
                  <TableHead key={column.header} className={column.className}>
                    {column.header}
                  </TableHead>
                ))}
                <TableHead>Статус</TableHead>
                <TableHead className="hidden md:table-cell">Изменено</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-96 whitespace-normal">
                    <Link
                      to={`${basePath}/${item.id}`}
                      className="font-medium hover:underline focus-visible:underline"
                    >
                      {item.title || 'Без названия'}
                    </Link>
                    <p className="mt-0.5 text-muted-foreground text-xs">
                      {item.locales.map((locale) => LOCALE_LABELS[locale]).join(' · ')}
                    </p>
                  </TableCell>
                  {columns.map((column) => (
                    <TableCell key={column.header} className={column.className}>
                      {column.cell(item)}
                    </TableCell>
                  ))}
                  <TableCell>
                    <StatusBadge status={item.status} short />
                    {item.scheduledAt ? (
                      <p className="mt-1 text-muted-foreground text-xs">
                        {formatDateTime(item.scheduledAt)}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground text-sm md:table-cell">
                    {formatDateTime(item.updatedAt)}
                    {item.updatedBy ? <p className="text-xs">{item.updatedBy.name}</p> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {pages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Назад
          </Button>
          <span className="text-muted-foreground tabular-nums">
            {page} из {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((current) => current + 1)}
          >
            Дальше
          </Button>
        </div>
      ) : null}
    </div>
  )
}

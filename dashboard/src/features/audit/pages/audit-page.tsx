import { Search } from 'lucide-react'
import { Fragment, useDeferredValue, useState } from 'react'
import { Link } from 'react-router'
import { type Period, PeriodFilter } from '@/components/inbox/period-filter'
import { Pager } from '@/components/pager'
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
import { formatDateTime } from '@/lib/format'
import { ACTION_LABELS, type AuditEntry, entityLink, SECTIONS } from '../api/audit-api'
import { useAudit, useAuditUsers } from '../hooks/use-audit'

const PAGE_SIZE = 50
const ALL = 'all'
const DAY_MS = 86_400_000

/** A Tashkent day (YYYY-MM-DD) as the instant it starts. */
function dayStart(day: string): string {
  return new Date(`${day}T00:00:00+05:00`).toISOString()
}

function Details({ entry }: { entry: AuditEntry }) {
  return (
    <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-[8rem_1fr]">
      {entry.ip ? (
        <>
          <dt className="text-muted-foreground">IP</dt>
          <dd className="font-mono">{entry.ip}</dd>
        </>
      ) : null}
      {entry.userAgent ? (
        <>
          <dt className="text-muted-foreground">Браузер</dt>
          <dd className="break-all">{entry.userAgent}</dd>
        </>
      ) : null}
      {entry.entityId ? (
        <>
          <dt className="text-muted-foreground">Объект</dt>
          <dd className="font-mono">
            {entry.entityType} · {entry.entityId}
          </dd>
        </>
      ) : null}
      {entry.meta ? (
        <>
          <dt className="text-muted-foreground">Подробности</dt>
          <dd>
            <pre className="whitespace-pre-wrap break-all font-mono">
              {JSON.stringify(entry.meta, null, 2)}
            </pre>
          </dd>
        </>
      ) : null}
    </dl>
  )
}

/** "Журнал действий": administrators only. Entries are kept 12 months. */
export function AuditPage() {
  const [section, setSection] = useState(ALL)
  const [userId, setUserId] = useState(ALL)
  const [q, setQ] = useState('')
  const [period, setPeriod] = useState<Period>({ from: '', to: '' })
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<string | null>(null)
  const query = useDeferredValue(q.trim())
  const users = useAuditUsers()
  const list = useAudit({
    section: section === ALL ? undefined : section,
    userId: userId === ALL ? undefined : userId,
    q: query || undefined,
    from: period.from ? dayStart(period.from) : undefined,
    to: period.to ? new Date(Date.parse(dayStart(period.to)) + DAY_MS).toISOString() : undefined,
    page,
    pageSize: PAGE_SIZE,
  })
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1
  const firstPage =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value)
      setPage(1)
    }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Журнал действий</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Кто что сделал в админке: входы, изменения, выгрузки, скачанные резюме. Записи хранятся 12
          месяцев.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={q}
            onChange={(event) => firstPage(setQ)(event.target.value)}
            placeholder="Текст, email или id объекта"
            aria-label="Поиск"
            className="pl-9"
          />
        </div>
        <Select value={section} onValueChange={firstPage(setSection)}>
          <SelectTrigger className="w-52" aria-label="Раздел">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Все разделы</SelectItem>
            {Object.entries(SECTIONS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={userId} onValueChange={firstPage(setUserId)}>
          <SelectTrigger className="w-52" aria-label="Пользователь">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Все пользователи</SelectItem>
            {(users.data?.items ?? []).map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <PeriodFilter value={period} onChange={firstPage(setPeriod)} />
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
          Ничего не найдено
        </div>
      ) : null}

      {list.data && list.data.items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Когда</TableHead>
                <TableHead className="@2xl:table-cell hidden">Кто</TableHead>
                <TableHead>Действие</TableHead>
                <TableHead grow className="@4xl:table-cell hidden">
                  Что
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((entry) => {
                const link = entityLink(entry)
                const expanded = open === entry.id
                return (
                  <Fragment key={entry.id}>
                    <TableRow>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(entry.createdAt)}
                      </TableCell>
                      <TableCell className="@2xl:table-cell hidden text-sm">
                        {entry.userEmail ?? '—'}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setOpen(expanded ? null : entry.id)}
                          className="text-left hover:underline"
                        >
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </button>
                        <p className="@4xl:hidden text-muted-foreground text-xs">{entry.summary}</p>
                      </TableCell>
                      <TableCell grow className="@4xl:table-cell hidden truncate text-sm">
                        {link && entry.summary ? (
                          <Link to={link} className="hover:underline">
                            {entry.summary}
                          </Link>
                        ) : (
                          (entry.summary ?? '—')
                        )}
                      </TableCell>
                    </TableRow>
                    {expanded ? (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={4} className="whitespace-normal">
                          <Details entry={entry} />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <Pager page={page} pages={pages} onChange={setPage} />
    </div>
  )
}

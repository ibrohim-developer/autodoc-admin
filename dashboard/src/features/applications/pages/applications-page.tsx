import { Download, FileText, Search, UserRoundSearch } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { InboxStatusBadge } from '@/components/inbox/inbox-status'
import { type Period, PeriodFilter } from '@/components/inbox/period-filter'
import { StatusTabs } from '@/components/inbox/status-tabs'
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
import { errorMessage, saveFile } from '@/lib/api-client'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { useCan } from '@/lib/session'
import {
  APPLICATION_SOURCES,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_TONES,
  APPLICATION_STATUSES,
  type ApplicationSource,
  type ApplicationStatus,
  exportApplications,
  SOURCE_LABELS,
} from '../api/applications-api'
import { AddApplicationDialog } from '../components/add-application-dialog'
import { useApplications, useVacancyOptions } from '../hooks/use-applications'

const PAGE_SIZE = 25
const ALL = 'all'

export function ApplicationsPage() {
  const canWrite = useCan('applications.write')
  const canExport = useCan('applications.export')
  const [status, setStatus] = useState<ApplicationStatus | undefined>(undefined)
  const [vacancyId, setVacancyId] = useState(ALL)
  const [source, setSource] = useState<ApplicationSource | typeof ALL>(ALL)
  const [q, setQ] = useState('')
  const [period, setPeriod] = useState<Period>({ from: '', to: '' })
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const query = useDeferredValue(q.trim())
  const vacancies = useVacancyOptions()
  const filters = {
    status,
    vacancyId: vacancyId === ALL ? undefined : vacancyId,
    source: source === ALL ? undefined : source,
    q: query || undefined,
    from: period.from,
    to: period.to,
  }
  const list = useApplications({ ...filters, page, pageSize: PAGE_SIZE })
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1
  const filtered = Boolean(
    status || query || period.from || period.to || vacancyId !== ALL || source !== ALL,
  )
  const firstPage =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value)
      setPage(1)
    }

  async function onExport() {
    setExporting(true)
    try {
      saveFile(await exportApplications(filters))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Отклики</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Кандидаты с сайта и добавленные вручную. Резюме открываются только здесь, каждое
            скачивание записывается в журнал.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport ? (
            <Button variant="outline" onClick={onExport} disabled={exporting}>
              <Download aria-hidden="true" />
              {exporting ? 'Готовим файл…' : 'Выгрузить в Excel'}
            </Button>
          ) : null}
          {canWrite ? <AddApplicationDialog vacancies={vacancies.data?.items ?? []} /> : null}
        </div>
      </div>

      <StatusTabs
        statuses={APPLICATION_STATUSES}
        labels={APPLICATION_STATUS_LABELS}
        counts={list.data?.counts}
        value={status}
        onChange={firstPage(setStatus)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={q}
            onChange={(event) => firstPage(setQ)(event.target.value)}
            placeholder="Имя, телефон, текст или №"
            aria-label="Поиск"
            className="pl-9"
          />
        </div>
        <Select value={vacancyId} onValueChange={firstPage(setVacancyId)}>
          <SelectTrigger className="w-64" aria-label="Вакансия">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Все вакансии</SelectItem>
            <SelectItem value="none">Другая позиция</SelectItem>
            {(vacancies.data?.items ?? []).map((vacancy) => (
              <SelectItem key={vacancy.id} value={vacancy.id}>
                {vacancy.title}
                {vacancy.newApplications > 0 ? ` · новых ${vacancy.newApplications}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={source}
          onValueChange={(value) => firstPage(setSource)(value as ApplicationSource | typeof ALL)}
        >
          <SelectTrigger className="w-44" aria-label="Источник">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Все источники</SelectItem>
            {APPLICATION_SOURCES.map((value) => (
              <SelectItem key={value} value={value}>
                {SOURCE_LABELS[value]}
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
        <div className="grid place-items-center rounded-xl border border-dashed py-16 text-center">
          <UserRoundSearch className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-muted-foreground text-sm">
            {filtered ? 'Ничего не найдено' : 'Откликов пока нет'}
          </p>
        </div>
      ) : null}

      {list.data && list.data.items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">№</TableHead>
                <TableHead>Кандидат</TableHead>
                <TableHead grow className="@xl:table-cell hidden">
                  Вакансия
                </TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="@4xl:table-cell hidden">Источник</TableHead>
                <TableHead className="@2xl:table-cell hidden">Получен</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((application) => (
                <TableRow
                  key={application.id}
                  className={cn(application.status === 'new' && 'font-medium')}
                >
                  <TableCell className="text-muted-foreground tabular-nums">
                    {application.number}
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/applications/${application.id}`}
                      className="hover:underline focus-visible:underline"
                    >
                      {application.name}
                    </Link>
                    <p className="flex items-center gap-1 font-normal text-muted-foreground text-xs">
                      {application.phone}
                      {application.resume ? (
                        <FileText className="size-3" aria-label="Есть резюме" />
                      ) : null}
                    </p>
                  </TableCell>
                  <TableCell grow className="@xl:table-cell hidden truncate font-normal">
                    {application.vacancy?.title ?? (
                      <span className="text-muted-foreground">Другая позиция</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <InboxStatusBadge
                      tone={APPLICATION_STATUS_TONES[application.status]}
                      label={APPLICATION_STATUS_LABELS[application.status]}
                    />
                  </TableCell>
                  <TableCell className="@4xl:table-cell hidden font-normal text-sm">
                    {application.sourceLabel}
                  </TableCell>
                  <TableCell className="@2xl:table-cell hidden font-normal text-muted-foreground text-sm">
                    {formatDateTime(application.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <Pager page={page} pages={pages} onChange={setPage} />
    </div>
  )
}

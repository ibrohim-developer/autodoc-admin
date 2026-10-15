import { Download, Inbox, Search } from 'lucide-react'
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
  exportLeads,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONES,
  LEAD_STATUSES,
  type LeadStatus,
} from '../api/leads-api'
import { useLeads } from '../hooks/use-leads'

const PAGE_SIZE = 25

export function LeadsPage() {
  const canExport = useCan('leads.export')
  const [status, setStatus] = useState<LeadStatus | undefined>(undefined)
  const [q, setQ] = useState('')
  const [period, setPeriod] = useState<Period>({ from: '', to: '' })
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const query = useDeferredValue(q.trim())
  const filters = { status, q: query || undefined, from: period.from, to: period.to }
  const list = useLeads({ ...filters, page, pageSize: PAGE_SIZE })
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1
  const filtered = Boolean(status || query || period.from || period.to)

  async function onExport() {
    setExporting(true)
    try {
      saveFile(await exportLeads(filters))
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
          <h1 className="font-semibold text-2xl tracking-tight">Заявки</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Обращения из форм сайта. Новые приходят и в Telegram — без имён и телефонов.
          </p>
        </div>
        {canExport ? (
          <Button variant="outline" onClick={onExport} disabled={exporting}>
            <Download aria-hidden="true" />
            {exporting ? 'Готовим файл…' : 'Выгрузить в Excel'}
          </Button>
        ) : null}
      </div>

      <StatusTabs
        statuses={LEAD_STATUSES}
        labels={LEAD_STATUS_LABELS}
        counts={list.data?.counts}
        value={status}
        onChange={(value) => {
          setStatus(value)
          setPage(1)
        }}
      />

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
            placeholder="Имя, телефон, текст или №"
            aria-label="Поиск"
            className="pl-9"
          />
        </div>
        <PeriodFilter
          value={period}
          onChange={(value) => {
            setPeriod(value)
            setPage(1)
          }}
        />
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
          <Inbox className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-muted-foreground text-sm">
            {filtered ? 'Ничего не найдено' : 'Заявок пока нет'}
          </p>
        </div>
      ) : null}

      {list.data && list.data.items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">№</TableHead>
                <TableHead>Кто</TableHead>
                <TableHead grow className="@xl:table-cell hidden">
                  Тема
                </TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="@2xl:table-cell hidden">Получена</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((lead) => (
                <TableRow key={lead.id} className={cn(lead.status === 'new' && 'font-medium')}>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {lead.number}
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/leads/${lead.id}`}
                      className="hover:underline focus-visible:underline"
                    >
                      {lead.name}
                    </Link>
                    <p className="font-normal text-muted-foreground text-xs">{lead.phone}</p>
                  </TableCell>
                  <TableCell grow className="@xl:table-cell hidden font-normal">
                    <p className="truncate">{lead.topic ?? lead.message ?? '—'}</p>
                    <p className="truncate text-muted-foreground text-xs">
                      {lead.formLabel} · {lead.locale.toUpperCase()}
                    </p>
                  </TableCell>
                  <TableCell>
                    <InboxStatusBadge
                      tone={LEAD_STATUS_TONES[lead.status]}
                      label={LEAD_STATUS_LABELS[lead.status]}
                    />
                  </TableCell>
                  <TableCell className="@2xl:table-cell hidden font-normal text-muted-foreground text-sm">
                    {formatDateTime(lead.createdAt)}
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

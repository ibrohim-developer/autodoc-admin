import { ArrowLeft, Phone, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CommentForm } from '@/components/inbox/comment-form'
import { DetailRow } from '@/components/inbox/detail-row'
import { InboxStatusBadge } from '@/components/inbox/inbox-status'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { errorMessage } from '@/lib/api-client'
import { formatDateTime } from '@/lib/format'
import { useCan } from '@/lib/session'
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONES,
  LEAD_STATUSES,
  type LeadChanges,
  type LeadStatus,
} from '../api/leads-api'
import { useDeleteLead, useLead, useUpdateLead } from '../hooks/use-leads'

const LANGUAGES: Record<string, string> = { uz: 'Узбекский', ru: 'Русский', en: 'Английский' }

export function LeadPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const canWrite = useCan('leads.write')
  const lead = useLead(id)
  const update = useUpdateLead(id)
  const remove = useDeleteLead()
  const [confirming, setConfirming] = useState(false)

  async function save(changes: LeadChanges, done: string) {
    try {
      await update.mutateAsync(changes)
      toast.success(done)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function onDelete() {
    try {
      await remove.mutateAsync(id)
      toast.success('Заявка в корзине. Её можно восстановить 30 дней.')
      navigate('/leads')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/leads">
          <ArrowLeft aria-hidden="true" />
          Все заявки
        </Link>
      </Button>

      {lead.isPending ? <p className="text-muted-foreground text-sm">Загружаем…</p> : null}
      {lead.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(lead.error)}</AlertDescription>
        </Alert>
      ) : null}

      {lead.data ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-3 font-semibold text-2xl tracking-tight">
                Заявка №{lead.data.number}
                <InboxStatusBadge
                  tone={LEAD_STATUS_TONES[lead.data.status]}
                  label={LEAD_STATUS_LABELS[lead.data.status]}
                />
              </h1>
              <p className="mt-1 text-muted-foreground text-sm">
                {lead.data.formLabel} · {formatDateTime(lead.data.createdAt)}
              </p>
            </div>
            {canWrite ? (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirming(true)}
              >
                <Trash2 aria-hidden="true" />
                Удалить
              </Button>
            ) : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Обращение</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  <DetailRow label="Имя">{lead.data.name}</DetailRow>
                  <DetailRow label="Телефон">
                    <a
                      href={`tel:${lead.data.phone.replace(/[^\d+]/g, '')}`}
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Phone className="size-3.5" aria-hidden="true" />
                      {lead.data.phone}
                    </a>
                  </DetailRow>
                  <DetailRow label="Тема">{lead.data.topic}</DetailRow>
                  <DetailRow label="Сообщение">{lead.data.message}</DetailRow>
                  <DetailRow label="Язык сайта">
                    {LANGUAGES[lead.data.locale] ?? lead.data.locale}
                  </DetailRow>
                  <DetailRow label="Страница">{lead.data.page}</DetailRow>
                  <DetailRow label="Согласие">Дано {formatDateTime(lead.data.consentAt)}</DetailRow>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Обработка</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="lead-status">Статус</Label>
                  <Select
                    value={lead.data.status}
                    disabled={!canWrite || update.isPending}
                    onValueChange={(value) =>
                      save({ status: value as LeadStatus }, 'Статус изменён')
                    }
                  >
                    <SelectTrigger id="lead-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {LEAD_STATUS_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <CommentForm
                  value={lead.data.comment}
                  disabled={!canWrite}
                  pending={update.isPending}
                  onSave={(comment) => save({ comment }, 'Комментарий сохранён')}
                />
                {lead.data.updatedBy ? (
                  <p className="text-muted-foreground text-xs">
                    Изменил(а) {lead.data.updatedBy.name}, {formatDateTime(lead.data.updatedAt)}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={`Удалить заявку №${lead.data.number}?`}
            description="Она пролежит в корзине 30 дней, потом удалится навсегда."
            confirmLabel="Удалить"
            destructive
            pending={remove.isPending}
            onConfirm={onDelete}
          />
        </>
      ) : null}
    </div>
  )
}

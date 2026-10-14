import { ArrowLeft, Download, Phone, Trash2 } from 'lucide-react'
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
import { errorMessage, saveFile } from '@/lib/api-client'
import { formatDateTime } from '@/lib/format'
import { formatBytes } from '@/lib/media'
import { useCan } from '@/lib/session'
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_TONES,
  APPLICATION_STATUSES,
  type ApplicationChanges,
  type ApplicationStatus,
  downloadResume,
} from '../api/applications-api'
import {
  useApplication,
  useDeleteApplication,
  useUpdateApplication,
} from '../hooks/use-applications'

export function ApplicationPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const canWrite = useCan('applications.write')
  const application = useApplication(id)
  const update = useUpdateApplication(id)
  const remove = useDeleteApplication()
  const [confirming, setConfirming] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function save(changes: ApplicationChanges, done: string) {
    try {
      await update.mutateAsync(changes)
      toast.success(done)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function onDownload() {
    setDownloading(true)
    try {
      saveFile(await downloadResume(id))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setDownloading(false)
    }
  }

  async function onDelete() {
    try {
      await remove.mutateAsync(id)
      toast.success('Отклик в корзине. Его можно восстановить 30 дней.')
      navigate('/applications')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const data = application.data

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/applications">
          <ArrowLeft aria-hidden="true" />
          Все отклики
        </Link>
      </Button>

      {application.isPending ? <p className="text-muted-foreground text-sm">Загружаем…</p> : null}
      {application.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(application.error)}</AlertDescription>
        </Alert>
      ) : null}

      {data ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-3 font-semibold text-2xl tracking-tight">
                {data.name}
                <InboxStatusBadge
                  tone={APPLICATION_STATUS_TONES[data.status]}
                  label={APPLICATION_STATUS_LABELS[data.status]}
                />
              </h1>
              <p className="mt-1 text-muted-foreground text-sm">
                Отклик №{data.number} · {data.vacancy?.title ?? 'Другая позиция'} ·{' '}
                {formatDateTime(data.createdAt)}
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
                <CardTitle className="text-base">Кандидат</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <dl className="space-y-3">
                  <DetailRow label="Телефон">
                    <a
                      href={`tel:${data.phone.replace(/[^\d+]/g, '')}`}
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Phone className="size-3.5" aria-hidden="true" />
                      {data.phone}
                    </a>
                  </DetailRow>
                  <DetailRow label="Email">
                    {data.email ? (
                      <a href={`mailto:${data.email}`} className="text-primary hover:underline">
                        {data.email}
                      </a>
                    ) : null}
                  </DetailRow>
                  <DetailRow label="Вакансия">
                    {data.vacancy?.id ? (
                      <Link
                        to={`/vacancies/${data.vacancy.id}`}
                        className="text-primary hover:underline"
                      >
                        {data.vacancy.title}
                      </Link>
                    ) : (
                      (data.vacancy?.title ?? 'Другая позиция')
                    )}
                  </DetailRow>
                  <DetailRow label="О себе">{data.about}</DetailRow>
                  <DetailRow label="Источник">
                    {data.sourceLabel}
                    {data.createdBy ? ` · добавил(а) ${data.createdBy.name}` : ''}
                  </DetailRow>
                  {data.page ? <DetailRow label="Страница">{data.page}</DetailRow> : null}
                  {data.consentAt ? (
                    <DetailRow label="Согласие">Дано {formatDateTime(data.consentAt)}</DetailRow>
                  ) : null}
                </dl>
                {data.resume ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-sm">{data.resume.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatBytes(data.resume.size)}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={onDownload} disabled={downloading}>
                      <Download aria-hidden="true" />
                      Скачать резюме
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Резюме не приложено.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Обработка</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="application-status">Статус</Label>
                  <Select
                    value={data.status}
                    disabled={!canWrite || update.isPending}
                    onValueChange={(value) =>
                      save({ status: value as ApplicationStatus }, 'Статус изменён')
                    }
                  >
                    <SelectTrigger id="application-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {APPLICATION_STATUSES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {APPLICATION_STATUS_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <CommentForm
                  value={data.comment}
                  disabled={!canWrite}
                  pending={update.isPending}
                  onSave={(comment) => save({ comment }, 'Комментарий сохранён')}
                />
                {data.updatedBy ? (
                  <p className="text-muted-foreground text-xs">
                    Изменил(а) {data.updatedBy.name}, {formatDateTime(data.updatedAt)}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={`Удалить отклик №${data.number}?`}
            description="Он пролежит в корзине 30 дней, потом удалится навсегда вместе с резюме."
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

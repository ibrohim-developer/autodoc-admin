import { BriefcaseBusiness, RefreshCw } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { errorMessage } from '@/lib/api-client'
import { formatDateTime } from '@/lib/format'
import type { Hh, HhRun } from '../api/integrations-api'
import { useDirections, useSyncHh, useUpdateHh } from '../hooks/use-hh'

function RunSummary({ run }: { run: HhRun }) {
  if (!run.ok) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {formatDateTime(run.at)}: {run.error}
        </AlertDescription>
      </Alert>
    )
  }
  const parts = [
    `новых ${run.created}`,
    `обновлено ${run.updated}`,
    `закрыто ${run.closed}`,
    run.reopened ? `открыто снова ${run.reopened}` : null,
    run.protected ? `правленых вручную ${run.protected}` : null,
    run.failed ? `с ошибкой ${run.failed}` : null,
  ].filter(Boolean)
  return (
    <p className="text-muted-foreground text-sm">
      Последняя синхронизация {formatDateTime(run.at)}: {parts.join(', ')}.
      {run.error ? <span className="block text-destructive">{run.error}</span> : null}
    </p>
  )
}

/** Stage 7: the company's vacancies from hh.uz, every hour. */
export function HhCard({ data }: { data: Hh }) {
  const update = useUpdateHh()
  const sync = useSyncHh()
  const directions = useDirections()
  const [enabled, setEnabled] = useState(data.enabled)
  const [autoPublish, setAutoPublish] = useState(data.autoPublish)
  const [employerId, setEmployerId] = useState(data.employerId ?? '')
  const [directionId, setDirectionId] = useState(data.directionId ?? '')
  const [token, setToken] = useState('')
  useEffect(() => {
    setEnabled(data.enabled)
    setAutoPublish(data.autoPublish)
    setEmployerId(data.employerId ?? '')
    setDirectionId(data.directionId ?? '')
  }, [data])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    try {
      await update.mutateAsync({
        enabled,
        autoPublish,
        employerId: employerId.trim() || null,
        directionId: directionId || null,
        ...(token.trim() ? { token: token.trim() } : {}),
      })
      setToken('')
      toast.success('Настройки hh.uz сохранены')
    } catch {
      // Shown under the form.
    }
  }

  async function onSync() {
    try {
      const run = await sync.mutateAsync()
      if (run.ok) toast.success('Синхронизация с hh.uz прошла')
      else toast.error(run.error ?? 'Синхронизация не удалась')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const ready = data.hasToken && data.employerId && data.directionId

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BriefcaseBusiness className="size-4 text-primary" aria-hidden="true" />
            hh.uz
          </CardTitle>
          <CardDescription>
            Каждый час открытые вакансии компании на hh.uz приходят в «Вакансии»: новые —
            черновиками (или сразу на сайт), изменения на hh подтягиваются, закрытые на hh
            закрываются на сайте. Вакансию, которую поправили в админке, синхронизация больше не
            переписывает — только открывает и закрывает. Отклики с hh не переносятся.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div className="flex items-center gap-3">
              <Switch id="hh-enabled" checked={enabled} onCheckedChange={setEnabled} />
              <Label htmlFor="hh-enabled">Синхронизировать каждый час</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="hh-publish" checked={autoPublish} onCheckedChange={setAutoPublish} />
              <Label htmlFor="hh-publish">Публиковать новые сразу</Label>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hh-employer">ID работодателя</Label>
              <Input
                id="hh-employer"
                inputMode="numeric"
                value={employerId}
                onChange={(event) => setEmployerId(event.target.value)}
                placeholder="Число из hh.uz/employer/…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hh-direction">Направление для новых вакансий</Label>
              <Select value={directionId} onValueChange={setDirectionId}>
                <SelectTrigger id="hh-direction" className="w-full">
                  <SelectValue placeholder="Выберите" />
                </SelectTrigger>
                <SelectContent>
                  {(directions.data?.items ?? []).map((direction) => (
                    <SelectItem key={direction.id} value={direction.id}>
                      {direction.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hh-token">Токен приложения</Label>
            <Input
              id="hh-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={
                data.hasToken ? 'Сохранён. Введите новый, чтобы заменить' : 'Из dev.hh.ru'
              }
            />
            <p className="text-muted-foreground text-xs">
              Без токена hh.uz отвечает отказом. Его выдаёт dev.hh.ru приложению, которое
              зарегистрировал аккаунт работодателя. Хранится зашифрованным.
            </p>
          </div>
          {update.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(update.error)}</AlertDescription>
            </Alert>
          ) : null}
          {data.lastRun ? <RunSummary run={data.lastRun} /> : null}
        </CardContent>
        <CardFooter className="mt-6 flex flex-wrap justify-between gap-2">
          <span className="text-muted-foreground text-xs">
            {data.updatedAt ? `Изменено ${formatDateTime(data.updatedAt)}` : 'Ещё не настроено'}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!ready || sync.isPending}
              onClick={onSync}
            >
              <RefreshCw
                className={sync.isPending ? 'animate-spin' : undefined}
                aria-hidden="true"
              />
              {sync.isPending ? 'Синхронизируем…' : 'Синхронизировать сейчас'}
            </Button>
            <Button type="submit" disabled={update.isPending}>
              Сохранить
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}

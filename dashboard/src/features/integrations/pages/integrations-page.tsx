import { CheckCircle2, Send, XCircle } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { errorMessage } from '@/lib/api-client'
import { formatDateTime } from '@/lib/format'
import type { Telegram, TelegramChanges, TelegramResult } from '../api/integrations-api'
import { useTelegram, useTestTelegram, useUpdateTelegram } from '../hooks/use-telegram'

function TestResult({ label, result }: { label: string; result: TelegramResult | undefined }) {
  if (result === undefined) return null
  if (result === null) return <li className="text-muted-foreground">{label}: чат не указан</li>
  return (
    <li className="flex items-center gap-2">
      {result.ok ? (
        <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
      ) : (
        <XCircle className="size-4 text-destructive" aria-hidden="true" />
      )}
      {label}: {result.ok ? 'сообщение отправлено' : `ошибка — ${result.error}`}
    </li>
  )
}

function TelegramCard({ data }: { data: Telegram }) {
  const update = useUpdateTelegram()
  const test = useTestTelegram()
  const [enabled, setEnabled] = useState(data.enabled)
  const [token, setToken] = useState('')
  const [leadsChatId, setLeadsChatId] = useState(data.leadsChatId ?? '')
  const [applicationsChatId, setApplicationsChatId] = useState(data.applicationsChatId ?? '')
  useEffect(() => {
    setEnabled(data.enabled)
    setLeadsChatId(data.leadsChatId ?? '')
    setApplicationsChatId(data.applicationsChatId ?? '')
  }, [data])

  async function save(changes: TelegramChanges) {
    try {
      await update.mutateAsync(changes)
      setToken('')
      test.reset()
      toast.success('Настройки Telegram сохранены')
    } catch {
      // Shown under the form.
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void save({
      enabled,
      leadsChatId: leadsChatId.trim() || null,
      applicationsChatId: applicationsChatId.trim() || null,
      ...(token.trim() ? { token: token.trim() } : {}),
    })
  }

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-4 text-primary" aria-hidden="true" />
            Telegram
          </CardTitle>
          <CardDescription>
            Бот пишет в чат маркетинга о новых заявках и в чат HR — о новых откликах. В сообщении
            только номер, форма или вакансия и ссылка в админку: имён, телефонов и текстов там нет.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3">
            <Switch id="telegram-enabled" checked={enabled} onCheckedChange={setEnabled} />
            <Label htmlFor="telegram-enabled">Отправлять уведомления</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="telegram-token">Токен бота</Label>
            <Input
              id="telegram-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={
                data.hasToken ? 'Сохранён. Введите новый, чтобы заменить' : '123456789:AAE…'
              }
            />
            <p className="text-muted-foreground text-xs">
              Выдаёт @BotFather. Хранится зашифрованным и больше не показывается.
              {data.hasToken ? (
                <>
                  {' '}
                  <button
                    type="button"
                    className="text-destructive hover:underline"
                    onClick={() => save({ token: '' })}
                  >
                    Удалить токен
                  </button>
                </>
              ) : null}
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="telegram-leads">Чат маркетинга (заявки)</Label>
              <Input
                id="telegram-leads"
                value={leadsChatId}
                onChange={(event) => setLeadsChatId(event.target.value)}
                placeholder="-1001234567890"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telegram-applications">Чат HR (отклики)</Label>
              <Input
                id="telegram-applications"
                value={applicationsChatId}
                onChange={(event) => setApplicationsChatId(event.target.value)}
                placeholder="-1009876543210"
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            Добавьте бота в группу, напишите в ней любое сообщение и откройте
            https://api.telegram.org/bot&lt;токен&gt;/getUpdates — там будет id чата (у групп он с
            минусом).
          </p>
          {update.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(update.error)}</AlertDescription>
            </Alert>
          ) : null}
          {test.data ? (
            <ul className="space-y-1 text-sm" aria-label="Результат проверки">
              <TestResult label="Чат маркетинга" result={test.data.leads} />
              <TestResult label="Чат HR" result={test.data.applications} />
            </ul>
          ) : null}
          {test.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(test.error)}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter className="mt-6 flex flex-wrap justify-between gap-2">
          <span className="text-muted-foreground text-xs">
            {data.updatedAt ? `Изменено ${formatDateTime(data.updatedAt)}` : 'Ещё не настроено'}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!data.hasToken || test.isPending}
              onClick={() => test.mutate()}
            >
              {test.isPending ? 'Проверяем…' : 'Проверить'}
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

export function IntegrationsPage() {
  const telegram = useTelegram()
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Интеграции</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Внешние сервисы админки. Счётчики сайта (GA4, Метрика, пиксель) — в «Настройках сайта».
        </p>
      </div>
      {telegram.isPending ? <p className="text-muted-foreground text-sm">Загружаем…</p> : null}
      {telegram.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(telegram.error)}</AlertDescription>
        </Alert>
      ) : null}
      {telegram.data ? <TelegramCard data={telegram.data} /> : null}
    </div>
  )
}

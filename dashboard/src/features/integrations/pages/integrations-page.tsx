import { Alert, AlertDescription } from '@/components/ui/alert'
import { errorMessage } from '@/lib/api-client'
import { HhCard } from '../components/hh-card'
import { TelegramCard } from '../components/telegram-card'
import { useHh } from '../hooks/use-hh'
import { useTelegram } from '../hooks/use-telegram'

export function IntegrationsPage() {
  const telegram = useTelegram()
  const hh = useHh()
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
      {hh.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(hh.error)}</AlertDescription>
        </Alert>
      ) : null}
      {hh.data ? <HhCard data={hh.data} /> : null}
    </div>
  )
}

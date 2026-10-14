import { ShieldCheck } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { CopyField } from '@/components/copy-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/api-client'
import type { Me } from '@/lib/session'
import type { TwoFactorSetup } from '../api/profile-api'
import {
  useDisableTwoFactor,
  useEnableTwoFactor,
  useRegenerateRecoveryCodes,
  useStartTwoFactorSetup,
} from '../hooks/use-profile'
import { RecoveryCodes } from './recovery-codes'

type Step =
  | { kind: 'idle' }
  | { kind: 'setup'; setup: TwoFactorSetup }
  | { kind: 'codes'; codes: string[] }
  | { kind: 'regenerate' }
  | { kind: 'disable' }

/** Optional per person: 2FA is offered, not forced. */
export function TwoFactorCard({ me }: { me: Me }) {
  const [step, setStep] = useState<Step>({ kind: 'idle' })
  const [value, setValue] = useState('')
  const start = useStartTwoFactorSetup()
  const enable = useEnableTwoFactor()
  const disable = useDisableTwoFactor()
  const regenerate = useRegenerateRecoveryCodes()
  const error = start.error ?? enable.error ?? disable.error ?? regenerate.error

  function go(next: Step) {
    setValue('')
    start.reset()
    enable.reset()
    disable.reset()
    regenerate.reset()
    setStep(next)
  }

  async function beginSetup() {
    const setup = await start.mutateAsync().catch(() => null)
    if (setup) go({ kind: 'setup', setup })
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault()
    const result = await enable.mutateAsync(value.trim()).catch(() => null)
    if (result) {
      toast.success('Двухфакторная защита включена')
      go({ kind: 'codes', codes: result.recoveryCodes })
    }
  }

  async function submitRegenerate(event: FormEvent) {
    event.preventDefault()
    const result = await regenerate.mutateAsync(value.trim()).catch(() => null)
    if (result) go({ kind: 'codes', codes: result.recoveryCodes })
  }

  async function submitDisable(event: FormEvent) {
    event.preventDefault()
    const ok = await disable
      .mutateAsync(value)
      .then(() => true)
      .catch(() => false)
    if (ok) {
      toast.success('Двухфакторная защита отключена')
      go({ kind: 'idle' })
    }
  }

  const errorAlert = error ? (
    <Alert variant="destructive">
      <AlertDescription>{errorMessage(error)}</AlertDescription>
    </Alert>
  ) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Двухфакторная защита
          {me.totpEnabled ? <Badge>включена</Badge> : <Badge variant="outline">выключена</Badge>}
        </CardTitle>
        <CardDescription>
          При входе кроме пароля нужен код из приложения на телефоне (Google Authenticator,
          Microsoft Authenticator, 1Password и др.). Даже узнав пароль, чужой человек не войдёт.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step.kind === 'codes' ? (
          <>
            <RecoveryCodes codes={step.codes} email={me.email} />
            <Button onClick={() => go({ kind: 'idle' })}>Я сохранил коды</Button>
          </>
        ) : step.kind === 'setup' ? (
          <form onSubmit={submitCode} className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Откройте приложение-аутентификатор и отсканируйте QR-код.</li>
              <li>Введите 6-значный код, который появится в приложении.</li>
            </ol>
            <img
              src={step.setup.qr}
              alt="QR-код для приложения-аутентификатора"
              width={200}
              height={200}
              className="rounded-lg border bg-white p-2"
            />
            <div className="max-w-md space-y-1">
              <p className="text-muted-foreground text-xs">Не сканируется? Введите ключ вручную:</p>
              <CopyField value={step.setup.secret} label="Ключ для ручного ввода" />
            </div>
            <div className="max-w-xs space-y-2">
              <Label htmlFor="totp-code">Код из приложения</Label>
              <Input
                id="totp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                autoFocus
              />
            </div>
            {errorAlert}
            <div className="flex gap-2">
              <Button type="submit" disabled={enable.isPending || value.trim().length < 6}>
                Включить
              </Button>
              <Button type="button" variant="ghost" onClick={() => go({ kind: 'idle' })}>
                Отмена
              </Button>
            </div>
          </form>
        ) : step.kind === 'regenerate' ? (
          <form onSubmit={submitRegenerate} className="max-w-xs space-y-4">
            <p className="text-sm">Старые резервные коды перестанут работать.</p>
            <div className="space-y-2">
              <Label htmlFor="regen-code">Код из приложения</Label>
              <Input
                id="regen-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                autoFocus
              />
            </div>
            {errorAlert}
            <div className="flex gap-2">
              <Button type="submit" disabled={regenerate.isPending || value.trim().length < 6}>
                Получить новые коды
              </Button>
              <Button type="button" variant="ghost" onClick={() => go({ kind: 'idle' })}>
                Отмена
              </Button>
            </div>
          </form>
        ) : step.kind === 'disable' ? (
          <form onSubmit={submitDisable} className="max-w-xs space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disable-password">Пароль для подтверждения</Label>
              <Input
                id="disable-password"
                type="password"
                autoComplete="current-password"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                autoFocus
              />
            </div>
            {errorAlert}
            <div className="flex gap-2">
              <Button type="submit" variant="destructive" disabled={disable.isPending || !value}>
                Отключить 2FA
              </Button>
              <Button type="button" variant="ghost" onClick={() => go({ kind: 'idle' })}>
                Отмена
              </Button>
            </div>
          </form>
        ) : me.totpEnabled ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => go({ kind: 'regenerate' })}>
              Новые резервные коды
            </Button>
            <Button variant="ghost" onClick={() => go({ kind: 'disable' })}>
              Отключить
            </Button>
          </div>
        ) : (
          <>
            {errorAlert}
            <Button onClick={beginSetup} disabled={start.isPending}>
              {start.isPending ? 'Готовим…' : 'Включить 2FA'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

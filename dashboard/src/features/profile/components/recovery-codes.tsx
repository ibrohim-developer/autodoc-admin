import { Download } from 'lucide-react'
import { CopyField } from '@/components/copy-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/** Shown once, right after they are generated: the server keeps only hashes. */
export function RecoveryCodes({ codes, email }: { codes: string[]; email: string }) {
  function download() {
    const text = [
      'Резервные коды для входа в админку autodoc.uz',
      email,
      '',
      'Каждый код работает один раз. Храните их отдельно от телефона.',
      '',
      ...codes,
    ].join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'autodoc-admin-recovery-codes.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3">
      <Alert>
        <AlertDescription>
          Сохраните эти коды сейчас — больше их не покажут. Каждый код один раз заменяет код из
          приложения, если телефона нет под рукой.
        </AlertDescription>
      </Alert>
      <ul className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={download}>
          <Download aria-hidden="true" />
          Скачать .txt
        </Button>
      </div>
      <CopyField value={codes.join(' ')} label="Все коды одной строкой" />
    </div>
  )
}

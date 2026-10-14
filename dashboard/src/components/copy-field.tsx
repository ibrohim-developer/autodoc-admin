import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** A read-only value with a copy button, e.g. an invite link. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked (http, permissions); the field stays selectable.
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        readOnly
        value={value}
        aria-label={label}
        onFocus={(event) => event.currentTarget.select()}
        className="font-mono text-xs"
      />
      <Button type="button" variant="outline" onClick={copy} aria-label="Скопировать">
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? 'Скопировано' : 'Копировать'}
      </Button>
    </div>
  )
}

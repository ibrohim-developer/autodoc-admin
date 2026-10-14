import { type FormEvent, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isSafeHref, normalizeHref } from '@/lib/rich-text'

export function LinkDialog({
  open,
  initial,
  onOpenChange,
  onSave,
  onRemove,
}: {
  open: boolean
  initial: string
  onOpenChange: (open: boolean) => void
  onSave: (href: string) => void
  onRemove: () => void
}) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValue(initial)
      setError(null)
    }
  }, [open, initial])

  function submit(event: FormEvent) {
    event.preventDefault()
    const href = normalizeHref(value)
    if (!href || !isSafeHref(href)) {
      setError('Нужна ссылка вида https://…, адрес на сайте (/ru/about/), email или телефон')
      return
    }
    onSave(href)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Ссылка</DialogTitle>
            <DialogDescription>Сайт, страница autodoc.uz, email или телефон.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="link-href">Адрес</Label>
            <Input
              id="link-href"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="https://"
              autoFocus
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'link-href-error' : undefined}
            />
            {error ? (
              <p id="link-href-error" className="text-destructive text-sm">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            {initial ? (
              <Button type="button" variant="ghost" onClick={onRemove} className="sm:mr-auto">
                Убрать ссылку
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit">Сохранить</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

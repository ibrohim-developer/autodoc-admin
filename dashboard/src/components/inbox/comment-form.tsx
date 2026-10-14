import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

/** The one comment a submission or application carries: who called, what was agreed. */
export function CommentForm({
  value,
  disabled = false,
  pending = false,
  onSave,
}: {
  value: string | null
  disabled?: boolean
  pending?: boolean
  onSave: (comment: string | null) => void
}) {
  const id = useId()
  const [draft, setDraft] = useState(value ?? '')
  // Another save (or another user) changed it: show what is stored now.
  useEffect(() => setDraft(value ?? ''), [value])
  const changed = draft.trim() !== (value ?? '')

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(draft.trim() || null)
      }}
    >
      <Label htmlFor={id}>Комментарий</Label>
      <Textarea
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={4}
        maxLength={4000}
        disabled={disabled}
        placeholder={disabled ? 'Нет комментария' : 'Например: перезвонить в понедельник'}
      />
      {disabled ? null : (
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!changed || pending}>
            Сохранить комментарий
          </Button>
        </div>
      )}
    </form>
  )
}

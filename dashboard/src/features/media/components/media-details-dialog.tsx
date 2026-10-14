import { Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/api-client'
import { formatDateTime } from '@/lib/format'
import {
  formatBytes,
  LOCALE_LABELS,
  LOCALES,
  type Locale,
  useDeleteMedia,
  useMediaDetails,
  useUpdateMediaAlt,
} from '@/lib/media'

const FORMATS: Record<string, string> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF',
}

export function MediaDetailsDialog({
  mediaId,
  canEdit,
  onClose,
}: {
  mediaId: string | null
  canEdit: boolean
  onClose: () => void
}) {
  const details = useMediaDetails(mediaId)
  const updateAlt = useUpdateMediaAlt()
  const remove = useDeleteMedia()
  const [alt, setAlt] = useState<Partial<Record<Locale, string>>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const media = details.data

  useEffect(() => {
    if (media) setAlt(media.alt)
  }, [media])

  async function saveAlt(event: FormEvent) {
    event.preventDefault()
    if (!media) return
    try {
      await updateAlt.mutateAsync({ id: media.id, alt })
      toast.success('Описание сохранено')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function deleteMedia() {
    if (!media) return
    try {
      await remove.mutateAsync(media.id)
      toast.success('Фото перемещено в корзину', {
        description: 'Восстановить можно в течение 30 дней',
      })
      setConfirmDelete(false)
      onClose()
    } catch (error) {
      setConfirmDelete(false)
      toast.error(errorMessage(error))
    }
  }

  const inUse = (media?.usages.length ?? 0) > 0

  return (
    <Dialog open={mediaId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{media?.originalName ?? 'Фото'}</DialogTitle>
          <DialogDescription>
            {media
              ? `${media.width} × ${media.height}, ${FORMATS[media.mime] ?? media.mime}, ${formatBytes(media.size)} · загружено ${formatDateTime(media.createdAt)}`
              : 'Загружаем…'}
          </DialogDescription>
        </DialogHeader>

        {details.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(details.error)}</AlertDescription>
          </Alert>
        ) : null}

        {media ? (
          <div className="grid gap-6 md:grid-cols-[1fr_18rem]">
            <img
              src={media.url}
              alt={media.alt.ru || media.alt.uz || ''}
              className="max-h-[60dvh] w-full rounded-lg border bg-muted object-contain"
            />
            <div className="space-y-5">
              <form onSubmit={saveAlt} className="space-y-3">
                <div>
                  <p className="font-medium text-sm">Описание фото</p>
                  <p className="text-muted-foreground text-xs">
                    Для незрячих посетителей и поисковиков. Что на фото, коротко.
                  </p>
                </div>
                {LOCALES.map((locale) => (
                  <div key={locale} className="space-y-1">
                    <Label htmlFor={`alt-${locale}`} className="text-xs">
                      {LOCALE_LABELS[locale]}
                    </Label>
                    <Input
                      id={`alt-${locale}`}
                      value={alt[locale] ?? ''}
                      maxLength={300}
                      disabled={!canEdit}
                      onChange={(event) => setAlt({ ...alt, [locale]: event.target.value })}
                    />
                  </div>
                ))}
                {canEdit ? (
                  <Button type="submit" size="sm" disabled={updateAlt.isPending}>
                    Сохранить описание
                  </Button>
                ) : null}
              </form>

              <div className="space-y-1">
                <p className="font-medium text-sm">Где используется</p>
                {inUse ? (
                  <ul className="space-y-1 text-sm">
                    {media.usages.map((usage) => (
                      <li key={usage.documentId}>
                        <span className="text-muted-foreground">{usage.typeLabel}:</span>{' '}
                        {usage.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">Нигде — можно удалить.</p>
                )}
              </div>

              {canEdit ? (
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                  disabled={inUse}
                  title={
                    inUse ? 'Сначала уберите фото из материалов, где оно используется' : undefined
                  }
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 aria-hidden="true" />
                  Удалить
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Удалить фото?"
          description="Оно попадёт в корзину. В течение 30 дней его можно восстановить, потом оно удалится навсегда."
          confirmLabel="Удалить"
          destructive
          pending={remove.isPending}
          onConfirm={deleteMedia}
        />
      </DialogContent>
    </Dialog>
  )
}

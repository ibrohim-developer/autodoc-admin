import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { errorMessage } from '@/lib/api-client'
import {
  type DocumentView,
  useRestoreVersion,
  useVersions,
  VERSION_KIND_LABELS,
  type Version,
} from '@/lib/content'
import { formatDateTime } from '@/lib/format'

/** Every save and publication of a document; any of them can go back into the working copy. */
export function VersionsDialog({
  doc,
  open,
  onOpenChange,
  canRestore,
  dirty,
  onRestored,
}: {
  doc: DocumentView
  open: boolean
  onOpenChange: (open: boolean) => void
  canRestore: boolean
  /** Edits on screen that aren't saved yet: restoring replaces them. */
  dirty: boolean
  onRestored: (doc: DocumentView) => void
}) {
  const versions = useVersions(doc.id, open)
  const restore = useRestoreVersion()
  const [confirming, setConfirming] = useState<string | null>(null)

  async function onRestore(version: Version) {
    try {
      const restored = await restore.mutateAsync({
        id: doc.id,
        versionId: version.id,
        revision: doc.revision,
      })
      toast.success(
        'Версия восстановлена в черновик. Чтобы она появилась на сайте, опубликуйте её.',
      )
      setConfirming(null)
      onOpenChange(false)
      onRestored(restored)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirming(null)
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>История версий</DialogTitle>
          <DialogDescription>
            Каждое сохранение и публикация, хранятся последние 100. Восстановленная версия попадает
            в черновик; на сайт — после публикации.
          </DialogDescription>
        </DialogHeader>
        {versions.isPending ? <p className="text-muted-foreground text-sm">Загружаем…</p> : null}
        {versions.isError ? (
          <p className="text-destructive text-sm">{errorMessage(versions.error)}</p>
        ) : null}
        <ol className="divide-y">
          {versions.data?.map((version) => (
            <li key={version.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 space-y-0.5">
                <p className="flex flex-wrap items-center gap-2 font-medium text-sm">
                  {VERSION_KIND_LABELS[version.kind]}
                  {version.isLive ? <Badge className="font-normal">На сайте</Badge> : null}
                  {version.isDraft ? (
                    <Badge variant="outline" className="font-normal">
                      Сейчас в черновике
                    </Badge>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatDateTime(version.createdAt)} · {version.createdBy?.name ?? 'по расписанию'}
                </p>
                {version.title !== doc.title ? (
                  <p className="truncate text-muted-foreground text-xs">«{version.title}»</p>
                ) : null}
              </div>
              {canRestore && !version.isDraft ? (
                confirming === version.id ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                      Отмена
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onRestore(version)}
                      disabled={restore.isPending}
                    >
                      Да, восстановить
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setConfirming(version.id)}>
                    Восстановить
                  </Button>
                )
              ) : null}
            </li>
          ))}
        </ol>
        {dirty ? (
          <p className="text-amber-700 text-xs dark:text-amber-300">
            На экране есть несохранённые правки: при восстановлении они пропадут.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

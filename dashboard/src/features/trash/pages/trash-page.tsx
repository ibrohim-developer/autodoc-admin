import { FileText, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { errorMessage } from '@/lib/api-client'
import { formatDateTime } from '@/lib/format'
import { type TrashItem, usePurgeItem, useRestoreItem, useTrash } from '@/lib/trash'

const DAY_MS = 24 * 60 * 60 * 1000

function daysLeft(purgeAt: string): string {
  const days = Math.max(0, Math.ceil((new Date(purgeAt).getTime() - Date.now()) / DAY_MS))
  if (days === 0) return 'сегодня ночью'
  const word =
    days % 10 === 1 && days % 100 !== 11
      ? 'день'
      : [2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100)
        ? 'дня'
        : 'дней'
  return `через ${days} ${word}`
}

export function TrashPage() {
  const trash = useTrash()
  const restore = useRestoreItem()
  const purge = usePurgeItem()
  const [purging, setPurging] = useState<TrashItem | null>(null)

  async function onRestore(item: TrashItem) {
    try {
      await restore.mutateAsync(item)
      toast.success(`Восстановлено: ${item.title}`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function onPurge() {
    if (!purging) return
    try {
      await purge.mutateAsync(purging)
      toast.success(`Удалено навсегда: ${purging.title}`)
      setPurging(null)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Корзина</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Удалённое хранится 30 дней, потом удаляется навсегда. Здесь только то, что может
          восстановить ваша роль.
        </p>
      </div>

      {trash.isPending ? <p className="text-muted-foreground text-sm">Загружаем…</p> : null}
      {trash.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(trash.error)}</AlertDescription>
        </Alert>
      ) : null}

      {trash.data && trash.data.items.length === 0 ? (
        <div className="grid place-items-center rounded-lg border border-dashed py-16 text-center">
          <Trash2 className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">Корзина пуста</p>
        </div>
      ) : null}

      {trash.data && trash.data.items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Что</TableHead>
                <TableHead>Раздел</TableHead>
                <TableHead>Удалил(а)</TableHead>
                <TableHead>Когда</TableHead>
                <TableHead>Удалится навсегда</TableHead>
                <TableHead className="w-56">
                  <span className="sr-only">Действия</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trash.data.items.map((item) => (
                <TableRow key={`${item.kind}-${item.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {item.thumbUrl ? (
                        <img src={item.thumbUrl} alt="" className="size-10 rounded object-cover" />
                      ) : (
                        <span className="grid size-10 place-items-center rounded bg-muted">
                          <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                        </span>
                      )}
                      <span className="font-medium">{item.title}</span>
                    </div>
                  </TableCell>
                  <TableCell>{item.typeLabel}</TableCell>
                  <TableCell>{item.deletedBy?.name ?? '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(item.deletedAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {daysLeft(item.purgeAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRestore(item)}
                        disabled={restore.isPending}
                      >
                        <RotateCcw aria-hidden="true" />
                        Восстановить
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        aria-label={`Удалить навсегда: ${item.title}`}
                        onClick={() => setPurging(item)}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <ConfirmDialog
        open={purging !== null}
        onOpenChange={(open) => !open && setPurging(null)}
        title={`Удалить навсегда: ${purging?.title ?? ''}?`}
        description="Восстановить будет нельзя."
        confirmLabel="Удалить навсегда"
        destructive
        pending={purge.isPending}
        onConfirm={onPurge}
      />
    </div>
  )
}

import { ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { errorMessage } from '@/lib/api-client'
import {
  type DocumentSummary,
  fetchDocument,
  issuesOf,
  useCreateDocument,
  useDeleteDocument,
  useDocuments,
  useSaveDocument,
} from '@/lib/content'
import { useCan } from '@/lib/session'

const TYPE = 'redirect'

type RedirectFields = {
  from: string
  to: string
  permanent: boolean
  enabled: boolean
  auto?: boolean
}
type RedirectForm = { from: string; to: string; permanent: boolean; enabled: boolean }

const fieldsOf = (item: DocumentSummary) => item.shared as RedirectFields

/** The latest revision, then the save: a redirect is small, a stale one would only conflict. */
function useSaveRedirect() {
  const save = useSaveDocument()
  return async (id: string, shared: RedirectFields) => {
    const doc = await fetchDocument(id)
    return save.mutateAsync({ id, data: { shared, locales: { uz: {} } }, revision: doc.revision })
  }
}

function RedirectDialog({ item, onClose }: { item: DocumentSummary | null; onClose: () => void }) {
  const create = useCreateDocument()
  const save = useSaveRedirect()
  const existing = item ? fieldsOf(item) : null
  const form = useForm<RedirectForm>({
    defaultValues: existing ?? { from: '', to: '', permanent: true, enabled: true },
  })
  const { errors, isSubmitting } = form.formState

  async function submit(values: RedirectForm) {
    const shared = {
      ...values,
      from: values.from.trim(),
      to: values.to.trim(),
      auto: existing?.auto,
    }
    try {
      if (item) await save(item.id, shared)
      else await create.mutateAsync({ type: TYPE, data: { shared, locales: { uz: {} } } })
      toast.success('Редирект сохранён. На сайте заработает в течение минуты.')
      onClose()
    } catch (error) {
      const issues = issuesOf(error)
      for (const issue of issues) {
        const field = issue.path.split('.')[1]
        if (field === 'from' || field === 'to') form.setError(field, { message: issue.message })
      }
      if (issues.length === 0) toast.error(errorMessage(error))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Редирект' : 'Новый редирект'}</DialogTitle>
          <DialogDescription>
            Посетитель, открывший старый адрес, попадёт на новый. Адреса — пути на сайте, как
            /about/ или /ru/blog/14/.
          </DialogDescription>
        </DialogHeader>
        <form
          id="redirect-form"
          className="space-y-4"
          onSubmit={form.handleSubmit(submit)}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="redirect-from">Старый адрес</Label>
            <Input
              id="redirect-from"
              placeholder="/old-page/"
              spellCheck={false}
              aria-invalid={errors.from ? true : undefined}
              {...form.register('from', { required: 'Укажите адрес' })}
            />
            {errors.from ? (
              <p className="text-destructive text-xs" role="alert">
                {errors.from.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="redirect-to">Новый адрес</Label>
            <Input
              id="redirect-to"
              placeholder="/new-page/ или https://…"
              spellCheck={false}
              aria-invalid={errors.to ? true : undefined}
              {...form.register('to', { required: 'Укажите, куда вести' })}
            />
            {errors.to ? (
              <p className="text-destructive text-xs" role="alert">
                {errors.to.message}
              </p>
            ) : null}
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="redirect-permanent">Навсегда (301)</Label>
              <p className="text-muted-foreground text-xs">
                Поисковики перенесут страницу на новый адрес. Выключите для временного (302).
              </p>
            </div>
            <Switch
              id="redirect-permanent"
              checked={form.watch('permanent')}
              onCheckedChange={(value) => form.setValue('permanent', value)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="redirect-enabled">Работает</Label>
            <Switch
              id="redirect-enabled"
              checked={form.watch('enabled')}
              onCheckedChange={(value) => form.setValue('enabled', value)}
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form="redirect-form" disabled={isSubmitting}>
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RedirectsPage() {
  const canWrite = useCan('content.write')
  const list = useDocuments(TYPE, { pageSize: 100 })
  const remove = useDeleteDocument()
  const save = useSaveRedirect()
  const [editing, setEditing] = useState<DocumentSummary | 'new' | null>(null)
  const [deleting, setDeleting] = useState<DocumentSummary | null>(null)
  const items = list.data?.items ?? []

  async function toggle(item: DocumentSummary, enabled: boolean) {
    try {
      await save(item.id, { ...fieldsOf(item), enabled })
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function onDelete() {
    if (!deleting) return
    try {
      await remove.mutateAsync({ id: deleting.id, type: TYPE })
      toast.success('Редирект в корзине')
    } catch (error) {
      toast.error(errorMessage(error))
    }
    setDeleting(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Редиректы</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Со старых адресов на новые. Когда у опубликованной новости или вакансии меняется адрес,
            редирект появляется здесь сам («авто»).
          </p>
        </div>
        {canWrite ? (
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" />
            Новый редирект
          </Button>
        ) : null}
      </div>

      {list.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(list.error)}</AlertDescription>
        </Alert>
      ) : null}
      {list.data && items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
          Редиректов пока нет
        </div>
      ) : null}
      {items.length > 0 ? (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Старый адрес → новый</TableHead>
                <TableHead className="hidden sm:table-cell">Тип</TableHead>
                <TableHead>Работает</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const redirect = fieldsOf(item)
                return (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-md whitespace-normal">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-sm [overflow-wrap:anywhere]">
                        {redirect.from}
                        <ArrowRight
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-label="ведёт на"
                        />
                        {redirect.to}
                        {redirect.auto ? (
                          <Badge variant="outline" className="font-normal font-sans">
                            авто
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground text-sm sm:table-cell">
                      {redirect.permanent ? '301' : '302'}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={redirect.enabled}
                        disabled={!canWrite}
                        onCheckedChange={(enabled) => toggle(item, enabled)}
                        aria-label={`Редирект ${redirect.from} работает`}
                      />
                    </TableCell>
                    <TableCell>
                      {canWrite ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Изменить редирект ${redirect.from}`}
                            onClick={() => setEditing(item)}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Удалить редирект ${redirect.from}`}
                            onClick={() => setDeleting(item)}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {editing ? (
        <RedirectDialog
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? null : setDeleting(null))}
        title="Удалить редирект?"
        description={`Адрес ${deleting ? fieldsOf(deleting).from : ''} перестанет перенаправлять. Восстановить можно из корзины.`}
        confirmLabel="Удалить"
        destructive
        pending={remove.isPending}
        onConfirm={onDelete}
      />
    </div>
  )
}

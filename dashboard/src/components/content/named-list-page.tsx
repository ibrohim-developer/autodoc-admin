import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  toLocales,
  useCreateDocument,
  useDeleteDocument,
  useDocuments,
  useSaveDocument,
} from '@/lib/content'
import { LOCALE_LABELS, LOCALES, type Locale } from '@/lib/media'
import { type Permission, useCan } from '@/lib/session'

/**
 * Short lists of names in three languages with an order: news categories, vacancy directions,
 * project areas. Saved means live (the type publishes on save); one in use can't be deleted.
 */
export type NamedListTexts = {
  title: string
  description: string
  /** "Новая категория": the button and the new item's dialog. */
  createLabel: string
  /** "Категория": the dialog title when editing. */
  itemLabel: string
  empty: string
  orderHint: string
  saved: string
  deleteTitle: string
  deleteDescription: (name: string) => string
  deleted: string
}

type NameForm = { names: Record<Locale, string>; order: string }

function NameDialog({
  type,
  item,
  nextOrder,
  texts,
  onClose,
}: {
  type: string
  /** Absent for a new one. */
  item: DocumentSummary | null
  nextOrder: number
  texts: NamedListTexts
  onClose: () => void
}) {
  const create = useCreateDocument()
  const save = useSaveDocument()
  const [loading, setLoading] = useState(Boolean(item))
  const form = useForm<NameForm>({
    defaultValues: async () => {
      if (!item) return { names: { uz: '', ru: '', en: '' }, order: String(nextOrder) }
      const doc = await fetchDocument(item.id)
      setLoading(false)
      const name = (locale: Locale) => String(doc.data.locales[locale]?.name ?? '')
      return {
        names: { uz: name('uz'), ru: name('ru'), en: name('en') },
        order: String(doc.data.shared.order ?? 0),
      }
    },
  })
  const { errors, isSubmitting } = form.formState

  async function submit(values: NameForm) {
    const data = {
      shared: { order: Number(values.order) || 0 },
      locales: toLocales({
        uz: { name: values.names.uz },
        ru: { name: values.names.ru },
        en: { name: values.names.en },
      }),
    }
    try {
      if (item) {
        // The latest revision: these are small, a stale one would only cause a conflict.
        const doc = await fetchDocument(item.id)
        await save.mutateAsync({ id: item.id, data, revision: doc.revision })
      } else {
        await create.mutateAsync({ type, data })
      }
      toast.success(texts.saved)
      onClose()
    } catch (error) {
      const issue = issuesOf(error).find((entry) => entry.path.startsWith('locales.uz'))
      if (issue) form.setError('names.uz', { message: issue.message })
      else toast.error(errorMessage(error))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? texts.itemLabel : texts.createLabel}</DialogTitle>
          <DialogDescription>
            Сохраняется сразу на сайте. Пустой перевод покажется на узбекском.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-muted-foreground text-sm">Загружаем…</p>
        ) : (
          <form
            id="named-item-form"
            className="space-y-4"
            onSubmit={form.handleSubmit(submit)}
            noValidate
          >
            {LOCALES.map((locale) => (
              <div key={locale} className="space-y-1.5">
                <Label htmlFor={`name-${locale}`}>
                  {LOCALE_LABELS[locale]}
                  {locale === 'uz' ? <span className="text-destructive"> *</span> : null}
                </Label>
                <Input
                  id={`name-${locale}`}
                  maxLength={60}
                  aria-invalid={errors.names?.[locale] ? true : undefined}
                  {...form.register(`names.${locale}`, {
                    validate: (value) =>
                      locale !== 'uz' || value.trim() !== '' || 'Укажите название на узбекском',
                  })}
                />
                {errors.names?.[locale] ? (
                  <p className="text-destructive text-xs" role="alert">
                    {errors.names[locale]?.message}
                  </p>
                ) : null}
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="name-order">Порядок</Label>
              <Input
                id="name-order"
                type="number"
                min={0}
                inputMode="numeric"
                className="w-32"
                {...form.register('order')}
              />
              <p className="text-muted-foreground text-xs">{texts.orderHint}</p>
            </div>
          </form>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form="named-item-form" disabled={loading || isSubmitting}>
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function NamedListPage({
  type,
  back,
  writePermission,
  texts,
}: {
  type: string
  back: { path: string; label: string }
  writePermission: Permission
  texts: NamedListTexts
}) {
  const canWrite = useCan(writePermission)
  const list = useDocuments(type, { pageSize: 100 })
  const remove = useDeleteDocument()
  const [editing, setEditing] = useState<DocumentSummary | 'new' | null>(null)
  const [deleting, setDeleting] = useState<DocumentSummary | null>(null)
  const items = list.data?.items ?? []
  const nextOrder =
    items.reduce((max, item) => Math.max(max, Number(item.shared.order ?? 0)), 0) + 1

  async function onDelete() {
    if (!deleting) return
    try {
      await remove.mutateAsync({ id: deleting.id, type })
      toast.success(texts.deleted)
    } catch (error) {
      toast.error(errorMessage(error))
    }
    setDeleting(null)
  }

  return (
    <div className="space-y-6">
      <Link
        to={back.path}
        className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {back.label}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">{texts.title}</h1>
          <p className="mt-1 text-muted-foreground text-sm">{texts.description}</p>
        </div>
        {canWrite ? (
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" />
            {texts.createLabel}
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
          {texts.empty}
        </div>
      ) : null}
      {items.length > 0 ? (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Порядок</TableHead>
                <TableHead>Переводы</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell className="tabular-nums">{String(item.shared.order ?? 0)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {item.locales.map((locale) => LOCALE_LABELS[locale]).join(' · ')}
                  </TableCell>
                  <TableCell>
                    {canWrite ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Изменить «${item.title}»`}
                          onClick={() => setEditing(item)}
                        >
                          <Pencil aria-hidden="true" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Удалить «${item.title}»`}
                          onClick={() => setDeleting(item)}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {editing ? (
        <NameDialog
          type={type}
          item={editing === 'new' ? null : editing}
          nextOrder={nextOrder}
          texts={texts}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? null : setDeleting(null))}
        title={texts.deleteTitle}
        description={texts.deleteDescription(deleting?.title ?? '')}
        confirmLabel="Удалить"
        destructive
        pending={remove.isPending}
        onConfirm={onDelete}
      />
    </div>
  )
}

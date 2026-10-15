import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CalendarClock,
  CalendarX,
  ExternalLink,
  Eye,
  History,
  MoreHorizontal,
  Trash2,
  Undo2,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import {
  type FieldValues,
  FormProvider,
  type UseFormReturn,
  useForm,
  useWatch,
} from 'react-hook-form'
import { Link, useBlocker, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiError, errorMessage } from '@/lib/api-client'
import { cn } from '@/lib/cn'
import {
  contentKeys,
  type DocumentData,
  type DocumentView,
  type Issue,
  issuesOf,
  previewLink,
  useCreateDocument,
  useDeleteDocument,
  useDocument,
  usePublishDocument,
  useSaveDocument,
  useScheduleDocument,
  useSingleton,
  useUnpublishDocument,
} from '@/lib/content'
import { formatDateTime } from '@/lib/format'
import { LOCALE_LABELS, LOCALES, type Locale } from '@/lib/media'
import { type Permission, useCan } from '@/lib/session'
import { ScheduleDialog } from './schedule-dialog'
import { StatusBadge } from './status-badge'
import { VersionsDialog } from './versions-dialog'

export type EditorContext = {
  /** The language tab that is open. */
  locale: Locale
  /** Changes whenever the form loads other content; rich-text editors remount on it. */
  resetKey: number
  /** The document as last saved; null while it is new. */
  doc: DocumentView | null
  form: UseFormReturn<FieldValues>
  /**
   * Publishing at a set time, chosen in the form (the news sidebar's switch): while `at` is set,
   * the main button schedules instead of publishing now.
   */
  schedule: { at: string | null; set: (at: string | null) => void; canPublish: boolean }
}

export type DocumentEditorProps<T extends FieldValues> = {
  type: string
  /** Heading of a document that doesn't exist yet: «Новая новость». */
  newTitle: string
  /**
   * A fixed heading in the top bar («Новый материал» / «Редактирование материала») when the
   * title is big in the form itself; without it the bar shows the document's title.
   */
  heading?: { create: string; edit: string }
  /** The language fields bring their own cards (news); otherwise they sit in one card. */
  bareLocale?: boolean
  list: { path: string; label: string }
  /** Absent for a new document (or a singleton, found by its type). */
  id?: string
  /** Pages and settings: one document per type, created on first save, never deleted. */
  singleton?: boolean
  /** The "← list" link above the title; singletons without a list of their own have none. */
  showBack?: boolean
  /** Saving publishes at once: no drafts, no schedule (settings). */
  publishOnSave?: boolean
  permissions: { write: Permission; publish: Permission }
  /** The field whose value is the document's name in the header: "locales.uz.title". */
  titleName: string
  empty: () => T
  fromData: (data: DocumentData) => T
  toData: (values: T) => DocumentData
  /** Whether a language has any content, for the dot on its tab. */
  hasLocale?: (values: T, locale: Locale) => boolean
  /** Fields of one language. Without it there is no language card (settings). */
  renderLocale?: (context: EditorContext) => ReactNode
  /** Fields shared by all languages, under the language card. */
  renderShared?: (context: EditorContext) => ReactNode
  /** The right-hand column: cover, date, category… */
  renderSidebar?: (context: EditorContext) => ReactNode
  /**
   * How languages relate. "uzbek-first" (content): Uzbek is required, an empty translation
   * shows the Uzbek text. "independent" (site texts): each language stands alone.
   */
  languages?: 'uzbek-first' | 'independent'
  /** Marks the Uzbek tab as required; off where every field is optional (a page's SEO). */
  uzbekRequired?: boolean
  /** The form field an API problem belongs to; the default fits content documents. */
  fieldOfIssue?: (path: string) => string
  /** Checks only the dashboard can make (it knows the site's defaults), run before saving. */
  validate?: (values: T) => Issue[]
}

const time = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Tashkent',
})
const day = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Tashkent',
})

/** "в 14:32" today, "14 окт." before. */
function savedAt(iso: string): string {
  const date = new Date(iso)
  return day.format(date) === day.format(new Date()) ? `в ${time.format(date)}` : day.format(date)
}

/** "locales.uz.body.content.3…" → "locales.uz.body"; "shared.gallery.2.mediaId" → "shared.gallery". */
function fieldOf(path: string): string {
  const parts = path.split('.')
  return (parts[0] === 'locales' ? parts.slice(0, 3) : parts.slice(0, 2)).join('.')
}

function LocaleTabsList<T extends FieldValues>({
  hasLocale,
  uzbekRequired,
}: {
  hasLocale: (values: T, locale: Locale) => boolean
  uzbekRequired: boolean
}) {
  // Only this small list re-renders on every keystroke.
  const values = useWatch() as T
  return (
    <TabsList className="h-auto gap-1 rounded-[9px] bg-muted p-[3px]">
      {LOCALES.map((locale) => {
        const filled = hasLocale(values, locale)
        return (
          <TabsTrigger
            key={locale}
            value={locale}
            className="h-[30px] flex-none gap-1.5 rounded-[7px] px-3.5 font-medium text-[13px] data-[state=active]:bg-card data-[state=active]:shadow-[0_1px_2px_rgba(0,0,0,.08)]"
          >
            {locale.toUpperCase()}
            <span className="sr-only">{LOCALE_LABELS[locale]}</span>
            {locale === 'uz' && uzbekRequired ? (
              <span className="sr-only">(обязательно)</span>
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                'size-1.5 rounded-full',
                filled ? 'bg-success' : 'bg-muted-foreground/30',
              )}
            />
            <span className="sr-only">{filled ? '(заполнено)' : '(не заполнено)'}</span>
          </TabsTrigger>
        )
      })}
    </TabsList>
  )
}

export function DocumentEditor<T extends FieldValues>(props: DocumentEditorProps<T>) {
  const { type, singleton = false, publishOnSave = false, renderLocale } = props
  const uzbekFirst = (props.languages ?? 'uzbek-first') === 'uzbek-first'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canWrite = useCan(props.permissions.write)
  const canPublish = useCan(props.permissions.publish)

  const single = useSingleton(type, singleton)
  const docId = singleton ? single.data?.id : props.id
  const docQuery = useDocument(docId)
  const doc = docQuery.data ?? null
  const loading = singleton ? single.isPending : Boolean(props.id) && docQuery.isPending
  const loadError = singleton ? single.error : docQuery.error

  const form = useForm<FieldValues>({ defaultValues: props.empty() })
  const { isDirty } = form.formState
  const [locale, setLocale] = useState<Locale>('uz')
  const [resetKey, setResetKey] = useState(0)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [dialog, setDialog] = useState<'history' | 'schedule' | 'unpublish' | 'delete' | null>(null)
  /** A publication time picked in the form; null publishes now. */
  const [scheduleAt, setScheduleAt] = useState<string | null>(null)

  const create = useCreateDocument()
  const save = useSaveDocument()
  const publish = usePublishDocument()
  const unpublish = useUnpublishDocument()
  const schedule = useScheduleDocument()
  const remove = useDeleteDocument()
  const busy =
    create.isPending ||
    save.isPending ||
    publish.isPending ||
    unpublish.isPending ||
    schedule.isPending ||
    remove.isPending

  // The section's converters, read when needed: they are new functions on every render.
  const convert = useRef(props)
  convert.current = props

  /** Shows `view` in the form: first load, a restored version, someone else's newer save. */
  const load = useCallback(
    (view: DocumentView) => {
      form.reset(convert.current.fromData(view.data) as FieldValues)
      setScheduleAt(view.scheduledAt)
      setResetKey((key) => key + 1)
      setLoadedId(view.id)
      setConflict(false)
    },
    [form],
  )

  useEffect(() => {
    if (doc && doc.id !== loadedId) load(doc)
  }, [doc, loadedId, load])

  // Leaving with unsaved edits: in the app, and when closing or reloading the tab. The blocker
  // runs outside render, where formState still holds what the last render saw — "dirty" right
  // after a save — so it reads this ref, which a save clears at once.
  const dirty = useRef(false)
  dirty.current = isDirty
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty.current && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (!isDirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])

  function report(error: unknown) {
    if (error instanceof ApiError && error.code === 'conflict') {
      setConflict(true)
      return
    }
    const issues = issuesOf(error)
    for (const issue of issues) {
      form.setError((props.fieldOfIssue ?? fieldOf)(issue.path), {
        type: 'server',
        message: issue.message,
      })
    }
    const withLocale = issues
      // "locales.ru.title", or "shared.overrides.ru.Hero.title" on the texts screen.
      .map(
        (issue) =>
          /^(?:locales|shared\.overrides)\.(uz|ru|en)\b/.exec(issue.path)?.[1] as
            | Locale
            | undefined,
      )
      .find(Boolean)
    if (withLocale) setLocale(withLocale)
    toast.error(errorMessage(error))
  }

  /** Saves what is on screen; a new document is created and its page opens. */
  async function persist(): Promise<DocumentView | null> {
    const values = form.getValues()
    form.clearErrors()
    const problems = convert.current.validate?.(values as T) ?? []
    if (problems.length > 0) {
      for (const problem of problems) {
        form.setError(problem.path, { type: 'client', message: problem.message })
      }
      toast.error(problems.length === 1 ? problems[0]?.message : 'Проверьте отмеченные поля')
      return null
    }
    try {
      const data = convert.current.toData(values as T)
      const saved = doc
        ? await save.mutateAsync({ id: doc.id, data, revision: doc.revision })
        : await create.mutateAsync({ type, data })
      // Keep what is on screen (typing may have gone on meanwhile), but mark it saved.
      form.reset(values, { keepValues: true })
      dirty.current = false
      if (!doc) {
        setLoadedId(saved.id)
        if (singleton) queryClient.setQueryData(contentKeys.singleton(type), saved)
        else navigate(`${props.list.path}/${saved.id}`, { replace: true })
      }
      return saved
    } catch (error) {
      report(error)
      return null
    }
  }

  async function onSave() {
    if (!canWrite || busy) return
    const saved = await persist()
    if (saved) toast.success(publishOnSave ? 'Сохранено и опубликовано' : 'Сохранено')
  }

  /** The current version, saved first if it has edits. */
  async function saved(): Promise<DocumentView | null> {
    if (doc && !dirty.current) return doc
    return persist()
  }

  async function onPublish() {
    const target = await saved()
    if (!target) return
    try {
      await publish.mutateAsync({ id: target.id, revision: target.revision })
      toast.success('Опубликовано на сайте')
    } catch (error) {
      report(error)
    }
  }

  async function onSchedule(at: string) {
    const target = await saved()
    if (!target) return
    try {
      await schedule.mutateAsync({ id: target.id, at })
      setDialog(null)
      toast.success(`Выйдет на сайте ${formatDateTime(at)}`)
    } catch (error) {
      report(error)
    }
  }

  async function onUnschedule() {
    if (!doc) return
    await schedule
      .mutateAsync({ id: doc.id, at: null })
      .then(() => toast.success('Публикация по расписанию отменена'))
      .catch(report)
  }

  async function onUnpublish() {
    if (!doc) return
    await unpublish
      .mutateAsync(doc.id)
      .then(() => {
        setDialog(null)
        toast.success('Снято с публикации: на сайте больше не показывается')
      })
      .catch(report)
  }

  async function onDelete() {
    if (!doc) return
    try {
      await remove.mutateAsync({ id: doc.id, type })
      // In the trash with whatever was on screen unsaved: nothing left to warn about.
      dirty.current = false
      setDialog(null)
      toast.success('Перемещено в корзину. Восстановить можно в течение 30 дней.')
      navigate(props.list.path)
    } catch (error) {
      setDialog(null)
      report(error)
    }
  }

  async function onPreview() {
    // Opened right away, while the click still counts: a window opened after an await is
    // often blocked as a pop-up.
    const preview = window.open('about:blank', '_blank')
    const target = await saved()
    const locales = target?.previewLocales ?? []
    const chosen = locales.includes(locale) ? locale : locales[0]
    if (!target || !chosen) {
      preview?.close()
      if (target) toast.error('У этого раздела нет своей страницы на сайте')
      return
    }
    try {
      const { url } = await previewLink(target.id, chosen)
      if (preview) {
        preview.opener = null
        preview.location.href = url
      } else {
        window.open(url, '_blank', 'noopener')
      }
    } catch (error) {
      preview?.close()
      toast.error(errorMessage(error))
    }
  }

  async function reloadLatest() {
    const latest = await docQuery.refetch()
    if (latest.data) load(latest.data)
  }

  // Ctrl+S / ⌘S saves, from any field.
  const saveShortcut = useRef(onSave)
  saveShortcut.current = onSave
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveShortcut.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const liveTitle = useWatch({ control: form.control, name: props.titleName }) as string | undefined

  if (loading) return <p className="text-muted-foreground text-sm">Загружаем…</p>
  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errorMessage(loadError)}</AlertDescription>
      </Alert>
    )
  }

  const context: EditorContext = {
    locale,
    resetKey,
    doc,
    form,
    schedule: { at: scheduleAt, set: setScheduleAt, canPublish },
  }
  const status = doc?.status
  const scheduling = Boolean(scheduleAt) && !publishOnSave
  const publishLabel = scheduling
    ? 'Запланировать'
    : !doc
      ? 'Опубликовать'
      : status === 'changed' || (doc.isLive && isDirty)
        ? 'Обновить'
        : doc.isLive
          ? 'Опубликовано'
          : 'Опубликовать'
  const heading = props.heading
    ? doc
      ? props.heading.edit
      : props.heading.create
    : liveTitle?.trim() || doc?.title || props.newTitle

  return (
    <FormProvider {...form}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void onSave()
        }}
        noValidate
      >
        {/* The action bar stays on top while the form scrolls, across the content area. */}
        <header className="sticky top-0 z-10 -mx-4 -mt-8 mb-6 border-b bg-background/92 backdrop-blur-md max-md:top-14 sm:-mx-8">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-8">
            {(props.showBack ?? !singleton) ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link to={props.list.path} aria-label={`Назад: ${props.list.label}`}>
                  <ArrowLeft aria-hidden="true" />
                  Назад
                </Link>
              </Button>
            ) : null}
            <h1 className="min-w-0 truncate font-semibold text-[15px]">{heading}</h1>
            {status && !publishOnSave ? <StatusBadge status={status} /> : null}
            <span className="text-muted-foreground text-xs">
              {isDirty ? (
                <span className="text-amber-700 dark:text-amber-300">
                  Есть несохранённые правки
                </span>
              ) : doc?.scheduledAt ? (
                `Выйдет ${formatDateTime(doc.scheduledAt)}`
              ) : doc ? (
                <span title={doc.updatedBy ? `Изменил(а) ${doc.updatedBy.name}` : undefined}>
                  Сохранено {savedAt(doc.updatedAt)}
                </span>
              ) : (
                'Ещё не сохранено'
              )}
            </span>
            {doc?.liveUrl ? (
              <a
                href={doc.liveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary text-xs hover:underline"
              >
                Открыть
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            ) : null}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {doc?.previewLocales.length || (!doc && !singleton) ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onPreview}
                  disabled={busy || !canWrite}
                >
                  <Eye aria-hidden="true" />
                  Предпросмотр
                </Button>
              ) : null}
              {doc ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="История версий"
                  title="История версий"
                  onClick={() => setDialog('history')}
                >
                  <History aria-hidden="true" />
                </Button>
              ) : null}
              {doc && ((canPublish && !publishOnSave) || (canWrite && !singleton)) ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="icon" aria-label="Ещё действия">
                      <MoreHorizontal aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    {canPublish && !publishOnSave ? (
                      <>
                        <DropdownMenuItem onSelect={() => setDialog('schedule')}>
                          <CalendarClock aria-hidden="true" />
                          {doc.scheduledAt
                            ? 'Изменить время публикации'
                            : 'Запланировать публикацию'}
                        </DropdownMenuItem>
                        {doc.scheduledAt ? (
                          <DropdownMenuItem onSelect={onUnschedule}>
                            <CalendarX aria-hidden="true" />
                            Отменить расписание
                          </DropdownMenuItem>
                        ) : null}
                        {doc.isLive ? (
                          <DropdownMenuItem onSelect={() => setDialog('unpublish')}>
                            <Undo2 aria-hidden="true" />
                            Снять с публикации
                          </DropdownMenuItem>
                        ) : null}
                      </>
                    ) : null}
                    {canWrite && !singleton ? (
                      <>
                        {canPublish && !publishOnSave ? <DropdownMenuSeparator /> : null}
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setDialog('delete')}
                        >
                          <Trash2 aria-hidden="true" />
                          Удалить
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              <Button
                type="submit"
                variant={publishOnSave || !canPublish ? 'default' : 'outline'}
                disabled={!canWrite || busy || (Boolean(doc) && !isDirty)}
              >
                {save.isPending || create.isPending
                  ? 'Сохраняем…'
                  : publishOnSave || doc?.isLive
                    ? 'Сохранить'
                    : 'Сохранить черновик'}
              </Button>
              {canPublish && !publishOnSave ? (
                <Button
                  type="button"
                  onClick={scheduling && scheduleAt ? () => onSchedule(scheduleAt) : onPublish}
                  disabled={
                    busy ||
                    (!scheduling && Boolean(doc?.isLive) && status !== 'changed' && !isDirty)
                  }
                >
                  {publish.isPending || schedule.isPending ? 'Публикуем…' : publishLabel}
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        {conflict ? (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              Пока вы редактировали, документ сохранил другой пользователь. Загрузите его версию,
              чтобы не затереть чужие правки (ваши несохранённые правки пропадут).
              <Button type="button" size="sm" variant="outline" onClick={reloadLatest}>
                Загрузить свежую версию
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <div
          className={cn(
            'grid items-start gap-6',
            props.renderSidebar && 'lg:grid-cols-[minmax(0,1fr)_340px]',
          )}
        >
          <div className="min-w-0 space-y-4">
            {renderLocale ? (
              <Tabs
                value={locale}
                onValueChange={(value) => setLocale(value as Locale)}
                className="gap-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <LocaleTabsList
                    hasLocale={props.hasLocale ?? (() => false)}
                    uzbekRequired={uzbekFirst && (props.uzbekRequired ?? true)}
                  />
                  {uzbekFirst && locale !== 'uz' ? (
                    <span className="text-muted-foreground text-xs">
                      Необязательно: пустое поле на сайте покажется на узбекском.
                    </span>
                  ) : null}
                </div>
                {LOCALES.map((item) => (
                  <TabsContent key={item} value={item}>
                    {item === locale ? (
                      props.bareLocale ? (
                        <div key={resetKey} className="space-y-4">
                          {renderLocale(context)}
                        </div>
                      ) : (
                        <Card key={resetKey} className="space-y-5 p-6">
                          {renderLocale(context)}
                        </Card>
                      )
                    ) : null}
                  </TabsContent>
                ))}
              </Tabs>
            ) : null}
            {props.renderShared ? <div key={resetKey}>{props.renderShared(context)}</div> : null}
          </div>
          {props.renderSidebar ? (
            <aside key={resetKey} className="space-y-4">
              {props.renderSidebar(context)}
            </aside>
          ) : null}
        </div>
      </form>

      {doc ? (
        <>
          <VersionsDialog
            doc={doc}
            open={dialog === 'history'}
            onOpenChange={(open) => setDialog(open ? 'history' : null)}
            canRestore={canWrite}
            dirty={isDirty}
            onRestored={load}
          />
          {dialog === 'schedule' ? (
            <ScheduleDialog
              open
              onOpenChange={(open) => setDialog(open ? 'schedule' : null)}
              current={doc.scheduledAt}
              pending={busy}
              onSubmit={onSchedule}
            />
          ) : null}
          <ConfirmDialog
            open={dialog === 'unpublish'}
            onOpenChange={(open) => setDialog(open ? 'unpublish' : null)}
            title="Снять с публикации?"
            description="Страница пропадёт с сайта. Черновик и история останутся, опубликовать снова можно в любой момент."
            confirmLabel="Снять с публикации"
            pending={unpublish.isPending}
            onConfirm={onUnpublish}
          />
          <ConfirmDialog
            open={dialog === 'delete'}
            onOpenChange={(open) => setDialog(open ? 'delete' : null)}
            title="Удалить?"
            description="Документ попадёт в корзину и пропадёт с сайта. В течение 30 дней его можно восстановить."
            confirmLabel="Удалить"
            destructive
            pending={remove.isPending}
            onConfirm={onDelete}
          />
        </>
      ) : null}

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.()
        }}
        title="Уйти без сохранения?"
        description="На странице есть несохранённые правки. Если уйти, они пропадут."
        confirmLabel="Уйти"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </FormProvider>
  )
}

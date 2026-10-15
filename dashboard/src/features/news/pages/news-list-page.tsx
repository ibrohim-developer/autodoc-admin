import { Pin, Plus, RotateCcw, Search, Tags, Trash2 } from 'lucide-react'
import { type ReactNode, useDeferredValue, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/content/status-badge'
import { Pager } from '@/components/pager'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { errorMessage } from '@/lib/api-client'
import { cn } from '@/lib/cn'
import {
  type DocumentSummary,
  type ListParams,
  useDeleteDocument,
  useDocuments,
  useSetFlag,
} from '@/lib/content'
import { formatDateTime } from '@/lib/format'
import { LOCALES, useMediaByIds } from '@/lib/media'
import { useCan } from '@/lib/session'
import { type TrashItem, useRestoreItem, useTrash } from '@/lib/trash'
import { usePostViews } from '../api/views'
import { useCategoryOptions } from '../hooks/use-categories'

const TYPE = 'post'
const PAGE_SIZE = 25
const ALL = 'all'

const TABS = [
  { key: 'all', label: 'Все' },
  { key: 'live', label: 'Опубликовано' },
  { key: 'scheduled', label: 'Запланировано' },
  { key: 'draft', label: 'Черновики' },
  { key: 'trash', label: 'Корзина' },
] as const
type Tab = (typeof TABS)[number]['key']

const tabOf = (value: string | null): Tab => TABS.find((tab) => tab.key === value)?.key ?? 'all'

const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeZone: 'UTC' })
const views = new Intl.NumberFormat('ru-RU')

/** Columns drop out as the list narrows (languages, views, date): it never scrolls sideways. */
const COLUMNS =
  'grid-cols-[minmax(0,1fr)_130px_72px] @xl:grid-cols-[minmax(0,1fr)_130px_110px_72px] @2xl:grid-cols-[minmax(0,1fr)_140px_84px_110px_72px] @4xl:grid-cols-[minmax(0,1fr)_140px_110px_84px_120px_72px]'
const TRASH_COLUMNS =
  'grid-cols-[minmax(0,1fr)_auto] @2xl:grid-cols-[minmax(0,1fr)_150px_auto] @4xl:grid-cols-[minmax(0,1fr)_150px_150px_auto]'

/** Новости и блог: tabs by state, search, category filter, and pin / trash right in the row. */
export function NewsListPage() {
  const canWrite = useCan('content.write')
  const [params, setParams] = useSearchParams()
  const tab = tabOf(params.get('tab'))
  const [q, setQ] = useState('')
  const [category, setCategory] = useState(ALL)
  const [page, setPage] = useState(1)
  const query = useDeferredValue(q.trim())
  const { options, names } = useCategoryOptions()

  const listParams: ListParams = {
    q: query,
    status: tab === 'all' || tab === 'trash' ? undefined : tab,
    ref: category === ALL ? undefined : `categoryId:${category}`,
    page,
    pageSize: PAGE_SIZE,
  }
  const list = useDocuments(TYPE, listParams)
  const trash = useTrash()
  const trashed = (trash.data?.items ?? []).filter(
    (item) => item.kind === 'document' && item.type === TYPE,
  )
  const counts = list.data?.counts
  const tabCount: Record<Tab, number | undefined> = {
    all: counts && counts.draft + counts.live + counts.scheduled,
    live: counts?.live,
    scheduled: counts?.scheduled,
    draft: counts?.draft,
    trash: trash.data ? trashed.length : undefined,
  }

  function open(next: Tab) {
    setParams(next === 'all' ? {} : { tab: next }, { replace: true })
    setPage(1)
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-semibold text-[26px] tracking-[-0.01em]">Новости и блог</h1>
          <p className="text-muted-foreground text-sm">
            Раздел «Блог» на сайте и блок новостей на главной.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/news/categories">
              <Tags aria-hidden="true" />
              Категории
            </Link>
          </Button>
          {canWrite ? (
            <Button asChild>
              <Link to="/news/new">
                <Plus aria-hidden="true" />
                Создать материал
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div role="tablist" aria-label="Состояние" className="flex flex-wrap gap-1 border-b">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => open(item.key)}
            className={cn(
              '-mb-px flex gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors',
              tab === item.key
                ? 'border-foreground font-semibold text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
            {tabCount[item.key] !== undefined ? (
              <span className="font-normal text-muted-foreground/80 tabular-nums">
                {tabCount[item.key]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'trash' ? (
        <TrashTab items={trashed} loading={trash.isPending} error={trash.error} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2.5">
            <div className="relative min-w-60 flex-1">
              <Search
                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={q}
                onChange={(event) => {
                  setQ(event.target.value)
                  setPage(1)
                }}
                placeholder="Поиск по заголовку и тексту"
                aria-label="Поиск"
                className="pl-9"
              />
            </div>
            <Select
              value={category}
              onValueChange={(value) => {
                setCategory(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-56" aria-label="Категория">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Все категории</SelectItem>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {list.isError ? (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-4">
                {errorMessage(list.error)}
                <Button size="sm" variant="outline" onClick={() => list.refetch()}>
                  Повторить
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <PostTable
            items={list.data?.items}
            categories={names}
            empty={
              query || category !== ALL || tab !== 'all'
                ? 'Ничего не найдено'
                : 'Материалов пока нет'
            }
          />
          <Pager
            page={page}
            pages={list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1}
            onChange={setPage}
          />
        </>
      )}
    </div>
  )
}

function Frame({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className="@container overflow-hidden rounded-xl border bg-card">
      {header}
      {children}
    </div>
  )
}

function PostTable({
  items,
  categories,
  empty,
}: {
  items: DocumentSummary[] | undefined
  categories: Map<string, string>
  empty: string
}) {
  const canStats = useCan('stats.content')
  const ids = (items ?? []).map((item) => item.id)
  const viewCounts = usePostViews(ids, canStats)
  const covers = useMediaByIds(
    (items ?? []).flatMap((item) => {
      const cover = item.shared.cover as { mediaId?: string } | null | undefined
      return cover?.mediaId ? [cover.mediaId] : []
    }),
  )

  return (
    <Frame
      header={
        <div
          className={cn('grid gap-4 border-b px-4 py-2.5 text-muted-foreground text-xs', COLUMNS)}
        >
          <span>Материал</span>
          <span>Статус</span>
          <span className="@4xl:block hidden">Языки</span>
          <span className="@2xl:block hidden text-right">Просмотры</span>
          <span className="@xl:block hidden">Дата</span>
          <span className="sr-only">Действия</span>
        </div>
      }
    >
      {!items ? (
        <p className="px-4 py-12 text-center text-muted-foreground text-sm">Загружаем…</p>
      ) : null}
      {items?.length === 0 ? (
        <p className="px-4 py-12 text-center text-muted-foreground text-sm">{empty}</p>
      ) : null}
      {items?.map((item) => {
        const cover = item.shared.cover as { mediaId?: string } | null | undefined
        const categoryId = item.shared.categoryId
        return (
          <PostRow
            key={item.id}
            item={item}
            thumb={cover?.mediaId ? covers.data?.get(cover.mediaId)?.thumbUrl : undefined}
            category={typeof categoryId === 'string' ? categories.get(categoryId) : undefined}
            views={canStats ? (viewCounts.data?.[item.id] ?? 0) : null}
          />
        )
      })}
    </Frame>
  )
}

function PostRow({
  item,
  thumb,
  category,
  views: count,
}: {
  item: DocumentSummary
  thumb: string | undefined
  category: string | undefined
  views: number | null
}) {
  const navigate = useNavigate()
  const canWrite = useCan('content.write')
  const canPublish = useCan('content.publish')
  const setFlag = useSetFlag()
  const remove = useDeleteDocument()
  const restore = useRestoreItem()
  const pinned = item.shared.pinned === true
  const title = item.title || 'Без названия'
  // A post on the site changes there too: that takes the right to publish.
  const canPin = canWrite && (item.status === 'draft' || canPublish)

  function togglePin() {
    setFlag.mutate(
      { id: item.id, field: 'pinned', value: !pinned },
      {
        onSuccess: () => toast.success(pinned ? 'Материал откреплён' : 'Материал закреплён вверху'),
        onError: (error) => toast.error(errorMessage(error)),
      },
    )
  }

  function moveToTrash() {
    remove.mutate(
      { id: item.id, type: item.type },
      {
        onSuccess: () =>
          toast.success('Перемещено в корзину', {
            description: 'Хранится 30 дней.',
            action: {
              label: 'Вернуть',
              onClick: () =>
                restore.mutate(
                  { kind: 'document', id: item.id },
                  { onError: (error) => toast.error(errorMessage(error)) },
                ),
            },
          }),
        onError: (error) => toast.error(errorMessage(error)),
      },
    )
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the title link is the keyboard way in.
    // biome-ignore lint/a11y/noStaticElementInteractions: the whole row opens the post too.
    <div
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('a,button')) navigate(`/news/${item.id}`)
      }}
      className={cn(
        'grid cursor-pointer items-center gap-4 border-b px-4 py-3 last:border-b-0 hover:bg-muted/40',
        COLUMNS,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {thumb ? (
          <img src={thumb} alt="" className="h-10 w-14 shrink-0 rounded-md object-cover" />
        ) : (
          <div className="h-10 w-14 shrink-0 rounded-md bg-muted" aria-hidden="true" />
        )}
        <div className="min-w-0 space-y-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            {pinned ? (
              <span className="shrink-0 rounded-[4px] bg-primary-soft px-1.5 py-px font-semibold text-[11px] text-primary">
                Закреплено
              </span>
            ) : null}
            <Link
              to={`/news/${item.id}`}
              title={title}
              className="truncate font-medium text-sm hover:underline focus-visible:underline"
            >
              {title}
            </Link>
          </div>
          <p className="truncate text-muted-foreground text-xs">
            {category ?? 'Без категории'}
            {item.updatedBy ? ` · ${item.updatedBy.name}` : ''}
          </p>
        </div>
      </div>
      <div className="space-y-1">
        <StatusBadge status={item.status} short />
        {item.scheduledAt ? (
          <p className="text-muted-foreground text-xs">{formatDateTime(item.scheduledAt)}</p>
        ) : null}
      </div>
      <div className="@4xl:flex hidden gap-1">
        {LOCALES.map((locale) => {
          const filled = item.locales.includes(locale)
          return (
            <span
              key={locale}
              title={filled ? 'Заполнено' : 'Не переведено'}
              className={cn(
                'rounded-[4px] border px-1.5 py-0.5 font-semibold text-[11px]',
                filled ? 'border-foreground/20 text-foreground' : 'text-muted-foreground/50',
              )}
            >
              <span className="sr-only">{filled ? 'Есть ' : 'Нет '}</span>
              {locale.toUpperCase()}
            </span>
          )
        })}
      </div>
      <span className="@2xl:block hidden text-right text-sm tabular-nums">
        {count === null || count === 0 ? '—' : views.format(count)}
      </span>
      <span className="@xl:block hidden text-[13px] text-muted-foreground">
        {typeof item.shared.date === 'string' ? dateFormat.format(new Date(item.shared.date)) : '—'}
      </span>
      <div className="flex justify-end gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className={cn('size-8', pinned ? 'text-primary' : 'text-muted-foreground/60')}
          aria-label={pinned ? `Открепить «${title}»` : `Закрепить «${title}» вверху`}
          aria-pressed={pinned}
          title={pinned ? 'Открепить' : 'Закрепить вверху'}
          disabled={!canPin || setFlag.isPending}
          onClick={togglePin}
        >
          <Pin className={cn(pinned && 'fill-current')} aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          aria-label={`В корзину «${title}»`}
          title="В корзину (30 дней)"
          disabled={!canWrite || remove.isPending}
          onClick={moveToTrash}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

/** Deleted posts: back as they were with one click, or gone for good after 30 days. */
function TrashTab({
  items,
  loading,
  error,
}: {
  items: TrashItem[]
  loading: boolean
  error: unknown
}) {
  const canWrite = useCan('content.write')
  const restore = useRestoreItem()

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errorMessage(error)}</AlertDescription>
      </Alert>
    )
  }
  return (
    <Frame
      header={
        <div
          className={cn(
            'grid gap-4 border-b px-4 py-2.5 text-muted-foreground text-xs',
            TRASH_COLUMNS,
          )}
        >
          <span>Материал</span>
          <span className="@4xl:block hidden">Удалено</span>
          <span className="@2xl:block hidden">Удалится навсегда</span>
          <span className="sr-only">Действия</span>
        </div>
      }
    >
      {loading ? (
        <p className="px-4 py-12 text-center text-muted-foreground text-sm">Загружаем…</p>
      ) : null}
      {!loading && items.length === 0 ? (
        <p className="px-4 py-12 text-center text-muted-foreground text-sm">
          Корзина пуста. Удалённые материалы хранятся здесь 30 дней.
        </p>
      ) : null}
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            'grid items-center gap-4 border-b px-4 py-3 last:border-b-0',
            TRASH_COLUMNS,
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            {item.thumbUrl ? (
              <img
                src={item.thumbUrl}
                alt=""
                className="h-10 w-14 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="h-10 w-14 shrink-0 rounded-md bg-muted" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="truncate font-medium text-sm" title={item.title}>
                {item.title || 'Без названия'}
              </p>
              {item.deletedBy ? (
                <p className="text-muted-foreground text-xs">{item.deletedBy.name}</p>
              ) : null}
            </div>
          </div>
          <span className="@4xl:block hidden text-[13px] text-muted-foreground">
            {formatDateTime(item.deletedAt)}
          </span>
          <span className="@2xl:block hidden text-[13px] text-muted-foreground">
            {formatDateTime(item.purgeAt)}
          </span>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={!canWrite || restore.isPending}
              aria-label={`Восстановить «${item.title}»`}
              onClick={() =>
                restore.mutate(item, {
                  onSuccess: () => toast.success('Материал восстановлен'),
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              <RotateCcw aria-hidden="true" />
              <span className="@max-2xl:sr-only">Восстановить</span>
            </Button>
          </div>
        </div>
      ))}
    </Frame>
  )
}

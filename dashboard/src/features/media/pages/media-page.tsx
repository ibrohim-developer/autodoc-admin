import { ImageUp, Search } from 'lucide-react'
import { type DragEvent, useState } from 'react'
import { MediaUploadButton, useUploadFiles } from '@/components/media-upload'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/api-client'
import { cn } from '@/lib/cn'
import { MAX_UPLOAD_MB, useMediaList } from '@/lib/media'
import { useCan } from '@/lib/session'
import { MediaDetailsDialog } from '../components/media-details-dialog'

export function MediaPage() {
  const canEdit = useCan('media.write')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const list = useMediaList(query.trim(), page)
  const { uploadFiles, pending } = useUploadFiles()

  const pageSize = 60
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / pageSize)) : 1

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (!canEdit) return
    const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith('image/'))
    if (files.length > 0) void uploadFiles(files)
  }

  return (
    <section
      className="relative space-y-6"
      aria-labelledby="media-title"
      onDragOver={(event) => {
        if (!canEdit) return
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="media-title" className="font-semibold text-2xl tracking-tight">
            Медиатека
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Все фото сайта в одном месте. Загруженные фото сжимаются автоматически — до{' '}
            {MAX_UPLOAD_MB} МБ, JPG, PNG, WebP или AVIF.
          </p>
        </div>
        {canEdit ? <MediaUploadButton /> : null}
      </div>

      <div className="relative max-w-md">
        <Search
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setPage(1)
          }}
          placeholder="Поиск по имени файла или описанию"
          aria-label="Поиск фото"
          className="pl-9"
        />
      </div>

      {list.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(list.error)}</AlertDescription>
        </Alert>
      ) : null}

      {list.data && list.data.items.length === 0 && pending === 0 ? (
        <div className="grid place-items-center rounded-lg border border-dashed py-16 text-center">
          <ImageUp className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium">{query ? 'Ничего не найдено' : 'Пока ни одного фото'}</p>
          {canEdit && !query ? (
            <p className="mt-1 text-muted-foreground text-sm">
              Перетащите фото сюда или нажмите «Загрузить фото».
            </p>
          ) : null}
        </div>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {list.data?.items.map((media) => (
          <li key={media.id}>
            <button
              type="button"
              onClick={() => setOpenId(media.id)}
              className="group block w-full overflow-hidden rounded-lg border bg-card text-left transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="aspect-[4/3] bg-muted">
                <img
                  src={media.thumbUrl}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              </div>
              <div className="space-y-1 p-2">
                <p className="truncate font-medium text-sm" title={media.originalName}>
                  {media.originalName}
                </p>
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  {media.width} × {media.height}
                  <span className="ml-auto flex gap-1">
                    {media.usageCount > 0 ? (
                      <Badge variant="secondary" className="font-normal">
                        используется
                      </Badge>
                    ) : null}
                    {!media.alt.uz && !media.alt.ru ? (
                      <Badge variant="outline" className="font-normal">
                        без описания
                      </Badge>
                    ) : null}
                  </span>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {pages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Назад
          </Button>
          <span className="text-muted-foreground text-sm">
            {page} из {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Дальше
          </Button>
        </div>
      ) : null}

      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 grid place-items-center rounded-xl border-2 border-primary border-dashed bg-primary/5 transition-opacity',
          dragging ? 'opacity-100' : 'opacity-0',
        )}
      >
        <p className="rounded-md bg-background px-4 py-2 font-medium shadow">
          Отпустите, чтобы загрузить
        </p>
      </div>

      <MediaDetailsDialog mediaId={openId} canEdit={canEdit} onClose={() => setOpenId(null)} />
    </section>
  )
}

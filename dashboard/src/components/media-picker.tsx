import { Search } from 'lucide-react'
import { useState } from 'react'
import { MediaUploadButton } from '@/components/media-upload'
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
import { cn } from '@/lib/cn'
import { type Media, useMediaList } from '@/lib/media'

/** Choose a photo from the library, or upload a new one right here. */
export function MediaPicker({
  open,
  onOpenChange,
  onSelect,
  title = 'Выберите фото',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (media: Media) => void
  title?: string
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Media | null>(null)
  const list = useMediaList(query.trim())

  function choose(media: Media | null) {
    if (!media) return
    onSelect(media)
    onOpenChange(false)
    setSelected(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Из медиатеки или новое с компьютера.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-48 flex-1">
            <Search
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по имени файла или описанию"
              aria-label="Поиск фото"
              className="pl-9"
            />
          </div>
          <MediaUploadButton
            variant="outline"
            multiple={false}
            onUploaded={([media]) => choose(media ?? null)}
          />
        </div>

        {list.isPending ? <p className="text-muted-foreground text-sm">Загружаем…</p> : null}
        {list.data && list.data.items.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground text-sm">
            {query ? 'Ничего не найдено' : 'В медиатеке пока нет фото'}
          </p>
        ) : null}
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {list.data?.items.map((media) => (
            <li key={media.id}>
              <button
                type="button"
                onClick={() => setSelected(media)}
                onDoubleClick={() => choose(media)}
                aria-pressed={selected?.id === media.id}
                aria-label={media.alt.ru || media.alt.uz || media.originalName}
                className={cn(
                  'block aspect-square w-full overflow-hidden rounded-md border-2 bg-muted transition',
                  selected?.id === media.id
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-transparent hover:border-border',
                )}
              >
                <img
                  src={media.thumbUrl}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={() => choose(selected)} disabled={!selected}>
            Выбрать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from 'lucide-react'
import { type KeyboardEvent, type MouseEvent, type ReactNode, useState } from 'react'
import { useController } from 'react-hook-form'
import { MediaPicker } from '@/components/media-picker'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { type Media, useMediaByIds } from '@/lib/media'
import { Field } from './fields'

/** How documents point at a library photo; the site looks up its sizes and alt text. */
export type MediaRef = { mediaId: string }

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)))

function parsePosition(value: unknown): [number, number] {
  const [x, y] = String(value || '50% 50%')
    .split(' ')
    .map((part) => Number.parseFloat(part))
  return [Number.isFinite(x) ? (x as number) : 50, Number.isFinite(y) ? (y as number) : 50]
}

/**
 * Click the main thing in the photo (a face, a kiosk); cropped versions on the site keep it in
 * frame. Arrow keys move the point too.
 */
function FocalPoint({ name, photo, aspect }: { name: string; photo: Media; aspect?: string }) {
  const { field } = useController({ name })
  const [x, y] = parsePosition(field.value)
  const set = (nextX: number, nextY: number) => field.onChange(`${clamp(nextX)}% ${clamp(nextY)}%`)

  function onClick(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    // Keyboard "clicks" have no position: those use the arrow keys instead.
    if (event.detail === 0) return
    set(
      ((event.clientX - rect.left) / rect.width) * 100,
      ((event.clientY - rect.top) / rect.height) * 100,
    )
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 10 : 2
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    set(x + move[0], y + move[1])
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        onKeyDown={onKeyDown}
        aria-label={`Точка фокуса: ${x}% по горизонтали, ${y}% по вертикали. Нажмите на главное в кадре или двигайте стрелками.`}
        className="relative block w-full cursor-crosshair overflow-hidden rounded-md bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      >
        <img src={photo.url} alt="" draggable={false} className="block w-full select-none" />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/40 shadow-[0_0_0_1px_rgb(0_0_0/0.5)]"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      </button>
      {aspect ? (
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs">Так фото обрежется в карточке:</p>
          <img
            src={photo.url}
            alt=""
            className="w-full rounded-md object-cover"
            style={{ aspectRatio: aspect, objectPosition: `${x}% ${y}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}

export function MediaField({
  name,
  label,
  hint,
  required,
  focalName,
  previewAspect,
  empty,
}: {
  name: string
  label: string
  hint?: ReactNode
  required?: boolean
  /** The field holding the photo's focal point ("shared.coverPosition"), if it has one. */
  focalName?: string
  /** The crop the site uses, e.g. "330 / 185" for news cards. */
  previewAspect?: string
  /** The empty box: its height and what it says (a cover is big, a social image small). */
  empty?: { className: string; title?: string; note?: string }
}) {
  const [open, setOpen] = useState(false)
  const { field, fieldState } = useController({ name })
  const value = field.value as MediaRef | null | undefined
  const photos = useMediaByIds(value ? [value.mediaId] : [])
  const photo = value ? photos.data?.get(value.mediaId) : undefined

  return (
    <Field label={label} required={required} hint={hint} error={fieldState.error?.message}>
      {value ? (
        <div className="space-y-2">
          {photo && focalName ? (
            <FocalPoint name={focalName} photo={photo} aspect={previewAspect} />
          ) : (
            <div className="overflow-hidden rounded-md border bg-muted">
              {photo ? (
                <img
                  src={photo.url}
                  alt={photo.alt.ru || photo.alt.uz || ''}
                  className="block w-full"
                />
              ) : (
                <div className="aspect-video" />
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
              Заменить
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange(null)}>
              Убрать
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-invalid={fieldState.error ? true : undefined}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed bg-muted/30 px-4 text-center text-muted-foreground text-sm transition-colors hover:border-primary hover:text-foreground aria-invalid:border-destructive',
            empty?.className ?? 'aspect-video',
          )}
        >
          {empty?.title ? (
            <span className="font-medium text-foreground">{empty.title}</span>
          ) : (
            <>
              <ImagePlus className="size-5" aria-hidden="true" />
              Выбрать фото
            </>
          )}
          {empty?.note ? <span className="text-muted-foreground text-xs">{empty.note}</span> : null}
        </button>
      )}
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        title={label}
        onSelect={(media) => field.onChange({ mediaId: media.id })}
      />
    </Field>
  )
}

export function GalleryField({
  name,
  label,
  hint,
  max = 40,
}: {
  name: string
  label: string
  hint?: ReactNode
  max?: number
}) {
  const [open, setOpen] = useState(false)
  const { field, fieldState } = useController({ name })
  const items: MediaRef[] = Array.isArray(field.value) ? field.value : []
  const photos = useMediaByIds(items.map((item) => item.mediaId))

  function move(index: number, delta: number) {
    const next = [...items]
    const [item] = next.splice(index, 1)
    if (item) next.splice(index + delta, 0, item)
    field.onChange(next)
  }

  return (
    <Field
      label={label}
      hint={hint}
      error={fieldState.error?.message}
      aside={
        <span className="text-muted-foreground text-xs tabular-nums">
          {items.length}/{max}
        </span>
      }
    >
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {items.map((item, index) => {
          const photo = photos.data?.get(item.mediaId)
          return (
            <li
              key={item.mediaId}
              className="group relative overflow-hidden rounded-md border bg-muted"
            >
              {photo ? (
                <img
                  src={photo.thumbUrl}
                  alt={photo.alt.ru || photo.alt.uz || photo.originalName}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="aspect-square" />
              )}
              <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="size-7"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="Переместить левее"
                >
                  <ArrowLeft aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="size-7"
                  onClick={() => field.onChange(items.filter((_, i) => i !== index))}
                  aria-label="Убрать из галереи"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="size-7"
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="Переместить правее"
                >
                  <ArrowRight aria-hidden="true" />
                </Button>
              </div>
            </li>
          )
        })}
        {items.length < max ? (
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground text-xs transition-colors hover:border-primary hover:text-foreground"
            >
              <ImagePlus className="size-5" aria-hidden="true" />
              Добавить
            </button>
          </li>
        ) : null}
      </ul>
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        title="Фото в галерею"
        onSelect={(media) => {
          if (!items.some((item) => item.mediaId === media.id)) {
            field.onChange([...items, { mediaId: media.id }])
          }
        }}
      />
    </Field>
  )
}

import { useEffect, useId, useState } from 'react'
import { useController, useFormContext, useWatch } from 'react-hook-form'
import type { EditorContext } from '@/components/content/document-editor'
import {
  DateField,
  Field,
  SelectField,
  SlugField,
  SwitchField,
  TagsField,
  useFieldError,
} from '@/components/content/fields'
import { MediaField } from '@/components/content/media-fields'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'
import type { Locale } from '@/lib/media'
import { type PostForm, postExcerpt } from '../api/post-form'
import { useCategoryOptions } from '../hooks/use-categories'
import { PostBlocks } from './post-blocks'

const TITLE_PLACEHOLDER: Record<Locale, string> = {
  uz: 'Sarlavha',
  ru: 'Заголовок',
  en: 'Headline',
}

/** The headline, large and borderless like the article it becomes. */
function TitleField({ locale }: { locale: Locale }) {
  const id = useId()
  const { field } = useController({ name: `locales.${locale}.title` })
  const error = useFieldError(`locales.${locale}.title`)
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="sr-only">
        Заголовок{locale === 'uz' ? ' (обязательно)' : ''}
      </label>
      <textarea
        id={id}
        rows={2}
        maxLength={200}
        value={typeof field.value === 'string' ? field.value : ''}
        onChange={field.onChange}
        onBlur={field.onBlur}
        placeholder={TITLE_PLACEHOLDER[locale]}
        aria-invalid={error ? true : undefined}
        className="w-full resize-none border-0 bg-transparent p-0 font-semibold text-[28px] leading-tight tracking-[-0.01em] outline-none placeholder:text-muted-foreground/60"
      />
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** One language: the headline, the cover and the article's blocks. */
export function PostLocaleFields({ locale, resetKey }: EditorContext) {
  return (
    <>
      <Card className="space-y-[18px] p-6">
        <TitleField locale={locale} />
        <MediaField
          name="shared.cover"
          label="Обложка"
          required
          focalName="shared.coverPosition"
          previewAspect="330 / 185"
          empty={{
            className: 'h-[200px]',
            title: 'Выберите изображение из медиатеки',
            note: 'JPG, PNG, WebP · рекомендуем 1600×900 · сжимается автоматически',
          }}
          hint="Нажмите на главное в кадре — так обрежется карточка."
        />
        <SwitchField
          name="shared.coverFull"
          label="Обложка целиком в материале"
          hint="Без обрезки по рамке баннера."
        />
      </Card>
      <PostBlocks locale={locale} resetKey={resetKey} />
    </>
  )
}

/** "2026-10-20" + "10:00" in Tashkent → an instant. */
function tashkentInstant(date: string, time: string): string {
  return new Date(`${date}T${time}:00+05:00`).toISOString()
}

const tashkentParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tashkent',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function partsOf(iso: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    tashkentParts.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  }
}

/** "Отложенная публикация": the main button then schedules for this time. */
function ScheduleControl({ schedule }: { schedule: EditorContext['schedule'] }) {
  const id = useId()
  const on = Boolean(schedule.at)
  const [draft, setDraft] = useState(() =>
    schedule.at
      ? partsOf(schedule.at)
      : partsOf(new Date(Date.now() + 24 * 3_600_000).toISOString()),
  )
  useEffect(() => {
    if (schedule.at) setDraft(partsOf(schedule.at))
  }, [schedule.at])

  function update(next: { date: string; time: string }) {
    setDraft(next)
    if (next.date && next.time) schedule.set(tashkentInstant(next.date, next.time))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor={id}>Отложенная публикация</Label>
          <p className="text-muted-foreground text-xs">Время по Ташкенту (UTC+5)</p>
        </div>
        <Switch
          id={id}
          checked={on}
          disabled={!schedule.canPublish}
          onCheckedChange={(checked) =>
            schedule.set(checked ? tashkentInstant(draft.date, draft.time || '10:00') : null)
          }
        />
      </div>
      {on ? (
        <div className="flex gap-2">
          <Input
            type="date"
            aria-label="Дата публикации"
            value={draft.date}
            onChange={(event) => update({ ...draft, date: event.target.value })}
            className="min-w-0 flex-1"
          />
          <Input
            type="time"
            aria-label="Время публикации"
            value={draft.time}
            onChange={(event) => update({ ...draft, time: event.target.value })}
            className="w-28"
          />
        </div>
      ) : null}
    </div>
  )
}

/** A text field with "used/limit" on the right, red past the limit search engines show. */
function SeoField({
  name,
  label,
  limit,
  effective,
  placeholder,
  multiline = false,
}: {
  name: string
  label: string
  limit: number
  /** What the site will use: this field, or its fallback when empty. */
  effective: string
  placeholder: string
  multiline?: boolean
}) {
  const id = useId()
  const { register } = useFormContext()
  const error = useFieldError(name)
  const props = { id, ...register(name), placeholder, 'aria-invalid': error ? true : undefined }
  return (
    <Field
      id={id}
      label={label}
      error={error}
      aside={
        <span
          className={cn(
            'text-xs tabular-nums',
            effective.length > limit ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {effective.length}/{limit}
        </span>
      }
    >
      {multiline ? <Textarea rows={3} {...props} /> : <Input {...props} />}
    </Field>
  )
}

const SITE = 'autodoc.uz'

/** The right column: publishing, then SEO for the open language. */
export function PostSidebar({ doc, locale, schedule }: EditorContext) {
  const { options } = useCategoryOptions()
  const values = useWatch() as PostForm
  const title = values.locales?.[locale]?.title || values.locales?.uz?.title || ''
  const seoTitle = values.locales?.[locale]?.seoTitle ?? ''
  const seoDescription = values.locales?.[locale]?.seoDescription ?? ''
  const excerpt = values.shared ? postExcerpt(values, locale, 160) : ''
  const effectiveTitle = seoTitle.trim() || title
  const effectiveDescription = seoDescription.trim() || excerpt
  const prefix = `${SITE}/${locale === 'uz' ? '' : `${locale}/`}blog/`

  return (
    <>
      <Card className="space-y-4 p-[18px]">
        <h2 className="font-semibold text-sm">Публикация</h2>
        <SelectField name="shared.categoryId" label="Категория" options={options} />
        <TagsField
          name={`locales.${locale}.tags`}
          label="Теги"
          hint={`Для языка ${locale.toUpperCase()}. Тег + Enter.`}
        />
        <DateField name="shared.date" label="Дата" required hint="В карточке и в материале." />
        <div className="h-px bg-border" />
        <SwitchField
          name="shared.pinned"
          label="Закрепить вверху"
          hint="Первым в списке на сайте"
        />
        <ScheduleControl schedule={schedule} />
      </Card>

      <Card className="space-y-4 p-[18px]">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold text-sm">SEO</h2>
          <span className="text-muted-foreground text-xs">{locale.toUpperCase()}</span>
        </div>
        <SeoField
          name={`locales.${locale}.seoTitle`}
          label="Title"
          limit={60}
          effective={effectiveTitle}
          placeholder={title || 'По умолчанию — заголовок'}
        />
        <SeoField
          name={`locales.${locale}.seoDescription`}
          label="Description"
          limit={160}
          effective={effectiveDescription}
          placeholder={excerpt || 'По умолчанию — начало текста'}
          multiline
        />
        <SlugField
          name="shared.slug"
          titleName="locales.uz.title"
          follow={!doc?.firstPublishedAt}
          prefix={prefix}
          hint={
            doc?.firstPublishedAt
              ? 'Материал уже был на сайте: со старого адреса посетители попадут на новый.'
              : 'Пока материал не опубликован, адрес берётся из заголовка.'
          }
        />
        <MediaField
          name="shared.ogImage"
          label="Картинка для соцсетей"
          empty={{
            className: 'h-[72px]',
            title: values.shared?.cover ? 'Используется обложка' : 'Выберите изображение 1200×630',
            note: values.shared?.cover ? 'можно заменить' : undefined,
          }}
          hint="Превью ссылки в Telegram и Facebook."
        />
        <div className="space-y-0.5 rounded-lg border bg-muted/40 p-3">
          <p className="text-[11px] text-muted-foreground">Так материал будет выглядеть в поиске</p>
          <p className="break-all text-[#3c6e3c] text-xs dark:text-[#8fc78f]">
            {prefix}
            {values.shared?.slug || '…'}
          </p>
          <p className="text-[#1a0dab] text-[15px] leading-snug dark:text-[#8ab4f8]">
            {effectiveTitle || 'Заголовок материала'}
          </p>
          <p className="text-[#4d5156] text-xs leading-relaxed dark:text-muted-foreground">
            {effectiveDescription || 'Описание появится здесь.'}
          </p>
        </div>
      </Card>
    </>
  )
}

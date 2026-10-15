import { useController, useWatch } from 'react-hook-form'
import { TextField } from '@/components/content/fields'
import { GalleryField } from '@/components/content/media-fields'
import { RichTextEditor } from '@/components/rich-text/rich-text-editor'
import { Card } from '@/components/ui/card'
import type { Locale } from '@/lib/media'
import type { RichTextDoc } from '@/lib/rich-text'

/** "youtu.be/…" → YouTube: shows the link was understood. */
function providerOf(url: string): string | null {
  if (/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(url)) return 'YouTube'
  if (/^https:\/\/(www\.)?instagram\.com\/(reel|reels|p)\//.test(url)) return 'Instagram Reels'
  return null
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <Card className="space-y-2.5 px-5 pt-4 pb-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.04em]">
          {title}
        </h2>
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
      </div>
      {children}
    </Card>
  )
}

const PLACEHOLDER: Record<Locale, string> = {
  uz: 'Matn…',
  ru: 'Текст материала…',
  en: 'Text…',
}

function TextSection({ locale, resetKey }: { locale: Locale; resetKey: string }) {
  const { field, fieldState } = useController({ name: `locales.${locale}.text` })
  return (
    <Section title="Текст" hint="Фото между абзацами — кнопка «Фото в текст» на панели">
      <RichTextEditor
        key={resetKey}
        label="Текст"
        initialValue={field.value as RichTextDoc | undefined}
        onChange={field.onChange}
        invalid={Boolean(fieldState.error)}
        placeholder={PLACEHOLDER[locale]}
      />
      {fieldState.error ? (
        <p className="text-destructive text-xs" role="alert">
          {fieldState.error.message}
        </p>
      ) : null}
    </Section>
  )
}

function VideoSection() {
  const url = (useWatch({ name: 'shared.videoUrl' }) as string | undefined) ?? ''
  const provider = providerOf(url.trim())
  return (
    <Section title="Видео" hint="Необязательно">
      <TextField
        name="shared.videoUrl"
        label="Ссылка"
        type="url"
        placeholder="Ссылка на YouTube или Instagram Reels"
        hint="Видео идёт после текста и галереи. На сайте плеер загрузится только по нажатию."
      />
      {provider ? (
        <span className="inline-block rounded-[5px] bg-success-soft px-2 py-1 font-medium text-success text-xs">
          {provider}
        </span>
      ) : null}
    </Section>
  )
}

/**
 * The article, always the same three sections: the text in the open language, then the
 * gallery and the video, shared by all languages. An empty gallery or video isn't shown on the site.
 */
export function PostSections({ locale, resetKey }: { locale: Locale; resetKey: number }) {
  return (
    <div className="space-y-4">
      <TextSection locale={locale} resetKey={`${resetKey}-${locale}`} />
      <Section title="Галерея" hint="Необязательно">
        <GalleryField
          name="shared.gallery"
          label="Фото в галерее"
          hint="На сайте — после текста. Порядок меняется стрелками на фото."
        />
      </Section>
      <VideoSection />
    </div>
  )
}

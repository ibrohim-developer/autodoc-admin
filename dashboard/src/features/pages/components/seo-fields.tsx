import { TextField } from '@/components/content/fields'
import type { Locale } from '@/lib/media'

/** Title and description for search engines and link previews, in one language. */
export function SeoFields({
  locale,
  titleHint,
  descriptionHint,
}: {
  locale: Locale
  titleHint: string
  descriptionHint: string
}) {
  return (
    <>
      <TextField
        name={`locales.${locale}.seoTitle`}
        label="SEO-заголовок"
        hint={titleHint}
        maxLength={120}
      />
      <TextField
        name={`locales.${locale}.seoDescription`}
        label="SEO-описание"
        hint={descriptionHint}
        multiline
        rows={3}
        maxLength={300}
      />
    </>
  )
}

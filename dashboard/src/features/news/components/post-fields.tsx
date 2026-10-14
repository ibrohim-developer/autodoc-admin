import type { EditorContext } from '@/components/content/document-editor'
import {
  DateField,
  RichTextField,
  SelectField,
  SlugField,
  SwitchField,
  TagsField,
  TextField,
} from '@/components/content/fields'
import { GalleryField, MediaField } from '@/components/content/media-fields'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useCategoryOptions } from '../hooks/use-categories'

/** One language: what the reader reads. */
export function PostLocaleFields({ locale, resetKey }: EditorContext) {
  const uz = locale === 'uz'
  return (
    <>
      <TextField name={`locales.${locale}.title`} label="Заголовок" required={uz} maxLength={200} />
      <TextField
        name={`locales.${locale}.excerpt`}
        label="Краткое описание"
        hint="Две строки под заголовком в карточке новости."
        multiline
        rows={2}
        maxLength={300}
      />
      <RichTextField
        name={`locales.${locale}.body`}
        label="Текст"
        resetKey={`${resetKey}-${locale}`}
      />
      <TagsField name={`locales.${locale}.tags`} label="Теги" />
      <details className="group rounded-lg border px-4 py-3">
        <summary className="cursor-pointer select-none font-medium text-sm">
          SEO: заголовок и описание для поисковиков
        </summary>
        <div className="mt-4 space-y-5">
          <TextField
            name={`locales.${locale}.seoTitle`}
            label="SEO-заголовок"
            hint="Если пусто — заголовок новости."
            maxLength={120}
          />
          <TextField
            name={`locales.${locale}.seoDescription`}
            label="SEO-описание"
            hint="Если пусто — краткое описание."
            multiline
            rows={2}
            maxLength={300}
          />
        </div>
      </details>
    </>
  )
}

/** Under the text: the same in every language. */
export function PostSharedFields() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Видео и галерея</CardTitle>
        <CardDescription>Одинаковые для всех языков, показываются под текстом.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <TextField
          name="shared.videoUrl"
          label="Видео"
          type="url"
          placeholder="https://www.youtube.com/watch?v=…"
          hint="Ссылка на YouTube или Instagram Reels — на сайте появится плеер."
        />
        <GalleryField name="shared.gallery" label="Галерея" hint="В этом порядке, под текстом." />
      </CardContent>
    </Card>
  )
}

export function PostSidebar({ doc }: EditorContext) {
  const { options } = useCategoryOptions()
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Публикация</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <DateField
            name="shared.date"
            label="Дата"
            required
            hint="В карточке и в новости. Порядок в списке — по времени публикации."
          />
          <SelectField name="shared.categoryId" label="Категория" options={options} />
          <SwitchField
            name="shared.pinned"
            label="Закрепить вверху"
            hint="Закреплённые новости идут первыми."
          />
          <SlugField
            name="shared.slug"
            titleName="locales.uz.title"
            follow={!doc?.firstPublishedAt}
            prefix="autodoc.uz/blog/"
            hint={
              doc?.firstPublishedAt
                ? 'Новость уже была на сайте: со старого адреса посетители попадут на новый.'
                : 'Пока новость не опубликована, адрес берётся из заголовка.'
            }
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Обложка</CardTitle>
          <CardDescription>
            Нужна для публикации. Нажмите на главное в кадре — так обрежется карточка.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <MediaField
            name="shared.cover"
            label="Фото"
            required
            focalName="shared.coverPosition"
            previewAspect="330 / 185"
          />
          <SwitchField
            name="shared.coverFull"
            label="Фото целиком в новости"
            hint="Без обрезки по рамке баннера."
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Для соцсетей</CardTitle>
          <CardDescription>
            Превью ссылки в Telegram и Facebook. Если пусто — обложка.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MediaField name="shared.ogImage" label="Картинка" />
        </CardContent>
      </Card>
    </>
  )
}

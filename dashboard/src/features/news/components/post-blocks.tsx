import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { useController, useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { TextField, useFieldError } from '@/components/content/fields'
import { GalleryField, MediaField } from '@/components/content/media-fields'
import { RichTextEditor } from '@/components/rich-text/rich-text-editor'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LOCALES, type Locale } from '@/lib/media'
import type { RichTextDoc } from '@/lib/rich-text'
import {
  BLOCK_LABELS,
  type BlockType,
  emptyWords,
  type FormBlock,
  newBlock,
} from '../api/post-form'

/** "youtu.be/…" → YouTube: shows the link was understood. */
function providerOf(url: string): string | null {
  if (/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(url)) return 'YouTube'
  if (/^https:\/\/(www\.)?instagram\.com\/(reel|reels|p)\//.test(url)) return 'Instagram Reels'
  return null
}

function TextBlock({ id, locale, resetKey }: { id: string; locale: Locale; resetKey: string }) {
  const { field, fieldState } = useController({ name: `locales.${locale}.blocks.${id}.text` })
  return (
    <>
      <RichTextEditor
        key={resetKey}
        label="Текст блока"
        initialValue={field.value as RichTextDoc | undefined}
        onChange={field.onChange}
        invalid={Boolean(fieldState.error)}
        placeholder={locale === 'uz' ? 'Matn…' : locale === 'ru' ? 'Текст материала…' : 'Text…'}
      />
      {fieldState.error ? (
        <p className="text-destructive text-xs" role="alert">
          {fieldState.error.message}
        </p>
      ) : null}
    </>
  )
}

function VideoBlock({ index }: { index: number }) {
  const url = (useWatch({ name: `shared.blocks.${index}.url` }) as string | undefined) ?? ''
  const provider = providerOf(url.trim())
  return (
    <div className="space-y-2">
      <TextField
        name={`shared.blocks.${index}.url`}
        label="Ссылка"
        type="url"
        placeholder="Ссылка на YouTube или Instagram Reels"
        hint="На сайте плеер загрузится только по нажатию."
      />
      {provider ? (
        <span className="inline-block rounded-[5px] bg-success-soft px-2 py-1 font-medium text-success text-xs">
          {provider}
        </span>
      ) : null}
    </div>
  )
}

/**
 * The article: blocks in order, each in its own card, with ↑ ↓ ✕. Photos, galleries and videos
 * are the same in every language; the open language's texts and captions are edited here.
 */
export function PostBlocks({ locale, resetKey }: { locale: Locale; resetKey: number }) {
  const { control, setValue, getValues } = useFormContext()
  const { fields, append, remove, swap } = useFieldArray({
    control,
    name: 'shared.blocks',
    // The blocks carry their own `id`; RHF's key goes elsewhere.
    keyName: 'fieldKey',
  })
  const error = useFieldError('shared.blocks')

  function add(type: BlockType) {
    const block = newBlock(type)
    // Every language gets its (empty) words for the block, so its fields exist.
    for (const code of LOCALES) {
      if (!getValues(`locales.${code}.blocks.${block.id}`)) {
        setValue(`locales.${code}.blocks.${block.id}`, emptyWords())
      }
    }
    append(block)
  }

  return (
    <div className="space-y-4">
      {fields.map((item, index) => {
        const block = item as unknown as FormBlock & { fieldKey: string }
        return (
          <Card key={block.fieldKey} className="space-y-2.5 px-5 pt-4 pb-5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.04em]">
                {BLOCK_LABELS[block.type]}
              </span>
              <div className="ml-auto flex gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  disabled={index === 0}
                  onClick={() => swap(index, index - 1)}
                  aria-label={`Блок «${BLOCK_LABELS[block.type]}» выше`}
                  title="Выше"
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  disabled={index === fields.length - 1}
                  onClick={() => swap(index, index + 1)}
                  aria-label={`Блок «${BLOCK_LABELS[block.type]}» ниже`}
                  title="Ниже"
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:bg-danger-soft hover:text-destructive"
                  onClick={() => remove(index)}
                  aria-label={`Удалить блок «${BLOCK_LABELS[block.type]}»`}
                  title="Удалить блок"
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            </div>
            {block.type === 'text' ? (
              <TextBlock
                id={block.id}
                locale={locale}
                resetKey={`${resetKey}-${locale}-${block.id}`}
              />
            ) : null}
            {block.type === 'image' ? (
              <div className="space-y-3">
                <MediaField
                  name={`shared.blocks.${index}.image`}
                  label="Фото"
                  empty={{ className: 'h-[180px]', title: 'Выберите фото из медиатеки' }}
                />
                <TextField
                  name={`locales.${locale}.blocks.${block.id}.caption`}
                  label="Подпись"
                  placeholder="Подпись к фото (необязательно)"
                  maxLength={300}
                />
              </div>
            ) : null}
            {block.type === 'gallery' ? (
              <GalleryField name={`shared.blocks.${index}.items`} label="Фото в галерее" />
            ) : null}
            {block.type === 'video' ? <VideoBlock index={index} /> : null}
          </Card>
        )
      })}

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[13px] text-muted-foreground">Добавить блок:</span>
        {(Object.keys(BLOCK_LABELS) as BlockType[]).map((type) => (
          <Button
            key={type}
            type="button"
            variant="outline"
            size="sm"
            className="hover:border-primary"
            onClick={() => add(type)}
          >
            {BLOCK_LABELS[type]}
          </Button>
        ))}
      </div>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

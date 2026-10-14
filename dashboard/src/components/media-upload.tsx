import { Loader2, Upload } from 'lucide-react'
import { type ChangeEvent, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button, type ButtonProps } from '@/components/ui/button'
import { errorMessage } from '@/lib/api-client'
import {
  ACCEPTED_IMAGES,
  MAX_UPLOAD_MB,
  type Media,
  type UploadedMedia,
  useUploadMedia,
} from '@/lib/media'

/**
 * Uploads files one after another: the server compresses each photo, and one at a time keeps
 * that predictable. Every failure gets its own message, so one bad file doesn't hide the rest.
 */
export function useUploadFiles() {
  const upload = useUploadMedia()
  const [pending, setPending] = useState(0)

  async function uploadFiles(files: File[]): Promise<UploadedMedia[]> {
    const done: UploadedMedia[] = []
    setPending(files.length)
    for (const file of files) {
      try {
        if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
          throw new Error(`${file.name}: больше ${MAX_UPLOAD_MB} МБ`)
        }
        const media = await upload.mutateAsync(file)
        done.push(media)
        if (media.duplicate) toast.info(`${file.name}: это фото уже есть в медиатеке`)
      } catch (error) {
        const text =
          error instanceof Error && !('status' in error) ? error.message : errorMessage(error)
        toast.error(text.startsWith(file.name) ? text : `${file.name}: ${text}`)
      } finally {
        setPending((count) => count - 1)
      }
    }
    if (done.length > 1) toast.success(`Загружено фото: ${done.length}`)
    else if (done.length === 1 && !done[0]?.duplicate) toast.success('Фото загружено')
    return done
  }

  return { uploadFiles, pending }
}

export function MediaUploadButton({
  onUploaded,
  multiple = true,
  label = 'Загрузить фото',
  ...buttonProps
}: Omit<ButtonProps, 'onClick'> & {
  onUploaded?: (media: Media[]) => void
  multiple?: boolean
  label?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const { uploadFiles, pending } = useUploadFiles()

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    if (files.length === 0) return
    const uploaded = await uploadFiles(files)
    if (uploaded.length > 0) onUploaded?.(uploaded)
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED_IMAGES}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onChange}
      />
      <Button
        type="button"
        {...buttonProps}
        disabled={pending > 0}
        onClick={() => input.current?.click()}
      >
        {pending > 0 ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Upload aria-hidden="true" />
        )}
        {pending > 0 ? `Загружается… (${pending})` : label}
      </Button>
    </>
  )
}

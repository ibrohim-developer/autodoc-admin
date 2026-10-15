import { Image as ImageExtension } from '@tiptap/extension-image'
import { Placeholder } from '@tiptap/extensions'
import { type Editor, EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Undo2,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { MediaPicker } from '@/components/media-picker'
import { cn } from '@/lib/cn'
import { EMPTY_DOC, type RichTextDoc } from '@/lib/rich-text'
import { LinkDialog } from './link-dialog'

/** A photo from the library: the site finds it by `mediaId`, `src` is only for the editor. */
const LibraryImage = ImageExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-media-id'),
        renderHTML: (attributes: { mediaId?: string | null }) =>
          attributes.mediaId ? { 'data-media-id': attributes.mediaId } : {},
      },
    }
  },
}).configure({ inline: false, allowBase64: false })

/**
 * Only what the site renders and the API accepts: h2/h3, bold, italic, lists, quotes, links,
 * a divider and photos from the media library. No colours, fonts or pasted HTML styles.
 */
function extensions(placeholder: string) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      code: false,
      codeBlock: false,
      strike: false,
      underline: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        protocols: ['http', 'https', 'mailto', 'tel'],
      },
    }),
    LibraryImage,
    Placeholder.configure({ placeholder }),
  ]
}

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the text selection: a normal click would move focus out of the editor first.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'grid size-8 place-items-center rounded-md text-foreground/80 transition-colors',
        'hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && 'bg-accent text-accent-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Toolbar({
  editor,
  onLink,
  onImage,
}: {
  editor: Editor
  onLink: () => void
  onImage: () => void
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      h2: current.isActive('heading', { level: 2 }),
      h3: current.isActive('heading', { level: 3 }),
      bullet: current.isActive('bulletList'),
      ordered: current.isActive('orderedList'),
      quote: current.isActive('blockquote'),
      link: current.isActive('link'),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  })
  const chain = () => editor.chain().focus()

  return (
    <div
      role="toolbar"
      aria-label="Оформление текста"
      className="flex flex-wrap gap-0.5 border-b p-1"
    >
      <ToolbarButton
        label="Заголовок"
        active={state.h2}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton
        label="Подзаголовок"
        active={state.h3}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="size-4" aria-hidden="true" />
      </ToolbarButton>
      <span className="mx-1 w-px self-stretch bg-border" aria-hidden="true" />
      <ToolbarButton label="Жирный" active={state.bold} onClick={() => chain().toggleBold().run()}>
        <Bold className="size-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton
        label="Курсив"
        active={state.italic}
        onClick={() => chain().toggleItalic().run()}
      >
        <Italic className="size-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="Ссылка" active={state.link} onClick={onLink}>
        <Link2 className="size-4" aria-hidden="true" />
      </ToolbarButton>
      <span className="mx-1 w-px self-stretch bg-border" aria-hidden="true" />
      <ToolbarButton
        label="Список"
        active={state.bullet}
        onClick={() => chain().toggleBulletList().run()}
      >
        <List className="size-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton
        label="Нумерованный список"
        active={state.ordered}
        onClick={() => chain().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton
        label="Цитата"
        active={state.quote}
        onClick={() => chain().toggleBlockquote().run()}
      >
        <Quote className="size-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="Разделитель" onClick={() => chain().setHorizontalRule().run()}>
        <Minus className="size-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="Фото из медиатеки" onClick={onImage}>
        <ImagePlus className="size-4" aria-hidden="true" />
      </ToolbarButton>
      <span className="mx-1 w-px self-stretch bg-border" aria-hidden="true" />
      <ToolbarButton
        label="Отменить"
        disabled={!state.canUndo}
        onClick={() => chain().undo().run()}
      >
        <Undo2 className="size-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton
        label="Повторить"
        disabled={!state.canRedo}
        onClick={() => chain().redo().run()}
      >
        <Redo2 className="size-4" aria-hidden="true" />
      </ToolbarButton>
    </div>
  )
}

/**
 * The editor owns its content once mounted: `initialValue` is read only on mount. To show other
 * content (another language, a restored version), give it a new `key` so it mounts afresh.
 * Feeding every change back in as a prop would race with typing: the prop lags a keystroke
 * behind, and resetting to it drops letters.
 */
export function RichTextEditor({
  initialValue,
  onChange,
  placeholder = 'Начните писать…',
  label,
  invalid = false,
  className,
}: {
  initialValue: RichTextDoc | null | undefined
  onChange: (value: RichTextDoc) => void
  placeholder?: string
  /** Accessible name of the text area. */
  label: string
  invalid?: boolean
  className?: string
}) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const editor = useEditor({
    extensions: extensions(placeholder),
    content: initialValue ?? EMPTY_DOC,
    editorProps: {
      attributes: {
        'aria-label': label,
        'aria-multiline': 'true',
        role: 'textbox',
        class: 'rich-text min-h-48 px-4 py-3 focus:outline-none',
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getJSON() as RichTextDoc),
  })

  if (!editor) return null

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border bg-card focus-within:ring-2 focus-within:ring-ring',
        invalid && 'border-destructive',
        className,
      )}
    >
      <Toolbar
        editor={editor}
        onLink={() => setLinkOpen(true)}
        onImage={() => setPickerOpen(true)}
      />
      <EditorContent editor={editor} />

      <LinkDialog
        open={linkOpen}
        initial={(editor.getAttributes('link').href as string | undefined) ?? ''}
        onOpenChange={setLinkOpen}
        onSave={(href) => {
          editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
          setLinkOpen(false)
        }}
        onRemove={() => {
          editor.chain().focus().extendMarkRange('link').unsetLink().run()
          setLinkOpen(false)
        }}
      />
      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Фото в текст"
        onSelect={(media) => {
          editor
            .chain()
            .focus()
            .insertContent({
              type: 'image',
              attrs: { mediaId: media.id, src: media.url, alt: media.alt.ru || media.alt.uz || '' },
            })
            .run()
        }}
      />
    </div>
  )
}

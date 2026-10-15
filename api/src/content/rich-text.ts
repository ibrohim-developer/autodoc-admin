import { z } from 'zod'

/**
 * The editor's content format: ProseMirror/TipTap JSON, restricted to what the site can
 * render. Anything outside this list (scripts, iframes, unknown marks, `javascript:` links)
 * fails validation, so it can't be stored, whatever the client sends.
 *
 * Unknown keys are stripped by zod, so the stored JSON contains only what is listed here.
 */

const MAX_TEXT = 20_000

/** http(s), mail and phone links, or a path on the site. */
export function isSafeHref(href: string): boolean {
  if (href.startsWith('/') && !href.startsWith('//')) return true
  if (href.startsWith('#')) return true
  try {
    const url = new URL(href)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)
  } catch {
    return false
  }
}

const markSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bold') }),
  z.object({ type: z.literal('italic') }),
  z.object({
    type: z.literal('link'),
    attrs: z.object({
      href: z.string().max(2000).refine(isSafeHref, { message: 'Недопустимая ссылка' }),
    }),
  }),
])

const textSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1).max(MAX_TEXT),
  marks: z.array(markSchema).max(5).optional(),
})

const hardBreakSchema = z.object({ type: z.literal('hardBreak') })

const inlineSchema = z.discriminatedUnion('type', [textSchema, hardBreakSchema])
const inlineContent = z.array(inlineSchema).max(500).optional()

/** A photo from the media library. `src` is for the editor's display; the site uses `mediaId`. */
const imageSchema = z.object({
  type: z.literal('image'),
  attrs: z.object({
    mediaId: z.uuid(),
    src: z.string().max(300).startsWith('/media/').nullish(),
    alt: z.string().max(300).nullish(),
  }),
})

type Block =
  | { type: 'paragraph'; content?: z.infer<typeof inlineSchema>[] }
  | { type: 'heading'; attrs: { level: 2 | 3 }; content?: z.infer<typeof inlineSchema>[] }
  | { type: 'bulletList'; content: ListItem[] }
  | { type: 'orderedList'; attrs?: { start?: number }; content: ListItem[] }
  | { type: 'blockquote'; content: Block[] }
  | { type: 'horizontalRule' }
  | z.infer<typeof imageSchema>
type ListItem = { type: 'listItem'; content: Block[] }

const listItemSchema: z.ZodType<ListItem> = z.lazy(() =>
  z.object({ type: z.literal('listItem'), content: z.array(blockSchema).min(1).max(50) }),
)

const blockSchema: z.ZodType<Block> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('paragraph'), content: inlineContent }),
    z.object({
      type: z.literal('heading'),
      attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }),
      content: inlineContent,
    }),
    z.object({ type: z.literal('bulletList'), content: z.array(listItemSchema).min(1).max(100) }),
    z.object({
      type: z.literal('orderedList'),
      attrs: z.object({ start: z.number().int().min(0).max(10_000).optional() }).optional(),
      content: z.array(listItemSchema).min(1).max(100),
    }),
    z.object({ type: z.literal('blockquote'), content: z.array(blockSchema).min(1).max(50) }),
    z.object({ type: z.literal('horizontalRule') }),
    imageSchema,
  ]),
)

export const richTextSchema = z.object({
  type: z.literal('doc'),
  content: z.array(blockSchema).max(1_000),
})
export type RichText = z.infer<typeof richTextSchema>

export const EMPTY_RICH_TEXT: RichText = { type: 'doc', content: [] }

/** Plain text of a document, e.g. for search or an automatic excerpt. */
export function richTextToPlain(doc: RichText): string {
  const parts: string[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const value = node as { type?: string; text?: string; content?: unknown[] }
    if (value.type === 'text' && value.text) parts.push(value.text)
    if (value.type === 'hardBreak') parts.push(' ')
    for (const child of value.content ?? []) walk(child)
    if (value.type && value.type !== 'text' && value.type !== 'doc') parts.push(' ')
  }
  walk(doc)
  return parts.join('').replace(/\s+/g, ' ').trim()
}

/** At most `max` characters, cut at a word and marked with "…". */
export function excerpt(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, '')}…`
}

export function isRichText(value: unknown): value is RichText {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'doc' &&
    Array.isArray((value as { content?: unknown }).content)
  )
}

/** Empty means no text and no images: an untranslated body falls back to Uzbek. */
export function isEmptyRichText(doc: RichText): boolean {
  return richTextToPlain(doc).length === 0 && !JSON.stringify(doc).includes('"mediaId"')
}

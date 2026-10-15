import type { RichText } from '../content/rich-text.js'

export { excerpt } from '../content/rich-text.js'

/**
 * hh.uz vacancy descriptions are HTML (p, strong, em, ul/ol, br, sometimes h3). This turns
 * them into the editor's format, keeping paragraphs, headings, lists, bold and italic. Every
 * other tag is dropped and its text kept: nothing from hh ends up as markup on the site.
 */

type Mark = { type: 'bold' } | { type: 'italic' }
type Inline = { type: 'text'; text: string; marks?: Mark[] } | { type: 'hardBreak' }
type Block = Record<string, unknown> & { type: string; content?: unknown[] }

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  bull: '•',
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const value =
        code[1]?.toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1))
      return Number.isFinite(value) && value > 0 && value < 0x110000
        ? String.fromCodePoint(value)
        : ''
    }
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

/** Text without any markup, whitespace collapsed. */
export function htmlToPlain(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|li|h\d|div)>/gi, ' ')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

const MAX_TEXT = 20_000

export function htmlToRichText(html: string): RichText {
  const root: Block[] = []
  /** Where blocks go now: the document, or the list item being read. */
  const containers: Block[][] = [root]
  const lists: Block[] = []
  let inline: Inline[] = []
  let heading: 2 | 3 | null = null
  let bold = 0
  let italic = 0
  /** Inside <script> or <style>: their text is not content. */
  let skipping: string | null = null

  const top = () => containers[containers.length - 1] as Block[]

  function flush() {
    // Trim the paragraph's ends; drop it if nothing is left.
    while (inline[0]?.type === 'hardBreak') inline.shift()
    while (inline.at(-1)?.type === 'hardBreak') inline.pop()
    const first = inline[0]
    if (first?.type === 'text') first.text = first.text.replace(/^\s+/, '')
    const last = inline.at(-1)
    if (last?.type === 'text') last.text = last.text.replace(/\s+$/, '')
    const content = inline.filter((node) => node.type !== 'text' || node.text.length > 0)
    inline = []
    if (content.length === 0) return
    top().push(
      heading
        ? { type: 'heading', attrs: { level: heading }, content }
        : { type: 'paragraph', content },
    )
  }

  function addText(raw: string) {
    let text = decodeEntities(raw).replace(/\s+/g, ' ')
    const previous = inline.at(-1)
    // Collapse the space between two runs, like a browser would.
    if (
      text.startsWith(' ') &&
      (!previous || (previous.type === 'text' && previous.text.endsWith(' ')))
    ) {
      text = text.slice(1)
    }
    if (!text) return
    const marks: Mark[] = [
      ...(bold ? [{ type: 'bold' as const }] : []),
      ...(italic ? [{ type: 'italic' as const }] : []),
    ]
    const key = marks.map((mark) => mark.type).join()
    if (
      previous?.type === 'text' &&
      (previous.marks ?? []).map((mark) => mark.type).join() === key
    ) {
      previous.text = `${previous.text}${text}`.slice(0, MAX_TEXT)
      return
    }
    inline.push(marks.length > 0 ? { type: 'text', text, marks } : { type: 'text', text })
  }

  for (const match of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^>]*>|([^<]+)/g)) {
    const [, closing, rawTag, text] = match
    const name = (rawTag ?? '').toLowerCase()
    if (skipping) {
      if (closing && name === skipping) skipping = null
      continue
    }
    if (text !== undefined) {
      addText(text)
      continue
    }
    const tag = name
    const open = !closing
    switch (tag) {
      case 'p':
      case 'div':
        flush()
        break
      case 'br':
        inline.push({ type: 'hardBreak' })
        break
      case 'strong':
      case 'b':
        bold = Math.max(0, bold + (open ? 1 : -1))
        break
      case 'em':
      case 'i':
        italic = Math.max(0, italic + (open ? 1 : -1))
        break
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        flush()
        heading = open ? (tag === 'h1' || tag === 'h2' ? 2 : 3) : null
        break
      case 'ul':
      case 'ol': {
        flush()
        if (open) {
          const list: Block = { type: tag === 'ul' ? 'bulletList' : 'orderedList', content: [] }
          top().push(list)
          lists.push(list)
        } else {
          lists.pop()
        }
        break
      }
      case 'li': {
        flush()
        const list = lists.at(-1)
        if (open && list) {
          const item: Block = { type: 'listItem', content: [] }
          ;(list.content as Block[]).push(item)
          containers.push(item.content as Block[])
        } else if (!open && containers.length > 1) {
          containers.pop()
        }
        break
      }
      case 'script':
      case 'style':
        if (open) skipping = tag
        break
      default:
      // Any other tag goes; its text stays.
    }
  }
  flush()

  // Lists and items the HTML left empty are not valid in the editor's format.
  const clean = (blocks: Block[]): Block[] =>
    blocks.flatMap((block) => {
      if (block.type === 'bulletList' || block.type === 'orderedList') {
        const items = (block.content as Block[])
          .map((item) => ({ ...item, content: clean(item.content as Block[]) }))
          .filter((item) => item.content.length > 0)
        return items.length > 0 ? [{ ...block, content: items.slice(0, 100) }] : []
      }
      return [block]
    })

  return { type: 'doc', content: clean(root).slice(0, 1_000) } as RichText
}

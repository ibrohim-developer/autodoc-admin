import { UnprocessableEntityException } from '@nestjs/common'

export const MAX_RESUME_BYTES = 10 * 1024 * 1024

export type ResumeFormat = { mime: string; extension: 'pdf' | 'doc' | 'docx' }

const OLE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04])

/**
 * What a resume really is, judged by its content: the name and the browser's type are the
 * sender's word. PDF, Word 97–2003 (an OLE file with a WordDocument stream) and Word 2007+
 * (a zip with word/document.xml). Macro-enabled Word files and anything else are refused.
 */
export function detectResume(buffer: Buffer): ResumeFormat | null {
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
    return { mime: 'application/pdf', extension: 'pdf' }
  }
  if (buffer.subarray(0, 8).equals(OLE_SIGNATURE)) {
    // Excel and PowerPoint files are OLE too; Word's has a stream with this name (UTF-16).
    if (buffer.includes(Buffer.from('WordDocument', 'utf16le'))) {
      return { mime: 'application/msword', extension: 'doc' }
    }
    return null
  }
  if (buffer.subarray(0, 4).equals(ZIP_SIGNATURE)) {
    // Zip entry names are stored as plain text in the headers.
    const isWord =
      buffer.includes(Buffer.from('[Content_Types].xml')) &&
      buffer.includes(Buffer.from('word/document.xml'))
    if (!isWord || buffer.includes(Buffer.from('vbaProject.bin'))) return null
    return {
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
    }
  }
  return null
}

export function assertResume(buffer: Buffer): ResumeFormat {
  if (buffer.length === 0) {
    throw new UnprocessableEntityException({ code: 'empty_resume', message: 'Файл пустой' })
  }
  const format = detectResume(buffer)
  if (!format) {
    throw new UnprocessableEntityException({
      code: 'unsupported_resume',
      message: 'Резюме принимается в форматах PDF, DOC и DOCX',
    })
  }
  return format
}

/** A file name safe for Content-Disposition and the disk listing: no paths, no control chars. */
export function cleanFileName(name: string, extension: string): string {
  const base = name
    .replace(/^.*[\\/]/, '')
    .replace(/[\p{Cc}"]/gu, '')
    .trim()
    .slice(0, 200)
  if (!base) return `resume.${extension}`
  return base.toLowerCase().endsWith(`.${extension}`) ? base : `${base}.${extension}`
}

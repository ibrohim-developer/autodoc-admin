import type { Response } from 'express'
import { XLSX_MIME } from '../common/xlsx.js'

/** Sends a workbook as a download named like `zayavki-2026-10-14.xlsx`. */
export function sendXlsx(res: Response, baseName: string, file: Buffer): void {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date())
  res
    .status(200)
    .set({
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${baseName}-${day}.xlsx"`,
      'Content-Length': String(file.length),
      'Cache-Control': 'no-store',
    })
    .end(file)
}

/** RFC 6266: an ASCII fallback plus the real (often Cyrillic) name. */
export function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

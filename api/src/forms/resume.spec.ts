import { cleanFileName, detectResume } from './resume.js'

const ole = (stream: string) =>
  Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.alloc(500),
    Buffer.from(stream, 'utf16le'),
  ])

const zip = (...names: string[]) =>
  Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), ...names.map((n) => Buffer.from(n))])

describe('detectResume', () => {
  it('recognises PDF, DOC and DOCX by content', () => {
    expect(detectResume(Buffer.from('%PDF-1.7\n…'))?.extension).toBe('pdf')
    expect(detectResume(ole('WordDocument'))?.extension).toBe('doc')
    expect(detectResume(zip('[Content_Types].xml', 'word/document.xml'))?.extension).toBe('docx')
  })

  it('refuses everything else, whatever the name says', () => {
    expect(detectResume(Buffer.from('<html><script>alert(1)</script>'))).toBeNull()
    // An Excel file is OLE too.
    expect(detectResume(ole('Workbook'))).toBeNull()
    // Any zip is not a Word file.
    expect(detectResume(zip('[Content_Types].xml', 'xl/workbook.xml'))).toBeNull()
    // Macros.
    expect(
      detectResume(zip('[Content_Types].xml', 'word/document.xml', 'word/vbaProject.bin')),
    ).toBeNull()
    expect(detectResume(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBeNull()
  })
})

describe('cleanFileName', () => {
  it('keeps the name, drops paths and quotes, and fixes the extension', () => {
    expect(cleanFileName('Резюме Иванов.pdf', 'pdf')).toBe('Резюме Иванов.pdf')
    expect(cleanFileName('C:\\Users\\me\\cv"x".docx', 'docx')).toBe('cvx.docx')
    expect(cleanFileName('cv.exe', 'pdf')).toBe('cv.exe.pdf')
    expect(cleanFileName('', 'doc')).toBe('resume.doc')
  })
})

import { inflateRawSync } from 'node:zlib'
import { buildXlsx } from './xlsx.js'

/** Reads the entries back through the central directory, like Excel does. */
function unzip(buffer: Buffer): Record<string, string> {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  const count = buffer.readUInt16LE(end + 10)
  let pointer = buffer.readUInt32LE(end + 16)
  const files: Record<string, string> = {}
  for (let i = 0; i < count; i++) {
    const size = buffer.readUInt32LE(pointer + 20)
    const nameLength = buffer.readUInt16LE(pointer + 28)
    const extra = buffer.readUInt16LE(pointer + 30)
    const comment = buffer.readUInt16LE(pointer + 32)
    const local = buffer.readUInt32LE(pointer + 42)
    const name = buffer.subarray(pointer + 46, pointer + 46 + nameLength).toString('utf8')
    const localName = buffer.readUInt16LE(local + 26)
    const localExtra = buffer.readUInt16LE(local + 28)
    const start = local + 30 + localName + localExtra
    files[name] = inflateRawSync(buffer.subarray(start, start + size)).toString('utf8')
    pointer += 46 + nameLength + extra + comment
  }
  return files
}

describe('buildXlsx', () => {
  it('writes a workbook Excel can open: header, text, numbers', () => {
    const file = buildXlsx(
      'Заявки',
      [{ header: '№' }, { header: 'Имя', width: 30 }],
      [
        [1, 'Алишер'],
        [2, null],
      ],
    )
    const files = unzip(file)
    expect(Object.keys(files)).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
    ])
    const sheet = files['xl/worksheets/sheet1.xml'] as string
    expect(sheet).toContain('<c r="B1" s="1" t="inlineStr"><is><t xml:space="preserve">Имя</t>')
    expect(sheet).toContain('<c r="A2" s="2"><v>1</v></c>')
    expect(sheet).toContain('Алишер')
    expect(files['xl/workbook.xml']).toContain('<sheet name="Заявки"')
  })

  it('escapes markup and never writes formulas', () => {
    const sheet = unzip(buildXlsx('x', [{ header: 'a' }], [['=HYPERLINK("x")<b>&\u0007']]))[
      'xl/worksheets/sheet1.xml'
    ] as string
    expect(sheet).toContain('=HYPERLINK(&quot;x&quot;)&lt;b&gt;&amp;</t>')
    expect(sheet).not.toContain('<f>')
  })
})

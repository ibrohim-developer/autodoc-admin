import { randomBytes } from 'node:crypto'
import { decrypt, encrypt, randomToken, sha256 } from './crypto.js'

describe('crypto', () => {
  const key = randomBytes(32)

  it('round-trips text through AES-GCM', () => {
    const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
    const sealed = encrypt(secret, key)
    expect(sealed).not.toContain(secret)
    expect(decrypt(sealed, key)).toBe(secret)
  })

  it('uses a fresh IV every time', () => {
    expect(encrypt('same', key)).not.toBe(encrypt('same', key))
  })

  it('refuses tampered ciphertext and the wrong key', () => {
    const sealed = encrypt('secret', key)
    const [iv, tag, data] = sealed.split('.')
    const flipped = `${iv}.${tag}.${Buffer.from('x').toString('base64url')}${data?.slice(2)}`
    expect(() => decrypt(flipped, key)).toThrow()
    expect(() => decrypt(sealed, randomBytes(32))).toThrow()
    expect(() => decrypt('garbage', key)).toThrow()
  })

  it('hashes and generates tokens', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })
})

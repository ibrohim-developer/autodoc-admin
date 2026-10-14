import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/** URL-safe random token, e.g. for refresh tokens and invite links. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/** AES-256-GCM with a random IV. Output: `iv.tag.ciphertext`, each base64url. */
export function encrypt(plain: string, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url')).join('.')
}

export function decrypt(payload: string, key: Buffer): string {
  const [iv, tag, data] = payload.split('.').map((part) => Buffer.from(part, 'base64url'))
  if (!iv || !tag || !data) throw new Error('Malformed ciphertext')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

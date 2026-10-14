import { randomInt } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { generateSecret, generateURI, verify } from 'otplib'
import QRCode from 'qrcode'
import { sha256 } from '../common/crypto.js'

const ISSUER = 'Autodoc Admin'
/** No 0/o, 1/l/i: recovery codes get typed from paper. */
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export const RECOVERY_CODE_COUNT = 10

@Injectable()
export class TotpService {
  generateSecret(): string {
    return generateSecret()
  }

  uri(secret: string, email: string): string {
    return generateURI({ issuer: ISSUER, label: email, secret })
  }

  qrDataUrl(uri: string): Promise<string> {
    return QRCode.toDataURL(uri, { margin: 1, width: 240 })
  }

  /**
   * Accepts the current code and one step either side (phone clocks drift).
   * Returns the matched time step, or null. Codes at or before `afterTimeStep`
   * are refused, so a code can't be used twice.
   */
  async verify(
    secret: string,
    token: string,
    afterTimeStep?: number | null,
  ): Promise<number | null> {
    const result = await verify({
      secret,
      token,
      epochTolerance: 30,
      ...(afterTimeStep != null ? { afterTimeStep } : {}),
    })
    // `verify` also covers HOTP, whose result has no time step.
    return result.valid && 'timeStep' in result ? result.timeStep : null
  }
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const chars = Array.from(
      { length: 8 },
      () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)],
    )
    return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
  })
}

export function normalizeCode(code: string): string {
  return code.toLowerCase().replace(/[\s-]/g, '')
}

export function hashRecoveryCode(code: string): string {
  return sha256(normalizeCode(code))
}

export function isTotpCode(code: string): boolean {
  return /^\d{6}$/.test(normalizeCode(code))
}

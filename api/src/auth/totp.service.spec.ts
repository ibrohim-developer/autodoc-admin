import { Injectable } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { generate } from 'otplib'
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  isTotpCode,
  normalizeCode,
  TotpService,
} from './totp.service.js'

/** Proves the test build emits decorator metadata: Nest injects by constructor type. */
@Injectable()
class NeedsTotp {
  constructor(readonly totp: TotpService) {}
}

describe('TotpService', () => {
  let totp: TotpService

  beforeEach(async () => {
    const module = await Test.createTestingModule({ providers: [TotpService, NeedsTotp] }).compile()
    totp = module.get(TotpService)
    expect(module.get(NeedsTotp).totp).toBe(totp)
  })

  it('accepts the current code and refuses it a second time', async () => {
    const secret = totp.generateSecret()
    const code = await generate({ secret })

    const step = await totp.verify(secret, code)
    expect(step).toEqual(expect.any(Number))
    expect(await totp.verify(secret, code, step)).toBeNull()
  })

  it('refuses a wrong code', async () => {
    const secret = totp.generateSecret()
    const code = await generate({ secret })
    const wrong = code === '000000' ? '111111' : '000000'
    expect(await totp.verify(secret, wrong)).toBeNull()
  })

  it('builds an otpauth URI and a QR image', async () => {
    const uri = totp.uri(totp.generateSecret(), 'admin@autodoc.uz')
    expect(uri).toMatch(/^otpauth:\/\/totp\/Autodoc%20Admin:admin%40autodoc\.uz\?/)
    expect(await totp.qrDataUrl(uri)).toMatch(/^data:image\/png;base64,/)
  })
})

describe('recovery codes', () => {
  it('generates ten distinct readable codes', () => {
    const codes = generateRecoveryCodes()
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
    for (const code of codes) expect(code).toMatch(/^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/)
  })

  it('matches however the code is typed', () => {
    expect(hashRecoveryCode('ABCD-EFGH')).toBe(hashRecoveryCode('abcd efgh'))
    expect(normalizeCode(' 123 456 ')).toBe('123456')
  })

  it('tells authenticator codes from recovery codes', () => {
    expect(isTotpCode('123 456')).toBe(true)
    expect(isTotpCode('abcd-efgh')).toBe(false)
  })
})

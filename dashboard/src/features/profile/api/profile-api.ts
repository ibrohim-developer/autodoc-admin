import { z } from 'zod'
import { request } from '@/lib/api-client'

export function changePassword(input: { currentPassword: string; newPassword: string }) {
  return request('admin/auth/password', { method: 'POST', body: input, schema: z.null() })
}

const setupSchema = z.object({
  /** Base32, for typing into the app by hand when the QR can't be scanned. */
  secret: z.string(),
  uri: z.string(),
  /** PNG data URL of the QR code. */
  qr: z.string().startsWith('data:image/png;base64,'),
})
export type TwoFactorSetup = z.infer<typeof setupSchema>

const recoveryCodesSchema = z.object({ recoveryCodes: z.array(z.string()) })

export function startTwoFactorSetup(): Promise<TwoFactorSetup> {
  return request('admin/auth/2fa/setup', { method: 'POST', schema: setupSchema })
}

export function enableTwoFactor(code: string) {
  return request('admin/auth/2fa/enable', {
    method: 'POST',
    body: { code },
    schema: recoveryCodesSchema,
  })
}

export function disableTwoFactor(password: string) {
  return request('admin/auth/2fa/disable', {
    method: 'POST',
    body: { password },
    schema: z.null(),
  })
}

export function regenerateRecoveryCodes(code: string) {
  return request('admin/auth/2fa/recovery-codes', {
    method: 'POST',
    body: { code },
    schema: recoveryCodesSchema,
  })
}

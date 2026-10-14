import { z } from 'zod'
import { request } from '@/lib/api-client'
import { meSchema } from '@/lib/session'

const loginResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), user: meSchema }),
  // Password was right and 2FA is on: send the same request again with `code`.
  z.object({ status: z.literal('two_factor_required') }),
])
export type LoginResponse = z.infer<typeof loginResponseSchema>

export type LoginInput = { email: string; password: string; code?: string }

export function login(input: LoginInput): Promise<LoginResponse> {
  return request('admin/auth/login', { method: 'POST', body: input, schema: loginResponseSchema })
}

export function logout(): Promise<null> {
  return request('admin/auth/logout', { method: 'POST', schema: z.null() })
}

export const passwordTokenInfoSchema = z.object({
  email: z.string(),
  name: z.string(),
  purpose: z.enum(['invite', 'reset']),
})
export type PasswordTokenInfo = z.infer<typeof passwordTokenInfoSchema>

/** What an invite or reset link is for, before the person types a password. */
export function inspectPasswordToken(token: string): Promise<PasswordTokenInfo> {
  return request('admin/auth/password-token/inspect', {
    method: 'POST',
    body: { token },
    schema: passwordTokenInfoSchema,
  })
}

export function setPasswordWithToken(token: string, password: string): Promise<null> {
  return request('admin/auth/password-token/use', {
    method: 'POST',
    body: { token, password },
    schema: z.null(),
  })
}

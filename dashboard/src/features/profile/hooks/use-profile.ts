import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionKey } from '@/lib/session'
import {
  changePassword,
  disableTwoFactor,
  enableTwoFactor,
  regenerateRecoveryCodes,
  startTwoFactorSetup,
} from '../api/profile-api'

export function useChangePassword() {
  return useMutation({ mutationFn: changePassword })
}

export function useStartTwoFactorSetup() {
  return useMutation({ mutationFn: startTwoFactorSetup })
}

/** Enabling and disabling change `totpEnabled` on the session user. */
function useSessionMutation<TInput, TOutput>(mutationFn: (input: TInput) => Promise<TOutput>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKey }),
  })
}

export function useEnableTwoFactor() {
  return useSessionMutation((code: string) => enableTwoFactor(code))
}

export function useDisableTwoFactor() {
  return useSessionMutation((password: string) => disableTwoFactor(password))
}

export function useRegenerateRecoveryCodes() {
  return useMutation({ mutationFn: (code: string) => regenerateRecoveryCodes(code) })
}

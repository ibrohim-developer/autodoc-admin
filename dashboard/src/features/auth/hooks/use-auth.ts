import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { sessionKey } from '@/lib/session'
import {
  inspectPasswordToken,
  type LoginInput,
  login,
  logout,
  setPasswordWithToken,
} from '../api/auth-api'

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: (result) => {
      if (result.status === 'ok') queryClient.setQueryData(sessionKey, result.user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    // Even if the server can't be reached, this browser forgets the session.
    mutationFn: () => logout().catch(() => null),
    onSettled: () => {
      queryClient.clear()
      queryClient.setQueryData(sessionKey, null)
      navigate('/login', { replace: true })
      toast.success('Вы вышли из админки')
    },
  })
}

export function usePasswordTokenInfo(token: string) {
  return useQuery({
    queryKey: ['password-token', token],
    queryFn: () => inspectPasswordToken(token),
    enabled: token.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useSetPassword() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      setPasswordWithToken(token, password),
  })
}

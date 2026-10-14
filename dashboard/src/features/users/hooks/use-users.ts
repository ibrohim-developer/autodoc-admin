import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createResetLink,
  fetchUsers,
  type InviteInput,
  inviteUser,
  resetTwoFactor,
  type UserChanges,
  updateUser,
} from '../api/users-api'

export const userKeys = {
  all: ['users'] as const,
}

export function useUsers() {
  return useQuery({ queryKey: userKeys.all, queryFn: fetchUsers })
}

function useInvalidatingMutation<TInput, TOutput>(mutationFn: (input: TInput) => Promise<TOutput>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  })
}

export function useInviteUser() {
  return useInvalidatingMutation((input: InviteInput) => inviteUser(input))
}

export function useUpdateUser() {
  return useInvalidatingMutation(({ id, changes }: { id: string; changes: UserChanges }) =>
    updateUser(id, changes),
  )
}

export function useResetLink() {
  return useInvalidatingMutation((id: string) => createResetLink(id))
}

export function useResetTwoFactor() {
  return useInvalidatingMutation((id: string) => resetTwoFactor(id))
}

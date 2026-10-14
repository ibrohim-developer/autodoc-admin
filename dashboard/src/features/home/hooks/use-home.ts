import { useQuery } from '@tanstack/react-query'
import { fetchHome } from '../api/home-api'

export function useHome() {
  return useQuery({ queryKey: ['home'], queryFn: fetchHome, refetchInterval: 60_000 })
}

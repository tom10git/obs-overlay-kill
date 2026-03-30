import { useQuery } from '@tanstack/react-query'
import { twitchApi } from '../utils/twitchApi'
import type { TwitchUser } from '../types/twitch'
import { twitchUserQueryKey } from '../lib/queryKeys'

interface UseTwitchUserResult {
  user: TwitchUser | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Twitchユーザー情報を取得するカスタムフック（TanStack Query）
 */
export function useTwitchUser(login: string): UseTwitchUserResult {
  const q = useQuery({
    queryKey: twitchUserQueryKey(login),
    queryFn: () => twitchApi.getUser(login),
    enabled: !!login,
  })

  return {
    user: q.data ?? null,
    loading: q.isLoading,
    error: q.error instanceof Error ? q.error : q.error ? new Error(String(q.error)) : null,
    refetch: async () => {
      await q.refetch()
    },
  }
}

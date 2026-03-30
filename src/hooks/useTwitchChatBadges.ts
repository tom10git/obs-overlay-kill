import { useQuery } from '@tanstack/react-query'
import { twitchApi } from '../utils/twitchApi'
import type { TwitchChatBadge } from '../types/twitch'
import { twitchChatBadgesQueryKey } from '../lib/queryKeys'

interface UseTwitchChatBadgesResult {
  badges: TwitchChatBadge[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Twitchチャットバッジ情報を取得するカスタムフック（TanStack Query）
 */
export function useTwitchChatBadges(broadcasterId: string): UseTwitchChatBadgesResult {
  const q = useQuery({
    queryKey: twitchChatBadgesQueryKey(broadcasterId),
    queryFn: () => twitchApi.getChatBadges(broadcasterId),
    enabled: !!broadcasterId,
  })

  return {
    badges: q.data ?? [],
    loading: q.isLoading,
    error: q.error instanceof Error ? q.error : q.error ? new Error(String(q.error)) : null,
    refetch: async () => {
      await q.refetch()
    },
  }
}

import { useQuery } from '@tanstack/react-query'
import { twitchApi } from '../utils/twitchApi'
import type { TwitchChannelInformation } from '../types/twitch'
import { twitchChannelQueryKey } from '../lib/queryKeys'

interface UseTwitchChannelResult {
  channel: TwitchChannelInformation | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Twitchチャンネル情報を取得するカスタムフック（TanStack Query）
 */
export function useTwitchChannel(userId: string): UseTwitchChannelResult {
  const q = useQuery({
    queryKey: twitchChannelQueryKey(userId),
    queryFn: () => twitchApi.getChannelByUserId(userId),
    enabled: !!userId,
  })

  return {
    channel: q.data ?? null,
    loading: q.isLoading,
    error: q.error instanceof Error ? q.error : q.error ? new Error(String(q.error)) : null,
    refetch: async () => {
      await q.refetch()
    },
  }
}

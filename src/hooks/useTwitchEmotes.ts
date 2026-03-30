import { useQuery } from '@tanstack/react-query'
import { twitchApi } from '../utils/twitchApi'
import type { TwitchEmote } from '../types/twitch'
import { twitchEmotesQueryKey } from '../lib/queryKeys'

interface UseTwitchEmotesResult {
  emotes: TwitchEmote[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Twitchエモート情報を取得するカスタムフック（TanStack Query）
 */
export function useTwitchEmotes(broadcasterId: string): UseTwitchEmotesResult {
  const q = useQuery({
    queryKey: twitchEmotesQueryKey(broadcasterId),
    queryFn: () => twitchApi.getEmotes(broadcasterId),
    enabled: !!broadcasterId,
  })

  return {
    emotes: q.data ?? [],
    loading: q.isLoading,
    error: q.error instanceof Error ? q.error : q.error ? new Error(String(q.error)) : null,
    refetch: async () => {
      await q.refetch()
    },
  }
}

import { useQuery } from '@tanstack/react-query'
import { twitchApi } from '../utils/twitchApi'
import { getAutoRefreshInterval } from '../config/admin'
import type { TwitchStream } from '../types/twitch'
import { twitchStreamQueryKey } from '../lib/queryKeys'
import { logger } from '../lib/logger'

interface UseTwitchStreamResult {
  stream: TwitchStream | null
  loading: boolean
  error: Error | null
  isLive: boolean
  refetch: () => Promise<void>
}

/**
 * Twitchストリーム情報を取得するカスタムフック（TanStack Query）
 */
export function useTwitchStream(userLogin: string): UseTwitchStreamResult {
  const q = useQuery({
    queryKey: twitchStreamQueryKey(userLogin),
    queryFn: async (): Promise<TwitchStream | null> => {
      if (!userLogin) return null
      try {
        return await twitchApi.getStream(userLogin)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        if (error.message.includes('CORS') || error.message.includes('Network Error')) {
          logger.warn(
            '[useTwitchStream] CORS/Network (ブラウザでは想定内。オーバーレイでは未使用):',
            error.message
          )
          return null
        }
        throw error
      }
    },
    enabled: !!userLogin,
    refetchInterval: userLogin ? getAutoRefreshInterval() * 1000 : false,
  })

  return {
    stream: q.data ?? null,
    loading: q.isLoading,
    error: q.error instanceof Error ? q.error : q.error ? new Error(String(q.error)) : null,
    isLive: q.data != null,
    refetch: async () => {
      await q.refetch()
    },
  }
}

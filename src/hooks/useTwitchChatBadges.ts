import { useState, useEffect } from 'react'
import { twitchApi } from '../utils/twitchApi'
import type { TwitchChatBadge } from '../types/twitch'

interface UseTwitchChatBadgesResult {
  badges: TwitchChatBadge[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Twitchチャットバッジ情報を取得するカスタムフック
 */
export function useTwitchChatBadges(broadcasterId: string): UseTwitchChatBadgesResult {
  const [badges, setBadges] = useState<TwitchChatBadge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchBadges = async () => {
    if (!broadcasterId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const badgesData = await twitchApi.getChatBadges(broadcasterId)
      setBadges(badgesData)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setBadges([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBadges()
  }, [broadcasterId])

  return {
    badges,
    loading,
    error,
    refetch: fetchBadges,
  }
}

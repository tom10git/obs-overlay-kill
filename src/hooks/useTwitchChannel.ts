import { useState, useEffect } from 'react'
import { twitchApi } from '../utils/twitchApi'
import type { TwitchChannelInformation } from '../types/twitch'

interface UseTwitchChannelResult {
  channel: TwitchChannelInformation | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Twitchチャンネル情報を取得するカスタムフック
 */
export function useTwitchChannel(userId: string): UseTwitchChannelResult {
  const [channel, setChannel] = useState<TwitchChannelInformation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchChannel = async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const channelData = await twitchApi.getChannelByUserId(userId)
      setChannel(channelData)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setChannel(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchChannel()
  }, [userId])

  return {
    channel,
    loading,
    error,
    refetch: fetchChannel,
  }
}

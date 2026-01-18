import { useState, useEffect } from 'react'
import { twitchApi } from '../utils/twitchApi'
import type { TwitchEmote } from '../types/twitch'

interface UseTwitchEmotesResult {
  emotes: TwitchEmote[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Twitchエモート情報を取得するカスタムフック
 */
export function useTwitchEmotes(broadcasterId: string): UseTwitchEmotesResult {
  const [emotes, setEmotes] = useState<TwitchEmote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchEmotes = async () => {
    if (!broadcasterId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const emotesData = await twitchApi.getEmotes(broadcasterId)
      setEmotes(emotesData)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setEmotes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmotes()
  }, [broadcasterId])

  return {
    emotes,
    loading,
    error,
    refetch: fetchEmotes,
  }
}

import { useState, useEffect } from 'react'
import { twitchApi } from '../utils/twitchApi'
import type { TwitchClip } from '../types/twitch'

interface UseTwitchClipsResult {
  clips: TwitchClip[]
  loading: boolean
  error: Error | null
  hasMore: boolean
  loadMore: () => Promise<void>
  refetch: () => Promise<void>
}

/**
 * Twitchクリップ情報を取得するカスタムフック
 */
export function useTwitchClips(
  broadcasterId: string,
  limit: number = 20
): UseTwitchClipsResult {
  const [clips, setClips] = useState<TwitchClip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [hasMore, setHasMore] = useState(false)

  const fetchClips = async (reset: boolean = false) => {
    if (!broadcasterId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const result = await twitchApi.getClips(
        broadcasterId,
        limit,
        reset ? undefined : cursor
      )

      if (reset) {
        setClips(result.data)
      } else {
        setClips((prev) => {
          // メモリ最適化: クリップ配列のサイズを制限（最大200件）
          const MAX_CLIPS = 200
          const updated = [...prev, ...result.data]
          return updated.slice(0, MAX_CLIPS)
        })
      }

      setCursor(result.pagination?.cursor)
      setHasMore(!!result.pagination?.cursor)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClips(true)
  }, [broadcasterId])

  const loadMore = async () => {
    if (!loading && hasMore) {
      await fetchClips(false)
    }
  }

  return {
    clips,
    loading,
    error,
    hasMore,
    loadMore,
    refetch: () => fetchClips(true),
  }
}

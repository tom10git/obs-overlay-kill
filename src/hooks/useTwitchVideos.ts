import { useState, useEffect } from 'react'
import { twitchApi } from '../utils/twitchApi'
import type { TwitchVideo } from '../types/twitch'

interface UseTwitchVideosResult {
  videos: TwitchVideo[]
  loading: boolean
  error: Error | null
  hasMore: boolean
  loadMore: () => Promise<void>
  refetch: () => Promise<void>
}

/**
 * Twitchビデオ情報を取得するカスタムフック
 */
export function useTwitchVideos(
  userId: string,
  limit: number = 20
): UseTwitchVideosResult {
  const [videos, setVideos] = useState<TwitchVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [hasMore, setHasMore] = useState(false)

  const fetchVideos = async (reset: boolean = false) => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const result = await twitchApi.getVideos(
        userId,
        limit,
        reset ? undefined : cursor
      )

      if (reset) {
        setVideos(result.data)
      } else {
        setVideos((prev) => {
          // メモリ最適化: ビデオ配列のサイズを制限（最大200件）
          const MAX_VIDEOS = 200
          const updated = [...prev, ...result.data]
          return updated.slice(0, MAX_VIDEOS)
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
    fetchVideos(true)
  }, [userId])

  const loadMore = async () => {
    if (!loading && hasMore) {
      await fetchVideos(false)
    }
  }

  return {
    videos,
    loading,
    error,
    hasMore,
    loadMore,
    refetch: () => fetchVideos(true),
  }
}

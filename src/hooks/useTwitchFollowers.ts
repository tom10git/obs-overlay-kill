import { useState, useEffect } from 'react'
import { twitchApi } from '../utils/twitchApi'
import type { TwitchFollower } from '../types/twitch'

interface UseTwitchFollowersResult {
  followers: TwitchFollower[]
  total: number
  loading: boolean
  error: Error | null
  hasMore: boolean
  loadMore: () => Promise<void>
  refetch: () => Promise<void>
}

/**
 * Twitchフォロワー情報を取得するカスタムフック
 */
export function useTwitchFollowers(
  broadcasterId: string,
  limit: number = 20
): UseTwitchFollowersResult {
  const [followers, setFollowers] = useState<TwitchFollower[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [hasMore, setHasMore] = useState(false)

  const fetchFollowers = async (reset: boolean = false) => {
    if (!broadcasterId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const result = await twitchApi.getFollowers(
        broadcasterId,
        limit,
        reset ? undefined : cursor
      )

      if (reset) {
        setFollowers(result.data)
      } else {
        setFollowers((prev) => [...prev, ...result.data])
      }

      setTotal(result.total)
      setCursor(result.pagination?.cursor)
      setHasMore(!!result.pagination?.cursor)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFollowers(true)
  }, [broadcasterId])

  const loadMore = async () => {
    if (!loading && hasMore) {
      await fetchFollowers(false)
    }
  }

  return {
    followers,
    total,
    loading,
    error,
    hasMore,
    loadMore,
    refetch: () => fetchFollowers(true),
  }
}

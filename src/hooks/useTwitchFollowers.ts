import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { twitchApi } from '../utils/twitchApi'
import type { TwitchFollower } from '../types/twitch'
import { twitchFollowersQueryKey } from '../lib/queryKeys'

const MAX_FOLLOWERS = 500

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
 * Twitchフォロワー情報を取得するカスタムフック（TanStack Query infinite）
 */
export function useTwitchFollowers(
  broadcasterId: string,
  limit: number = 20
): UseTwitchFollowersResult {
  const q = useInfiniteQuery({
    queryKey: twitchFollowersQueryKey(broadcasterId, limit),
    queryFn: ({ pageParam }) => twitchApi.getFollowers(broadcasterId, limit, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.pagination?.cursor,
    enabled: !!broadcasterId,
  })

  const followers = useMemo(() => {
    const flat = q.data?.pages.flatMap((p) => p.data) ?? []
    return flat.slice(0, MAX_FOLLOWERS)
  }, [q.data])

  const total = q.data?.pages[0]?.total ?? 0

  return {
    followers,
    total,
    loading: q.isLoading,
    error: q.error instanceof Error ? q.error : q.error ? new Error(String(q.error)) : null,
    hasMore: !!q.hasNextPage && followers.length < MAX_FOLLOWERS,
    loadMore: async () => {
      if (q.hasNextPage && !q.isFetchingNextPage && followers.length < MAX_FOLLOWERS) {
        await q.fetchNextPage()
      }
    },
    refetch: async () => {
      await q.refetch()
    },
  }
}

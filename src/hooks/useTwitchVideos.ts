import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { twitchApi } from '../utils/twitchApi'
import type { TwitchVideo } from '../types/twitch'
import { twitchVideosQueryKey } from '../lib/queryKeys'

const MAX_VIDEOS = 200

interface UseTwitchVideosResult {
  videos: TwitchVideo[]
  loading: boolean
  error: Error | null
  hasMore: boolean
  loadMore: () => Promise<void>
  refetch: () => Promise<void>
}

/**
 * Twitchビデオ情報を取得するカスタムフック（TanStack Query infinite）
 */
export function useTwitchVideos(userId: string, limit: number = 20): UseTwitchVideosResult {
  const q = useInfiniteQuery({
    queryKey: twitchVideosQueryKey(userId, limit),
    queryFn: ({ pageParam }) => twitchApi.getVideos(userId, limit, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.pagination?.cursor,
    enabled: !!userId,
  })

  const videos = useMemo(() => {
    const flat = q.data?.pages.flatMap((p) => p.data) ?? []
    return flat.slice(0, MAX_VIDEOS)
  }, [q.data])

  return {
    videos,
    loading: q.isLoading,
    error: q.error instanceof Error ? q.error : q.error ? new Error(String(q.error)) : null,
    hasMore: !!q.hasNextPage && videos.length < MAX_VIDEOS,
    loadMore: async () => {
      if (q.hasNextPage && !q.isFetchingNextPage && videos.length < MAX_VIDEOS) {
        await q.fetchNextPage()
      }
    },
    refetch: async () => {
      await q.refetch()
    },
  }
}

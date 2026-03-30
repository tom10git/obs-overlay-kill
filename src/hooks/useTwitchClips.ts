import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { twitchApi } from '../utils/twitchApi'
import type { TwitchClip } from '../types/twitch'
import { twitchClipsQueryKey } from '../lib/queryKeys'

const MAX_CLIPS = 200

interface UseTwitchClipsResult {
  clips: TwitchClip[]
  loading: boolean
  error: Error | null
  hasMore: boolean
  loadMore: () => Promise<void>
  refetch: () => Promise<void>
}

/**
 * Twitchクリップ情報を取得するカスタムフック（TanStack Query infinite）
 */
export function useTwitchClips(broadcasterId: string, limit: number = 20): UseTwitchClipsResult {
  const q = useInfiniteQuery({
    queryKey: twitchClipsQueryKey(broadcasterId, limit),
    queryFn: ({ pageParam }) => twitchApi.getClips(broadcasterId, limit, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.pagination?.cursor,
    enabled: !!broadcasterId,
  })

  const clips = useMemo(() => {
    const flat = q.data?.pages.flatMap((p) => p.data) ?? []
    return flat.slice(0, MAX_CLIPS)
  }, [q.data])

  return {
    clips,
    loading: q.isLoading,
    error: q.error instanceof Error ? q.error : q.error ? new Error(String(q.error)) : null,
    hasMore: !!q.hasNextPage && clips.length < MAX_CLIPS,
    loadMore: async () => {
      if (q.hasNextPage && !q.isFetchingNextPage && clips.length < MAX_CLIPS) {
        await q.fetchNextPage()
      }
    },
    refetch: async () => {
      await q.refetch()
    },
  }
}

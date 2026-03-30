import { useMemo } from 'react'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { twitchApi } from '../utils/twitchApi'
import type { TwitchChannelPointReward, TwitchChannelPointRedemption } from '../types/twitch'
import {
  twitchChannelPointRewardsQueryKey,
  twitchChannelPointRedemptionsQueryKey,
} from '../lib/queryKeys'

interface UseTwitchChannelPointsResult {
  rewards: TwitchChannelPointReward[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Twitchチャンネルポイントリワードを取得するカスタムフック（TanStack Query）
 */
export function useTwitchChannelPoints(
  broadcasterId: string,
  onlyManageableRewards: boolean = false
): UseTwitchChannelPointsResult {
  const q = useQuery({
    queryKey: twitchChannelPointRewardsQueryKey(broadcasterId, onlyManageableRewards),
    queryFn: () => twitchApi.getChannelPointRewards(broadcasterId, onlyManageableRewards),
    enabled: !!broadcasterId,
  })

  return {
    rewards: q.data ?? [],
    loading: q.isLoading,
    error: q.error instanceof Error ? q.error : q.error ? new Error(String(q.error)) : null,
    refetch: async () => {
      await q.refetch()
    },
  }
}

interface UseTwitchChannelPointRedemptionsResult {
  redemptions: TwitchChannelPointRedemption[]
  loading: boolean
  error: Error | null
  hasMore: boolean
  loadMore: () => Promise<void>
  refetch: () => Promise<void>
}

/**
 * Twitchチャンネルポイントリワードの引き換え履歴（TanStack Query infinite）
 */
export function useTwitchChannelPointRedemptions(
  broadcasterId: string,
  rewardId: string,
  status?: 'UNFULFILLED' | 'FULFILLED' | 'CANCELED',
  limit: number = 20,
  sort: 'OLDEST' | 'NEWEST' = 'NEWEST'
): UseTwitchChannelPointRedemptionsResult {
  const q = useInfiniteQuery({
    queryKey: twitchChannelPointRedemptionsQueryKey(broadcasterId, rewardId, status, limit, sort),
    queryFn: ({ pageParam }) =>
      twitchApi.getChannelPointRedemptions(
        broadcasterId,
        rewardId,
        status,
        limit,
        pageParam,
        sort
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.pagination?.cursor,
    enabled: !!(broadcasterId && rewardId),
  })

  const redemptions = useMemo(
    () => q.data?.pages.flatMap((p) => p.data) ?? [],
    [q.data]
  )

  return {
    redemptions,
    loading: q.isLoading,
    error: q.error instanceof Error ? q.error : q.error ? new Error(String(q.error)) : null,
    hasMore: !!q.hasNextPage,
    loadMore: async () => {
      if (q.hasNextPage && !q.isFetchingNextPage) {
        await q.fetchNextPage()
      }
    },
    refetch: async () => {
      await q.refetch()
    },
  }
}

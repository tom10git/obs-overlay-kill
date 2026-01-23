import { useState, useEffect } from 'react'
import { twitchApi } from '../utils/twitchApi'
import type { TwitchChannelPointReward, TwitchChannelPointRedemption } from '../types/twitch'

interface UseTwitchChannelPointsResult {
  rewards: TwitchChannelPointReward[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Twitchチャンネルポイントリワードを取得するカスタムフック
 * 注意: OAuth認証（ユーザートークン）が必要です
 */
export function useTwitchChannelPoints(
  broadcasterId: string,
  onlyManageableRewards: boolean = false
): UseTwitchChannelPointsResult {
  const [rewards, setRewards] = useState<TwitchChannelPointReward[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchRewards = async () => {
    if (!broadcasterId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const rewardsData = await twitchApi.getChannelPointRewards(
        broadcasterId,
        onlyManageableRewards
      )
      setRewards(rewardsData)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setRewards([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRewards()
  }, [broadcasterId, onlyManageableRewards])

  return {
    rewards,
    loading,
    error,
    refetch: fetchRewards,
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
 * Twitchチャンネルポイントリワードの引き換え履歴を取得するカスタムフック
 * 注意: OAuth認証（ユーザートークン）が必要です
 * 
 * 公式API仕様: https://dev.twitch.tv/docs/api/reference#get-custom-reward-redemption
 * 
 * @param broadcasterId - ブロードキャスターのID
 * @param rewardId - カスタムリワードのID
 * @param status - リデンプションのステータス（idパラメータが指定されていない場合は必須）
 * @param limit - 1ページあたりの最大アイテム数（1-50、デフォルト20）
 * @param sort - ソート順（OLDEST, NEWEST） - デフォルトはNEWEST（最新の引き換えを先に取得）
 */
export function useTwitchChannelPointRedemptions(
  broadcasterId: string,
  rewardId: string,
  status?: 'UNFULFILLED' | 'FULFILLED' | 'CANCELED',
  limit: number = 20,
  sort: 'OLDEST' | 'NEWEST' = 'NEWEST'
): UseTwitchChannelPointRedemptionsResult {
  const [redemptions, setRedemptions] = useState<TwitchChannelPointRedemption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [hasMore, setHasMore] = useState(false)

  const fetchRedemptions = async (reset: boolean = false) => {
    if (!broadcasterId || !rewardId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const result = await twitchApi.getChannelPointRedemptions(
        broadcasterId,
        rewardId,
        status,
        limit,
        reset ? undefined : cursor,
        sort
      )

      if (reset) {
        setRedemptions(result.data)
      } else {
        setRedemptions((prev) => [...prev, ...result.data])
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
    fetchRedemptions(true)
  }, [broadcasterId, rewardId, status, sort, limit])

  const loadMore = async () => {
    if (!loading && hasMore) {
      await fetchRedemptions(false)
    }
  }

  return {
    redemptions,
    loading,
    error,
    hasMore,
    loadMore,
    refetch: () => fetchRedemptions(true),
  }
}

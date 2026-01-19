/**
 * チャンネルポイント引き換えイベントを監視するフック
 */

import { useState, useEffect, useRef } from 'react'
import { useTwitchChannelPointRedemptions } from './useTwitchChannelPoints'
import type { ChannelPointEvent } from '../types/overlay'
import type { TwitchChannelPointRedemption } from '../types/twitch'

interface UseChannelPointEventsOptions {
  broadcasterId: string
  rewardId: string
  enabled: boolean
  pollingInterval?: number // ミリ秒
  onEvent?: (event: ChannelPointEvent) => void
}

interface UseChannelPointEventsResult {
  events: ChannelPointEvent[]
  isPolling: boolean
  error: Error | null
}

/**
 * チャンネルポイント引き換えイベントを監視
 */
export function useChannelPointEvents({
  broadcasterId,
  rewardId,
  enabled,
  pollingInterval = 5000, // デフォルト5秒
  onEvent,
}: UseChannelPointEventsOptions): UseChannelPointEventsResult {
  const [events, setEvents] = useState<ChannelPointEvent[]>([])
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const processedIdsRef = useRef<Set<string>>(new Set())
  const lastPollTimeRef = useRef<number>(0)

  const {
    redemptions,
    loading,
    error: apiError,
    refetch,
  } = useTwitchChannelPointRedemptions(
    broadcasterId,
    rewardId,
    'UNFULFILLED', // 未処理の引き換えのみ
    20
  )

  useEffect(() => {
    if (!enabled || !broadcasterId || !rewardId) {
      setIsPolling(false)
      return
    }

    setIsPolling(true)

    // 初回読み込み
    const processRedemptions = () => {
      const now = Date.now()
      const newEvents: ChannelPointEvent[] = []

      redemptions.forEach((redemption: TwitchChannelPointRedemption) => {
        // 既に処理済みのイベントはスキップ
        if (processedIdsRef.current.has(redemption.id)) {
          return
        }

        // 新しい引き換えを検出（最後のポーリング時刻より後）
        const redeemedAt = new Date(redemption.redeemed_at).getTime()
        if (redeemedAt > lastPollTimeRef.current) {
          const event: ChannelPointEvent = {
            id: redemption.id,
            rewardId: redemption.reward.id,
            userId: redemption.user_id,
            userName: redemption.user_name,
            redeemedAt: redemption.redeemed_at,
            status: redemption.status,
          }

          newEvents.push(event)
          processedIdsRef.current.add(redemption.id)

          // コールバックを呼び出し
          if (onEvent) {
            onEvent(event)
          }
        }
      })

      if (newEvents.length > 0) {
        setEvents((prev) => [...newEvents, ...prev])
      }

      lastPollTimeRef.current = now
    }

    // 初回処理
    if (redemptions.length > 0) {
      processRedemptions()
    }

    // ポーリング間隔で再取得
    const intervalId = setInterval(() => {
      refetch()
    }, pollingInterval)

    return () => {
      clearInterval(intervalId)
      setIsPolling(false)
    }
  }, [
    enabled,
    broadcasterId,
    rewardId,
    redemptions,
    pollingInterval,
    refetch,
    onEvent,
  ])

  useEffect(() => {
    if (apiError) {
      setError(apiError)
    } else {
      setError(null)
    }
  }, [apiError])

  return {
    events,
    isPolling: isPolling && !loading,
    error,
  }
}

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

  // メモリ最適化: processedIdsRefのサイズを制限（最大1000件）
  const MAX_PROCESSED_IDS = 1000

  const {
    redemptions,
    loading,
    error: apiError,
    refetch,
  } = useTwitchChannelPointRedemptions(
    broadcasterId,
    rewardId,
    'UNFULFILLED', // 未処理の引き換えのみ（公式API仕様に基づく必須パラメータ）
    20, // 1ページあたりの最大アイテム数
    'NEWEST' // 最新の引き換えを先に取得（テストモードと同じ動作）
  )

  useEffect(() => {
    if (!enabled || !broadcasterId || !rewardId) {
      setIsPolling(false)
      return
    }

    setIsPolling(true)

    // 初回読み込み時は、現在時刻を基準にする（既存の引き換えを無視）
    if (lastPollTimeRef.current === 0) {
      lastPollTimeRef.current = Date.now()
      if (import.meta.env.DEV) {
        console.log('📊 チャンネルポイントイベント監視: 初期タイムスタンプ設定', new Date(lastPollTimeRef.current).toISOString())
      }
    }

    // 初回読み込み
    const processRedemptions = () => {
      const now = Date.now()
      const newEvents: ChannelPointEvent[] = []

      if (import.meta.env.DEV) {
        console.log('📊 チャンネルポイントイベント監視: 引き換え履歴を処理中', {
          件数: redemptions.length,
          最終ポーリング時刻: new Date(lastPollTimeRef.current).toISOString(),
        })
      }

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

          if (import.meta.env.DEV) {
            console.log('✅ チャンネルポイントイベント監視: 新しい引き換えを検出', {
              イベントID: event.id,
              リワードID: event.rewardId,
              ユーザー名: event.userName,
              引き換え時刻: event.redeemedAt,
            })
          }

          newEvents.push(event)
          processedIdsRef.current.add(redemption.id)

          // メモリ最適化: 処理済みIDのセットが大きくなりすぎないように制限
          if (processedIdsRef.current.size > MAX_PROCESSED_IDS) {
            // 古いIDを削除（最初の500件を削除）
            const idsArray = Array.from(processedIdsRef.current)
            idsArray.slice(0, 500).forEach((id) => processedIdsRef.current.delete(id))
          }

          // コールバックを呼び出し
          if (onEvent) {
            try {
              onEvent(event)
            } catch (error) {
              console.error(
                '❌ チャンネルポイントイベントコールバックエラー\n' +
                'イベント処理中にエラーが発生しました。\n' +
                'エラー詳細:', error
              )
            }
          }
        }
      })

      if (newEvents.length > 0) {
        setEvents((prev) => {
          // メモリ最適化: イベント配列のサイズを制限（最大100件）
          const MAX_EVENTS = 100
          const updated = [...newEvents, ...prev]
          return updated.slice(0, MAX_EVENTS)
        })
      }

      lastPollTimeRef.current = now
    }

    // 初回処理
    if (redemptions.length > 0) {
      processRedemptions()
    }

    // ポーリング間隔で再取得
    const intervalId = setInterval(() => {
      if (import.meta.env.DEV) {
        console.log('📊 チャンネルポイントイベント監視: 新しい引き換えをポーリング中...')
      }
      refetch()
    }, pollingInterval)

    return () => {
      clearInterval(intervalId)
      setIsPolling(false)
      // メモリ最適化: クリーンアップ時に処理済みIDをクリア
      processedIdsRef.current.clear()
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
      // OAuth認証エラーの可能性をチェック
      if (apiError.message.includes('401') || apiError.message.includes('Unauthorized')) {
        console.error(
          '❌ OAuth認証エラー: チャンネルポイントの引き換え履歴を取得するには、OAuth認証（ユーザートークン）が必要です。\n' +
          'App Access Tokenでは使用できません。\n' +
          'VITE_TWITCH_ACCESS_TOKEN にユーザートークンを設定してください。\n' +
          'エラー詳細:', apiError
        )
      } else {
        console.error(
          '❌ チャンネルポイントAPIエラー\n' +
          'チャンネルポイントの引き換え履歴を取得できませんでした。\n' +
          'エラー詳細:', apiError
        )
      }
    } else {
      setError(null)
    }
  }, [apiError, broadcasterId, rewardId, enabled])

  return {
    events,
    isPolling: isPolling && !loading,
    error,
  }
}

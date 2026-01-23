/**
 * EventSub WebSocketを使用してチャンネルポイント引き換えイベントを監視するフック
 * ポーリング方式よりもリアルタイムで効率的
 */

import { useEffect, useRef, useState } from 'react'
import { twitchEventSub } from '../utils/twitchEventSub'
import type { ChannelPointEvent } from '../types/overlay'

interface UseEventSubRedemptionsOptions {
  broadcasterId: string
  enabled: boolean
  onEvent?: (event: ChannelPointEvent) => void
}

interface UseEventSubRedemptionsResult {
  isConnected: boolean
  error: Error | null
}

/**
 * EventSub WebSocketを使用してチャンネルポイント引き換えイベントを監視
 */
export function useEventSubRedemptions({
  broadcasterId,
  enabled,
  onEvent,
}: UseEventSubRedemptionsOptions): UseEventSubRedemptionsResult {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const onEventRef = useRef(onEvent)

  // コールバックを最新の状態に保つ
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!enabled || !broadcasterId) {
      twitchEventSub.disconnect()
      setIsConnected(false)
      setError(null)
      return
    }

    let mounted = true

    const connect = async () => {
      try {
        await twitchEventSub.connect({
          broadcasterId,
          onRedemption: (event) => {
            if (mounted && onEventRef.current) {
              onEventRef.current(event)
            }
          },
          onConnect: () => {
            if (mounted) {
              setIsConnected(true)
              setError(null)
            }
          },
          onDisconnect: () => {
            if (mounted) {
              setIsConnected(false)
            }
          },
          onError: (err) => {
            if (mounted) {
              setError(err)
              setIsConnected(false)
            }
          },
        })
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to connect to EventSub'))
          setIsConnected(false)
        }
      }
    }

    connect()

    return () => {
      mounted = false
      twitchEventSub.disconnect()
      setIsConnected(false)
    }
  }, [enabled, broadcasterId])

  // 接続状態を定期的に確認
  useEffect(() => {
    if (!enabled) return

    const intervalId = setInterval(() => {
      setIsConnected(twitchEventSub.isConnected())
    }, 5000)

    return () => {
      clearInterval(intervalId)
    }
  }, [enabled])

  return {
    isConnected,
    error,
  }
}

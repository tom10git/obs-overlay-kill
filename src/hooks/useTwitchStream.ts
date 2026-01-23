import { useState, useEffect } from 'react'
import { twitchApi } from '../utils/twitchApi'
import { getAutoRefreshInterval } from '../config/admin'
import type { TwitchStream } from '../types/twitch'

interface UseTwitchStreamResult {
  stream: TwitchStream | null
  loading: boolean
  error: Error | null
  isLive: boolean
  refetch: () => Promise<void>
}

/**
 * Twitchストリーム情報を取得するカスタムフック
 */
export function useTwitchStream(userLogin: string): UseTwitchStreamResult {
  const [stream, setStream] = useState<TwitchStream | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchStream = async () => {
    if (!userLogin) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const streamData = await twitchApi.getStream(userLogin)
      setStream(streamData)
    } catch (err) {
      // CORSエラーの場合は、開発環境では警告のみ（オーバーレイページでは使用されない）
      const error = err instanceof Error ? err : new Error('Unknown error')
      if (error.message.includes('CORS') || error.message.includes('Network Error')) {
        if (import.meta.env.DEV) {
          console.warn(
            `[useTwitchStream] CORS error (this is expected in browser - stream info is not used in overlay):`,
            error.message
          )
        }
        // CORSエラーの場合は、エラーとして扱わない（オーバーレイページでは使用されないため）
        setError(null)
      } else {
        setError(error)
      }
      setStream(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStream()
    // 管理者設定から自動更新間隔を取得
    const refreshInterval = getAutoRefreshInterval() * 1000 // ミリ秒に変換
    const interval = setInterval(fetchStream, refreshInterval)
    return () => clearInterval(interval)
  }, [userLogin])

  return {
    stream,
    loading,
    error,
    isLive: stream !== null,
    refetch: fetchStream,
  }
}

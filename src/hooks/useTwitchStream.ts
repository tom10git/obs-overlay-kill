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
      setError(err instanceof Error ? err : new Error('Unknown error'))
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

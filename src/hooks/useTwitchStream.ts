import { useState, useEffect } from 'react'
import { twitchApi } from '../utils/twitchApi'
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
    // 30秒ごとに自動更新（オプション）
    const interval = setInterval(fetchStream, 30000)
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

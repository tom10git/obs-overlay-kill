import { useState, useEffect } from 'react'
import { twitchApi } from '../utils/twitchApi'
import type { TwitchUser } from '../types/twitch'

interface UseTwitchUserResult {
  user: TwitchUser | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Twitchユーザー情報を取得するカスタムフック
 */
export function useTwitchUser(login: string): UseTwitchUserResult {
  const [user, setUser] = useState<TwitchUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchUser = async () => {
    if (!login) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const userData = await twitchApi.getUser(login)
      setUser(userData)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [login])

  return {
    user,
    loading,
    error,
    refetch: fetchUser,
  }
}

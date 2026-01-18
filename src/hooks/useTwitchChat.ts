import { useState, useEffect, useRef, useCallback } from 'react'
import { twitchChat } from '../utils/twitchChat'
import type { TwitchChatMessage } from '../types/twitch'

interface UseTwitchChatResult {
  messages: TwitchChatMessage[]
  isConnected: boolean
  error: Error | null
  connect: () => Promise<void>
  disconnect: () => void
  clearMessages: () => void
}

/**
 * Twitchチャットメッセージを取得するカスタムフック
 */
export function useTwitchChat(
  channel: string,
  maxMessages: number = 100
): UseTwitchChatResult {
  const [messages, setMessages] = useState<TwitchChatMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const connect = useCallback(async () => {
    if (!channel) {
      setError(new Error('Channel name is required'))
      return
    }

    try {
      setError(null)
      await twitchChat.connect(channel)
      setIsConnected(true)

      // メッセージコールバックを登録
      const unsubscribe = twitchChat.onMessage((message) => {
        setMessages((prev) => {
          const newMessages = [message, ...prev]
          // 最大メッセージ数を超えた場合は古いものを削除
          return newMessages.slice(0, maxMessages)
        })
      })

      unsubscribeRef.current = unsubscribe
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to connect to chat'))
      setIsConnected(false)
    }
  }, [channel, maxMessages])

  const disconnect = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
    twitchChat.disconnect()
    setIsConnected(false)
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  useEffect(() => {
    if (channel) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [channel, connect, disconnect])

  return {
    messages,
    isConnected,
    error,
    connect,
    disconnect,
    clearMessages,
  }
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { twitchChat } from '../utils/twitchChat'
import type { TwitchChatMessage } from '../types/twitch'
import type { TwitchChatConnectOptions } from '../utils/twitchChat'

interface UseTwitchChatResult {
  messages: TwitchChatMessage[]
  isConnected: boolean
  /** identity で接続しており say で送信可能か */
  canSend: boolean
  error: Error | null
  connect: () => Promise<void>
  disconnect: () => void
  clearMessages: () => void
}

/**
 * Twitchチャットメッセージを取得するカスタムフック
 * options に token と username を渡すと identity で接続し、送信可能になる（tmi.js の say で自動返信）
 */
export function useTwitchChat(
  channel: string,
  maxMessages: number = 100,
  options?: TwitchChatConnectOptions
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
      await twitchChat.connect(channel, options)
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
  }, [channel, maxMessages, options?.token, options?.username])

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
    canSend: twitchChat.canSend(),
    error,
    connect,
    disconnect,
    clearMessages,
  }
}

/**
 * Twitchチャットのリトライコマンドを監視するフック
 */

import { useState, useEffect, useRef } from 'react'
import { useTwitchChat } from './useTwitchChat'
import type { TwitchChatMessage } from '../types/twitch'

interface UseRetryCommandOptions {
  channel: string
  command: string
  enabled: boolean
  onRetry?: () => void
}

interface UseRetryCommandResult {
  retryCount: number
  lastRetryUser: string | null
}

/**
 * リトライコマンドを監視
 */
export function useRetryCommand({
  channel,
  command,
  enabled,
  onRetry,
}: UseRetryCommandOptions): UseRetryCommandResult {
  const [retryCount, setRetryCount] = useState(0)
  const [lastRetryUser, setLastRetryUser] = useState<string | null>(null)
  const processedMessagesRef = useRef<Set<string>>(new Set())

  // メモリ最適化: processedMessagesRefのサイズを制限（最大500件）
  const MAX_PROCESSED_MESSAGES = 500

  const { messages } = useTwitchChat(channel, 100)

  useEffect(() => {
    if (!enabled || !command) return

    messages.forEach((message: TwitchChatMessage) => {
      // 既に処理済みのメッセージはスキップ
      if (processedMessagesRef.current.has(message.id)) {
        return
      }

      // コマンドをチェック（大文字小文字を区別しない）
      const messageText = message.message.trim().toLowerCase()
      const commandLower = command.toLowerCase()

      if (messageText === commandLower || messageText.startsWith(`${commandLower} `)) {
        processedMessagesRef.current.add(message.id)

        // メモリ最適化: 処理済みメッセージのセットが大きくなりすぎないように制限
        if (processedMessagesRef.current.size > MAX_PROCESSED_MESSAGES) {
          // 古いIDを削除（最初の250件を削除）
          const idsArray = Array.from(processedMessagesRef.current)
          idsArray.slice(0, 250).forEach((id) => processedMessagesRef.current.delete(id))
        }

        setRetryCount((prev) => prev + 1)
        setLastRetryUser(message.user.displayName)

        // コールバックを呼び出し
        if (onRetry) {
          onRetry()
        }
      }
    })
  }, [messages, command, enabled, onRetry])

  // メモリ最適化: クリーンアップ時に処理済みメッセージをクリア
  useEffect(() => {
    return () => {
      processedMessagesRef.current.clear()
    }
  }, [])

  return {
    retryCount,
    lastRetryUser,
  }
}

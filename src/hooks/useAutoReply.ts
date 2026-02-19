import { useCallback } from 'react'
import { twitchChat } from '../utils/twitchChat'
import { twitchApi } from '../utils/twitchApi'

/**
 * 自動返信の送信を統一する。
 * - identity 接続中は tmi.js の say を優先
 * - 不可時は Helix API 送信へフォールバック
 */
export function useAutoReply(channelName: string, broadcasterUserId?: string) {
  return useCallback((message: string, errorLabel: string) => {
    if (!message.trim()) return
    if (twitchChat.canSend()) {
      twitchChat.say(channelName, message)
      return
    }
    if (broadcasterUserId) {
      twitchApi.sendChatMessage(broadcasterUserId, message).catch((err) => console.error(errorLabel, err))
    }
  }, [channelName, broadcasterUserId])
}

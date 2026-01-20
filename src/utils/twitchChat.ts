import tmi, { type Client } from 'tmi.js'
import type { TwitchChatMessage } from '../types/twitch'

class TwitchChatClient {
  private client: Client | null = null
  private messageCallbacks: Set<(message: TwitchChatMessage) => void> = new Set()

  /**
   * チャンネルに接続してチャットメッセージを購読
   */
  connect(channel: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.client) {
        this.disconnect()
      }

      // チャンネル名の検証
      const cleanChannel = channel.trim()
      if (!cleanChannel || cleanChannel.length === 0) {
        reject(new Error('チャンネル名が空です'))
        return
      }

      // 危険な文字列をチェック
      if (cleanChannel.includes('<') || cleanChannel.includes('>') || cleanChannel.includes('"')) {
        reject(new Error('無効なチャンネル名です'))
        return
      }

      const channelName = cleanChannel.startsWith('#') ? cleanChannel : `#${cleanChannel}`

      this.client = new tmi.Client({
        options: { debug: false },
        channels: [channelName],
      })

      this.client.on('message', (channel: string, tags: any, message: string, self: boolean) => {
        if (self) return // 自分のメッセージは無視

        const chatMessage: TwitchChatMessage = {
          id: tags.id || `${Date.now()}-${Math.random()}`,
          user: {
            id: tags['user-id'] || '',
            login: tags.username || '',
            displayName: tags['display-name'] || tags.username || '',
            color: tags.color || '#FFFFFF',
            badges: tags.badges || {},
            isMod: tags.mod === true,
            isSubscriber: tags.subscriber === true,
            isVip: tags.vip === true,
          },
          message: message,
          timestamp: tags['tmi-sent-ts'] ? parseInt(tags['tmi-sent-ts']) : Date.now(),
          channel: channel.replace('#', ''),
          emotes: tags.emotes
            ? tags.emotes.map((emote: any) => ({
              id: emote.id,
              name: emote.name,
              positions: emote.positions,
            }))
            : undefined,
        }

        // すべてのコールバックを呼び出し
        this.messageCallbacks.forEach((callback) => {
          try {
            callback(chatMessage)
          } catch (error) {
            console.error('Error in chat message callback:', error)
          }
        })
      })

      this.client.on('connected', () => {
        resolve()
      })

      this.client.on('disconnected', () => {
        // 再接続は自動的に行われる
      })

      this.client.on('join', (channel: string, _username: string, self: boolean) => {
        if (self) {
          console.log(`Joined channel: ${channel}`)
        }
      })

      this.client.on('part', (channel: string, _username: string, self: boolean) => {
        if (self) {
          console.log(`Left channel: ${channel}`)
        }
      })

      this.client.connect().catch((error: unknown) => {
        console.error('Failed to connect to Twitch chat:', error)
        reject(error)
      })
    })
  }

  /**
   * チャットメッセージのコールバックを登録
   */
  onMessage(callback: (message: TwitchChatMessage) => void): () => void {
    this.messageCallbacks.add(callback)
    // 登録解除関数を返す
    return () => {
      this.messageCallbacks.delete(callback)
    }
  }

  /**
   * チャンネルから切断
   */
  disconnect(): void {
    if (this.client) {
      this.client.disconnect()
      this.client = null
    }
    this.messageCallbacks.clear()
  }

  /**
   * 接続状態を取得
   */
  isConnected(): boolean {
    return this.client?.readyState() === 'OPEN'
  }
}

// シングルトンインスタンスをエクスポート
export const twitchChat = new TwitchChatClient()

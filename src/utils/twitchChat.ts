import tmi, { type Client, type ClientOptions } from 'tmi.js'
import type { TwitchChatMessage } from '../types/twitch'

export interface TwitchChatConnectOptions {
  /** OAuth トークン（付与時は identity で接続し、say で送信可能） */
  token?: string
  /** identity 用のユーザー名（配信者のログイン名） */
  username?: string
}

class TwitchChatClient {
  private client: Client | null = null
  private messageCallbacks: Set<(message: TwitchChatMessage) => void> = new Set()
  private connectedWithIdentity = false

  /**
   * チャンネルに接続してチャットメッセージを購読
   * token と username を渡すと identity で接続し、say() でメッセージ送信が可能になる（参考: channel-point アプリ）
   * identity 接続に失敗した場合は匿名で再接続し、受信・攻撃検知は動作する（送信のみ不可）
   */
  connect(channel: string, options?: TwitchChatConnectOptions): Promise<void> {
    const cleanChannel = channel.trim()
    if (!cleanChannel || cleanChannel.length === 0) {
      return Promise.reject(new Error('チャンネル名が空です'))
    }
    if (cleanChannel.includes('<') || cleanChannel.includes('>') || cleanChannel.includes('"')) {
      return Promise.reject(new Error('無効なチャンネル名です'))
    }

    // channel-point と同じ: channels は # なしのチャンネル名（tmi が内部で正規化）
    const channelForTmi = cleanChannel.startsWith('#') ? cleanChannel.slice(1) : cleanChannel

    const tryConnect = (useIdentity: boolean): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (this.client) {
          this.disconnect()
        }

        const hasIdentity = useIdentity && !!(options?.token?.trim() && options?.username?.trim())
        const token = options?.token?.trim().replace(/^oauth:/i, '') || ''

        // channel-point アプリと同じ tmi.Client 設定（CORS 回避・再接続・自動返信安定化）
        const clientOptions: ClientOptions = {
          options: {
            debug: false,
            skipUpdatingEmotesets: true,
            skipMembership: true,
            updateEmotesetsTimer: 0,
          },
          connection: {
            secure: true,
            reconnect: true,
            timeout: 20000,
            reconnectDecay: 1.5,
            reconnectInterval: 1000,
          },
          channels: [channelForTmi],
        }
        if (hasIdentity && token && options?.username?.trim()) {
          // トークン所有者のログイン名で接続する（チャンネル名ではない）
          const identityUser = options.username.trim().toLowerCase()
          clientOptions.identity = {
            username: identityUser,
            password: `oauth:${token}`,
          }
          if (import.meta.env.DEV) {
            console.log('[Twitch] identity で接続します（自動返信可能）:', identityUser)
          }
        }

        this.connectedWithIdentity = !!clientOptions.identity
        this.client = new tmi.Client(clientOptions)

        this.client.on('message', (ch: string, tags: any, message: string, self: boolean) => {
          if (self) return

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
            channel: ch.replace('#', ''),
            emotes: tags.emotes
              ? tags.emotes.map((emote: any) => ({
                id: emote.id,
                name: emote.name,
                positions: emote.positions,
              }))
              : undefined,
          }

          this.messageCallbacks.forEach((callback) => {
            try {
              callback(chatMessage)
            } catch (error) {
              console.error('❌ Twitchチャット: メッセージコールバックでエラーが発生しました', error)
            }
          })
        })

        this.client.on('connected', () => {
          resolve()
        })

        this.client.on('disconnected', () => {})

        this.client.on('join', (ch: string, _username: string, self: boolean) => {
          if (self && import.meta.env.DEV) {
            console.log(`💬 Twitchチャット: チャンネルに参加しました: ${ch}`)
          }
        })

        this.client.on('part', (ch: string, _username: string, self: boolean) => {
          if (self && import.meta.env.DEV) {
            console.log(`💬 Twitchチャット: チャンネルから退出しました: ${ch}`)
          }
        })

        // channel-point と同様: CORS / kraken / emoticon 系エラーは無視して接続継続
        this.client.on('error', (err: unknown) => {
          const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : ''
          if (
            msg.includes('CORS') ||
            msg.includes('kraken') ||
            msg.includes('emoticon_images') ||
            msg.includes('emotesets')
          ) {
            return
          }
          console.warn('❌ Twitchチャット エラー:', err)
        })

        this.client.connect().catch((error: unknown) => {
          reject(error)
        })
      })
    }

    // まず identity ありで試し、失敗したら匿名で再接続（攻撃・受信は動くようにする）
    const wantIdentity = !!(options?.token?.trim() && options?.username?.trim())
    if (wantIdentity) {
      return tryConnect(true).catch((err) => {
        console.warn(
          '⚠️ Twitchチャット: identity 接続に失敗したため、匿名で再接続します（受信・攻撃検知は有効、自動返信のみ不可）。',
          err
        )
        return tryConnect(false)
      })
    }
    return tryConnect(false)
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
    this.connectedWithIdentity = false
    this.messageCallbacks.clear()
  }

  /**
   * 接続状態を取得
   */
  isConnected(): boolean {
    return this.client?.readyState() === 'OPEN'
  }

  /**
   * identity で接続しているか（true の場合のみ say で送信可能）
   */
  canSend(): boolean {
    return this.connectedWithIdentity && this.client?.readyState() === 'OPEN'
  }

  /**
   * チャットにメッセージを送信（identity で接続している場合のみ有効・tmi.js の say を使用）
   * 参考: channel-point アプリは Helix API ではなく tmi client.say() で自動返信している
   */
  say(channel: string, message: string): boolean {
    if (!this.client || !this.connectedWithIdentity) return false
    // channel-point と同じ: # なしで渡す（tmi が内部で _.channel() で正規化）
    const ch = channel.startsWith('#') ? channel.slice(1) : channel
    try {
      this.client.say(ch, message)
      if (import.meta.env.DEV) {
        console.log('[Twitch] 自動返信送信:', message.slice(0, 50) + (message.length > 50 ? '...' : ''))
      }
      return true
    } catch (err) {
      console.error('❌ Twitchチャット送信エラー:', err)
      return false
    }
  }
}

// シングルトンインスタンスをエクスポート
export const twitchChat = new TwitchChatClient()

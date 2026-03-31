/**
 * Twitch EventSub WebSocket クライアント
 * PubSubの代替として、EventSubを使用してチャンネルポイントの引き換えイベントを監視
 */

import { getTwitchClientId, getTwitchAccessToken } from '../config/auth'
import { logger } from '../lib/logger'
import type { ChannelPointEvent } from '../types/overlay'

interface EventSubMessage {
  metadata: {
    message_id: string
    message_type: 'session_welcome' | 'session_keepalive' | 'session_reconnect' | 'notification' | 'revocation'
    message_timestamp: string
    subscription_type?: string
    subscription_version?: string
  }
  payload?: {
    session?: {
      id: string
      status: string
      connected_at: string
      keepalive_timeout_seconds?: number
      reconnect_url?: string
    }
    subscription?: {
      id: string
      status: string
      type: string
      version: string
      condition: Record<string, string>
      transport: {
        method: string
        session_id: string
      }
      created_at: string
    }
    event?: {
      id: string
      broadcaster_user_id: string
      broadcaster_user_login: string
      broadcaster_user_name: string
      user_id: string
      user_login: string
      user_name: string
      user_input: string
      status: 'unfulfilled' | 'fulfilled' | 'canceled'
      reward: {
        id: string
        title: string
        cost: number
        prompt: string
      }
      redeemed_at: string
    }
  }
}

interface EventSubClientOptions {
  broadcasterId: string
  onRedemption?: (event: ChannelPointEvent) => void
  onError?: (error: Error) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

/** ブラウザの close code の目安（Twitch 側の文言は reason に来る場合がある） */
function eventSubCloseHint(code: number): string {
  switch (code) {
    case 1000:
      return '正常終了'
    case 1006:
      return '異常終了（close フレームなし）。ネットワーク断・ファイアウォール・プロキシ・TLS/中間証明書・アンチウイルス等を疑う'
    case 1002:
      return 'プロトコルエラー'
    case 1011:
      return 'サーバー内部エラー（一時的なことが多い。再試行）'
    default:
      return '上記 code と reason を Twitch/OBS/ネットワーク側で確認'
  }
}

class TwitchEventSubClient {
  private ws: WebSocket | null = null
  private sessionId: string | null = null
  private reconnectTimeout: number | null = null
  private keepaliveTimeout: number | null = null
  private processedMessageIds: Set<string> = new Set()
  private isConnecting: boolean = false
  private options: EventSubClientOptions | null = null

  /**
   * EventSub WebSocketに接続
   */
  async connect(options: EventSubClientOptions): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (import.meta.env.DEV) {
        logger.debug('📡 EventSub: 既に接続されています')
      }
      return
    }

    if (this.isConnecting) {
      if (import.meta.env.DEV) {
        logger.debug('📡 EventSub: 接続処理が進行中です')
      }
      return
    }

    this.options = options
    this.isConnecting = true

    const clientId = getTwitchClientId()
    const accessToken = getTwitchAccessToken()

    if (!clientId || !accessToken) {
      throw new Error('Client ID and Access Token are required for EventSub')
    }

    // "oauth:" プレフィックスを削除
    const token = accessToken.replace(/^oauth:/i, '').trim()

    // WebSocket URL（keepalive_timeout_secondsを指定）
    const wsUrl = `wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30`

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          if (import.meta.env.DEV) {
            logger.debug('📡 EventSub: WebSocket接続完了')
          }
        }

        this.ws.onmessage = (event) => {
          try {
            const message: EventSubMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            logger.error('❌ EventSub: メッセージの解析に失敗しました', error)
          }
        }

        this.ws.onerror = () => {
          // ブラウザの WebSocket onerror は Event しか渡さず { isTrusted:true } 程度しか見えないことが多い。
          // 実際の理由は直後の onclose の code / reason を見る。
          logger.warn(
            '❌ EventSub: WebSocket onerror（詳細はブラウザが出さないことが多いです。直後の「WebSocket切断」の code/reason を確認してください）'
          )
          this.isConnecting = false
          if (this.options?.onError) {
            this.options.onError(new Error('EventSub WebSocket error (see close code in logs)'))
          }
          reject(new Error('EventSub WebSocket error'))
        }

        this.ws.onclose = (event) => {
          this.isConnecting = false
          if (event.code === 1000) {
            if (import.meta.env.DEV) {
              logger.debug('📡 EventSub: WebSocket切断（正常）', { code: event.code, reason: event.reason })
            }
          } else {
            logger.warn('❌ EventSub: WebSocket切断', {
              code: event.code,
              reason: event.reason || '(なし)',
              wasClean: event.wasClean,
              hint: eventSubCloseHint(event.code),
            })
          }

          if (this.options?.onDisconnect) {
            this.options.onDisconnect()
          }

          // クリーンアップ
          this.sessionId = null
          if (this.keepaliveTimeout) {
            clearTimeout(this.keepaliveTimeout)
            this.keepaliveTimeout = null
          }

          // 自動再接続（意図的な切断でない場合）
          if (event.code !== 1000 && this.options) {
            logger.warn(`📡 EventSub: ${event.code} のため約2秒後に再接続します…`)
            this.reconnectTimeout = window.setTimeout(() => {
              this.connect(this.options!).catch((err) => {
                logger.error('❌ EventSub: 再接続に失敗しました', err)
              })
            }, 2000)
          }
        }

        // 接続タイムアウト（10秒以内にwelcomeメッセージが来ない場合）
        const connectionTimeout = window.setTimeout(() => {
          if (!this.sessionId) {
            this.ws?.close()
            reject(new Error('EventSub connection timeout: Welcome message not received'))
          }
        }, 10000)

        // welcomeメッセージを待つ
        const originalOnMessage = this.ws.onmessage
        this.ws.onmessage = (event) => {
          try {
            const message: EventSubMessage = JSON.parse(event.data)
            if (message.metadata.message_type === 'session_welcome') {
              clearTimeout(connectionTimeout)
              this.sessionId = message.payload?.session?.id || null
              if (this.sessionId) {
                if (import.meta.env.DEV) {
                  if (import.meta.env.DEV) {
                    logger.debug('📡 EventSub: セッション確立', this.sessionId)
                  }
                }
                this.subscribeToRedemptions(options.broadcasterId, token)
                  .then(() => {
                    this.isConnecting = false
                    if (this.options?.onConnect) {
                      this.options.onConnect()
                    }
                    resolve()
                  })
                  .catch(reject)
              } else {
                reject(new Error('Session ID not received in welcome message'))
              }
            } else {
              // 他のメッセージは元のハンドラーで処理
              if (originalOnMessage) {
                // this.ws はクローズ等で null になり得るため安全に呼び出す
                const ws = this.ws
                if (ws) {
                  originalOnMessage.call(ws, event)
                }
              }
            }
          } catch (error) {
            logger.error('❌ EventSub: Welcomeメッセージの解析に失敗しました', error)
            reject(error)
          }
        }
      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  /**
   * チャンネルポイント引き換えイベントをサブスクライブ
   */
  private async subscribeToRedemptions(broadcasterId: string, accessToken: string): Promise<void> {
    if (!this.sessionId) {
      throw new Error('Session ID is required to subscribe')
    }

    const clientId = getTwitchClientId()

    const subscriptionPayload = {
      type: 'channel.channel_points_custom_reward_redemption.add',
      version: '1',
      condition: {
        broadcaster_user_id: broadcasterId,
      },
      transport: {
        method: 'websocket',
        session_id: this.sessionId,
      },
    }

    try {
      const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-ID': clientId,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(subscriptionPayload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Failed to create EventSub subscription: ${response.status} ${errorData.message || response.statusText}`
        )
      }

      const data = await response.json()
      if (import.meta.env.DEV) {
        logger.debug('📡 EventSub: サブスクリプション作成完了', data.data?.[0]?.id)
      }
    } catch (error) {
      logger.error('❌ EventSub: サブスクリプションの作成に失敗しました', error)
      throw error
    }
  }

  /**
   * メッセージを処理
   */
  private handleMessage(message: EventSubMessage): void {
    const { message_type, message_id } = message.metadata

    // 重複メッセージのチェック
    if (this.processedMessageIds.has(message_id)) {
      if (import.meta.env.DEV) {
        logger.debug('📡 EventSub: 重複メッセージを無視', message_id)
      }
      return
    }

    this.processedMessageIds.add(message_id)

    // メモリ最適化: 処理済みIDのセットが大きくなりすぎないように制限（最大1000件）
    if (this.processedMessageIds.size > 1000) {
      const idsArray = Array.from(this.processedMessageIds)
      idsArray.slice(0, 500).forEach((id) => this.processedMessageIds.delete(id))
    }

    switch (message_type) {
      case 'session_welcome':
        // 既に処理済み（接続時に処理）
        break

      case 'session_keepalive':
        // Keepaliveメッセージ - 接続が維持されていることを確認
        if (import.meta.env.DEV) {
          logger.debug('📡 EventSub: Keepalive受信')
        }
        break

      case 'session_reconnect': {
        // 再接続が必要な場合
        const reconnectUrl = message.payload?.session?.reconnect_url
        if (reconnectUrl) {
          logger.warn('⚠️ EventSub: 再接続が必要です', reconnectUrl)
          // 再接続処理（現在の接続を閉じて新しいURLに接続）
          this.disconnect()
          // 再接続は自動的に行われる（oncloseハンドラーで）
        }
        break
      }

      case 'notification':
        // イベント通知
        this.handleNotification(message)
        break

      case 'revocation':
        // サブスクリプションが取り消された場合
        logger.warn('⚠️ EventSub: サブスクリプションが取り消されました', message.payload?.subscription?.id)
        if (this.options?.onError) {
          this.options.onError(new Error('EventSub subscription revoked'))
        }
        break

      default:
        if (import.meta.env.DEV) {
          logger.debug('📡 EventSub: 不明なメッセージタイプ', message_type)
        }
    }
  }

  /**
   * 通知メッセージを処理
   */
  private handleNotification(message: EventSubMessage): void {
    const event = message.payload?.event
    if (!event) {
      return
    }

    // チャンネルポイント引き換えイベントの場合
    if (message.metadata.subscription_type === 'channel.channel_points_custom_reward_redemption.add') {
      const channelPointEvent: ChannelPointEvent = {
        id: event.id,
        rewardId: event.reward.id,
        userId: event.user_id,
        userName: event.user_name,
        redeemedAt: event.redeemed_at,
        status: event.status === 'unfulfilled' ? 'UNFULFILLED' : event.status === 'fulfilled' ? 'FULFILLED' : 'CANCELED',
      }

      if (import.meta.env.DEV) {
        logger.debug('✅ EventSub: チャンネルポイント引き換えイベント受信', {
          イベントID: channelPointEvent.id,
          リワードID: channelPointEvent.rewardId,
          ユーザー名: channelPointEvent.userName,
          ステータス: channelPointEvent.status,
        })
      }

      if (this.options?.onRedemption) {
        try {
          this.options.onRedemption(channelPointEvent)
        } catch (error) {
          logger.error('❌ EventSub: 引き換えイベントコールバックでエラーが発生しました', error)
        }
      }
    }
  }

  /**
   * 切断
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.keepaliveTimeout) {
      clearTimeout(this.keepaliveTimeout)
      this.keepaliveTimeout = null
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }

    this.sessionId = null
    this.processedMessageIds.clear()
    this.isConnecting = false
  }

  /**
   * 接続状態を取得
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.sessionId !== null
  }
}

// シングルトンインスタンスをエクスポート
export const twitchEventSub = new TwitchEventSubClient()

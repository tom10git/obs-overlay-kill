import { logger } from '../lib/logger'
import { twitchApi } from './twitchApi'

const EVENTSUB_WS_URL = 'wss://eventsub.wss.twitch.tv/ws'
const REDEMPTION_ADD_TYPE = 'channel.channel_points_custom_reward_redemption.add'
const REDEMPTION_ADD_VERSION = '1'

export type ChannelPointRedemptionAddPayload = {
  id: string
  broadcaster_user_id: string
  user_id: string
  user_name: string
  user_login: string
  status: string
  redeemed_at: string
  reward: {
    id: string
    title: string
    cost: number
    prompt: string
  }
}

type EventSubMessage = {
  metadata: {
    message_id: string
    message_type: string
    message_timestamp: string
  }
  payload: {
    session?: {
      id: string
      status: string
      keepalive_timeout_seconds?: number
      reconnect_url?: string | null
    }
    subscription?: unknown
    event?: ChannelPointRedemptionAddPayload
  }
}

export type TwitchEventSubWebSocketOptions = {
  broadcasterId: string
  onRedemptionAdd: (event: ChannelPointRedemptionAddPayload) => void
  onConnected?: () => void
  onError?: (message: string, error?: unknown) => void
}

/**
 * Twitch EventSub WebSocket で channel.channel_points_custom_reward_redemption.add を受信する。
 * ダッシュボードで作成したリワードは Helix ポーリング不可のため、こちらが主な検知手段。
 */
export class TwitchEventSubWebSocket {
  private ws: WebSocket | null = null
  private keepaliveTimer: ReturnType<typeof setTimeout> | null = null
  private cancelled = false
  private subscribed = false

  constructor(private readonly options: TwitchEventSubWebSocketOptions) {}

  connect(url: string = EVENTSUB_WS_URL): void {
    if (this.cancelled) return
    this.clearKeepalive()
    this.subscribed = false

    try {
      this.ws = new WebSocket(url)
    } catch (err) {
      this.options.onError?.('WebSocket の接続に失敗しました', err)
      return
    }

    this.ws.onmessage = (ev) => {
      void this.handleMessage(String(ev.data ?? ''))
    }
    this.ws.onerror = () => {
      this.options.onError?.('EventSub WebSocket でエラーが発生しました')
    }
    this.ws.onclose = () => {
      this.clearKeepalive()
      if (!this.cancelled) {
        this.options.onError?.('EventSub WebSocket が切断されました')
      }
    }
  }

  disconnect(): void {
    this.cancelled = true
    this.clearKeepalive()
    if (this.ws) {
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null
      this.ws.close()
      this.ws = null
    }
  }

  private clearKeepalive(): void {
    if (this.keepaliveTimer != null) {
      clearTimeout(this.keepaliveTimer)
      this.keepaliveTimer = null
    }
  }

  private scheduleKeepalive(seconds: number): void {
    this.clearKeepalive()
    const ms = Math.max(5000, (seconds - 2) * 1000)
    this.keepaliveTimer = setTimeout(() => {
      if (!this.cancelled && this.ws?.readyState === WebSocket.OPEN) {
        logger.warn('[ChannelPoints] EventSub keepalive がタイムアウトしました。再接続します。')
        this.ws?.close()
        this.connect()
      }
    }, ms)
  }

  private async handleMessage(raw: string): Promise<void> {
    if (this.cancelled) return
    let msg: EventSubMessage
    try {
      msg = JSON.parse(raw) as EventSubMessage
    } catch {
      return
    }

    const type = msg.metadata?.message_type
    switch (type) {
      case 'session_welcome': {
        const session = msg.payload?.session
        if (!session?.id) return
        this.scheduleKeepalive(session.keepalive_timeout_seconds ?? 10)
        if (this.subscribed) return
        try {
          await twitchApi.createEventSubWebSocketSubscription(
            REDEMPTION_ADD_TYPE,
            REDEMPTION_ADD_VERSION,
            { broadcaster_user_id: this.options.broadcasterId },
            session.id,
          )
          this.subscribed = true
          logger.info('[ChannelPoints] EventSub: 引き換え通知の購読を開始しました')
          this.options.onConnected?.()
        } catch (err) {
          this.options.onError?.('EventSub 購読の作成に失敗しました', err)
        }
        break
      }
      case 'session_keepalive':
        this.scheduleKeepalive(10)
        break
      case 'session_reconnect': {
        const reconnectUrl = msg.payload?.session?.reconnect_url
        if (reconnectUrl) {
          this.ws?.close()
          this.connect(reconnectUrl)
        }
        break
      }
      case 'notification': {
        const event = msg.payload?.event
        if (event?.id && event.reward?.id) {
          this.options.onRedemptionAdd(event)
        }
        break
      }
      case 'revocation':
        logger.warn('[ChannelPoints] EventSub 購読が解除されました', msg.payload)
        break
      default:
        break
    }
  }
}

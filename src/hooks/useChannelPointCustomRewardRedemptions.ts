import axios from 'axios'
import { useEffect, useRef } from 'react'
import { logger } from '../lib/logger'
import { twitchApi } from '../utils/twitchApi'

const EVENTSUB_WS_URL = 'wss://eventsub.wss.twitch.tv/ws'

function normalizeCpTitle(s: string): string {
  return s.trim().normalize('NFKC')
}

function readObsOverlayDebug(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('obs-overlay-debug') === '1'
  } catch {
    return false
  }
}

export interface ChannelPointRedemptionRoute {
  /** ログ用ラベル（例: attack / heal / revive） */
  tag: string
  rewardTitle: string
  rewardIdOverride: string
  onRedemption: (payload: { redemptionId: string; userId: string; userName: string }) => void
}

export interface UseChannelPointCustomRewardRedemptionsOptions {
  enabled: boolean
  broadcasterId: string | undefined
  /** 空配列のときは接続しない */
  routes: ChannelPointRedemptionRoute[]
  /** @deprecated 互換用（未使用） */
  pollIntervalSec: number
  autoFulfill: boolean
}

type EventSubWsEnvelope = {
  metadata?: { message_type?: string }
  payload?: {
    session?: { id?: string; reconnect_url?: string }
    subscription?: { type?: string }
    event?: {
      id?: string
      broadcaster_user_id?: string
      user_id?: string
      user_login?: string
      user_name?: string
      status?: string
      reward?: { id?: string; title?: string }
    }
  }
}

function matchesRoute(
  route: ChannelPointRedemptionRoute,
  event: NonNullable<EventSubWsEnvelope['payload']>['event'],
  emptyTitleLoggedRef: { current: Set<string> }
): boolean {
  if (!event?.reward) return false
  const override = route.rewardIdOverride.trim()
  if (override) {
    return event.reward.id === override
  }
  const titleTarget = route.rewardTitle.trim()
  if (!titleTarget) {
    if (!emptyTitleLoggedRef.current.has(route.tag)) {
      emptyTitleLoggedRef.current.add(route.tag)
      logger.warn(
        `[channel-points] リワードタイトルが空のため、チャンネルポイント「${route.tag}」の EventSub 照合をスキップします`
      )
    }
    return false
  }
  return normalizeCpTitle(event.reward.title ?? '') === normalizeCpTitle(titleTarget)
}

/**
 * EventSub WebSocket でカスタムリワードの引き換えを受け取り、ルートごとのコールバックを発火する。
 * 複数リワードは購読条件を broadcaster のみにし、通知をタイトル／ID で振り分ける。
 */
export function useChannelPointCustomRewardRedemptions(options: UseChannelPointCustomRewardRedemptionsOptions): void {
  const { enabled, broadcasterId, routes, autoFulfill } = options

  const routesRef = useRef(routes)
  routesRef.current = routes

  const autoFulfillRef = useRef(autoFulfill)
  autoFulfillRef.current = autoFulfill

  const processedRedemptionIdsRef = useRef<Set<string>>(new Set())
  const tokenAuditBroadcasterRef = useRef<string | null>(null)
  const subscriptionIdRef = useRef<string | null>(null)
  const emptyTitleLoggedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    emptyTitleLoggedRef.current.clear()
  }, [broadcasterId])

  useEffect(() => {
    if (!enabled || !broadcasterId || routesRef.current.length === 0) {
      return
    }

    let latestSocket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof window.setTimeout> | undefined
    let closedByUser = false
    let backoffMs = 2000
    let skipReconnectOnClose = false
    let skipHelixFulfillAfter403 = false

    const clearReconnect = () => {
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer)
        reconnectTimer = undefined
      }
    }

    const deleteSubscription = async () => {
      const sid = subscriptionIdRef.current
      subscriptionIdRef.current = null
      if (!sid) return
      try {
        await twitchApi.deleteEventSubSubscription(sid)
      } catch {
        /* best-effort */
      }
    }

    const scheduleReconnect = () => {
      if (closedByUser) return
      clearReconnect()
      const delay = Math.min(backoffMs, 60_000)
      backoffMs = Math.min(backoffMs * 2, 60_000)
      reconnectTimer = window.setTimeout(() => connect(), delay)
    }

    const runTokenAuditOnce = async () => {
      if (tokenAuditBroadcasterRef.current === broadcasterId) return
      tokenAuditBroadcasterRef.current = broadcasterId
      const info = await twitchApi.getOAuthUserIdAndScopes()
      if (!info) {
        logger.error(
          '[channel-points] OAuth ユーザーアクセストークンを検証できませんでした。VITE_TWITCH_ACCESS_TOKEN またはリフレッシュ可能な VITE_TWITCH_REFRESH_TOKEN を確認してください。'
        )
      } else {
        if (info.userId !== broadcasterId) {
          logger.error(
            `[channel-points] トークンはユーザー ID ${info.userId} 用ですが、オーバーレイの配信者 ID は ${broadcasterId} です。` +
              'チャンネルポイント API は「チャンネル所有者本人」のユーザートークンが必要です。VITE_TWITCH_USERNAME（またはログイン名）とトークンが同じ Twitch アカウントか確認してください。'
          )
        }
        if (!info.scopes.includes('channel:read:redemptions')) {
          logger.error(
            '[channel-points] トークンに channel:read:redemptions がありません。スコープを付けてトークンを再取得してください。'
          )
        }
        if (autoFulfillRef.current && !info.scopes.includes('channel:manage:redemptions')) {
          logger.warn(
            '[channel-points] 引き換えの自動完了をオンにしていますが、channel:manage:redemptions がありません。FULFILLED 更新は失敗することがあります。'
          )
        }
      }
    }

    const handleNotification = async (event: NonNullable<EventSubWsEnvelope['payload']>['event']) => {
      if (!event?.id || !event.user_id || !event.reward?.id) return
      if (event.broadcaster_user_id && event.broadcaster_user_id !== broadcasterId) return
      if (event.status && event.status !== 'unfulfilled') return

      const activeRoutes = routesRef.current
      const matched = activeRoutes.find((r) => matchesRoute(r, event, emptyTitleLoggedRef))
      if (!matched) {
        if (readObsOverlayDebug()) {
          logger.info('[channel-points] EventSub 通知をスキップ（どのルートにも不一致）', {
            rewardId: event.reward?.id,
            title: event.reward?.title,
          })
        }
        return
      }

      if (processedRedemptionIdsRef.current.has(event.id)) return
      processedRedemptionIdsRef.current.add(event.id)

      const userName = (event.user_name || event.user_login || event.user_id).trim() || event.user_id
      try {
        matched.onRedemption({
          redemptionId: event.id,
          userId: event.user_id,
          userName,
        })
      } catch (e) {
        logger.error(`[channel-points] onRedemption (${matched.tag}) 内でエラー`, e)
      }

      if (autoFulfillRef.current && !skipHelixFulfillAfter403) {
        try {
          await twitchApi.fulfillChannelPointRedemptions(broadcasterId, event.reward.id, [event.id])
        } catch (e) {
          if (axios.isAxiosError(e) && e.response?.status === 403) {
            skipHelixFulfillAfter403 = true
            logger.warn(
              '[channel-points] このカスタムリワードは Helix で自動完了（FULFILLED）にできません（クリエイターダッシュボードで作成したリワードでよくあります）。演出はそのまま動作します。ダッシュボードのキューで手動完了するか、設定の「引き換えを自動で完了」をオフにするとこの警告は出ません。'
            )
          } else {
            logger.error('[channel-points] 引き換えの FULFILLED 更新に失敗しました', e)
          }
        }
      }

      if (processedRedemptionIdsRef.current.size > 500) {
        const arr = Array.from(processedRedemptionIdsRef.current)
        arr.slice(0, 250).forEach((id) => processedRedemptionIdsRef.current.delete(id))
      }
    }

    const subscribeAfterWelcome = async (sessionId: string, socket: WebSocket) => {
      const condition = { broadcaster_user_id: broadcasterId }
      await runTokenAuditOnce()
      try {
        const subId = await twitchApi.createEventSubChannelPointsRedemptionAddWebsocket(sessionId, condition)
        subscriptionIdRef.current = subId
        backoffMs = 2000
        logger.info('[channel-points] EventSub 購読を開始しました（全カスタムリワード通知・ルートで振り分け）', {
          broadcasterId,
          routeCount: routesRef.current.length,
        })
      } catch (e) {
        const helixMessage =
          axios.isAxiosError(e) &&
          e.response?.data &&
          typeof (e.response.data as { message?: string }).message === 'string'
            ? (e.response.data as { message: string }).message
            : undefined
        if (axios.isAxiosError(e) && e.response?.status === 401) {
          logger.error(
            '[channel-points] 401: EventSub の作成に失敗しました。OAuth トークンに channel:read:redemptions を付けて再取得してください。'
          )
        } else if (axios.isAxiosError(e) && e.response?.status === 403) {
          logger.error(
            `[channel-points] 403: EventSub の作成が拒否されました。${helixMessage ? ` (${helixMessage})` : ''}`
          )
        } else {
          logger.error('[channel-points] EventSub 購読の作成に失敗しました', e)
        }
        try {
          socket.close()
        } catch {
          /* */
        }
      }
    }

    const connect = (url: string = EVENTSUB_WS_URL) => {
      if (closedByUser) return
      const socket = new WebSocket(url)
      latestSocket = socket

      socket.onmessage = (ev) => {
        let msg: EventSubWsEnvelope
        try {
          msg = JSON.parse(String(ev.data)) as EventSubWsEnvelope
        } catch {
          return
        }
        const mtype = msg.metadata?.message_type

        if (mtype === 'session_welcome') {
          const sessionId = msg.payload?.session?.id
          if (!sessionId) return
          if (!subscriptionIdRef.current) {
            void subscribeAfterWelcome(sessionId, socket)
          }
          return
        }

        if (mtype === 'session_reconnect') {
          const nextUrl = msg.payload?.session?.reconnect_url
          if (typeof nextUrl === 'string' && nextUrl.length > 0) {
            skipReconnectOnClose = true
            try {
              socket.close()
            } catch {
              /* */
            }
            connect(nextUrl)
          }
          return
        }

        if (mtype === 'notification') {
          const subType = msg.payload?.subscription?.type
          if (subType !== 'channel.channel_points_custom_reward_redemption.add') return
          const event = msg.payload?.event
          void handleNotification(event)
        }
      }

      socket.onclose = () => {
        if (latestSocket !== socket) return
        latestSocket = null
        const skip = skipReconnectOnClose
        skipReconnectOnClose = false
        if (!skip) {
          void deleteSubscription()
        }
        if (skip) return
        if (!closedByUser) {
          scheduleReconnect()
        }
      }
    }

    connect()

    return () => {
      closedByUser = true
      clearReconnect()
      void deleteSubscription()
      try {
        latestSocket?.close()
      } catch {
        /* */
      }
      latestSocket = null
    }
  }, [enabled, broadcasterId])
}

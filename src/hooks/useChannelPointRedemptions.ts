import { useEffect, useRef } from 'react'
import type { ChannelPointEvent } from '../types/overlay'
import {
  buildChannelPointPollTargets,
  findChannelPointTargetForRedemption,
  isAnyChannelPointActionEnabled,
} from '../utils/channelPointConfig'
import { logger } from '../lib/logger'
import { twitchApi } from '../utils/twitchApi'
import { TwitchEventSubWebSocket, type ChannelPointRedemptionAddPayload } from '../utils/twitchEventSub'
import type { OverlayConfig } from '../types/overlay'
import type { TwitchChannelPointReward } from '../types/twitch'

function normalizeRedemptionStatus(status: string): ChannelPointEvent['status'] {
  const upper = status.toUpperCase()
  if (upper === 'FULFILLED' || upper === 'CANCELED') return upper
  return 'UNFULFILLED'
}

export type UseChannelPointRedemptionsOptions = {
  config: OverlayConfig | null
  broadcasterId: string | undefined
  /** テストモード時はポーリングしない */
  disabled?: boolean
  onRedemption: (event: ChannelPointEvent, twitchRewardId: string) => void | Promise<void>
}

/**
 * チャンネルポイント引き換えを監視する。
 * - 主: EventSub WebSocket（ダッシュボード作成リワード向け）
 * - 副: Helix ポーリング（API 作成リワードのみ・自動完了用）
 */
export function useChannelPointRedemptions({
  config,
  broadcasterId,
  disabled = false,
  onRedemption,
}: UseChannelPointRedemptionsOptions): void {
  const processedIdsRef = useRef<Set<string>>(new Set())
  const onRedemptionRef = useRef(onRedemption)
  onRedemptionRef.current = onRedemption

  useEffect(() => {
    if (!config || !broadcasterId || disabled) return
    if (!isAnyChannelPointActionEnabled(config)) return

    let cancelled = false
    let pollTimerId: ReturnType<typeof setTimeout> | null = null
    let rewardsCache: TwitchChannelPointReward[] = []
    let manageableRewardIds = new Set<string>()
    let eventSub: TwitchEventSubWebSocket | null = null
    let eventSubStarted = false

    const refreshRewardCaches = async () => {
      const [allRewards, manageableRewards] = await Promise.all([
        twitchApi.getChannelPointRewards(broadcasterId, false),
        twitchApi.getChannelPointRewards(broadcasterId, true),
      ])
      if (cancelled) return
      rewardsCache = allRewards
      manageableRewardIds = new Set(manageableRewards.map((r) => r.id))
    }

    const processRedemption = async (
      redemptionId: string,
      twitchRewardId: string,
      twitchTitle: string,
      userId: string,
      userName: string,
      redeemedAt: string,
      status: string,
    ) => {
      if (processedIdsRef.current.has(redemptionId)) return
      processedIdsRef.current.add(redemptionId)

      const target = findChannelPointTargetForRedemption(
        config,
        rewardsCache,
        twitchRewardId,
        twitchTitle,
      )
      if (!target) return

      const event: ChannelPointEvent = {
        id: redemptionId,
        rewardId: target.internalRewardId,
        userId,
        userName,
        redeemedAt,
        status: normalizeRedemptionStatus(status),
      }

      try {
        await onRedemptionRef.current(event, twitchRewardId)
        if (
          config.attack.channelPointsAutoFulfill &&
          manageableRewardIds.has(twitchRewardId)
        ) {
          await twitchApi.updateChannelPointRedemptionStatus(
            broadcasterId,
            twitchRewardId,
            redemptionId,
            'FULFILLED',
          )
        }
      } catch (err) {
        logger.error('[ChannelPoints] 引き換え処理に失敗しました', err)
        processedIdsRef.current.delete(redemptionId)
      }
    }

    const handleEventSubRedemption = (payload: ChannelPointRedemptionAddPayload) => {
      void processRedemption(
        payload.id,
        payload.reward.id,
        payload.reward.title,
        payload.user_id,
        payload.user_name,
        payload.redeemed_at,
        payload.status,
      )
    }

    const pollManageableRewards = async () => {
      if (cancelled) return
      try {
        if (rewardsCache.length === 0) {
          await refreshRewardCaches()
        }
        if (cancelled) return

        const targets = buildChannelPointPollTargets(config, rewardsCache).filter((t) =>
          manageableRewardIds.has(t.twitchRewardId),
        )

        for (const target of targets) {
          if (cancelled) break
          const redemptions = await twitchApi.getChannelPointRedemptions(
            broadcasterId,
            target.twitchRewardId,
            'UNFULFILLED',
          )
          for (const r of redemptions) {
            if (cancelled) break
            await processRedemption(
              r.id,
              target.twitchRewardId,
              r.reward?.title ?? '',
              r.user_id,
              r.user_name,
              r.redeemed_at,
              r.status,
            )
          }
        }
      } catch (err) {
        if (!cancelled) {
          const ax = err as { response?: { status?: number; data?: { message?: string } } }
          const msg = ax.response?.data?.message
          if (ax.response?.status === 401 && msg?.includes('Client ID')) {
            logger.error(
              '[ChannelPoints] OAuth トークンと Client ID が一致しません。トークンを再取得してください。',
              err,
            )
          } else if (ax.response?.status !== 403) {
            logger.warn('[ChannelPoints] ポーリングに失敗しました', err)
          }
        }
      } finally {
        if (!cancelled) {
          const sec = Math.max(2, Math.min(60, config.attack.channelPointsPollIntervalSec ?? 4))
          pollTimerId = setTimeout(pollManageableRewards, sec * 1000)
        }
      }
    }

    const start = async () => {
      try {
        await refreshRewardCaches()
        if (cancelled) return

        const targets = buildChannelPointPollTargets(config, rewardsCache)
        if (targets.length === 0) {
          logger.warn(
            '[ChannelPoints] 有効なリワードが見つかりません。表示名を Twitch のリワード名と一致させるか、リワード ID を指定してください。',
            rewardsCache.map((r) => r.title),
          )
        } else if (manageableRewardIds.size === 0) {
          logger.info(
            '[ChannelPoints] リワードは Twitch ダッシュボード作成のため EventSub で監視します（Helix ポーリングは使用しません）。',
          )
        }

        if (!eventSubStarted) {
          eventSubStarted = true
          eventSub = new TwitchEventSubWebSocket({
            broadcasterId,
            onRedemptionAdd: handleEventSubRedemption,
            onConnected: () => {
              logger.info('[ChannelPoints] EventSub 接続完了。引き換えを待機しています。')
            },
            onError: (message, err) => {
              if (!cancelled) logger.warn(`[ChannelPoints] ${message}`, err)
            },
          })
          eventSub.connect()
        }

        if (manageableRewardIds.size > 0) {
          void pollManageableRewards()
        }
      } catch (err) {
        if (!cancelled) {
          logger.warn('[ChannelPoints] 初期化に失敗しました（OAuth スコープを確認してください）', err)
        }
      }
    }

    void start()

    return () => {
      cancelled = true
      if (pollTimerId != null) clearTimeout(pollTimerId)
      eventSub?.disconnect()
      if (processedIdsRef.current.size > 2000) {
        const ids = Array.from(processedIdsRef.current)
        ids.slice(0, 1000).forEach((id) => processedIdsRef.current.delete(id))
      }
    }
  }, [config, broadcasterId, disabled])
}

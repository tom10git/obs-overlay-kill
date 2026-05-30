import {
  CHANNEL_POINT_ACTION_REWARD_IDS,
  type ChannelPointActionKind,
} from '../constants/channelPointActions'
import type { OverlayConfig } from '../types/overlay'
import type { TwitchChannelPointReward } from '../types/twitch'

export interface ChannelPointPollTarget {
  action: ChannelPointActionKind
  twitchRewardId: string
  internalRewardId: string
}

function resolveRewardId(
  configuredId: string,
  title: string,
  rewards: TwitchChannelPointReward[],
): string | null {
  const id = configuredId.trim()
  if (id) return id
  const t = title.trim()
  if (!t) return null
  const found = rewards.find((r) => r.title.trim().toLowerCase() === t.toLowerCase())
  return found?.id ?? null
}

/** いずれかのチャンネルポイント連携が有効か */
export function isAnyChannelPointActionEnabled(config: OverlayConfig): boolean {
  return (
    config.attack.channelPointsAttackEnabled ||
    config.heal.channelPointsHealEnabled ||
    config.retry.channelPointsReviveEnabled ||
    config.pvp.channelPointsStrengthBuffEnabled
  )
}

/** ポーリング対象の Twitch リワード ID 一覧を構築 */
export function buildChannelPointPollTargets(
  config: OverlayConfig,
  rewards: TwitchChannelPointReward[],
): ChannelPointPollTarget[] {
  const targets: ChannelPointPollTarget[] = []
  const used = new Set<string>()

  const add = (
    action: ChannelPointActionKind,
    enabled: boolean,
    rewardId: string,
    title: string,
  ) => {
    if (!enabled) return
    const twitchId = resolveRewardId(rewardId, title, rewards)
    if (!twitchId || used.has(twitchId)) return
    used.add(twitchId)
    targets.push({
      action,
      twitchRewardId: twitchId,
      internalRewardId: CHANNEL_POINT_ACTION_REWARD_IDS[action],
    })
  }

  add(
    'attack',
    config.attack.channelPointsAttackEnabled,
    config.attack.channelPointsRewardId,
    config.attack.channelPointsRewardTitle,
  )
  add(
    'heal',
    config.heal.channelPointsHealEnabled,
    config.heal.channelPointsHealRewardId,
    config.heal.channelPointsHealRewardTitle,
  )
  add(
    'revive',
    config.retry.channelPointsReviveEnabled,
    config.retry.channelPointsReviveRewardId,
    config.retry.channelPointsReviveRewardTitle,
  )
  add(
    'strength',
    config.pvp.channelPointsStrengthBuffEnabled,
    config.pvp.channelPointsStrengthBuffRewardId,
    config.pvp.channelPointsStrengthBuffRewardTitle,
  )

  return targets
}

export function findChannelPointPollTarget(
  targets: ChannelPointPollTarget[],
  twitchRewardId: string,
): ChannelPointPollTarget | undefined {
  return targets.find((t) => t.twitchRewardId === twitchRewardId)
}

/** EventSub / ポーリングで受け取った Twitch リワード ID を内部アクションに紐づける */
export function findChannelPointTargetForRedemption(
  config: OverlayConfig,
  rewards: TwitchChannelPointReward[],
  twitchRewardId: string,
  twitchTitle: string,
): ChannelPointPollTarget | null {
  const targets = buildChannelPointPollTargets(config, rewards)
  const byId = targets.find((t) => t.twitchRewardId === twitchRewardId)
  if (byId) return byId

  const normalizedTitle = twitchTitle.trim().toLowerCase()
  if (!normalizedTitle) return null

  const entries: Array<[ChannelPointActionKind, boolean, string, string]> = [
    ['attack', config.attack.channelPointsAttackEnabled, config.attack.channelPointsRewardId, config.attack.channelPointsRewardTitle],
    ['heal', config.heal.channelPointsHealEnabled, config.heal.channelPointsHealRewardId, config.heal.channelPointsHealRewardTitle],
    ['revive', config.retry.channelPointsReviveEnabled, config.retry.channelPointsReviveRewardId, config.retry.channelPointsReviveRewardTitle],
    [
      'strength',
      config.pvp.channelPointsStrengthBuffEnabled,
      config.pvp.channelPointsStrengthBuffRewardId,
      config.pvp.channelPointsStrengthBuffRewardTitle,
    ],
  ]

  for (const [action, enabled, configuredId, title] of entries) {
    if (!enabled) continue
    if (configuredId.trim() && configuredId.trim() === twitchRewardId) {
      return {
        action,
        twitchRewardId,
        internalRewardId: CHANNEL_POINT_ACTION_REWARD_IDS[action],
      }
    }
    if (title.trim().toLowerCase() === normalizedTitle) {
      return {
        action,
        twitchRewardId,
        internalRewardId: CHANNEL_POINT_ACTION_REWARD_IDS[action],
      }
    }
  }

  return null
}

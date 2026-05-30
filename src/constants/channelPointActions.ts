/** チャンネルポイント引き換え → 内部ハンドラへ渡す rewardId（Twitch の reward UUID とは別） */

export const CHANNEL_POINT_REWARD_ATTACK = 'channel-points-attack' as const
export const CHANNEL_POINT_REWARD_HEAL = 'channel-points-heal' as const
export const CHANNEL_POINT_REWARD_REVIVE = 'channel-points-revive' as const
export const CHANNEL_POINT_REWARD_STRENGTH = 'channel-points-strength' as const

export type ChannelPointActionKind = 'attack' | 'heal' | 'revive' | 'strength'

export const CHANNEL_POINT_ACTION_REWARD_IDS: Record<ChannelPointActionKind, string> = {
  attack: CHANNEL_POINT_REWARD_ATTACK,
  heal: CHANNEL_POINT_REWARD_HEAL,
  revive: CHANNEL_POINT_REWARD_REVIVE,
  strength: CHANNEL_POINT_REWARD_STRENGTH,
}

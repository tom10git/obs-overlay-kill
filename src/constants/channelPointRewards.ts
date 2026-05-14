/**
 * チャンネルポイント経由で handleAttackEvent / handleHealEvent / 蘇生処理に渡す内部 rewardId
 * （Twitch のカスタムリワード UUID とは別）
 */
export const CHANNEL_POINT_STREAMER_ATTACK_REWARD_ID = 'channel-point-streamer-attack' as const
export const CHANNEL_POINT_STREAMER_HEAL_REWARD_ID = 'channel-point-streamer-heal' as const
export const CHANNEL_POINT_STREAMER_REVIVE_REWARD_ID = 'channel-point-streamer-revive' as const

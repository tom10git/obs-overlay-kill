/**
 * TanStack Query の queryKey を一元管理
 */

export const overlayConfigQueryKey = ['overlayConfig'] as const

export const twitchUserQueryKey = (login: string) => ['twitchUser', login] as const

export const twitchStreamQueryKey = (userLogin: string) => ['twitchStream', userLogin] as const

export const twitchChannelQueryKey = (userId: string) => ['twitchChannel', userId] as const

export const twitchVideosQueryKey = (userId: string, limit: number) =>
  ['twitchVideos', userId, limit] as const

export const twitchClipsQueryKey = (broadcasterId: string, limit: number) =>
  ['twitchClips', broadcasterId, limit] as const

export const twitchFollowersQueryKey = (userId: string, limit: number) =>
  ['twitchFollowers', userId, limit] as const

export const twitchEmotesQueryKey = (broadcasterId: string) => ['twitchEmotes', broadcasterId] as const

export const twitchChatBadgesQueryKey = (broadcasterId: string) =>
  ['twitchChatBadges', broadcasterId] as const

export const twitchChannelPointRewardsQueryKey = (broadcasterId: string, onlyManageable: boolean) =>
  ['twitchChannelPointRewards', broadcasterId, onlyManageable] as const

export const twitchChannelPointRedemptionsQueryKey = (
  broadcasterId: string,
  rewardId: string,
  status: 'UNFULFILLED' | 'FULFILLED' | 'CANCELED' | undefined,
  limit: number,
  sort: 'OLDEST' | 'NEWEST'
) => ['twitchChannelPointRedemptions', broadcasterId, rewardId, status ?? 'all', limit, sort] as const

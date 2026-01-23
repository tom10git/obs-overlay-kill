// Twitch API レスポンスの型定義

export interface TwitchUser {
  id: string
  login: string
  display_name: string
  type: string
  broadcaster_type: string
  description: string
  profile_image_url: string
  offline_image_url: string
  view_count: number
  created_at: string
}

export interface TwitchStream {
  id: string
  user_id: string
  user_login: string
  user_name: string
  game_id: string
  game_name: string
  type: string
  title: string
  viewer_count: number
  started_at: string
  language: string
  thumbnail_url: string
  tag_ids: string[]
  is_mature: boolean
}

export interface TwitchGame {
  id: string
  name: string
  box_art_url: string
  igdb_id?: string
}

export interface TwitchApiResponse<T> {
  data: T[]
}

export interface TwitchTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
  refresh_token?: string
  scope?: string[]
}

export interface TwitchChannel {
  broadcaster_id: string
  broadcaster_login: string
  broadcaster_name: string
  broadcaster_language: string
  game_id: string
  game_name: string
  title: string
  delay: number
  tags: string[]
  content_classification_labels: string[]
  is_branded_content: boolean
}

export interface TwitchChannelInformation {
  broadcaster_id: string
  broadcaster_login: string
  broadcaster_name: string
  broadcaster_language: string
  game_id: string
  game_name: string
  title: string
  delay: number
}

export interface TwitchVideo {
  id: string
  stream_id: string | null
  user_id: string
  user_login: string
  user_name: string
  title: string
  description: string
  created_at: string
  published_at: string
  url: string
  thumbnail_url: string
  viewable: string
  view_count: number
  language: string
  type: string
  duration: string
  muted_segments: Array<{
    duration: number
    offset: number
  }> | null
}

export interface TwitchClip {
  id: string
  url: string
  embed_url: string
  broadcaster_id: string
  broadcaster_name: string
  creator_id: string
  creator_name: string
  video_id: string
  game_id: string
  language: string
  title: string
  view_count: number
  created_at: string
  thumbnail_url: string
  duration: number
  vod_offset: number | null
  is_featured: boolean
}

export interface TwitchEmote {
  id: string
  name: string
  images: {
    url_1x: string
    url_2x: string
    url_4x: string
  }
  tier: string
  emote_type: string
  emote_set_id: string
  format: string[]
  scale: string[]
  theme_mode: string[]
}

export interface TwitchFollower {
  user_id: string
  user_login: string
  user_name: string
  followed_at: string
}

export interface TwitchFollowerResponse {
  total: number
  data: TwitchFollower[]
  pagination?: {
    cursor?: string
  }
}

export interface TwitchChatBadge {
  set_id: string
  versions: Array<{
    id: string
    image_url_1x: string
    image_url_2x: string
    image_url_4x: string
    title: string
    description: string
    click_action: string | null
    click_url: string | null
  }>
}

export interface TwitchApiPaginatedResponse<T> {
  data: T[]
  pagination?: {
    cursor?: string
  }
}

export interface TwitchChatMessage {
  id: string
  user: {
    id: string
    login: string
    displayName: string
    color: string
    badges: Record<string, string>
    isMod: boolean
    isSubscriber: boolean
    isVip: boolean
  }
  message: string
  timestamp: number
  channel: string
  emotes?: Array<{
    id: string
    name: string
    positions: Array<{ start: number; end: number }>
  }>
}

export interface TwitchChannelPointReward {
  id: string
  broadcaster_id: string
  broadcaster_login: string
  broadcaster_name: string
  title: string
  prompt: string
  cost: number
  image?: {
    url_1x: string
    url_2x: string
    url_4x: string
  }
  default_image: {
    url_1x: string
    url_2x: string
    url_4x: string
  }
  background_color: string
  is_enabled: boolean
  is_user_input_required: boolean
  max_per_stream_setting?: {
    is_enabled: boolean
    max_per_stream: number
  }
  max_per_user_per_stream_setting?: {
    is_enabled: boolean
    max_per_user_per_stream: number
  }
  global_cooldown_setting?: {
    is_enabled: boolean
    global_cooldown_seconds: number
  }
  is_paused: boolean
  is_in_stock: boolean
  should_redemptions_skip_request_queue: boolean
  redemptions_redeemed_current_stream: number | null
  cooldown_expires_at: string | null
}

export interface TwitchChannelPointRedemption {
  id: string
  broadcaster_id: string
  broadcaster_login: string
  broadcaster_name: string
  user_id: string
  user_login: string
  user_name: string
  user_input: string
  status: 'UNFULFILLED' | 'FULFILLED' | 'CANCELED'
  redeemed_at: string
  reward: {
    id: string
    title: string
    prompt: string
    cost: number
  }
}

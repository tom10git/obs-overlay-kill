/**
 * OBS Overlay HP Gauge System の型定義
 */

export interface HPConfig {
  max: number
  current: number
  gaugeCount: number
}

export interface AttackConfig {
  rewardId: string
  enabled: boolean
  damage: number
  missEnabled: boolean
  missProbability: number // 0-100
}

export interface HealConfig {
  rewardId: string
  enabled: boolean
  healType: 'fixed' | 'random'
  healAmount: number // fixed の場合
  healMin: number // random の場合
  healMax: number // random の場合
}

export interface RetryConfig {
  command: string
  enabled: boolean
}

export interface AnimationConfig {
  duration: number // ミリ秒
  easing: string
}

export interface DisplayConfig {
  showMaxHp: boolean
  fontSize: number
}

export interface ZeroHpImageConfig {
  enabled: boolean
  imageUrl: string
}

export interface ZeroHpSoundConfig {
  enabled: boolean
  soundUrl: string
  volume: number
}

export interface ZeroHpEffectConfig {
  enabled: boolean
  videoUrl: string // 透過WebM動画のURL（GIFの代わり）
  loop: boolean
  duration: number // ミリ秒（ループしない場合の表示時間）
}

export interface TestConfig {
  enabled: boolean
}

export interface OverlayConfig {
  hp: HPConfig
  attack: AttackConfig
  heal: HealConfig
  retry: RetryConfig
  animation: AnimationConfig
  display: DisplayConfig
  zeroHpImage: ZeroHpImageConfig
  zeroHpSound: ZeroHpSoundConfig
  zeroHpEffect: ZeroHpEffectConfig
  test: TestConfig
}

export interface ChannelPointEvent {
  id: string
  rewardId: string
  userId: string
  userName: string
  redeemedAt: string
  status: 'UNFULFILLED' | 'FULFILLED' | 'CANCELED'
}

export interface GaugeLayer {
  id: string
  color: string
  percentage: number
}

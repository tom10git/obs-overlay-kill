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
  customText: string // チャットメッセージで判定するカスタムテキスト（App Access Token用）
  enabled: boolean
  damage: number
  missEnabled: boolean
  missProbability: number // 0-100
  criticalEnabled: boolean
  criticalProbability: number // 0-100
  criticalMultiplier: number // クリティカル時のダメージ倍率（例: 2.0 = 2倍）
}

export interface HealConfig {
  rewardId: string
  customText: string // チャットメッセージで判定するカスタムテキスト（App Access Token用）
  enabled: boolean
  effectEnabled: boolean // 回復エフェクト（パーティクル）の表示/非表示
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
  duration: number // ミリ秒（表示時間）
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

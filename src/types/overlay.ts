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
  missSoundEnabled: boolean // ミス効果音の有効/無効
  missSoundUrl: string // ミス効果音のURL
  missSoundVolume: number // ミス効果音の音量（0-1）
  criticalEnabled: boolean
  criticalProbability: number // 0-100
  criticalMultiplier: number // クリティカル時のダメージ倍率（例: 2.0 = 2倍）
  bleedEnabled: boolean // 出血ダメージ機能の有効/無効
  bleedProbability: number // 出血ダメージの発生確率（0-100）
  bleedDamage: number // 出血ダメージの量
  bleedDuration: number // 出血ダメージの持続時間（秒）
  bleedInterval: number // 出血ダメージの間隔（秒）
  bleedSoundEnabled: boolean // 出血ダメージ効果音の有効/無効
  bleedSoundUrl: string // 出血ダメージ効果音のURL
  bleedSoundVolume: number // 出血ダメージ効果音の音量（0-1）
  soundEnabled: boolean // 攻撃効果音の有効/無効
  soundUrl: string // 攻撃効果音のURL
  soundVolume: number // 攻撃効果音の音量（0-1）
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
  soundEnabled: boolean // 回復効果音の有効/無効
  soundUrl: string // 回復効果音のURL
  soundVolume: number // 回復効果音の音量（0-1）
}

export interface RetryConfig {
  command: string
  enabled: boolean
  soundEnabled: boolean // 蘇生効果音の有効/無効
  soundUrl: string // 蘇生効果音のURL
  soundVolume: number // 蘇生効果音の音量（0-1）
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

/**
 * OBS Overlay HP Gauge System の型定義
 */

export interface HPConfig {
  max: number
  current: number
  gaugeCount: number
  x: number // 位置X（px、中央からのオフセット）
  y: number // 位置Y（px、中央からのオフセット）
  width: number // ゲージの幅（px）
  height: number // ゲージの高さ（px）
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
  filterEffectEnabled: boolean // 攻撃時のフィルターエフェクトの有効/無効
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
  filterEffectEnabled: boolean // 回復時のフィルターエフェクトの有効/無効
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

export interface GaugeColorConfig {
  lastGauge: string // 最後の1ゲージ（HPが最後に残る分）の色
  secondGauge: string // 2ゲージ目の色
  patternColor1: string // 3ゲージ目以降の交互パターン1（3, 5, 7, 9...ゲージ目）
  patternColor2: string // 3ゲージ目以降の交互パターン2（4, 6, 8, 10...ゲージ目）
}

export interface DamageColorConfig {
  normal: string // 通常ダメージの色
  critical: string // クリティカルダメージの色
  bleed: string // 出血ダメージの色
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

export interface ExternalWindowConfig {
  enabled: boolean
  x: number // 位置X（px）
  y: number // 位置Y（px）
  width: number // 幅（px）
  height: number // 高さ（px）
  opacity: number // 透明度（0-1）
  zIndex: number // z-index（HPゲージより後ろに配置するため低めの値）
}

export interface WebMLoopConfig {
  enabled: boolean
  x: number // 位置X（px、中央からのオフセット）
  y: number // 位置Y（px、中央からのオフセット）
  width: number // 幅（px）
  height: number // 高さ（px）
  opacity: number // 透明度（0-1）
  zIndex: number // z-index（外部ウィンドウと同じ値）
  videoUrl: string // WebM動画のURL
  loop: boolean // ループ再生するか
}

export interface EffectFilterConfig {
  sepia: number // 0-1
  hueRotate: number // 0-360度
  saturate: number // 0-2
  brightness: number // 0-2
  contrast: number // 0-2
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
  externalWindow: ExternalWindowConfig
  webmLoop: WebMLoopConfig
  damageEffectFilter: EffectFilterConfig // ダメージエフェクトのフィルター設定
  healEffectFilter: EffectFilterConfig // 回復エフェクトのフィルター設定
  gaugeColors: GaugeColorConfig // HPゲージの色設定
  damageColors: DamageColorConfig // ダメージ値の色設定
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

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
  /** 配信者HPが0になったときにチャットへ送る自動返信メッセージ。{attacker} で攻撃した視聴者名に置換（空なら送信しない） */
  messageWhenZeroHp: string
}

export interface AttackConfig {
  rewardId: string
  customText: string // チャットメッセージで判定するカスタムテキスト（App Access Token用）
  enabled: boolean
  /** ダメージタイプ: 固定 or ランダム（回復量の healType と同様） */
  damageType?: 'fixed' | 'random'
  /** 固定時のダメージ量。ランダム時は damageMin〜damageMax の範囲で刻みに従い決定 */
  damage: number
  /** ランダム時の最小ダメージ */
  damageMin?: number
  /** ランダム時の最大ダメージ */
  damageMax?: number
  /** ランダム時の刻み（1のときは最小〜最大の連続値。50なら 50,100,150... のいずれか） */
  damageRandomStep?: number
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
  survivalHp1Enabled: boolean // 攻撃でHPが0になる場合に一定確率で1残す機能の有効/無効
  survivalHp1Probability: number // HPが1残る確率（0-100）
  survivalHp1Message: string // 食いしばり発動時に表示するカスタムメッセージ
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
  /** random 時の刻み（例: 50 → 50,100,150... のいずれか。1 のときは min～max の連続値） */
  healRandomStep: number
  soundEnabled: boolean // 回復効果音の有効/無効
  soundUrl: string // 回復効果音のURL
  soundVolume: number // 回復効果音の音量（0-1）
  filterEffectEnabled: boolean // 回復時のフィルターエフェクトの有効/無効
  healWhenZeroEnabled: boolean // HPが0のときも通常回復を許可する
  /** 回復コマンド（チャンネルポイント）使用時にチャットへ自動返信する */
  autoReplyEnabled: boolean
  /** 回復時自動返信メッセージ。{hp} {max} で置換（攻撃時と同様） */
  autoReplyMessageTemplate: string
}

export interface RetryConfig {
  command: string
  /** 配信者側の自動返信（配信者HP0時などにチャットへメッセージを送る） */
  streamerAutoReplyEnabled: boolean
  /** 配信者側の全回復コマンド（配信者が実行するとHPを最大まで回復） */
  fullHealCommand: string
  /** 配信者・全員を全回復するコマンド（配信者のみ実行可能・配信者HPと全視聴者HPを最大まで回復） */
  fullResetAllCommand: string
  /** 配信者側の通常回復コマンド（設定量だけ回復） */
  streamerHealCommand: string
  /** 配信者側の回復量タイプ（固定 or ランダム） */
  streamerHealType: 'fixed' | 'random'
  /** 配信者側の回復量（fixed 時） */
  streamerHealAmount: number
  /** 配信者側の回復量（random 時の最小） */
  streamerHealMin: number
  /** 配信者側の回復量（random 時の最大） */
  streamerHealMax: number
  /** 配信者側のランダム回復の刻み（例: 50 → 50,100,150...。1 のときは min～max の連続値） */
  streamerHealRandomStep: number
  /** 配信者HPが0のときも通常回復コマンドを許可する */
  streamerHealWhenZeroEnabled: boolean
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

/** PvPモード: 配信者 vs 視聴者。視聴者ごとにHPを管理し、配信者のカウンター攻撃などを行う */
export interface PvPConfig {
  enabled: boolean
  /** 攻撃・カウンター時の自動返信（HP表示メッセージ） */
  autoReplyAttackCounter: boolean
  /** 視聴者HPが0になったときの自動返信メッセージを送る */
  autoReplyWhenViewerZeroHp: boolean
  /** HP確認コマンドの自動返信 */
  autoReplyHpCheck: boolean
  /** 全回復コマンドの自動返信 */
  autoReplyFullHeal: boolean
  /** 通常回復コマンドの自動返信（視聴者!healで回復設定を使わない場合のPvPテンプレート返信） */
  autoReplyHeal: boolean
  /** HP0ブロック時の自動返信（「攻撃できません」「回復できません」） */
  autoReplyBlockedByZeroHp: boolean
  /** 視聴者1人あたりの最大HP（ユーザー側のHP量） */
  viewerMaxHp: number
  /** 配信者側の攻撃設定（カウンター攻撃に使用。視聴者用攻撃設定とは別） */
  streamerAttack: AttackConfig
  /** カウンター攻撃を発動するカスタムコマンド（配信者のみ実行可能） */
  counterCommand: string
  /** 攻撃時にチャットへ投稿するメッセージ。{username} {hp} {max} が置換される */
  autoReplyMessageTemplate: string
  /** 視聴者が自分のHPを確認するカスタムコマンド */
  hpCheckCommand: string
  /** 視聴者が自分のHPを全回復するカスタムコマンド（実行した視聴者のHPを最大まで回復） */
  viewerFullHealCommand: string
  /** 視聴者側の通常回復コマンド（実行した視聴者のHPを設定量だけ回復） */
  viewerHealCommand: string
  /** 視聴者側の回復量タイプ（固定 or ランダム） */
  viewerHealType: 'fixed' | 'random'
  /** 視聴者側の回復量（fixed 時） */
  viewerHealAmount: number
  /** 視聴者側の回復量（random 時の最小） */
  viewerHealMin: number
  /** 視聴者側の回復量（random 時の最大） */
  viewerHealMax: number
  /** 視聴者側のランダム回復の刻み（例: 50 → 50,100,150...。1 のときは min～max の連続値） */
  viewerHealRandomStep: number
  /** 視聴者HPが0のときも通常回復コマンドを許可する */
  viewerHealWhenZeroEnabled: boolean
  /** 視聴者が攻撃したとき、攻撃者にカウンターする（初期設定・デフォルトON） */
  counterOnAttackTargetAttacker: boolean
  /** 視聴者が攻撃したとき、ランダムなユーザーにカウンターする（counterOnAttackTargetAttacker より優先されない） */
  counterOnAttackTargetRandom: boolean
  /** カウンターコマンドでユーザー名を指定して攻撃できる（!counter ユーザー名） */
  counterCommandAcceptsUsername: boolean
  /** HPが0のときに攻撃をブロックしたときの自動返信メッセージ */
  messageWhenAttackBlockedByZeroHp: string
  /** HPが0のときに回復をブロックしたときの自動返信メッセージ */
  messageWhenHealBlockedByZeroHp: string
  /** 視聴者HPが0になったときにチャットへ送る自動返信メッセージ。{username} で対象の表示名に置換 */
  messageWhenViewerZeroHp: string
  /**
   * 攻撃モード: 配信者 vs 視聴者のみ / 両方（視聴者同士の攻撃も有効）
   * - streamer_only: 視聴者同士の攻撃は無効。配信者への攻撃とカウンターのみ。
   * - both: 配信者 vs 視聴者に加え、視聴者同士の攻撃も有効。
   */
  attackMode: 'streamer_only' | 'both'
  /** 視聴者が別の視聴者を攻撃するコマンド（例: !attack ユーザー名）。attackMode が both のときのみ有効。 */
  viewerAttackViewerCommand: string
  /** 視聴者同士の攻撃時のダメージ・ミス・クリティカル等の設定 */
  viewerVsViewerAttack: AttackConfig
  /** 視聴者が攻撃したときに一定確率で配信者HPが回復する（攻撃が「反転」して回復になる） */
  streamerHealOnAttackEnabled: boolean
  /** 上記の発生確率（0-100） */
  streamerHealOnAttackProbability: number
  /** 上記の回復量タイプ（固定 or ランダム） */
  streamerHealOnAttackType?: 'fixed' | 'random'
  /** 固定時の回復量 */
  streamerHealOnAttackAmount: number
  /** ランダム時の最小回復量 */
  streamerHealOnAttackMin?: number
  /** ランダム時の最大回復量 */
  streamerHealOnAttackMax?: number
  /** ランダム時の刻み（1のときは最小～最大の連続値） */
  streamerHealOnAttackRandomStep?: number
  /** ストレングスバフコマンド（視聴者が実行するとストレングス効果を付与） */
  strengthBuffCommand: string
  /** バフ確認コマンド（視聴者が自分のバフ状態を確認） */
  strengthBuffCheckCommand: string
  /** ストレングスバフの効果時間（秒、デフォルト300秒=5分）。UIでは分単位で設定される */
  strengthBuffDuration: number
  /** ストレングスバフの対象（個人用 or 全員用） */
  strengthBuffTarget: 'individual' | 'all'
  /** ストレングスバフコマンド実行時の自動返信の有無 */
  autoReplyStrengthBuff: boolean
  /** バフ確認コマンド実行時の自動返信の有無 */
  autoReplyStrengthBuffCheck: boolean
  /** ストレングスバフが有効になったときの自動返信メッセージ。{username} {duration} で置換 */
  messageWhenStrengthBuffActivated: string
  /** バフ確認時の自動返信メッセージ。{username} {remaining} {duration} で置換 */
  messageWhenStrengthBuffCheck: string
  /** ストレングスバフ効果音の有効/無効 */
  strengthBuffSoundEnabled: boolean
  /** ストレングスバフ効果音のURL */
  strengthBuffSoundUrl: string
  /** ストレングスバフ効果音の音量（0-1） */
  strengthBuffSoundVolume: number
  /** 視聴者側の攻撃で必殺技を発動する（隠し機能） */
  viewerFinishingMoveEnabled: boolean
  /** 必殺技の発動確率（0-100、デフォルト0.001） */
  viewerFinishingMoveProbability: number
  /** 必殺技のダメージ倍率（デフォルト10倍） */
  viewerFinishingMoveMultiplier: number
  /** 必殺技発動時の自動返信メッセージ。{username} {damage} で置換 */
  messageWhenViewerFinishingMove: string
  /** 必殺技発動時の自動返信の有無 */
  autoReplyViewerFinishingMove: boolean
  /** 必殺技発動時に表示するテキスト（デフォルト: "必殺技！"） */
  finishingMoveText: string
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
  pvp: PvPConfig
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

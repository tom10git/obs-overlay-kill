/**
 * 技ごとの演出プリセット（見た目の構造・アニメが異なる）
 * 未登録の技名は hash でフォールバック。
 */

import type { CSSProperties } from 'react'
import {
  COMBO_TECHNIQUE_NAMES,
  MAGIC_TECHNIQUE_NAMES,
  SHOOTING_TECHNIQUE_NAMES,
  SLASH_TECHNIQUE_NAMES,
} from './comboTechniqueNames'

/** 技名が needles のいずれかを部分一致で含むか（get*Kind と語彙アクセントで共用） */
export function techniqueNameHitsAny(name: string, needles: readonly string[]): boolean {
  return needles.some((n) => name.includes(n))
}

/** 回路系（斬撃は追加マーカーあり）— 語彙アクセントは slash 側を参照 */
export const TECHNIQUE_EFFECT_CYBER_NAME_PARTS = {
  slash: ['サイバー', 'デジタル', '回路', 'ネオン', 'マトリックス', 'マトリクス'] as const,
  magicOrShooting: ['サイバー', 'デジタル', '回路'] as const,
} as const

const BLOODTIDE_SLASH_PARTS = ['血潮', '血海', '流血', '血刃', 'ブラッド', '吸血'] as const
const BLOODTIDE_MAGIC_PARTS = ['血潮', '血海', '流血', 'ブラッド', '吸血'] as const
const BLOODTIDE_SHOOTING_PARTS = ['血潮', '血弾', '流血', 'ブラッド'] as const

const DUNE_SLASH_OR_MAGIC_PARTS = ['砂漠', '砂丘', '砂塵', 'サハラ', '烈日', 'オアシス', '乾燥'] as const
const DUNE_SHOOTING_PARTS = ['砂漠', '砂塵', '砂丘', '乾砂'] as const

/** 語彙アクセント（斬撃・魔法・射撃のマーカー和集合）— techniqueBurstArtDraw と同期 */
export const TECHNIQUE_NAME_ACCENT_BLOODTIDE_PARTS = [
  '血潮',
  '血海',
  '流血',
  '血刃',
  'ブラッド',
  '吸血',
  '血弾',
] as const
export const TECHNIQUE_NAME_ACCENT_DUNE_PARTS = [
  '砂漠',
  '砂丘',
  '砂塵',
  'サハラ',
  '烈日',
  'オアシス',
  '乾燥',
  '乾砂',
] as const

/** 斬撃／魔法／射撃で同一判定のテーマ語 */
export const TECHNIQUE_EFFECT_THEME_MARKERS = {
  rustbound: ['錆', '酸化', '鉄錆'],
  canopy: ['雨林', '密林', '樹海', '蔦', 'ジャングル'],
  abyssal: ['深海', '海溝', '溺潮', '淵海', '海底'],
  cogwork: ['機械神', '歯車', '蒸気', '真鍮', 'ボイラー', '時計塔'],
  constellation: ['星座', '星列', '天球', '星図', '黄道'],
} as const

export const TECHNIQUE_EFFECT_SANCTUM_MARKERS = {
  slash: ['神殿', '神域', '聖域', '聖堂', '天壇', '柱廊'],
  magic: ['神殿', '神域', '聖域', '聖堂', '天壇', '柱廊', '教会'],
  shooting: ['神殿', '聖域', '聖堂'],
} as const

export type TechniqueEffectKind =
  | 'inferno'
  | 'meteor'
  | 'void'
  | 'tempest'
  | 'glacier'
  | 'plasma'
  | 'radiance'
  | 'tremor'
  | 'phantom'
  | 'nova'
  /** 極光帯・流れる彩り（炎/雷/幻影とは別モチーフ） */
  | 'aurora'
  /** 花弁・有機的光（幻影の紫気とは質感が異なる） */
  | 'blossom'
  /** 縦スクロールする回路／デジタル雨（プラズマの六角系とは別） */
  | 'circuit'
  /** 毒・瘴・粘液の沸き・泡（虚空の渦とは別） */
  | 'mire'
  /** 血潮・流血（炎の赤とは質感が異なる） */
  | 'bloodtide'
  /** 砂漠・熱波・砂塵 */
  | 'dune'
  /** 神殿・聖域（radiance の白光とは柱・金箔の質感が異なる） */
  | 'sanctum'
  /** 雨林・樹冠・蔦（blossom の花弁とは別の濃緑の層） */
  | 'canopy'
  /** 深海・沈み・青黒い水塊（void の深淵語より「水」の質感） */
  | 'abyssal'
  /** 歯車・蒸気・真鍮（circuit のデジタル雨とは別の機械神話） */
  | 'cogwork'
  /** 星座・星図・天球（nova の爆発星とは静かな連線） */
  | 'constellation'
  /** 錆・酸化・朽ちた金属（dune の砂とは別の酸化膜） */
  | 'rustbound'

function getSlashKind(name: string): TechniqueEffectKind {
  // 固定枠を含む「長い名前の固有技」を先に（部分一致が短い語だけに寄らないよう）
  if (name.includes('鉄蟲')) return 'phantom'
  // 桜花単独は森羅／華やか寄り（鉄蟲桜は上で phantom のまま）
  if (name.includes('桜花')) return 'blossom'

  if (name.includes('オーロラ') || name.includes('レインボー') || name.includes('ベール'))
    return 'aurora'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_CYBER_NAME_PARTS.slash)) return 'circuit'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.rustbound)) return 'rustbound'
  if (name.includes('瘴') || name.includes('毒') || name.includes('アシッド') || name.includes('腐')) return 'mire'

  // 血系は「紅」より先に（紅血などで炎に寄せない）
  if (techniqueNameHitsAny(name, BLOODTIDE_SLASH_PARTS)) return 'bloodtide'
  if (techniqueNameHitsAny(name, DUNE_SLASH_OR_MAGIC_PARTS)) return 'dune'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_SANCTUM_MARKERS.slash)) return 'sanctum'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.canopy)) return 'canopy'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.abyssal)) return 'abyssal'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.cogwork)) return 'cogwork'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.constellation)) return 'constellation'

  if (name.includes('飛翔竜') || name.includes('降竜')) return 'nova'
  if (name.includes('飛円')) return 'tempest'
  if (name.includes('竜杭') || name.includes('竜撃砲')) return 'inferno'
  if (name.includes('超高出力') || name.includes('高出力')) return 'inferno'
  if (
    name.includes('属性解放斬り') ||
    name.includes('解放突き') ||
    // 生成プールの head「属性解放」と語尾の組み合わせ用
    name.includes('零距離属性解放')
  )
    return 'inferno'
  if (name.includes('零距離')) return 'inferno'
  if (name.includes('真・溜め') || name.includes('強溜め')) return 'inferno'
  if (name.includes('居合')) return 'radiance'
  if (name.includes('剛刃')) return 'radiance'
  if (name.includes('流転')) return 'tempest'
  if (name.includes('兜割')) return 'tremor'

  // カタカナ頭で属性寄せ（語尾での kind 上書きはしない／見せ方は slashVariant と Canvas で足す）
  if (name.includes('ブラック')) return 'void'

  // 斬撃タイプの中でも見た目が単調にならないよう、技名の語彙で種別を振り分ける
  if (name.includes('紅')) return 'inferno'
  if (name.includes('クリムゾン') || name.includes('インフェルノ')) return 'inferno'
  if (name.includes('蒼')) return 'glacier'
  if (name.includes('アズール') || name.includes('フロスト')) return 'glacier'
  if (name.includes('雷') || name.includes('風')) return 'tempest'
  if (name.includes('ライジン') || name.includes('ウィンド') || name.includes('テンペスト')) return 'tempest'
  if (name.includes('影') || name.includes('黒')) return 'void'
  if (name.includes('ヴォイド')) return 'void'
  if (name.includes('白') || name.includes('月')) return 'radiance'
  if (name.includes('ムーンライト') || name.includes('ホワイト')) return 'radiance'
  if (name.includes('花刃') || name.includes('桜') || (name.includes('華') && !name.includes('氷')))
    return 'blossom'

  if (name.includes('虎') || name.includes('金剛')) return 'tremor'
  if (name.includes('龍')) return 'nova'
  if (name.includes('ノヴァ') || name.includes('アーク')) return 'nova'
  if (name.includes('ブレイド')) return 'phantom'
  if (name.includes('シャドウ')) return 'phantom'
  if (name.includes('シャドー') || name.includes('ファントム')) return 'phantom'
  return 'tremor'
}

function getMagicKind(name: string): TechniqueEffectKind {
  if (name.includes('カワイソウニ')) return 'phantom'

  // 術式の「役割」語を先に（頭語より副作用が分かりやすいもの）
  if (name.includes('カース')) return 'void'
  if (name.includes('ブレッシング') || name.includes('チャーム')) return 'radiance'
  if (name.includes('ゲート')) return 'void'
  if (name.includes('ブースト')) return 'plasma'

  if (name.includes('オーロラ') || name.includes('極光')) return 'aurora'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_CYBER_NAME_PARTS.magicOrShooting)) return 'circuit'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.rustbound)) return 'rustbound'
  if (name.includes('毒') || name.includes('瘴') || name.includes('菌') || name.includes('疫病')) return 'mire'

  if (techniqueNameHitsAny(name, BLOODTIDE_MAGIC_PARTS)) return 'bloodtide'
  if (techniqueNameHitsAny(name, DUNE_SLASH_OR_MAGIC_PARTS)) return 'dune'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_SANCTUM_MARKERS.magic)) return 'sanctum'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.canopy)) return 'canopy'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.abyssal)) return 'abyssal'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.cogwork)) return 'cogwork'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.constellation)) return 'constellation'

  if (name.includes('星詠') || name.includes('アストラ')) return 'nova'
  if (name.includes('ネビュラ') || name.includes('セレスティア') || name.includes('アストラル')) return 'nova'
  if (name.includes('深淵') || name.includes('虚無')) return 'void'
  if (name.includes('エクリプス') || name.includes('カオス') || name.includes('ゼロ') || name.includes('ノクターン'))
    return 'void'
  if (name.includes('聖光') || name.includes('月詠')) return 'radiance'
  if (name.includes('ルミナ') || name.includes('プリズム') || name.includes('オラクル'))
    return 'radiance'

  if (name.includes('氷華')) return 'glacier'
  if (name.includes('芽') || name.includes('花') || (name.includes('華') && !name.includes('氷'))) return 'blossom'

  if (name.includes('雷帝')) return 'tempest'
  if (name.includes('焔王')) return 'inferno'
  if (name.includes('ソラリス')) return 'inferno'
  if (name.includes('霊峰')) return 'tremor'
  if (name.includes('ルーン') || name.includes('秘儀')) return 'plasma'
  if (
    name.includes('エーテル') ||
    name.includes('アーケイン') ||
    name.includes('グリモア') ||
    name.includes('マナ') ||
    name.includes('スピリット')
  )
    return 'plasma'
  if (name.includes('ミラージュ') || name.includes('シンフォニア')) return 'phantom'

  // チャント／キャストは「詠唱の光」と「術式回路」（幻惑系 head より後ろで判定）
  if (name.includes('チャント')) return 'radiance'
  if (name.includes('キャスト')) return 'plasma'

  return 'radiance'
}

function getShootingKind(name: string): TechniqueEffectKind {
  // 大技語尾・弾種（MH 固有枠との兼用）
  if (
    name.includes('竜撃弾') ||
    name.includes('竜熱') ||
    name.includes('エクスプロード') ||
    name.includes('オーバードライブ')
  )
    return 'inferno'

  // 名前由来の質感レイヤーを細かく分岐
  if (
    name.includes('流星') ||
    name.includes('彗星') ||
    name.includes('銀河') ||
    name.includes('メテオ')
  )
    return 'meteor'

  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_CYBER_NAME_PARTS.magicOrShooting)) return 'circuit'
  if (name.includes('オーロラ')) return 'aurora'
  if (name.includes('毒') || name.includes('瘴')) return 'mire'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.rustbound)) return 'rustbound'

  if (techniqueNameHitsAny(name, BLOODTIDE_SHOOTING_PARTS)) return 'bloodtide'
  if (techniqueNameHitsAny(name, DUNE_SHOOTING_PARTS)) return 'dune'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_SANCTUM_MARKERS.shooting)) return 'sanctum'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.canopy)) return 'canopy'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.abyssal)) return 'abyssal'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.cogwork)) return 'cogwork'
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.constellation)) return 'constellation'

  if (name.includes('曲射')) return 'meteor'
  if (name.includes('閃光') || name.includes('白夜')) return 'radiance'
  if (name.includes('フォトン')) return 'radiance'
  if (name.includes('ヘイル')) return 'glacier'
  if (name.includes('烈火')) return 'inferno'
  if (name.includes('徹甲') || name.includes('スタンピード')) return 'tremor'
  if (name.includes('斬裂')) return 'phantom'

  if (name.includes('雷鳴')) return 'tempest'
  if (name.includes('ブリッツ')) return 'tempest'

  if (name.includes('黒翼')) return 'void'
  if (
    name.includes('ブラックアウト') ||
    name.includes('スモーク') ||
    name.includes('ホワイトノイズ')
  )
    return 'void'

  // ロックオン／精密射撃は「視界収束」より void/phantom 寄せ
  if (name.includes('ロックオン')) return 'phantom'
  if (name.includes('スナイプ')) return 'phantom'

  if (
    name.includes('フルオート') ||
    name.includes('ラピッド') ||
    name.includes('チェイン') ||
    name.includes('スプレッド')
  )
    return 'plasma'

  if (name.includes('ストライカー')) return 'plasma'
  if (name.includes('ハンター')) return 'tremor'
  if (name.includes('金剛') || name.includes('スティール') || name.includes('アイアン')) return 'tremor'

  if (name.includes('蒼穹')) return 'nova'
  if (name.includes('ノヴァ') || name.includes('スカイ')) return 'nova'

  if (name.includes('バレット') || name.includes('キャノン')) return 'plasma'
  if (name.includes('プラズマ') || name.includes('レイザー')) return 'plasma'
  if (
    name.includes('マグナム') ||
    name.includes('バスター') ||
    name.includes('オーバードライブ')
  )
    return 'inferno'

  return 'meteor'
}

/** 技名 → 演出種別（3タイプ構成: 斬撃 / 魔法 / 射撃） */
export const TECHNIQUE_EFFECT_KIND_BY_NAME: Readonly<Record<string, TechniqueEffectKind>> =
  Object.freeze(
    Object.fromEntries([
      ...SLASH_TECHNIQUE_NAMES.map((n) => [n, getSlashKind(n)] as const),
      ...MAGIC_TECHNIQUE_NAMES.map((n) => [n, getMagicKind(n)] as const),
      ...SHOOTING_TECHNIQUE_NAMES.map((n) => [n, getShootingKind(n)] as const),
    ])
  )

const KINDS: readonly TechniqueEffectKind[] = [
  'inferno',
  'meteor',
  'void',
  'tempest',
  'glacier',
  'plasma',
  'radiance',
  'tremor',
  'phantom',
  'nova',
  'aurora',
  'blossom',
  'circuit',
  'mire',
  'bloodtide',
  'dune',
  'sanctum',
  'canopy',
  'abyssal',
  'cogwork',
  'constellation',
  'rustbound',
]

/** 技名・演出用シード（Canvas アート等でも利用） */
export function hashTechniqueName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i += 1) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0
  }
  return h >>> 0
}

/** Canvas アート層の視覚パターン数（技名から固定で 0…COUNT-1） */
export const TECHNIQUE_VISUAL_PATTERN_COUNT = 60

/** Canvas / SVG アート用（パターン＋技ごとに独立した補助シード） */
export interface TechniqueBurstArtParams {
  pattern: number
  seed: number
  aux0: number
  aux1: number
}

/**
 * 技名ごとに固定の Canvas/SVG パラメータ。
 * パターンは複数ハッシュを混ぜて mod 60（プール件数が増えても衝突しにくい）。
 * aux は幾何・位相・色の微差用（アルゴリズム型が同じでも見え方を分ける）。
 */
export function getTechniqueBurstArtParams(name: string): TechniqueBurstArtParams {
  const s = name.trim()
  const h0 = hashTechniqueName(`${s}\u0000visual-art-pattern`)
  const h1 = hashTechniqueName(`\u0001${s}\u0000pat-mix`)
  const h2 = hashTechniqueName(`${s}\u0000pat-mix2`)
  const mixed = (h0 ^ (h1 << 13) ^ (h2 >>> 7)) >>> 0
  return {
    pattern: mixed % TECHNIQUE_VISUAL_PATTERN_COUNT,
    seed: hashTechniqueName(s),
    aux0: hashTechniqueName(`${s}\u0000art-aux0`),
    aux1: hashTechniqueName(`${s}\u0000art-aux1`),
  }
}

export function getTechniqueVisualPattern(name: string): number {
  return getTechniqueBurstArtParams(name).pattern
}

/** 技名から算出する演出用インラインスタイル（位相・色・追加レイヤー用変数） */
export interface TechniqueBurstVisualStyles {
  /** .tefx ルート用（CSS 変数＋子レイヤーが参照） */
  root: CSSProperties
  /** フィナーレルート用（filter は子へ伝播） */
  finale: CSSProperties
}

function r01(seed: number): number {
  return (seed % 10007) / 10007
}

/**
 * 技名ごとに連続的にばらす（固定 N パターンにしない）。
 * 複数の独立ハッシュで相関を下げ、同じ kind でも見え方の組み合わせが増える。
 */
export function buildTechniqueBurstVisualStyles(name: string): TechniqueBurstVisualStyles {
  const s = name.trim()
  const h0 = hashTechniqueName(s)
  const h1 = hashTechniqueName(`\u0001${s}`)
  const h2 = hashTechniqueName(`${s}\u0002flow`)
  const h3 = hashTechniqueName(`${s}\u0003grid`)
  const h4 = hashTechniqueName(`burst\u0004${s}`)
  const h5 = hashTechniqueName(`${s}\u0005wild`)

  const sigDelay = -r01(h0) * 2.15
  const scanDelay = -r01(h1) * 1.62
  const gridDelay = -r01(h0 ^ h2) * 3.55
  const sparkDelay = -r01(h3) * 1.38
  const glossAdd = (r01(h4) - 0.5) * 0.58
  const gridX = (h0 % 29) - 14
  const gridY = (h2 % 29) - 14
  const vigHue = (h1 % 101) - 50
  const vigSat = 0.86 + r01(h3) * 0.34
  const entOpacity = 0.07 + r01(h0 ^ h3) * 0.28
  const entContrast = 1.02 + r01(h2) * 0.26
  const entBrightness = 0.94 + r01(h4) * 0.18
  const entDelay = -r01(h1 ^ h4) * 2.55
  const distOpacity = 0.04 + r01(h2 ^ h3) * 0.2
  const distDelay = -r01(h0) * 2.05
  const finHue = (h4 % 97) - 48
  const finSat = 0.88 + r01(h1 >>> 7) * 0.32
  const finBright = 0.97 + r01(h5) * 0.1
  const scanSpeed = 0.92 + r01(h5 ^ h2) * 0.22
  const gridSpeed = 0.88 + r01(h3 >>> 3) * 0.28
  const sparkSpeed = 2.05 + r01(h5 ^ h0) * 1.05
  const vigDelay = -r01(h2 ^ h5) * 2.2

  const root: CSSProperties = {
    ['--tefx-sig-delay' as string]: `${sigDelay.toFixed(3)}s`,
    ['--tefx-scan-delay' as string]: `${scanDelay.toFixed(3)}s`,
    ['--tefx-grid-delay' as string]: `${gridDelay.toFixed(3)}s`,
    ['--tefx-spark-delay' as string]: `${sparkDelay.toFixed(3)}s`,
    ['--tefx-gloss-add' as string]: `${glossAdd.toFixed(3)}s`,
    ['--tefx-grid-x' as string]: `${gridX}px`,
    ['--tefx-grid-y' as string]: `${gridY}px`,
    ['--tefx-vig-hue' as string]: `${vigHue}deg`,
    ['--tefx-vig-sat' as string]: vigSat.toFixed(3),
    ['--tefx-entropy-opacity' as string]: entOpacity.toFixed(3),
    ['--tefx-entropy-contrast' as string]: entContrast.toFixed(3),
    ['--tefx-entropy-brightness' as string]: entBrightness.toFixed(3),
    ['--tefx-entropy-delay' as string]: `${entDelay.toFixed(3)}s`,
    ['--tefx-distort-opacity' as string]: distOpacity.toFixed(3),
    ['--tefx-distort-delay' as string]: `${distDelay.toFixed(3)}s`,
    ['--tefx-scan-speed' as string]: `${scanSpeed.toFixed(3)}s`,
    ['--tefx-grid-speed' as string]: `${gridSpeed.toFixed(3)}s`,
    ['--tefx-spark-speed' as string]: `${sparkSpeed.toFixed(3)}s`,
    ['--tefx-vig-delay' as string]: `${vigDelay.toFixed(3)}s`,
  }

  const finale: CSSProperties = {
    filter: `hue-rotate(${finHue}deg) saturate(${finSat.toFixed(3)}) brightness(${finBright.toFixed(3)})`,
  }

  return { root, finale }
}

export function getTechniqueEffectKind(name: string): TechniqueEffectKind {
  const trimmed = name.trim()
  const mapped = TECHNIQUE_EFFECT_KIND_BY_NAME[trimmed]
  if (mapped) return mapped
  return KINDS[hashTechniqueName(trimmed) % KINDS.length]!
}

/** 開発時: リストとマップの整合（ビルド時に一度だけ走らせる想定） */
export function assertTechniqueEffectMapComplete(): void {
  const missing: string[] = []
  for (const n of COMBO_TECHNIQUE_NAMES) {
    if (TECHNIQUE_EFFECT_KIND_BY_NAME[n] == null) missing.push(n)
  }
  if (missing.length > 0) {
    throw new Error(`techniqueEffectKinds: 未マッピングの技: ${missing.join(', ')}`)
  }
}

/** 本番でも読み込み時に一度検証（リストに技を足したときの未マッピングを即検出） */
assertTechniqueEffectMapComplete()

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

function getSlashKind(name: string): TechniqueEffectKind {
  // 斬撃タイプの中でも見た目が単調にならないよう、技名の語彙で種別を振り分ける
  if (name.includes('紅')) return 'inferno'
  if (name.includes('蒼')) return 'glacier'
  if (name.includes('雷') || name.includes('風')) return 'tempest'
  if (name.includes('影') || name.includes('黒')) return 'void'
  if (name.includes('白') || name.includes('月')) return 'radiance'
  if (name.includes('虎')) return 'tremor'
  if (name.includes('龍')) return 'nova'
  if (name.includes('ブレイド')) return 'phantom'
  if (name.includes('シャドウ')) return 'phantom'
  return 'tremor'
}

function getMagicKind(name: string): TechniqueEffectKind {
  if (name.includes('カワイソウニ')) return 'phantom'
  if (name.includes('星詠') || name.includes('アストラ')) return 'nova'
  if (name.includes('深淵') || name.includes('虚無')) return 'void'
  if (name.includes('聖光') || name.includes('月詠')) return 'radiance'
  if (name.includes('氷華')) return 'glacier'
  if (name.includes('雷帝')) return 'tempest'
  if (name.includes('焔王')) return 'inferno'
  if (name.includes('霊峰')) return 'tremor'
  if (name.includes('ルーン') || name.includes('秘儀')) return 'plasma'
  return 'radiance'
}

function getShootingKind(name: string): TechniqueEffectKind {
  if (name.includes('流星') || name.includes('彗星') || name.includes('銀河')) return 'meteor'
  if (name.includes('閃光') || name.includes('白夜')) return 'radiance'
  if (name.includes('雷鳴')) return 'tempest'
  if (name.includes('黒翼')) return 'void'
  if (name.includes('蒼穹')) return 'nova'
  if (name.includes('金剛')) return 'tremor'
  if (name.includes('烈火')) return 'inferno'
  if (name.includes('バレット') || name.includes('キャノン')) return 'plasma'
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

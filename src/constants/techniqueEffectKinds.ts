/**
 * 技ごとの演出プリセット（見た目の構造・アニメが異なる）
 * 未登録の技名は hash でフォールバック。
 */

import { COMBO_TECHNIQUE_NAMES } from './comboTechnique'

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

const INFERNO: readonly string[] = [
  'フレア',
  'ブレイズ',
  '劫火',
  '焔牙',
  '炎幕',
  '炎レイ',
  '紅フレア',
  '紅コンボ',
  '竜ブレス',
  '龍破',
]

const METEOR: readonly string[] = [
  'メテオ',
  'コメット',
  '銀コメット',
  '銀メテオ',
  '星パルス',
  '蒼スター',
  '星火',
  '空ダイブ',
]

const VOID: readonly string[] = [
  'ヴォイド',
  'シャドウ',
  '幽穿',
  '闇刃',
  '闇ゲート',
  '夜ニト',
  'イクリプス',
  '月の楔',
  '極ナイト',
  '黒の刃',
]

const TEMPEST: readonly string[] = [
  'サンダー',
  '雷神',
  '紫電',
  '雷陣',
  '雷ボルト',
  'スパーク',
  'ショック',
  'ゲイル',
  'レヴン',
  '迅風',
  '嵐脚',
  '嵐ゲイル',
  '風ソニ',
]

const GLACIER: readonly string[] = [
  'フロスト',
  '霜斬',
  'ブリザ',
  '凍刃',
  '氷壁',
  '氷ジェイル',
  '流水',
  '蒼落',
  '蒼ブレイド',
  '海トリ',
]

const PLASMA: readonly string[] = [
  'プラズマ',
  'チェイン',
  '極光',
  'アストラ',
  'クレスト',
  'クオリア',
  '旋トルク',
]

const RADIANCE: readonly string[] = [
  'ルミナ',
  '光理',
  'ヘイロー',
  '聖フォース',
  '白ヴェール',
  '月光',
  'フェイス',
  'ウィズ',
  'オーラ',
  '秘オーラ',
  '桜ビート',
]

const TREMOR: readonly string[] = [
  'グランド',
  '崩山',
  '穿石',
  '地クラック',
  '鉄崩',
  '鉄拳',
  '鋼シールド',
  '鉄ウィップ',
  '金バレット',
  '狼崩',
  '虎襲',
  'ランス',
]

const PHANTOM: readonly string[] = [
  'ファントム',
  'ブレイド',
  '幻刺',
  'ミスト',
  'ドレム',
  '魔イフ',
  '神楽ステップ',
  '蝶ステップ',
  '燕ノ閃',
  'ドレイン',
  'ソウル',
  '鷹爪',
]

const NOVA: readonly string[] = [
  'ノヴァ',
  '業渦',
  '裂空',
  '真打',
  '極意',
  '竜撃',
  'ヴェール',
]

function entriesFor(names: readonly string[], kind: TechniqueEffectKind): [string, TechniqueEffectKind][] {
  return names.map((n) => [n, kind])
}

/** 技名 → 演出種別（100 件すべてカバー） */
export const TECHNIQUE_EFFECT_KIND_BY_NAME: Readonly<Record<string, TechniqueEffectKind>> =
  Object.freeze(
    Object.fromEntries([
      ...entriesFor(INFERNO, 'inferno'),
      ...entriesFor(METEOR, 'meteor'),
      ...entriesFor(VOID, 'void'),
      ...entriesFor(TEMPEST, 'tempest'),
      ...entriesFor(GLACIER, 'glacier'),
      ...entriesFor(PLASMA, 'plasma'),
      ...entriesFor(RADIANCE, 'radiance'),
      ...entriesFor(TREMOR, 'tremor'),
      ...entriesFor(PHANTOM, 'phantom'),
      ...entriesFor(NOVA, 'nova'),
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

function hashTechniqueName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i += 1) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0
  }
  return h >>> 0
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

if (import.meta.env.DEV) {
  assertTechniqueEffectMapComplete()
}

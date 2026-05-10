/** 通常攻撃後のルーレット追加攻撃（合わせ技とは別ロジック・技名リストのみ共有） */

import {
  CUSTOM_ORIGINAL_TECHNIQUE_NAME_SET,
  MONSTER_HUNTER_VERBATIM_TECHNIQUE_NAMES,
} from './comboTechniqueNames'
import { HP_GAUGE_TOP_BAND_GAP_PX } from './hpGaugeOverlay'

const MH_VERBATIM_NAME_SET = new Set<string>(MONSTER_HUNTER_VERBATIM_TECHNIQUE_NAMES)

/** 通常攻撃ヒット後にルーレット演出を出す確率 */
export const ROULETTE_BONUS_TRIGGER_PROBABILITY = 0.4

/** ルーレットが成功扱いになる確率（演出終了時の判定） */
export const ROULETTE_BONUS_SUCCESS_PROBABILITY = 0.5

/** 成功時に「もう一度ルーレット」を連鎖抽選する確率 */
export const ROULETTE_BONUS_CHAIN_TRIGGER_PROBABILITY = 0.35

/** 連鎖ルーレットの最大段数（0=初回、1=連鎖1回目...） */
export const ROULETTE_BONUS_CHAIN_MAX_DEPTH = 2

/** スピンアニメーション時間（ms）— イージングは CSS cubic-bezier で指定 */
export const ROULETTE_BONUS_SPIN_MS = 2100

/** 成功／失敗テキスト表示の滞留時間（ms） */
export const ROULETTE_BONUS_RESULT_HOLD_MS = 1900

/** 1行の高さ（px）— ストリップの刻み。CSS と一致させる */
export const ROULETTE_BONUS_ROW_HEIGHT_PX = 22

/**
 * ルーレット窓の高さ（px）— おおよそ 1.5 行分で上下に隣行がわずかに見える
 * （ROW_HEIGHT の 1.5 倍に合わせること）
 */
export const ROULETTE_BONUS_VIEWPORT_HEIGHT_PX = 33

/** ストリップ上の失敗マス表示文言（技名リストと重複しないこと） */
export const ROULETTE_STRIP_FAIL_LABEL = '失敗'

/** HPゲージフレーム上端とルーレット下端のあいだ（px）。config.hp の位置に追従 */
export const ROULETTE_BONUS_GAP_ABOVE_GAUGE_PX = HP_GAUGE_TOP_BAND_GAP_PX

/**
 * ルーレット成功時の「止まるマス」と表示・追加攻撃の技名を一致させるため、
 * インデックスから技名を取る（indexOf に頼らない）。
 * @param mhVerbatimRollPercent 合わせ技と同設定想定。0〜100。`names` 内で歴代MH実在技名に該当するマスのみから止まり先を選ぶ抽選を、この確率（%）で挟む。
 * @param customOriginalNameRollPercent 0〜100。MH優先に当たらなかったとき、`names` 内のオリジナル技名マスのみから止まり先を選ぶ抽選をこの確率（%）で挟む。
 */
export function pickRouletteStripSkill(
  names: readonly string[],
  mhVerbatimRollPercent = 0,
  customOriginalNameRollPercent = 0
): { landedName: string; landIndex: number } {
  const n = names.length
  if (n < 1) {
    return { landedName: '', landIndex: 0 }
  }
  const p = Math.max(0, Math.min(100, mhVerbatimRollPercent))
  if (p > 0) {
    const mhIdx: number[] = []
    for (let i = 0; i < n; i += 1) {
      if (MH_VERBATIM_NAME_SET.has(names[i]!)) mhIdx.push(i)
    }
    if (mhIdx.length > 0 && Math.random() * 100 < p) {
      const landIndex = mhIdx[Math.floor(Math.random() * mhIdx.length)]!
      return { landedName: names[landIndex] ?? names[0]!, landIndex }
    }
  }
  const customP = Math.max(0, Math.min(100, customOriginalNameRollPercent))
  if (customP > 0 && CUSTOM_ORIGINAL_TECHNIQUE_NAME_SET.size > 0) {
    const customIdx: number[] = []
    for (let i = 0; i < n; i += 1) {
      if (CUSTOM_ORIGINAL_TECHNIQUE_NAME_SET.has(names[i]!)) customIdx.push(i)
    }
    if (customIdx.length > 0 && Math.random() * 100 < customP) {
      const landIndex = customIdx[Math.floor(Math.random() * customIdx.length)]!
      return { landedName: names[landIndex] ?? names[0]!, landIndex }
    }
  }
  const landIndex = Math.floor(Math.random() * n)
  return { landedName: names[landIndex] ?? names[0]!, landIndex }
}

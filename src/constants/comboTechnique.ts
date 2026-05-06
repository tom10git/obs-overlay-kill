/**
 * 合わせ技チャレンジ用の既定接頭辞。
 * 接頭辞・制限時間は攻撃設定（AttackConfig）で変更可能。
 */

import { COMBO_TECHNIQUE_NAMES, MONSTER_HUNTER_VERBATIM_TECHNIQUE_NAMES } from './comboTechniqueNames'

export { COMBO_TECHNIQUE_NAMES }

export const COMBO_TECHNIQUE_PREFIX = '合わせ技：'

export const COMBO_TECHNIQUE_TRIGGER_PROBABILITY = 0.3

/**
 * 合わせ技チャレンジの技名を抽選する。
 * @param mhVerbatimRollPercent 0〜100。各抽選でこの確率（%）に従い、歴代MHの実在技名（固定枠）から一様に選ぶ。0のときは従来どおり全プールから一様。
 */
export function pickRandomComboTechniqueName(mhVerbatimRollPercent = 0): string {
  const p = Math.max(0, Math.min(100, mhVerbatimRollPercent))
  const mh = MONSTER_HUNTER_VERBATIM_TECHNIQUE_NAMES
  if (p > 0 && mh.length > 0 && Math.random() * 100 < p) {
    return mh[Math.floor(Math.random() * mh.length)]!
  }
  const pool = COMBO_TECHNIQUE_NAMES
  const i = Math.floor(Math.random() * pool.length)
  return pool[i] ?? pool[0]!
}

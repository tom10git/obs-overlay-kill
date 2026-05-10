/**
 * 合わせ技チャレンジ用の既定接頭辞。
 * 接頭辞・制限時間は攻撃設定（AttackConfig）で変更可能。
 */

import {
  COMBO_TECHNIQUE_NAMES,
  CUSTOM_ORIGINAL_TECHNIQUE_NAME_SET,
  MONSTER_HUNTER_VERBATIM_TECHNIQUE_NAMES,
} from './comboTechniqueNames'

export { COMBO_TECHNIQUE_NAMES }

export const COMBO_TECHNIQUE_PREFIX = '合わせ技：'

export const COMBO_TECHNIQUE_TRIGGER_PROBABILITY = 0.3

/**
 * 合わせ技チャレンジの技名を抽選する。
 * @param mhVerbatimRollPercent 0〜100。各抽選でこの確率（%）に従い、歴代MHの実在技名（固定枠）から一様に選ぶ。0のときは従来どおり全プールから一様。
 * @param customOriginalNameRollPercent 0〜100。MH優先抽選に当たらなかったとき、この確率（%）で `customTechniqueNames.ts` のオリジナル技名のみから一様に選ぶ。登録名が無いときは無視。
 */
export function pickRandomComboTechniqueName(
  mhVerbatimRollPercent = 0,
  customOriginalNameRollPercent = 0
): string {
  const mhP = Math.max(0, Math.min(100, mhVerbatimRollPercent))
  const mh = MONSTER_HUNTER_VERBATIM_TECHNIQUE_NAMES
  if (mhP > 0 && mh.length > 0 && Math.random() * 100 < mhP) {
    return mh[Math.floor(Math.random() * mh.length)]!
  }
  const customP = Math.max(0, Math.min(100, customOriginalNameRollPercent))
  if (customP > 0 && CUSTOM_ORIGINAL_TECHNIQUE_NAME_SET.size > 0 && Math.random() * 100 < customP) {
    const customArr = Array.from(CUSTOM_ORIGINAL_TECHNIQUE_NAME_SET)
    return customArr[Math.floor(Math.random() * customArr.length)]!
  }
  const pool = COMBO_TECHNIQUE_NAMES
  const i = Math.floor(Math.random() * pool.length)
  return pool[i] ?? pool[0]!
}

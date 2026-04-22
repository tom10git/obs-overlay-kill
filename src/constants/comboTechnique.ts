/**
 * 合わせ技チャレンジ用の既定接頭辞。
 * 接頭辞・制限時間は攻撃設定（AttackConfig）で変更可能。
 */

import { COMBO_TECHNIQUE_NAMES } from './comboTechniqueNames'

export { COMBO_TECHNIQUE_NAMES }

export const COMBO_TECHNIQUE_PREFIX = '合わせ技：'

export const COMBO_TECHNIQUE_TRIGGER_PROBABILITY = 0.3

export function pickRandomComboTechniqueName(): string {
  const i = Math.floor(Math.random() * COMBO_TECHNIQUE_NAMES.length)
  return COMBO_TECHNIQUE_NAMES[i] ?? COMBO_TECHNIQUE_NAMES[0]!
}

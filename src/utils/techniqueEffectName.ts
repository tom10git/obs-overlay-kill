import { COMBO_TECHNIQUE_PREFIX } from '../constants/comboTechnique'

/** 合わせ技チャレンジの targetFull から技名部分だけを取り出す */
export function techniqueNameFromComboTarget(targetFull: string): string {
  if (targetFull.startsWith(COMBO_TECHNIQUE_PREFIX)) {
    return targetFull.slice(COMBO_TECHNIQUE_PREFIX.length)
  }
  return targetFull
}

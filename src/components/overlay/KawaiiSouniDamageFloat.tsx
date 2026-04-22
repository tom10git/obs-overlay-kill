/**
 * カワイソウニ debuff 中: 被ダメ時に上方向の扇の中へランダムに飛ばすラベル
 */

import type { CSSProperties } from 'react'
import './KawaiiSouniDamageFloat.css'
import { KAWAI_SOUNI_TECHNIQUE_NAME } from '../../constants/kawaiiSouniTechnique'

export interface KawaiiSouniDamageFloatProps {
  /** 0°=右、90°=下、-90°=上（画面座標） */
  angleDeg: number
  distancePx: number
  /** 50〜200＝%÷100。DamageNumber と同じ設定を渡す */
  fontScalePercent?: number
  /** HP ゲージの config.hp.x / .y（px）。ダメージ数値と同じ基準に揃える */
  hpOffsetX?: number
  hpOffsetY?: number
}

export function KawaiiSouniDamageFloat({
  angleDeg,
  distancePx,
  fontScalePercent = 100,
  hpOffsetX = 0,
  hpOffsetY = 0,
}: KawaiiSouniDamageFloatProps) {
  const rad = (angleDeg * Math.PI) / 180
  const endX = Math.cos(rad) * distancePx
  const endY = Math.sin(rad) * distancePx
  const popupScale = Math.min(200, Math.max(50, Math.round(fontScalePercent))) / 100

  return (
    <div
      className="kawaii-souni-damage-float"
      aria-hidden
      style={
        {
          ['--ks-float-ex' as string]: `${endX}px`,
          ['--ks-float-ey' as string]: `${endY}px`,
          ['--ks-float-font' as string]: String(popupScale),
          ['--hp-gauge-offset-x' as string]: `${hpOffsetX}px`,
          ['--hp-gauge-offset-y' as string]: `${hpOffsetY}px`,
        } as CSSProperties
      }
    >
      {KAWAI_SOUNI_TECHNIQUE_NAME}
    </div>
  )
}

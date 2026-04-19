/**
 * 回復量数値表示コンポーネント
 * ダメージ表示と同じ位置・アニメーションを使い、色だけ変える
 */

import './DamageNumber.css'
import { glowTextStyleFromHex } from '../../utils/glowTextStyle'

interface HealNumberProps {
  id: number
  amount: number
  /** 50〜200＝%÷100。既定 100 */
  fontScalePercent?: number
  healColors: {
    normal: string
  }
}

export function HealNumber({ id, amount, fontScalePercent = 100, healColors }: HealNumberProps) {
  const style = glowTextStyleFromHex(healColors?.normal || '#00ff88', 'heal')
  const popupScale = Math.min(200, Math.max(50, Math.round(fontScalePercent))) / 100

  return (
    <div
      className="damage-number heal-number"
      key={id}
      data-heal={amount}
      style={{
        ...style,
        ['--damage-popup-font-scale' as string]: String(popupScale),
      }}
    >
      +{amount}
    </div>
  )
}


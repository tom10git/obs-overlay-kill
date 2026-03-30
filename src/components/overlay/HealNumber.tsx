/**
 * 回復量数値表示コンポーネント
 * ダメージ表示と同じ位置・アニメーションを使い、色だけ変える
 */

import './DamageNumber.css'
import { glowTextStyleFromHex } from '../../utils/glowTextStyle'

interface HealNumberProps {
  id: number
  amount: number
  healColors: {
    normal: string
  }
}

export function HealNumber({ id, amount, healColors }: HealNumberProps) {
  const style = glowTextStyleFromHex(healColors?.normal || '#00ff88', 'heal')

  return (
    <div
      className="damage-number heal-number"
      key={id}
      data-heal={amount}
      style={style}
    >
      +{amount}
    </div>
  )
}


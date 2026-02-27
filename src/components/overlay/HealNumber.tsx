/**
 * 回復量数値表示コンポーネント
 * ダメージ表示と同じ位置・アニメーションを使い、色だけ変える
 */

import './DamageNumber.css'

interface HealNumberProps {
  id: number
  amount: number
  healColors: {
    normal: string
  }
}

export function HealNumber({ id, amount, healColors }: HealNumberProps) {
  const color = healColors?.normal || '#00ff88'

  // 16進カラーコードをRGBに変換
  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null
  }

  const rgb = hexToRgb(color)

  const style: any = rgb
    ? {
        color,
        textShadow:
          `0 0 4px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9),` +
          `0 0 8px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8),` +
          `0 0 16px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7),` +
          `0 0 24px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6),` +
          `0 0 32px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5),` +
          `0 0 48px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4),` +
          `0 0 64px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3),` +
          `2px 2px 8px rgba(0, 0, 0, 0.9)`,
        filter: `drop-shadow(0 0 12px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5))`,
      }
    : { color }

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


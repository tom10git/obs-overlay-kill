/**
 * ダメージ数値表示コンポーネント
 */

import './DamageNumber.css'
import type { AttackDebuffKind, DamageColorConfig } from '../../types/overlay'

function dotDebuffFallbackHex(kind: AttackDebuffKind | undefined, damageColors: DamageColorConfig): string {
  switch (kind ?? 'bleed') {
    case 'poison':
      return damageColors.dotPoison ?? '#66dd88'
    case 'burn':
      return damageColors.dotBurn ?? '#ff9944'
    default:
      return damageColors.bleed
  }
}

interface DamageNumberProps {
  amount: number
  isCritical?: boolean
  isBleed?: boolean // 持続ダメージ（DOT）かどうか
  /** DOT の種別（既定の数値色に使用。省略時は bleed） */
  dotDebuffKind?: AttackDebuffKind
  /** DOT 時のみ。指定時は種別の既定色より優先（#RGB / #RRGGBB） */
  bleedColorOverride?: string
  angle?: number // 放射状の角度（度）
  distance?: number // 放射状の距離（px）
  id: number
  damageColors: DamageColorConfig
}

export function DamageNumber({ 
  amount, 
  isCritical = false, 
  isBleed = false,
  dotDebuffKind = 'bleed',
  bleedColorOverride,
  angle = 0,
  distance = 0,
  id,
  damageColors
}: DamageNumberProps) {
  const bleedHex =
    isBleed && bleedColorOverride && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(bleedColorOverride.trim())
      ? bleedColorOverride.trim()
      : null
  const dotBase = dotDebuffFallbackHex(dotDebuffKind, damageColors)
  // 色を決定
  const color = isBleed ? (bleedHex ?? dotBase) : (isCritical ? damageColors.critical : damageColors.normal)
  
  // 出血ダメージの場合は角度と距離からx, y座標を計算
  let bleedStyle: React.CSSProperties | undefined = undefined
  if (isBleed) {
    const angleRad = (angle * Math.PI) / 180
    const endX = Math.cos(angleRad) * distance
    const endY = Math.sin(angleRad) * distance
    // 中間位置も計算（アニメーション用）
    const midX = endX * 0.3
    const midY = endY * 0.3
    bleedStyle = {
      '--bleed-end-x': `${endX}px`,
      '--bleed-end-y': `${endY}px`,
      '--bleed-mid-x': `${midX}px`,
      '--bleed-mid-y': `${midY}px`,
    } as React.CSSProperties & { 
      '--bleed-end-x': string
      '--bleed-end-y': string
      '--bleed-mid-x': string
      '--bleed-mid-y': string
    }
  }

  // 色をRGBに変換してtext-shadowを生成
  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    let s = hex.replace(/^#/, '')
    if (s.length === 3) {
      s = `${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`
    }
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(s)
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null
  }

  const rgb = hexToRgb(color)
  const textShadowStyle = rgb ? {
    color: color,
    textShadow: isBleed
      ? `2px 2px 4px rgba(0, 0, 0, 0.8), 0 0 8px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6), 0 0 15px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`
      : isCritical
        ? `0 0 6px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9), 0 0 12px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85), 0 0 20px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8), 0 0 30px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7), 0 0 40px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6), 2px 2px 10px rgba(0, 0, 0, 0.9)`
        : `0 0 4px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9), 0 0 8px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8), 0 0 16px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7), 0 0 24px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6), 0 0 32px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5), 0 0 48px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4), 0 0 64px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3), 2px 2px 8px rgba(0, 0, 0, 0.9)`,
    filter: isBleed
      ? undefined
      : isCritical
        ? `drop-shadow(0 0 15px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)) drop-shadow(0 0 25px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3))`
        : `drop-shadow(0 0 12px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5))`
  } : { color: color }

  return (
    <div
      className={`damage-number ${isCritical ? 'critical' : ''} ${isBleed ? 'bleed' : ''}`}
      key={id}
      data-damage={amount}
      style={{ ...bleedStyle, ...textShadowStyle }}
    >
      {isCritical ? '💥 ' : ''}
      {amount}
    </div>
  )
}

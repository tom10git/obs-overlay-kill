/**
 * ダメージ数値表示コンポーネント
 */

import './DamageNumber.css'

interface DamageNumberProps {
  amount: number
  isCritical?: boolean
  isBleed?: boolean // 出血ダメージかどうか
  angle?: number // 放射状の角度（度）
  distance?: number // 放射状の距離（px）
  id: number
}

export function DamageNumber({ 
  amount, 
  isCritical = false, 
  isBleed = false,
  angle = 0,
  distance = 0,
  id 
}: DamageNumberProps) {
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

  return (
    <div
      className={`damage-number ${isCritical ? 'critical' : ''} ${isBleed ? 'bleed' : ''}`}
      key={id}
      data-damage={amount}
      style={bleedStyle}
    >
      {isCritical ? '💥 ' : ''}
      {amount}
    </div>
  )
}

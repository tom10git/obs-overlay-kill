/**
 * 個別のHPゲージレイヤーコンポーネント
 */

import './HPGaugeLayer.css'

interface HPGaugeLayerProps {
  percentage: number
  color: string
  zIndex: number
  animationDuration: number
  easing: string
}

export function HPGaugeLayer({
  percentage,
  color,
  zIndex,
  animationDuration,
  easing,
}: HPGaugeLayerProps) {
  const style: React.CSSProperties = {
    backgroundColor: color,
    transform: `scaleX(${percentage / 100})`,
    /* 左端固定で右側が空く（中央に向かって挟まれる見え方を避ける） */
    transformOrigin: 'left center',
    zIndex,
    transition: `transform ${animationDuration}ms ${easing}`,
  }

  return (
    <div className="hp-gauge-layer" style={style}>
      <div className="hp-gauge-fill" />
    </div>
  )
}

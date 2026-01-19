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
    transformOrigin: 'left',
    zIndex,
    transition: `transform ${animationDuration}ms ${easing}`,
  }

  return (
    <div className="hp-gauge-layer" style={style}>
      <div className="hp-gauge-fill" />
    </div>
  )
}

/**
 * HP数値表示コンポーネント
 */

import './HPDisplay.css'

interface HPDisplayProps {
  current: number
  max: number
  fontSize: number
  showMaxHp: boolean
  /** 平行四辺形ゲージ時はテキストを逆スキューして水平に戻す */
  gaugeDesign?: 'default' | 'parallelogram'
  /** 平行四辺形時の逆スキュー角度（度、display.gaugeShape.skewDeg と一致） */
  gaugeSkewDeg?: number
}

export function HPDisplay({
  current,
  max,
  fontSize,
  showMaxHp,
  gaugeDesign = 'default',
  gaugeSkewDeg = 11,
}: HPDisplayProps) {
  // showMaxHpがtrueの場合は「現在HP / 最大HP」、falseの場合は「現在HP」のみ表示
  const displayText = showMaxHp ? `${current} / ${max}` : `${current}`

  return (
    <div
      className={`hp-display ${gaugeDesign === 'parallelogram' ? 'hp-display--parallelogram' : ''}`}
      style={{
        fontSize: `${fontSize}px`,
        ...(gaugeDesign === 'parallelogram'
          ? { transform: `translate(-50%, -50%) skewX(${gaugeSkewDeg}deg)` }
          : {}),
      }}
    >
      {displayText}
    </div>
  )
}

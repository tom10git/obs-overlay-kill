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
  /** カワイソウニ debuff 中: 白文字に RGB シフト系のグリッチを付ける */
  kawaiiSouniGlitchActive?: boolean
}

export function HPDisplay({
  current,
  max,
  fontSize,
  showMaxHp,
  gaugeDesign = 'default',
  gaugeSkewDeg = 11,
  kawaiiSouniGlitchActive = false,
}: HPDisplayProps) {
  // showMaxHpがtrueの場合は「現在HP / 最大HP」、falseの場合は「現在HP」のみ表示
  const displayText = showMaxHp ? `${current} / ${max}` : `${current}`

  return (
    <div
      className={[
        'hp-display',
        gaugeDesign === 'parallelogram' ? 'hp-display--parallelogram' : '',
        kawaiiSouniGlitchActive ? 'hp-display--kawaii-souni-active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
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

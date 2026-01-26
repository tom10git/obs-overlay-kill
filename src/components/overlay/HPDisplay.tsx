/**
 * HP数値表示コンポーネント
 */

import './HPDisplay.css'

interface HPDisplayProps {
  current: number
  max: number
  fontSize: number
  showMaxHp: boolean
}

export function HPDisplay({
  current,
  max,
  fontSize,
  showMaxHp,
}: HPDisplayProps) {
  // showMaxHpがtrueの場合は「現在HP / 最大HP」、falseの場合は「現在HP」のみ表示
  const displayText = showMaxHp ? `${current} / ${max}` : `${current}`

  return (
    <div className="hp-display" style={{ fontSize: `${fontSize}px` }}>
      {displayText}
    </div>
  )
}

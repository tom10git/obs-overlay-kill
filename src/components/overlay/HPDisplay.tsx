/**
 * HP数値表示コンポーネント
 */

import './HPDisplay.css'

interface HPDisplayProps {
  current: number
  max: number
  fontSize: number
}

export function HPDisplay({
  current,
  max,
  fontSize,
}: HPDisplayProps) {
  // 常に最大HPを表示（現在HP / 最大HP の形式）
  const displayText = `${current} / ${max}`

  return (
    <div className="hp-display" style={{ fontSize: `${fontSize}px` }}>
      {displayText}
    </div>
  )
}

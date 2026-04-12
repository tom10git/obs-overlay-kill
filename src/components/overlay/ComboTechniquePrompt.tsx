/**
 * 合わせ技: HPゲージ直上に入力目標を表示（ダメージ数値より手前）
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './ComboTechniquePrompt.css'

export interface ComboTechniquePromptProps {
  targetFull: string
  matchedLength: number
  endsAt: number
  /** config.hp.width — これに合わせて横幅と文字サイズを調整 */
  gaugeWidthPx: number
}

function fitComboFontPx(charsEl: HTMLElement, availableWidthPx: number): number {
  const available = Math.max(48, availableWidthPx)
  let lo = 7
  let hi = 52
  const apply = (px: number) => {
    charsEl.style.fontSize = `${px}px`
  }
  apply(hi)
  if (charsEl.scrollWidth <= available) return hi
  apply(lo)
  if (charsEl.scrollWidth > available) return lo
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2
    apply(mid)
    if (charsEl.scrollWidth <= available) lo = mid
    else hi = mid
  }
  return lo
}

export function ComboTechniquePrompt({
  targetFull,
  matchedLength,
  endsAt,
  gaugeWidthPx,
}: ComboTechniquePromptProps) {
  const [remainingSec, setRemainingSec] = useState(() =>
    Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
  )
  const [charsFontPx, setCharsFontPx] = useState(20)
  const rootRef = useRef<HTMLDivElement>(null)
  const charsRef = useRef<HTMLDivElement>(null)

  const safeGaugeW = Math.max(120, gaugeWidthPx)

  useLayoutEffect(() => {
    const root = rootRef.current
    const chars = charsRef.current
    if (!root || !chars) return

    const run = () => {
      const innerPad = 14
      const w = root.clientWidth
      const px = fitComboFontPx(chars, w - innerPad)
      setCharsFontPx(px)
    }

    run()
    const ro = new ResizeObserver(run)
    ro.observe(root)
    return () => ro.disconnect()
  }, [targetFull, matchedLength, safeGaugeW])

  useEffect(() => {
    const tick = () => {
      setRemainingSec(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)))
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [endsAt])

  const chars = [...targetFull]

  return (
    <div ref={rootRef} className="combo-technique-prompt" aria-live="polite">
      <p className="combo-technique-prompt__timer">合わせ技チャンス · 残り {remainingSec} 秒</p>
      <div
        ref={charsRef}
        className="combo-technique-prompt__chars"
        style={{ fontSize: `${charsFontPx}px` }}
      >
        {chars.map((ch, idx) => (
          <span
            key={idx}
            className={
              idx < matchedLength
                ? 'combo-technique-prompt__char combo-technique-prompt__char--matched'
                : 'combo-technique-prompt__char'
            }
          >
            {ch}
          </span>
        ))}
      </div>
    </div>
  )
}

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
  /** 50〜200＝%。既定 100（残り秒表示と入力文字の基準サイズ） */
  challengeFontScalePercent?: number
  /**
   * 文字数が多いときの追加縮小（「何文字以上で」「どのくらい小さく」）。
   * - thresholdChars: この文字数以上で縮小を適用
   * - scalePercent: 追加で掛ける倍率（30〜100、100＝縮小なし）
   */
  longTextThresholdChars?: number
  longTextScalePercent?: number
  /** 文字寄せ（レイアウト調整用） */
  textAlign?: 'left' | 'center' | 'right'
  /** テキスト全体の平行移動（px。band位置は別。テキストだけ微調整したい場合に使う） */
  textOffsetXPx?: number
  textOffsetYPx?: number
  /** 色（#RGB / #RRGGBB） */
  timerTextColor?: string
  charsTextColor?: string
  matchedTextColor?: string
  /** グロー影色（#RGB / #RRGGBB）。黒い縁取り影は可読性のため固定 */
  timerGlowShadowColor?: string
  charsGlowShadowColor?: string
  matchedGlowShadowColor?: string
}

function fitComboFontPx(charsEl: HTMLElement, availableWidthPx: number): number {
  const available = Math.max(48, availableWidthPx)
  /* 日本語（濁点・漢字）が潰れないよう下限を少し上げる */
  let lo = 9
  let hi = 52
  const apply = (px: number) => {
    charsEl.style.fontSize = `${px}px`
  }
  apply(hi)
  if (charsEl.scrollWidth <= available) return hi
  apply(lo)
  if (charsEl.scrollWidth > available) {
    // lo でも収まらない場合は、比率で確実に収める（小数px可）
    const ratio = available / Math.max(1, charsEl.scrollWidth)
    return Math.max(9, lo * ratio)
  }
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
  challengeFontScalePercent = 100,
  longTextThresholdChars = 18,
  longTextScalePercent = 85,
  textAlign = 'center',
  textOffsetXPx = 0,
  textOffsetYPx = 0,
  timerTextColor,
  charsTextColor,
  matchedTextColor,
  timerGlowShadowColor,
  charsGlowShadowColor,
  matchedGlowShadowColor,
}: ComboTechniquePromptProps) {
  const [remainingSec, setRemainingSec] = useState(() =>
    Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
  )
  const [charsFontPx, setCharsFontPx] = useState(20)
  const rootRef = useRef<HTMLDivElement>(null)
  const charsRef = useRef<HTMLDivElement>(null)

  const safeGaugeW = Math.max(120, gaugeWidthPx)
  const challengeScale =
    Math.min(200, Math.max(50, Math.round(challengeFontScalePercent))) / 100
  const chars = [...targetFull]
  const longTextScale = (() => {
    const threshold = Math.max(0, Math.floor(Number(longTextThresholdChars)))
    const scale = Math.min(100, Math.max(30, Math.round(Number(longTextScalePercent)))) / 100
    if (!threshold) return 1
    if (chars.length < threshold) return 1
    return scale
  })()

  useLayoutEffect(() => {
    const root = rootRef.current
    const chars = charsRef.current
    if (!root || !chars) return

    const run = () => {
      const innerPad = 14
      const w = root.clientWidth
      const px = fitComboFontPx(chars, w - innerPad)
      setCharsFontPx(Math.max(12, Math.round(px * challengeScale * longTextScale)))
    }

    run()
    const ro = new ResizeObserver(run)
    ro.observe(root)
    return () => ro.disconnect()
  }, [targetFull, matchedLength, safeGaugeW, challengeScale, longTextScale])

  useEffect(() => {
    const tick = () => {
      setRemainingSec(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)))
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [endsAt])

  return (
    <div
      ref={rootRef}
      className="combo-technique-prompt"
      style={{
        ['--combo-challenge-font-scale' as string]: String(challengeScale),
        ...(timerTextColor ? { ['--combo-challenge-timer-color' as string]: timerTextColor } : {}),
        ...(charsTextColor ? { ['--combo-challenge-chars-color' as string]: charsTextColor } : {}),
        ...(matchedTextColor
          ? { ['--combo-challenge-matched-color' as string]: matchedTextColor }
          : {}),
        ...(timerGlowShadowColor
          ? { ['--combo-challenge-timer-glow' as string]: timerGlowShadowColor }
          : {}),
        ...(charsGlowShadowColor
          ? { ['--combo-challenge-chars-glow' as string]: charsGlowShadowColor }
          : {}),
        ...(matchedGlowShadowColor
          ? { ['--combo-challenge-matched-glow' as string]: matchedGlowShadowColor }
          : {}),
        transform:
          (Number(textOffsetXPx) || 0) !== 0 || (Number(textOffsetYPx) || 0) !== 0
            ? `translate(${Math.round(Number(textOffsetXPx) || 0)}px, ${Math.round(Number(textOffsetYPx) || 0)}px)`
            : undefined,
        textAlign,
      }}
      aria-live="polite"
    >
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

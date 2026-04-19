/**
 * 通常攻撃後のルーレット追加攻撃の演出（合わせ技とは別）
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ROULETTE_BONUS_GAP_ABOVE_GAUGE_PX,
  ROULETTE_BONUS_RESULT_HOLD_MS,
  ROULETTE_BONUS_ROW_HEIGHT_PX,
  ROULETTE_BONUS_SPIN_MS,
  ROULETTE_BONUS_VIEWPORT_HEIGHT_PX,
  ROULETTE_STRIP_FAIL_LABEL,
} from '../../constants/rouletteBonus'
import './HPGauge.css'
import './RouletteBonusOverlay.css'

export interface RouletteBonusOverlayProps {
  names: readonly string[]
  /** 成功時のみ：停止マスに合わせる技名 */
  landedName: string
  /** 成功時：names 内の停止行インデックス（landedName と同一抽選で渡すこと） */
  landIndex: number
  success: boolean
  gaugeWidthPx: number
  /** HPゲージと同じ config.hp（位置追従） */
  hpX: number
  hpY: number
  hpHeight: number
  /** ゲージ上端からの余白（省略時は定数） */
  gapAboveGaugePx?: number
  /** スピン終了直後（結果表示の直前）— 成功時の追加ダメージはここで適用 */
  onSpinEnd: () => void
  /** 全演出終了後に親が state をクリア */
  onComplete: () => void
  /** HPゲージと同じ被ダメージ揺れ（HPGauge の hitShake と同期） */
  hitShakeActive?: boolean
  /** HPゲージと同じ回避スライド */
  dodgeSlideActive?: boolean
  dodgeSlideDirection?: 'left' | 'right'
}

export function RouletteBonusOverlay({
  names,
  landedName,
  landIndex: landIndexProp,
  success,
  gaugeWidthPx,
  hpX,
  hpY,
  hpHeight,
  gapAboveGaugePx = ROULETTE_BONUS_GAP_ABOVE_GAUGE_PX,
  onSpinEnd,
  onComplete,
  hitShakeActive = false,
  dodgeSlideActive = false,
  dodgeSlideDirection = 'left',
}: RouletteBonusOverlayProps) {
  const [phase, setPhase] = useState<'spin' | 'result'>('spin')
  const stripRef = useRef<HTMLDivElement>(null)
  const spinDoneRef = useRef(false)
  const safeW = Math.max(120, gaugeWidthPx)

  const { strip, startIdx, endIdx } = useMemo(() => {
    const n = names.length
    const failLabel = ROULETTE_STRIP_FAIL_LABEL
    if (n < 1) {
      return { strip: ['—', failLabel] as string[], startIdx: 0, endIdx: 1 }
    }
    const successLandIndex = Math.max(0, Math.min(n - 1, Math.floor(landIndexProp)))
    // 各サイクル: 技名… + 最後に「失敗」マス（成功時は技名に止まり、失敗時は「失敗」に止まる）
    const cycle = [...names, failLabel]
    const cycleLen = cycle.length
    const cycles = 28
    const stripArr: string[] = []
    for (let c = 0; c < cycles; c += 1) {
      stripArr.push(...cycle)
    }
    const targetCycle = cycles - 3
    const end = success ? targetCycle * cycleLen + successLandIndex : targetCycle * cycleLen + n
    const back = 10 + Math.floor(Math.random() * 6)
    const start = Math.max(0, Math.min(end - 1, end - back))
    return { strip: stripArr, startIdx: start, endIdx: end }
  }, [names, landIndexProp, success])

  const rowH = ROULETTE_BONUS_ROW_HEIGHT_PX
  const viewportH = ROULETTE_BONUS_VIEWPORT_HEIGHT_PX
  /** 当たり行をビューポート縦中央に置く（窓が 1.5 行高でも刻みは rowH） */
  const stripYForIndex = (idx: number) => viewportH / 2 - rowH / 2 - idx * rowH

  useLayoutEffect(() => {
    const el = stripRef.current
    if (!el) return
    const yStart = stripYForIndex(startIdx)
    const yEnd = stripYForIndex(endIdx)
    el.style.transition = 'none'
    el.style.transform = `translateY(${yStart}px)`
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = `transform ${ROULETTE_BONUS_SPIN_MS}ms cubic-bezier(0.1, 0.82, 0.12, 1)`
        el.style.transform = `translateY(${yEnd}px)`
      })
    })
    return () => cancelAnimationFrame(id)
  }, [rowH, startIdx, endIdx, viewportH])

  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const finishSpin = () => {
      if (spinDoneRef.current) return
      spinDoneRef.current = true
      try {
        onSpinEnd()
      } finally {
        setPhase('result')
      }
    }
    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.target !== el) return
      if (e.propertyName !== 'transform') return
      finishSpin()
    }
    el.addEventListener('transitionend', onTransitionEnd)
    const fallback = window.setTimeout(finishSpin, ROULETTE_BONUS_SPIN_MS + 200)
    return () => {
      el.removeEventListener('transitionend', onTransitionEnd)
      window.clearTimeout(fallback)
    }
  }, [onSpinEnd])

  useEffect(() => {
    if (phase !== 'result') return
    const t = window.setTimeout(() => {
      onComplete()
    }, ROULETTE_BONUS_RESULT_HOLD_MS)
    return () => window.clearTimeout(t)
  }, [phase, onComplete])

  const panelMaxW = Math.min(safeW, 280)
  const hFrame = Math.max(1, hpHeight)
  /** HPゲージコンテナと同じ基準点（中央）の少し上＝フレーム上端より上にルーレット下端を合わせる */
  const anchorTop = `calc(50% + ${hpY}px - ${hFrame / 2}px - ${gapAboveGaugePx}px)`

  const motionClassName = useMemo(
    () =>
      [
        'hp-gauge-motion-root',
        'roulette-bonus-motion',
        dodgeSlideActive && `hp-gauge-motion-root--dodge-${dodgeSlideDirection}`,
        !dodgeSlideActive && hitShakeActive && 'hp-gauge-motion-root--hit-shake',
      ]
        .filter(Boolean)
        .join(' '),
    [dodgeSlideActive, dodgeSlideDirection, hitShakeActive]
  )

  return (
    <div
      className="roulette-bonus-overlay"
      style={
        {
          left: `calc(50% + ${hpX}px)`,
          top: anchorTop,
          transform: 'translate(-50%, -100%)',
          '--roulette-gauge-width': `${safeW}px`,
          '--roulette-panel-max': `${panelMaxW}px`,
          '--roulette-row-h': `${rowH}px`,
          '--roulette-viewport-h': `${viewportH}px`,
        } as React.CSSProperties
      }
      aria-live="polite"
    >
      <div className={motionClassName}>
        <div className="roulette-bonus-panel">
          <div className="roulette-bonus-title-row">
            <span className="roulette-bonus-title__tag">BONUS</span>
            <span className="roulette-bonus-title__label">追加攻撃ルーレット</span>
          </div>
          <div className="roulette-bonus-viewport">
            <div ref={stripRef} className="roulette-bonus-strip-wrap">
              {strip.map((label, i) => (
                <div
                  key={i}
                  className={
                    label === ROULETTE_STRIP_FAIL_LABEL
                      ? 'roulette-bonus-row roulette-bonus-row--fail-slot'
                      : 'roulette-bonus-row'
                  }
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
          {phase === 'result' && (
            <div className="roulette-bonus-result">
              {success ? (
                <p className="roulette-bonus-result__line">
                  <span className="roulette-bonus-result__pill roulette-bonus-result__pill--ok">成功</span>
                  <span className="roulette-bonus-result__sep" aria-hidden>
                    ·
                  </span>
                  <span className="roulette-bonus-result__skill">{landedName}</span>
                  <span className="roulette-bonus-result__suffix">発動</span>
                </p>
              ) : (
                <p className="roulette-bonus-result__line">
                  <span className="roulette-bonus-result__pill roulette-bonus-result__pill--ng">失敗</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * 攻撃時の透過WebMを一瞬だけ重ねる（通常/合わせ技/ルーレット共通）
 */

import { useEffect, useRef } from 'react'
import './AttackEffectBurst.css'

export type AttackEffectBurstProps = {
  videoUrl: string
  onDone?: () => void
}

export function AttackEffectBurst({ videoUrl, onDone }: AttackEffectBurstProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const el = videoRef.current
    if (!el) return

    let safetyId: ReturnType<typeof window.setTimeout> | undefined
    let fired = false
    const fireOnce = () => {
      if (fired) return
      fired = true
      if (safetyId !== undefined) {
        window.clearTimeout(safetyId)
        safetyId = undefined
      }
      onDoneRef.current?.()
    }

    el.addEventListener('ended', fireOnce)
    el.addEventListener('error', fireOnce)
    const armSafetyFromDuration = () => {
      const d = el.duration
      if (Number.isFinite(d) && d > 0 && d < 600) {
        if (safetyId !== undefined) window.clearTimeout(safetyId)
        safetyId = window.setTimeout(fireOnce, Math.ceil((d + 0.4) * 1000))
      }
    }
    el.addEventListener('loadedmetadata', armSafetyFromDuration)
    if (el.readyState >= 1) armSafetyFromDuration()

    return () => {
      el.removeEventListener('ended', fireOnce)
      el.removeEventListener('error', fireOnce)
      el.removeEventListener('loadedmetadata', armSafetyFromDuration)
      if (safetyId !== undefined) window.clearTimeout(safetyId)
    }
  }, [videoUrl])

  return (
    <div className="attack-effect-burst" aria-hidden>
      <video
        ref={videoRef}
        className="attack-effect-burst__video"
        src={videoUrl}
        autoPlay
        muted
        playsInline
        loop={false}
      />
    </div>
  )
}


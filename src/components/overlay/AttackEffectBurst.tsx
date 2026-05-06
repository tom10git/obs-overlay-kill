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
    let playRetryId: ReturnType<typeof window.setTimeout> | undefined
    let recoverAttempts = 0
    const fireOnce = () => {
      if (fired) return
      fired = true
      if (safetyId !== undefined) {
        window.clearTimeout(safetyId)
        safetyId = undefined
      }
      if (playRetryId !== undefined) {
        window.clearTimeout(playRetryId)
        playRetryId = undefined
      }
      onDoneRef.current?.()
    }

    const tryPlay = () => {
      // `play()` は失敗しうる（デコード準備/一時的なバッファ待ち等）。短時間だけリトライする。
      el.play().catch(() => {
        if (fired) return
        if (playRetryId !== undefined) window.clearTimeout(playRetryId)
        playRetryId = window.setTimeout(() => {
          if (!fired) void el.play().catch(() => { })
        }, 90)
      })
    }

    el.addEventListener('ended', fireOnce)
    const onError = () => {
      if (fired) return
      // 一時的な読み込み/デコード失敗を拾っても即終了せず、1回だけ復旧を試みる。
      if (recoverAttempts < 1) {
        recoverAttempts += 1
        try {
          el.load()
        } catch {
          // ignore
        }
        requestAnimationFrame(() => tryPlay())
        return
      }
      fireOnce()
    }
    el.addEventListener('error', onError)
    // ネットワーク/デコード都合で止まった時に再度 kick する
    el.addEventListener('waiting', tryPlay)
    el.addEventListener('stalled', tryPlay)
    const armSafetyFromDuration = () => {
      const d = el.duration
      if (Number.isFinite(d) && d > 0 && d < 600) {
        if (safetyId !== undefined) window.clearTimeout(safetyId)
        safetyId = window.setTimeout(fireOnce, Math.ceil((d + 0.4) * 1000))
      }
    }
    el.addEventListener('loadedmetadata', armSafetyFromDuration)
    if (el.readyState >= 1) armSafetyFromDuration()

    // マウント直後に先頭から確実に再生開始（autoPlay 任せだと環境によって一瞬止まることがある）
    try {
      el.currentTime = 0
    } catch {
      // ignore
    }
    requestAnimationFrame(() => tryPlay())

    return () => {
      el.removeEventListener('ended', fireOnce)
      el.removeEventListener('error', onError)
      el.removeEventListener('waiting', tryPlay)
      el.removeEventListener('stalled', tryPlay)
      el.removeEventListener('loadedmetadata', armSafetyFromDuration)
      if (safetyId !== undefined) window.clearTimeout(safetyId)
      if (playRetryId !== undefined) window.clearTimeout(playRetryId)
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
        preload="auto"
        disablePictureInPicture
        loop={false}
      />
    </div>
  )
}


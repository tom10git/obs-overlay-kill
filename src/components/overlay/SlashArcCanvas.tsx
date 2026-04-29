/**
 * 全画面の弧状斬撃フラッシュ＋火花（短時間）。内部解像度・FPS を抑えて描画負荷を下げる。
 */

import { useEffect, useRef, type CSSProperties } from 'react'
import { cappedCanvasBitmapSize } from '../../utils/canvasInternalSize'
import './SlashArcCanvas.css'

/** 60→30 で RAF 回数半減（見た目はほぼ同じ尺に近いようフレーム数も調整） */
const FPS = 30
const TOTAL_FRAMES = 24
const FRAME_MS = 1000 / FPS
const SPARK_COUNT = 10

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type SlashArcCanvasProps = {
  canvasWidthPx: number
  canvasHeightPx: number
  playbackKey: number
  onClipEnd?: () => void
}

export function SlashArcCanvas({
  canvasWidthPx,
  canvasHeightPx,
  playbackKey,
  onClipEnd,
}: SlashArcCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef(0)
  const onClipEndRef = useRef(onClipEnd)
  onClipEndRef.current = onClipEnd

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { w, h } = cappedCanvasBitmapSize(canvasWidthPx, canvasHeightPx, {
      maxLongEdge: 1280,
      minEdge: 64,
    })
    canvas.width = w
    canvas.height = h

    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })
    if (!ctx) {
      window.setTimeout(() => onClipEndRef.current?.(), 0)
      return
    }

    const cx = w * 0.5
    const cy = h * 0.5
    const diag = Math.hypot(w, h)
    const rng = mulberry32((playbackKey ^ 0x51a501) >>> 0)
    const sparkAngles: number[] = []
    const sparkDist: number[] = []
    for (let i = 0; i < SPARK_COUNT; i++) {
      sparkAngles.push(-0.55 + rng() * 1.1)
      sparkDist.push(0.22 + rng() * 0.48)
    }

    // スラッシュを「中心で回るだけ」ではなく、画面を横切るように移動させるための正規化量
    const moveSpan = diag * 0.46

    const clipMs = TOTAL_FRAMES * FRAME_MS
    let completed = false
    let safetyId: ReturnType<typeof window.setTimeout> | undefined

    const finishClip = () => {
      if (completed) return
      completed = true
      if (safetyId !== undefined) {
        window.clearTimeout(safetyId)
        safetyId = undefined
      }
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      const c = canvasRef.current
      if (c) {
        const x = c.getContext('2d', { alpha: true })
        if (x) x.clearRect(0, 0, c.width, c.height)
      }
      onClipEndRef.current?.()
    }

    const drawSlashBand = (
      ctx2: CanvasRenderingContext2D,
      f: number,
      phase: number,
      thick: number,
      coreA: number,
      edgeA: number
    ): { sweep: number; ang: number; move: number; len: number; halfT: number } => {
      const sweep = Math.min(1, Math.max(0, (f - 6 - phase * 2) / 18))
      const ang = -0.52 + sweep * 0.28
      const len = diag * 1.35
      const halfT = thick * (0.55 + sweep * 0.45)
      const move = (sweep - 0.5) * moveSpan

      const alphaMul = 0.35 + sweep * 0.65

      const renderAt = (sweepX: number, angX: number, halfTX: number, moveX: number, aMul: number) => {
        const g = ctx2.createLinearGradient(-len, 0, len, 0)
        g.addColorStop(0, `rgba(200, 235, 255, 0)`)
        g.addColorStop(0.42, `rgba(255, 255, 255, ${edgeA * 0.35 * aMul})`)
        g.addColorStop(0.5, `rgba(255, 255, 255, ${coreA * aMul})`)
        g.addColorStop(0.58, `rgba(200, 240, 255, ${edgeA * 0.4 * aMul})`)
        g.addColorStop(1, `rgba(120, 200, 255, 0)`)

        ctx2.save()
        ctx2.translate(cx, cy)
        ctx2.rotate(angX)
        ctx2.translate(0, moveX)
        ctx2.fillStyle = g
        ctx2.shadowColor = `rgba(180, 230, 255, ${coreA * 0.85 * aMul})`
        ctx2.shadowBlur = (16 + sweepX * 14) * (0.6 + aMul * 0.5)
        ctx2.fillRect(-len * 0.5, -halfTX, len, halfTX * 2)
        ctx2.shadowBlur = 0
        ctx2.restore()
      }

      // ほんの少し「残像」を描いて、移動しているように見せる
      if (sweep > 0.08) {
        const sweepBack = Math.max(0, sweep - 0.22)
        const angBack = -0.52 + sweepBack * 0.28
        const halfTBack = thick * (0.55 + sweepBack * 0.45)
        const moveBack = (sweepBack - 0.5) * moveSpan
        renderAt(sweepBack, angBack, halfTBack, moveBack, 0.22 + sweepBack * 0.28)
      }

      renderAt(sweep, ang, halfT, move, alphaMul)
      return { sweep, ang, move, len, halfT }
    }

    startRef.current = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startRef.current
      const f = Math.min(TOTAL_FRAMES - 1, Math.floor(elapsed / FRAME_MS))

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'

      if (f >= 4 && f < 22) {
        const fl = (f >= 10 && f <= 14 ? 0.14 : 0.06) * (1 - (f - 4) / 18)
        ctx.fillStyle = `rgba(255, 252, 245, ${fl})`
        ctx.fillRect(0, 0, w, h)
      }

      let mainBand: { sweep: number; ang: number; move: number; len: number; halfT: number } | null = null

      if (f >= 6 && f < 28) {
        mainBand = drawSlashBand(ctx, f, 0, 52, 0.95, 0.55)
      }
      if (f >= 10 && f < 34) {
        drawSlashBand(ctx, f, 1, 28, 0.5, 0.35)
      }

      // 命中（中心を横切る瞬間）に合わせたフラッシュ
      if (mainBand && f >= 10 && f < 23) {
        const centerHit =
          Math.max(0, 1 - Math.abs(mainBand.move) / (moveSpan * 0.25)) * Math.max(0, 1 - (f - 10) / 12)
        const rr = diag * 0.11 * (0.75 + mainBand.sweep * 0.6)
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr)
        g.addColorStop(0, `rgba(255,255,255,${0.48 * centerHit})`)
        g.addColorStop(0.22, `rgba(230,245,255,${0.22 * centerHit})`)
        g.addColorStop(0.55, `rgba(120,200,255,${0.08 * centerHit})`)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(cx, cy, rr, 0, Math.PI * 2)
        ctx.fill()
      }

      // 先端に寄せた火花で「斬ってる」感を作る
      if (mainBand && f >= 9 && f < 26) {
        const { ang, move, len } = mainBand
        const endXLocal = len * 0.45
        const xEnd = cx + Math.cos(ang) * endXLocal - move * Math.sin(ang)
        const yEnd = cy + Math.sin(ang) * endXLocal + move * Math.cos(ang)
        const axisCos = Math.cos(ang)
        const axisSin = Math.sin(ang)

        for (let i = 0; i < sparkAngles.length; i++) {
          const t = f - 9 - (i % 4) * 0.35
          if (t < 0 || t > 14) continue
          const u = t / 14
          const dist = sparkDist[i] * diag * (0.22 + u * 0.62)
          const xLocal = Math.cos(sparkAngles[i]!) * dist
          const yLocal = Math.sin(sparkAngles[i]!) * dist * 0.55
          const x = xEnd + xLocal * axisCos - yLocal * axisSin
          const y = yEnd + xLocal * axisSin + yLocal * axisCos
          const a = (1 - u) * 0.55 * (0.45 + mainBand.sweep * 0.55)
          const r = 2 + (1 - u) * 7
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255, 255, 255, ${a})`
          ctx.fill()
        }
      }

      if (elapsed >= clipMs - 0.001) {
        finishClip()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    safetyId = window.setTimeout(finishClip, clipMs + 80)

    return () => {
      if (safetyId !== undefined) window.clearTimeout(safetyId)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [canvasWidthPx, canvasHeightPx, playbackKey])

  const { w, h } = cappedCanvasBitmapSize(canvasWidthPx, canvasHeightPx, {
    maxLongEdge: 1280,
    minEdge: 64,
  })

  const rootStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    width: '100vw',
    height: '100vh',
    maxWidth: 'none',
    maxHeight: 'none',
    margin: 0,
    padding: 0,
    boxSizing: 'border-box',
    pointerEvents: 'none',
    /* HpGaugeTopBand の技名帯（10014）より前面（旧 10013 では帯に隠れる） */
    zIndex: 10020,
  }

  return (
    <div className="slash-arc-canvas-root" style={rootStyle} aria-hidden>
      <canvas ref={canvasRef} className="slash-arc-canvas" width={w} height={h} aria-hidden />
    </div>
  )
}

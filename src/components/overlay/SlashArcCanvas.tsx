/**
 * 全画面の弧状斬撃フラッシュ＋火花（短時間）。内部解像度・FPS を抑えて描画負荷を下げる。
 */

import { useEffect, useRef, type CSSProperties } from 'react'
import { cappedCanvasBitmapSize } from '../../utils/canvasInternalSize'
import './SlashArcCanvas.css'

/** Heavy situations: keep this effect short & cheap */
const TOTAL_MS = 560
const SLASH_MS = 190
const GAP_MS = 85
const SPARK_COUNT = 2

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x))
}

function easeOutCubic(x: number) {
  const t = 1 - clamp01(x)
  return 1 - t * t * t
}

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
  variant?: 'default' | 'tsuki'
  onClipEnd?: () => void
}

export function SlashArcCanvas({
  canvasWidthPx,
  canvasHeightPx,
  playbackKey,
  variant = 'default',
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
      // Keep it lighter than full-screen; this effect is often layered on top of WebM/other canvas.
      maxLongEdge: 640,
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

    // 左右に「斬りつける」イメージへ寄せ、画面の横方向に大きくスイングさせる
    const moveSpan = diag * 0.62

    const clipMs = TOTAL_MS
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
      dir: 1 | -1,
      u01: number,
      thick: number,
      coreA: number,
      edgeA: number
    ): { sweep: number; ang: number; move: number; len: number; halfT: number } => {
      // Each slash should "whoosh" past in a short window.
      const t01 = clamp01(u01)
      const sweep = easeOutCubic(t01)
      // Tilt: ~25–30deg (0.44–0.52rad). Small wiggle for life.
      const baseAng = dir === 1 ? -0.48 : 0.48
      const ang = baseAng + (sweep - 0.5) * 0.08
      const len = diag * 1.35
      // Fast pass: thinner at the start, thicker mid, then thin out.
      const thickPulse = 0.65 + Math.sin(t01 * Math.PI) * 0.55
      const halfT = thick * 0.5 * thickPulse
      // Start further off-screen so it feels like a pass-through.
      const move = (-0.68 + 1.36 * sweep) * moveSpan * 0.5 * dir

      const alphaMul = (0.25 + sweep * 0.75) * (1 - Math.pow(t01, 1.7) * 0.35)

      const renderAt = (sweepX: number, angX: number, halfTX: number, moveX: number, aMul: number) => {
        // Render only a short blade segment that moves across the screen.
        const segHalf = diag * 0.28
        // For tsuki, keep the crescent shape itself stable and move the whole thing.
        // (If we also slide the arc center far across a huge radius, it looks almost straight.)
        const headX = variant === 'tsuki' ? 0 : (-0.62 + 1.24 * sweepX) * (len * 0.55)
        // Cheaper than gradients: draw 3 layered rects (core + edges).
        const coreAlpha = coreA * aMul
        const edgeAlpha = edgeA * 0.22 * aMul

        ctx2.save()
        // Move first in world space (left-right), then rotate the band.
        ctx2.translate(cx + moveX, cy)
        ctx2.rotate(angX)
        ctx2.globalCompositeOperation = 'lighter'

        if (variant === 'tsuki') {
          // Crescent-like curved slash (Moon blade).
          // Use a true arc so it doesn't read as a long rectangle.
          const span = segHalf * 1.35
          // Smaller radius => visibly curved (avoid "long rectangle" impression)
          const r = span * 0.48
          const cxp = headX
          const cyp = 0
          // Open angle wider to show a clear crescent sweep
          const a0 = -2.75
          const a1 = -0.35

          ctx2.save()
          // Orient the crescent so it reads like a "moon blade" slash.
          ctx2.translate(cxp, cyp)
          ctx2.rotate(dir === 1 ? 0.42 : -0.42)
          // Slight squash makes it feel more like a crescent than a circle.
          ctx2.scale(1, 0.64)
          ctx2.translate(-cxp, -cyp)

          ctx2.lineCap = 'round'
          ctx2.lineJoin = 'round'
          // Crescent silhouette + tapered ends:
          // draw segmented arcs where lineWidth tapers near both ends (sin curve).
          const carveDx = segHalf * 0.28 * (dir === 1 ? 1 : -1)
          const carveDy = segHalf * -0.12
          const rIn = r * 0.94
          const segN = 7

          const taper = (tt: number) => {
            // 0..1 -> 0..1 with sharp ends
            const s = Math.sin(Math.PI * clamp01(tt))
            // Higher exponent => thinner, sharper tips.
            return Math.max(0, Math.pow(s, 2.6))
          }

          const drawSegmentedArc = (
            which: 'outer' | 'inner',
            cx0: number,
            cy0: number,
            rad: number,
            aa0: number,
            aa1: number,
            baseW: number,
            col: string,
            comp: GlobalCompositeOperation
          ) => {
            ctx2.save()
            ctx2.globalCompositeOperation = comp
            ctx2.strokeStyle = col
            ctx2.lineCap = 'round'
            ctx2.lineJoin = 'round'
            for (let i = 0; i < segN; i++) {
              const t0 = i / segN
              const t1 = (i + 1) / segN
              const tm = (t0 + t1) * 0.5
              const wMul = taper(tm)
              if (wMul <= 0.001) continue
              // Inner carve should be slightly fatter so ends get sharper.
              const w = baseW * (which === 'inner' ? (0.86 + wMul * 0.78) : (0.52 + wMul * 1.05))
              ctx2.lineWidth = w
              ctx2.beginPath()
              ctx2.arc(cx0, cy0, rad, aa0 + (aa1 - aa0) * t0, aa0 + (aa1 - aa0) * t1, false)
              ctx2.stroke()
            }
            ctx2.restore()
          }

          // Outer glow strokes (2 layers)
          drawSegmentedArc(
            'outer',
            cxp,
            cyp,
            r,
            a0,
            a1,
            halfTX * 2.9,
            `rgba(140,235,255,${edgeAlpha * 0.55})`,
            'lighter'
          )
          drawSegmentedArc(
            'outer',
            cxp,
            cyp,
            r,
            a0,
            a1,
            halfTX * 2.2,
            `rgba(220,250,255,${edgeAlpha * 0.62})`,
            'lighter'
          )

          // Carve inner arc (destination-out) to form crescent body
          drawSegmentedArc('inner', cxp + carveDx, cyp + carveDy, rIn, a0 + 0.02, a1 - 0.02, halfTX * 2.3, 'rgba(0,0,0,1)', 'destination-out')

          // Bright core edge
          drawSegmentedArc(
            'outer',
            cxp,
            cyp,
            r,
            a0 + 0.01,
            a1 - 0.01,
            halfTX * 1.2,
            `rgba(255,255,255,${coreAlpha})`,
            'lighter'
          )

          ctx2.restore()
        } else {
          // soft edge
          ctx2.fillStyle = `rgba(200,240,255,${edgeAlpha * 0.55})`
          ctx2.fillRect(headX - segHalf, -halfTX * 1.35, segHalf * 2, halfTX * 2.7)
          // bright core
          ctx2.fillStyle = `rgba(255,255,255,${coreAlpha})`
          ctx2.fillRect(headX - segHalf, -halfTX * 0.45, segHalf * 2, halfTX * 0.9)
          // thin highlight
          ctx2.fillStyle = `rgba(255,255,255,${coreAlpha * 0.65})`
          ctx2.fillRect(headX - segHalf, -1.2, segHalf * 2, 2.4)
        }

        ctx2.restore()
      }

      // afterimages: sell fast movement (cheap, just 2 extra draws)
      if (t01 > 0.06) {
        const back1 = clamp01(t01 - 0.12)
        const s1 = easeOutCubic(back1)
        renderAt(s1, baseAng + (s1 - 0.5) * 0.08, thick * 0.5 * (0.62 + Math.sin(back1 * Math.PI) * 0.45), (-0.68 + 1.36 * s1) * moveSpan * 0.5 * dir, 0.22)
      }
      if (t01 > 0.1) {
        const back2 = clamp01(t01 - 0.22)
        const s2 = easeOutCubic(back2)
        renderAt(s2, baseAng + (s2 - 0.5) * 0.08, thick * 0.5 * (0.6 + Math.sin(back2 * Math.PI) * 0.4), (-0.68 + 1.36 * s2) * moveSpan * 0.5 * dir, 0.12)
      }

      renderAt(sweep, ang, halfT, move, alphaMul)
      return { sweep, ang, move, len, halfT }
    }

    startRef.current = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startRef.current
      const t = Math.max(0, elapsed)

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'

      let mainBand: { sweep: number; ang: number; move: number; len: number; halfT: number } | null = null
      // Two slashes with an explicit gap so it doesn't look "always on".
      const s1 = 70
      const s2 = s1 + SLASH_MS + GAP_MS
      if (t >= s1 && t < s1 + SLASH_MS) {
        mainBand = drawSlashBand(ctx, 1, (t - s1) / SLASH_MS, 56, 0.95, 0.55)
      } else if (t >= s2 && t < s2 + SLASH_MS) {
        mainBand = drawSlashBand(ctx, -1, (t - s2) / SLASH_MS, 56, 0.95, 0.55)
      }

      // 命中（中心を横切る瞬間）に合わせたフラッシュ
      if (mainBand) {
        // Cheap flash: just a faint white wash near the center crossing.
        const centerHit = Math.max(0, 1 - Math.abs(mainBand.move) / (moveSpan * 0.18))
        const a = 0.08 * centerHit * (0.35 + mainBand.sweep * 0.65)
        if (a > 0.002) {
          ctx.fillStyle = `rgba(255,255,255,${a})`
          ctx.fillRect(0, 0, w, h)
        }
      }

      // 先端に寄せた火花で「斬ってる」感を作る
      if (mainBand) {
        const { ang, move, len } = mainBand
        const endXLocal = len * 0.45
        // band is rendered at (cx + move, cy)
        const xEnd = (cx + move) + Math.cos(ang) * endXLocal
        const yEnd = cy + Math.sin(ang) * endXLocal
        const axisCos = Math.cos(ang)
        const axisSin = Math.sin(ang)

        // Very few sparks, time-based (no stepping).
        for (let i = 0; i < sparkAngles.length; i++) {
          const u = clamp01(mainBand.sweep)
          if (u < 0.22 || u > 0.92) continue
          const dist = sparkDist[i]! * diag * (0.18 + u * 0.58)
          const xLocal = Math.cos(sparkAngles[i]!) * dist
          const yLocal = Math.sin(sparkAngles[i]!) * dist * 0.5
          const x = xEnd + xLocal * axisCos - yLocal * axisSin
          const y = yEnd + xLocal * axisSin + yLocal * axisCos
          const a = (1 - u) * 0.18
          if (a < 0.006) continue
          const r = 1.5 + (1 - u) * 4.5
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,255,255,${a})`
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
  }, [canvasWidthPx, canvasHeightPx, playbackKey, variant])

  const { w, h } = cappedCanvasBitmapSize(canvasWidthPx, canvasHeightPx, {
    maxLongEdge: 640,
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

/**
 * コナミバフ: 波形の「炎本体」はなし。激しく燃えているときの火の粉のみ（Canvas + lighter）。
 */

import { useEffect, useRef } from 'react'
import './KonamiBurnCanvas.css'

interface KonamiBurnCanvasProps {
  canvasWidthPx: number
  canvasHeightPx: number
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

type SparkKind = 'glow' | 'streak'

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  r: number
  spin: number
  kind: SparkKind
}

function spawnSpark(w: number, h: number, init: boolean): Spark {
  const fierceBed = init ? Math.random() < 0.72 : Math.random() < 0.88
  let x: number
  let y: number

  if (fierceBed) {
    x = w * (0.04 + Math.random() * 0.92)
    y = h * (0.88 + Math.random() * 0.12)
  } else {
    const side = Math.random() < 0.5
    x = side ? -4 - Math.random() * 40 : w + 4 + Math.random() * 40
    y = h * (0.35 + Math.random() * 0.62)
  }

  const spread = 1.35 + Math.random() * 0.95
  const aim = -Math.PI / 2 + (Math.random() - 0.5) * spread
  const speed = 2.2 + Math.random() * 7.5
  const kind: SparkKind = Math.random() < 0.58 ? 'streak' : 'glow'

  return {
    x,
    y,
    vx: Math.cos(aim) * speed * (0.85 + Math.random() * 0.45),
    vy: Math.sin(aim) * speed * (0.75 + Math.random() * 0.55),
    life: 0,
    maxLife: (kind === 'streak' ? 8 : 14) + Math.random() * (kind === 'streak' ? 28 : 48),
    r: kind === 'streak' ? 0.35 + Math.random() * 1.45 : 0.5 + Math.random() * 2.6,
    spin: (Math.random() - 0.5) * 0.45,
    kind,
  }
}

export function KonamiBurnCanvas({ canvasWidthPx, canvasHeightPx }: KonamiBurnCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const w = Math.max(48, Math.round(canvasWidthPx))
    const h = Math.max(80, Math.round(canvasHeightPx))
    canvas.width = w
    canvas.height = h

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const area = w * h
    const sparkN = clamp(Math.floor(area / 420), 140, 340)
    const sparks: Spark[] = []
    for (let i = 0; i < sparkN; i++) sparks.push(spawnSpark(w, h, true))

    let frame = 0
    const tick = () => {
      frame++

      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'

      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i]
        s.life += 1
        s.vy += 0.044
        s.x += s.vx
        s.y += s.vy
        s.vx *= 0.991

        const lifeT = s.life / s.maxLife
        if (s.life >= s.maxLife || s.y < -24 || s.x < -50 || s.x > w + 50) {
          sparks[i] = spawnSpark(w, h, false)
          continue
        }

        const flicker = 0.82 + 0.18 * Math.sin(frame * 0.9 + i * 0.37)
        const alpha = flicker * (1 - lifeT) * (0.45 + 0.55 * (1 - lifeT))

        if (s.kind === 'streak') {
          const tail = 2.2 + s.r * 4.5
          const x0 = s.x - (s.vx / (Math.abs(s.vx) + Math.abs(s.vy) + 0.01)) * tail
          const y0 = s.y - (s.vy / (Math.abs(s.vx) + Math.abs(s.vy) + 0.01)) * tail
          const g = ctx.createLinearGradient(x0, y0, s.x, s.y)
          g.addColorStop(0, `rgba(255, 140, 40, 0)`)
          g.addColorStop(0.35, `rgba(255, 90, 20, ${alpha * 0.55})`)
          g.addColorStop(0.75, `rgba(255, 230, 160, ${alpha * 0.95})`)
          g.addColorStop(1, `rgba(255, 255, 245, ${alpha})`)
          ctx.strokeStyle = g
          ctx.lineWidth = clamp(s.r * 1.8, 0.6, 3.2)
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(x0, y0)
          ctx.lineTo(s.x, s.y)
          ctx.stroke()

          ctx.fillStyle = `rgba(255, 252, 235, ${alpha * 0.9})`
          ctx.beginPath()
          ctx.arc(s.x, s.y, clamp(s.r * 0.9, 0.4, 2.2), 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.save()
          ctx.translate(s.x, s.y)
          ctx.rotate(s.life * s.spin)
          const rad = s.r * (3.2 + 1.8 * (1 - lifeT))
          const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, rad)
          grd.addColorStop(0, `rgba(255, 255, 248, ${alpha})`)
          grd.addColorStop(0.25, `rgba(255, 220, 120, ${alpha * 0.95})`)
          grd.addColorStop(0.55, `rgba(255, 150, 50, ${alpha * 0.5})`)
          grd.addColorStop(1, 'rgba(255, 70, 20, 0)')
          ctx.fillStyle = grd
          ctx.beginPath()
          ctx.arc(0, 0, rad, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }

      ctx.globalCompositeOperation = 'source-over'
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [canvasWidthPx, canvasHeightPx])

  const w = Math.max(48, Math.round(canvasWidthPx))
  const h = Math.max(80, Math.round(canvasHeightPx))

  return (
    <canvas
      ref={canvasRef}
      className="konami-burn-canvas konami-burn-canvas--freeform"
      width={w}
      height={h}
      aria-hidden
    />
  )
}

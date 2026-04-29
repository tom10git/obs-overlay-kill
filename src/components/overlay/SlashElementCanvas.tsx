/**
 * 斬撃モチーフ専用の「属性現象」Canvas。
 * kind（tempest/inferno/glacier/void/...）で見た目を変え、技名の頭イメージを補強する。
 */
import { useEffect, useMemo, useRef } from 'react'
import type { TechniqueEffectKind } from '../../constants/techniqueEffectKinds'
import './SlashElementCanvas.css'

type BoltPoint = { x: number; y: number }

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function boltPolyline(rng: () => number, w: number, h: number, t: number, tilt: number): BoltPoint[] {
  // 画面外→画面外を走る稲妻（中点変位風）
  const x0 = -w * 0.15
  const y0 = h * (0.2 + rng() * 0.6)
  const x1 = w * 1.15
  const y1 = y0 + (rng() - 0.5) * h * 0.25

  const segs = 10
  const pts: BoltPoint[] = []
  for (let i = 0; i <= segs; i++) {
    const p = i / segs
    const bx = lerp(x0, x1, p)
    const by = lerp(y0, y1, p)
    const env = Math.sin(p * Math.PI)
    const wob = (rng() - 0.5) * h * (0.03 + env * 0.1)
    pts.push({ x: bx, y: by + wob + Math.sin(t * 18 + i) * (h * 0.004) })
  }

  // 軽い傾き（風/雷刃で水平に寄せすぎない）
  if (Math.abs(tilt) > 0.001) {
    const cx = w * 0.5
    const cy = h * 0.5
    const s = Math.sin(tilt)
    const c = Math.cos(tilt)
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!
      const dx = p.x - cx
      const dy = p.y - cy
      pts[i] = { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c }
    }
  }
  return pts
}

function strokePolyline(
  ctx: CanvasRenderingContext2D,
  pts: BoltPoint[],
  layers: Array<{ lw: number; a: number; color: string; blur: number }>
): void {
  if (pts.length < 2) return
  for (const layer of layers) {
    if (layer.a <= 0.01) continue
    ctx.save()
    ctx.globalAlpha = layer.a
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = layer.lw
    ctx.strokeStyle = layer.color
    ctx.shadowBlur = layer.blur
    ctx.shadowColor = layer.color
    ctx.beginPath()
    ctx.moveTo(pts[0]!.x, pts[0]!.y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y)
    ctx.stroke()
    ctx.restore()
  }
}

type Ember = { x: number; y0: number; r: number; sp: number; ph: number }
type Shard = { x: number; y: number; w: number; h: number; rot: number; sp: number; ph: number }
type Wisp = { x: number; y: number; rx: number; ry: number; rot: number; ph: number; sp: number }

export interface SlashElementCanvasProps {
  kind: TechniqueEffectKind
  seed: number
  slashHead?: string
}

export function SlashElementCanvas({ kind, seed, slashHead }: SlashElementCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  const pre = useMemo(() => {
    const rng = mulberry32((seed ^ 0x8d12a93) >>> 0)
    const embers: Ember[] = []
    const shards: Shard[] = []
    const wisps: Wisp[] = []
    for (let i = 0; i < 48; i++) {
      embers.push({
        x: rng(),
        y0: rng(),
        r: 0.6 + rng() * 1.8,
        sp: 0.25 + rng() * 0.9,
        ph: rng(),
      })
    }
    for (let i = 0; i < 16; i++) {
      shards.push({
        x: rng(),
        y: rng(),
        w: 0.02 + rng() * 0.05,
        h: 0.01 + rng() * 0.03,
        rot: (rng() - 0.5) * Math.PI,
        sp: 0.12 + rng() * 0.35,
        ph: rng(),
      })
    }
    for (let i = 0; i < 10; i++) {
      wisps.push({
        x: rng(),
        y: rng(),
        rx: 0.12 + rng() * 0.25,
        ry: 0.08 + rng() * 0.18,
        rot: rng() * Math.PI,
        ph: rng(),
        sp: 0.08 + rng() * 0.25,
      })
    }
    return { embers, shards, wisps }
  }, [seed])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')

    const fit = () => {
      const p = canvas.parentElement
      if (!p) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cssW = Math.max(1, Math.floor(p.clientWidth))
      const cssH = Math.max(1, Math.floor(p.clientHeight))
      const bw = Math.max(1, Math.floor(cssW * dpr))
      const bh = Math.max(1, Math.floor(cssH * dpr))
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw
        canvas.height = bh
      }
    }

    const draw = (nowMs: number) => {
      const p = canvas.parentElement
      if (!p) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.max(1, p.clientWidth)
      const h = Math.max(1, p.clientHeight)
      const t = nowMs * 0.001
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // 斬撃の“属性現象”は軽く、主役の刃線を邪魔しない強度に。
      ctx.globalCompositeOperation = 'lighter'

      if (kind === 'tempest') {
        const rng = mulberry32((seed ^ 0x51c3 ^ (Math.floor(t * 8) & 0xff)) >>> 0)
        const isWind = slashHead === 'kaze'
        const intensity = mq.matches ? 0.55 : 0.25 + Math.abs(Math.sin(t * (isWind ? 6 : 10))) * 0.6

        if (!isWind) {
          // 雷刃: 稲妻が走る
          const boltN = mq.matches ? 1 : 2
          for (let b = 0; b < boltN; b++) {
            const pts = boltPolyline(rng, w, h, t + b * 0.12, (rng() - 0.5) * 0.22)
            strokePolyline(ctx, pts, [
              { lw: 10, a: 0.09 * intensity, color: 'rgba(90,210,255,1)', blur: 18 },
              { lw: 4, a: 0.22 * intensity, color: 'rgba(180,235,255,1)', blur: 10 },
              { lw: 1.6, a: 0.7 * intensity, color: 'rgba(255,255,255,1)', blur: 4 },
            ])
          }
          // 稲妻の残光
          const rr = Math.min(w, h) * 0.38
          const g = ctx.createRadialGradient(w * 0.52, h * 0.52, 0, w * 0.52, h * 0.52, rr)
          g.addColorStop(0, `rgba(120,210,255,${0.08 * intensity})`)
          g.addColorStop(0.6, `rgba(60,140,255,${0.03 * intensity})`)
          g.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(w * 0.52, h * 0.52, rr, 0, Math.PI * 2)
          ctx.fill()
        } else {
          // 風刃: 風斬り（曲線の風筋を“面”として描く）
          const streaks = mq.matches ? 3 : 6
          ctx.save()
          for (let i = 0; i < streaks; i++) {
            const y = h * (0.18 + rng() * 0.64)
            const len = w * (0.55 + rng() * 0.5)
            const x0 = -w * 0.2 + ((t * (0.55 + rng() * 0.8) + rng()) % 1) * (w * 1.4)
            const ang = -0.08 + (rng() - 0.5) * 0.18
            ctx.save()
            ctx.translate(x0, y)
            ctx.rotate(ang)
            const gr = ctx.createLinearGradient(0, 0, len, 0)
            gr.addColorStop(0, 'rgba(255,255,255,0)')
            gr.addColorStop(0.35, `rgba(210,245,255,${0.14 * intensity})`)
            gr.addColorStop(0.5, `rgba(255,255,255,${0.28 * intensity})`)
            gr.addColorStop(1, 'rgba(255,255,255,0)')
            ctx.fillStyle = gr
            ctx.shadowBlur = 14
            ctx.shadowColor = `rgba(180,235,255,${0.3 * intensity})`
            ctx.beginPath()
            ctx.ellipse(len * 0.5, 0, len * 0.5, h * 0.035, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
          }
          ctx.restore()
        }
      }

      if (kind === 'inferno') {
        const inten = mq.matches ? 0.6 : 0.22 + Math.abs(Math.sin(t * 7.2)) * 0.55
        for (const e of pre.embers) {
          const x = e.x * w + Math.sin(t * 2.2 + e.ph * 10) * w * 0.02
          const cycle = (t * e.sp + e.ph) % 1
          const y = h * (0.95 - cycle * 1.15)
          const a = (1 - cycle) * 0.55 * inten
          const r = e.r * (0.7 + (1 - cycle) * 0.6)
          ctx.fillStyle = `rgba(255, ${Math.floor(140 + e.ph * 100)}, 50, ${a})`
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
        }
        const rr = Math.min(w, h) * 0.42
        const g = ctx.createRadialGradient(w * 0.5, h * 0.68, 0, w * 0.5, h * 0.68, rr)
        g.addColorStop(0, `rgba(255,180,80,${0.12 * inten})`)
        g.addColorStop(0.5, `rgba(255,90,30,${0.06 * inten})`)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(w * 0.5, h * 0.68, rr, 0, Math.PI * 2)
        ctx.fill()
      }

      if (kind === 'glacier') {
        const isWater = slashHead === 'aoi'
        const inten = mq.matches ? 0.55 : 0.25 + Math.abs(Math.sin(t * (isWater ? 5.8 : 3.4))) * 0.6
        const u = Math.min(w, h)
        if (!isWater) {
          // 氷片
          for (const s of pre.shards) {
            const phase = (t * s.sp + s.ph) % 1
            const x = s.x * w + Math.sin(t * 0.9 + s.ph * 8) * w * 0.04
            const y = (s.y * h + phase * h * 0.25) % (h * 1.1) - h * 0.05
            const ww = u * s.w
            const hh = u * s.h
            ctx.save()
            ctx.translate(x, y)
            ctx.rotate(s.rot + t * 0.35)
            const g = ctx.createLinearGradient(-ww, -hh, ww, hh)
            g.addColorStop(0, `rgba(230,255,255,${0.05 * inten})`)
            g.addColorStop(0.5, `rgba(120,235,255,${0.22 * inten})`)
            g.addColorStop(1, 'rgba(0,0,0,0)')
            ctx.fillStyle = g
            ctx.fillRect(-ww, -hh, ww * 2, hh * 2)
            ctx.restore()
          }
        } else {
          // 蒼刃: 滝のような激しい水（縦ストリーク＋スプレー）
          const cols = mq.matches ? 12 : 22
          for (let i = 0; i < cols; i++) {
            const x = ((i + (seed % 7) * 0.13) / cols) * w
            const speed = 0.9 + (i % 6) * 0.12
            const phase = (t * speed + (i * 0.17 + (seed % 97) * 0.01)) % 1
            const y = -h * 0.2 + phase * h * 1.4
            const ww = w * (0.02 + (i % 5) * 0.002)
            const hh = h * (0.45 + (i % 7) * 0.06)
            const sway = Math.sin(t * 2.2 + i) * w * 0.012
            const gr = ctx.createLinearGradient(0, y - hh * 0.2, 0, y + hh)
            gr.addColorStop(0, 'rgba(255,255,255,0)')
            gr.addColorStop(0.25, `rgba(200,245,255,${0.12 * inten})`)
            gr.addColorStop(0.55, `rgba(120,235,255,${0.22 * inten})`)
            gr.addColorStop(1, 'rgba(255,255,255,0)')
            ctx.fillStyle = gr
            ctx.fillRect(x + sway, y, ww, hh)
          }
          // spray
          const sprayN = mq.matches ? 10 : 22
          for (let s = 0; s < sprayN; s++) {
            const rx = ((s * 73 + (seed % 97)) % 997) / 997
            const px = rx * w
            const cy = (t * (0.9 + (s % 5) * 0.12) + (s * 0.07)) % 1
            const py = h * (0.25 + cy * 0.6)
            const r = 0.8 + (s % 3) * 0.9
            const a = (1 - cy) * 0.18 * inten
            ctx.fillStyle = `rgba(230,255,255,${a})`
            ctx.beginPath()
            ctx.arc(px + Math.sin(t * 3.1 + s) * 6, py, r, 0, Math.PI * 2)
            ctx.fill()
          }
          const hazeR = u * 0.5
          const haze = ctx.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, hazeR)
          haze.addColorStop(0, `rgba(120,235,255,${0.05 * inten})`)
          haze.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = haze
          ctx.beginPath()
          ctx.arc(w * 0.5, h * 0.55, hazeR, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (kind === 'void' || kind === 'phantom') {
        const inten = mq.matches ? 0.5 : 0.25 + Math.abs(Math.sin(t * 2.1)) * 0.5
        for (const w0 of pre.wisps) {
          const x = w0.x * w + Math.sin(t * (0.9 + w0.sp) + w0.ph * 8) * w * 0.06
          const y = w0.y * h + Math.cos(t * (1.1 + w0.sp) + w0.ph * 9) * h * 0.05
          const rx = Math.min(w, h) * w0.rx
          const ry = Math.min(w, h) * w0.ry
          const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry) * 1.1)
          const col =
            kind === 'void'
              ? `rgba(190,140,255,${0.08 * inten})`
              : `rgba(220,180,255,${0.09 * inten})`
          g.addColorStop(0, col)
          g.addColorStop(0.6, `rgba(120,60,200,${0.03 * inten})`)
          g.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.ellipse(x, y, rx, ry, w0.rot + t * 0.08, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // 他 kind は “軽い光” に留める（必要なら追加実装）
      if (kind === 'radiance' || kind === 'nova' || kind === 'plasma' || kind === 'tremor' || kind === 'meteor') {
        const inten = mq.matches ? 0.45 : 0.18 + Math.abs(Math.sin(t * 2.6)) * 0.45
        const rr = Math.min(w, h) * 0.48
        if (kind === 'radiance' && slashHead === 'tsuki') {
          // 月刃: 淡い月光粒（常駐）
          const moonR = Math.min(w, h) * 0.46
          const moon = ctx.createRadialGradient(w * 0.55, h * 0.48, 0, w * 0.55, h * 0.48, moonR)
          moon.addColorStop(0, `rgba(255,255,252,${0.1 * inten})`)
          moon.addColorStop(0.32, `rgba(235,240,255,${0.06 * inten})`)
          moon.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = moon
          ctx.beginPath()
          ctx.arc(w * 0.55, h * 0.48, moonR, 0, Math.PI * 2)
          ctx.fill()

          // 粒は「多く・小さく・淡く」して上品に
          const particles = mq.matches ? 28 : 64
          for (let i = 0; i < particles; i++) {
            const rx = ((seed ^ (i * 997)) % 10007) / 10007
            const ry = ((seed ^ (i * 131)) % 10009) / 10009
            const sp = 0.035 + ((i % 9) * 0.008)
            const cycle = (t * sp + rx * 0.7 + ry * 0.3) % 1
            const driftX = Math.sin(t * (0.25 + (i % 5) * 0.05) + i) * 0.012
            const driftY = Math.cos(t * (0.22 + (i % 4) * 0.06) + i * 0.7) * 0.008
            const x = (rx + driftX) * w
            // ゆっくり上方向に流れる（滝の逆）
            const y = (ry + (1 - cycle) * 0.22 + driftY) * h
            const r = 0.55 + (i % 4) * 0.35
            const tw = 0.75 + Math.abs(Math.sin(t * 1.4 + i * 0.9)) * 0.25
            const a = (0.02 + (1 - cycle) * 0.05) * tw * inten
            ctx.fillStyle = `rgba(255,255,252,${a})`
            ctx.beginPath()
            ctx.arc(x, y, r, 0, Math.PI * 2)
            ctx.fill()
          }
        } else {
          const g = ctx.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, rr)
          const col =
            kind === 'radiance'
              ? `rgba(255,230,160,${0.08 * inten})`
              : kind === 'nova'
                ? `rgba(255,200,100,${0.08 * inten})`
                : kind === 'plasma'
                  ? `rgba(255,180,255,${0.08 * inten})`
                  : kind === 'tremor'
                    ? `rgba(255,220,160,${0.05 * inten})`
                    : `rgba(255,220,180,${0.06 * inten})`
          g.addColorStop(0, col)
          g.addColorStop(0.55, 'rgba(0,0,0,0)')
          g.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(w * 0.5, h * 0.55, rr, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const ro = new ResizeObserver(() => {
      fit()
      draw(performance.now())
    })
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    fit()

    const onMq = () => draw(performance.now())
    mq.addEventListener('change', onMq)

    if (mq.matches) {
      draw(0)
    } else {
      const loop = (now: number) => {
        draw(now)
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      mq.removeEventListener('change', onMq)
    }
  }, [kind, pre, seed])

  // Canvas の中身は親のサイズに追従する（TechniqueBurstArtCanvas と同様）
  return <canvas ref={ref} className="tefx-layer tefx-slash-element-canvas" aria-hidden />
}


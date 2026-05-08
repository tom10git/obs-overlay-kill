/**
 * Canvas-only full timeline technique burst.
 * Kept intentionally small; effects will be added incrementally.
 */
import { useEffect, useMemo, useRef } from 'react'
import type { TechniqueEffectKind } from '../../constants/techniqueEffectKinds'
import { getTechniqueBurstArtParams } from '../../constants/techniqueEffectKinds'
import { MONSTER_HUNTER_VERBATIM_TECHNIQUE_NAMES } from '../../constants/comboTechniqueNames'

export interface TechniqueEffectBurstCanvasLayerProps {
  techniqueName: string
  kind: TechniqueEffectKind
  /** ambient を止めるだけ。burst は必ず再生 */
  suppressAmbient?: boolean
  durationMs?: number
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x))
}

function smoothstep(a: number, b: number, x: number) {
  const t = clamp01((x - a) / Math.max(1e-6, b - a))
  return t * t * (3 - 2 * t)
}

function easeOutCubic(x: number) {
  const t = 1 - clamp01(x)
  return 1 - t * t * t
}

function kindHue(kind: TechniqueEffectKind): number {
  switch (kind) {
    case 'inferno':
      return 18
    case 'meteor':
      return 28
    case 'tempest':
      return 200
    case 'glacier':
      return 192
    case 'nova':
      return 36
    case 'tremor':
      return 24
    default:
      return 220
  }
}

type Profile = 'slash' | 'shooting' | 'magic' | 'explosion' | 'lightning' | 'ice' | 'fire' | 'other'

const MH_VERBATIM_SET = new Set<string>(MONSTER_HUNTER_VERBATIM_TECHNIQUE_NAMES)

function detectProfile(kind: TechniqueEffectKind, techniqueName: string): Profile {
  const n = techniqueName.trim()
  if (/斬|断|裂|刃/.test(n)) return 'slash'
  if (/弾|砲|射|銃/.test(n)) return 'shooting'
  if (/陣|呪|詠|法|術/.test(n)) return 'magic'
  if (kind === 'meteor' || kind === 'nova' || kind === 'tremor') return 'explosion'
  if (kind === 'tempest') return 'lightning'
  if (kind === 'glacier') return 'ice'
  if (kind === 'inferno') return 'fire'
  return 'other'
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type SlashCut = { t0: number; t1: number; x0: number; y0: number; x1: number; y1: number; w: number }
type Bullet = { t0: number; t1: number; y0: number; y1: number; r: number }
type Ember = { t0: number; life: number; x: number; y: number; vx: number; vy: number; r: number }
type Blood = { t0: number; life: number; x: number; y: number; vx: number; vy: number; r: number }
type IceShard = { t0: number; life: number; x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number }
type MhSpark = { t0: number; life: number; x: number; y: number; vx: number; vy: number; r: number }
type MhClaw = { t0: number; t1: number; x0: number; y0: number; x1: number; y1: number; w: number }

export function TechniqueEffectBurstCanvasLayer({
  techniqueName,
  kind,
  suppressAmbient = false,
  durationMs = 3200,
}: TechniqueEffectBurstCanvasLayerProps) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number>(0)
  const startMsRef = useRef<number>(-1)
  const prevFrameRef = useRef<number>(-1)

  // When other heavy effects (WebM decode / large canvas) are active, run this layer at a lower FPS.
  // This keeps the “burst cue” while avoiding main-thread stalls.
  const targetFps = suppressAmbient ? 30 : 60
  const frameMs = 1000 / targetFps

  const pre = useMemo(() => {
    const art = getTechniqueBurstArtParams(techniqueName)
    const seed = art.seed | 0
    const rng = mulberry32(seed ^ 0xa53c9e1b)
    const isMhVerbatim = MH_VERBATIM_SET.has(techniqueName.trim())
    const profile = detectProfile(kind, techniqueName)
    const isRush = /ラッシュ|RUSH/i.test(techniqueName)
    const durS = Math.max(0.6, durationMs / 1000)

    const slashCuts: SlashCut[] = []
    if (profile === 'slash') {
      // Rush: more cuts, but keep each cut cheap to draw.
      const n = (isRush ? 9 : 5) + Math.floor(rng() * (isRush ? 4 : 3))
      for (let i = 0; i < n; i++) {
        const t0 = (0.06 + rng() * 0.64) * durS
        const t1 = Math.min(durS * 0.98, t0 + (0.10 + rng() * 0.16) * durS)
        const dir = rng() > 0.5 ? 1 : -1
        // Keep slashes closer to "left-right" movement (less diagonal) so it reads like horizontal swipes.
        const slope = (rng() - 0.5) * 0.16
        const yMid = 0.22 + rng() * 0.62
        const span = 1.55 + rng() * 0.55
        const x0 = dir === 1 ? -0.25 : 1.25
        const x1 = x0 + dir * span
        const y0 = yMid - slope * 0.5
        const y1 = yMid + slope * 0.5
        const w = (isRush ? 0.006 : 0.007) + rng() * (isRush ? 0.01 : 0.012)
        slashCuts.push({ t0, t1, x0, y0, x1, y1, w })
      }
    }

    const bullets: Bullet[] = []
    if (profile === 'shooting') {
      const n = 8 + Math.floor(rng() * 6)
      for (let i = 0; i < n; i++) {
        const t0 = (0.05 + rng() * 0.55) * durS
        const t1 = Math.min(durS * 0.98, t0 + (0.12 + rng() * 0.16) * durS)
        const y = 0.16 + rng() * 0.68
        bullets.push({ t0, t1, y0: y, y1: y + (rng() - 0.5) * 0.12, r: 0.0035 + rng() * 0.004 })
      }
    }

    const embers: Ember[] = []
    if (profile === 'explosion' || profile === 'fire') {
      const n = 120 + Math.floor(rng() * 90)
      for (let i = 0; i < n; i++) {
        const t0 = (0.06 + rng() * 0.3) * durS
        embers.push({
          t0,
          life: (0.35 + rng() * 0.55) * durS,
          x: (rng() - 0.5) * 0.28,
          y: (rng() - 0.5) * 0.18,
          vx: (rng() - 0.5) * 1.15,
          vy: -(0.25 + rng() * 1.05),
          r: 0.8 + rng() * 2.8,
        })
      }
    }

    const blood: Blood[] = []
    {
      // Blood drops are visually nice but expensive; scale down slightly for rushy names.
      const n = (isRush ? 26 : 36) + Math.floor(rng() * (isRush ? 14 : 18))
      for (let i = 0; i < n; i++) {
        blood.push({
          t0: (0.22 + rng() * 0.18) * durS,
          life: (0.18 + rng() * 0.22) * durS,
          x: (rng() - 0.5) * 0.35,
          y: (rng() - 0.5) * 0.2,
          vx: (rng() - 0.5) * 0.95,
          vy: -(0.25 + rng() * 0.95),
          r: 0.8 + rng() * 2.6,
        })
      }
    }

    const ice: IceShard[] = []
    if (profile === 'ice') {
      const n = 44 + Math.floor(rng() * 26)
      for (let i = 0; i < n; i++) {
        ice.push({
          t0: (0.06 + rng() * 0.55) * durS,
          life: (0.28 + rng() * 0.6) * durS,
          x: (rng() - 0.5) * 0.7,
          y: (rng() - 0.5) * 0.35,
          vx: (rng() - 0.5) * 0.7,
          vy: -(0.15 + rng() * 0.65),
          w: 0.012 + rng() * 0.05,
          h: 0.008 + rng() * 0.035,
          rot: (rng() - 0.5) * Math.PI,
        })
      }
    }

    // Monster Hunter verbatim: distinct animated sigil + claw + sparks (always moving).
    const mhSparks: MhSpark[] = []
    const mhClaws: MhClaw[] = []
    if (isMhVerbatim) {
      const sn = 120 + Math.floor(rng() * 70)
      for (let i = 0; i < sn; i++) {
        // Earlier + snappier sparks
        const t0 = (0.03 + rng() * 0.42) * durS
        mhSparks.push({
          t0,
          life: (0.12 + rng() * 0.28) * durS,
          x: (rng() - 0.5) * 0.35,
          y: (rng() - 0.5) * 0.22,
          vx: (rng() - 0.5) * 1.85,
          vy: -(0.35 + rng() * 1.55),
          r: 0.7 + rng() * 2.2,
        })
      }
      const cn = 3 + Math.floor(rng() * 2) // 3–4 claws
      for (let i = 0; i < cn; i++) {
        // Shorter claw window for speed impression
        const t0 = (0.06 + rng() * 0.14) * durS
        const t1 = Math.min(durS * 0.98, t0 + (0.11 + rng() * 0.09) * durS)
        const dir = rng() > 0.5 ? 1 : -1
        const slope = -0.45 + (rng() - 0.5) * 0.25
        const yMid = 0.28 + rng() * 0.5
        const span = 1.45 + rng() * 0.45
        const x0 = dir === 1 ? -0.3 : 1.3
        const x1 = x0 + dir * span
        const y0 = yMid - slope * 0.5
        const y1 = yMid + slope * 0.5
        mhClaws.push({ t0, t1, x0, y0, x1, y1, w: 0.012 + rng() * 0.016 })
      }
    }

    return { seed, profile, isMhVerbatim, slashCuts, bullets, embers, blood, ice, mhSparks, mhClaws, isRush }
  }, [durationMs, kind, techniqueName])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })
    if (!ctx) return

    const fit = () => {
      const p = canvas.parentElement
      if (!p) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const bw = Math.max(1, Math.floor(p.clientWidth * dpr))
      const bh = Math.max(1, Math.floor(p.clientHeight * dpr))
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw
        canvas.height = bh
      }
    }

    const draw = (nowMs: number) => {
      const p = canvas.parentElement
      if (!p) return

      // FPS throttle (avoid drawing multiple times per same target frame).
      const f = Math.floor(nowMs / frameMs)
      if (f === prevFrameRef.current) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      prevFrameRef.current = f

      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.max(1, p.clientWidth)
      const h = Math.max(1, p.clientHeight)
      if (startMsRef.current < 0) startMsRef.current = nowMs
      const elapsedMs = Math.max(0, nowMs - startMsRef.current)
      const t = elapsedMs / 1000
      const prog = clamp01(elapsedMs / Math.max(1, durationMs))

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const hue = kindHue(kind)
      const cx = w * 0.5
      const cy = h * 0.58
      const u = Math.max(h, w * 0.22)
      const pulse = 0.6 + Math.sin(t * 3.2 + (pre.seed & 255) * 0.01) * 0.4
      // Baseline glow is one of the more expensive parts. Keep it, but reduce strength when throttled.
      const baseGlowMul = suppressAmbient ? 0.72 : 1
      ctx.globalCompositeOperation = 'screen'
      const a = (0.32 + pulse * 0.22) * baseGlowMul * (0.98 - Math.max(0, prog - 0.08) * 0.22)
      if (a > 0.002) {
        const r = u * (0.62 + pulse * 0.1)
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        g.addColorStop(0, `hsla(${hue}, 98%, 84%, ${a})`)
        g.addColorStop(0.22, `hsla(${(hue + 12) % 360}, 98%, 68%, ${a * 0.7})`)
        g.addColorStop(0.55, `hsla(${(hue + 28) % 360}, 98%, 55%, ${a * 0.35})`)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Early flash (start cue) so you can tell it's this canvas, not legacy CSS.
      const startFlash = smoothstep(0.0, 0.04, prog) * (1 - smoothstep(0.06, 0.12, prog))
      if (startFlash > 0.001) {
        ctx.globalCompositeOperation = 'lighter'
        ctx.fillStyle = `rgba(255,255,255,${0.35 * startFlash})`
        ctx.fillRect(0, 0, w, h)
      }

      const hit = smoothstep(0.18, 0.24, prog) * (1 - smoothstep(0.3, 0.55, prog))

      // Monster Hunter verbatim: override with distinct animated sigil/claw/sparks (still full timeline).
      if (pre.isMhVerbatim) {
        ctx.save()
        // Steel-teal palette for "hunter" feel; always animating (spin + flashes)
        const mhHue = 190
        const spin = t * 3.8 + (pre.seed & 255) * 0.01
        const appear = smoothstep(0.015, 0.085, prog)
        const fade = 1 - smoothstep(0.62, 0.96, prog)

        // rotating ring / sigil
        ctx.globalCompositeOperation = 'lighter'
        ctx.lineCap = 'round'
        const baseR = u * 0.28
        for (let i = 0; i < 2; i++) {
          const rr = baseR * (1 + i * 0.22)
          ctx.lineWidth = 2.6 - i * 0.7
          ctx.shadowBlur = 22
          ctx.shadowColor = `hsla(${mhHue}, 98%, 72%, ${0.45 * appear * fade})`
          ctx.strokeStyle = `hsla(${(mhHue + i * 18) % 360}, 96%, ${78 - i * 6}%, ${0.38 * appear * fade})`
          ctx.beginPath()
          ctx.arc(cx, cy, rr, spin + i, spin + i + Math.PI * (1.65 + i * 0.25))
          ctx.stroke()
        }
        ctx.shadowBlur = 0

        // radial ticks (like a mark)
        const ticks = 22
        for (let i = 0; i < ticks; i++) {
          const ang = (i / ticks) * Math.PI * 2 + spin * 0.7
          const r0 = baseR * 0.78
          const r1 = baseR * (1.05 + ((i + pre.seed) % 3) * 0.06)
          ctx.strokeStyle = `hsla(${(mhHue + i * 6) % 360}, 96%, 84%, ${0.14 * appear * fade})`
          ctx.lineWidth = 1.2
          ctx.beginPath()
          ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0 * 0.82)
          ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1 * 0.82)
          ctx.stroke()
        }

        // claw slashes
        ctx.globalCompositeOperation = 'lighter'
        for (let i = 0; i < pre.mhClaws.length; i++) {
          const c = pre.mhClaws[i]!
          const p = clamp01((t - c.t0) / Math.max(1e-6, c.t1 - c.t0))
          if (p <= 0 || p >= 1) continue
          const head = easeOutCubic(p)
          const tail = clamp01((p - 0.12) / 0.88)
          const x0 = c.x0 * w
          const y0 = c.y0 * h
          const x1 = c.x1 * w
          const y1 = c.y1 * h
          const sx = x0 + (x1 - x0) * tail
          const sy = y0 + (y1 - y0) * tail
          const ex = x0 + (x1 - x0) * head
          const ey = y0 + (y1 - y0) * head
          const life = 1 - p
          const lw = Math.min(w, h) * c.w * (0.9 + 0.15 * Math.sin(t * 12 + i))
          ctx.shadowBlur = 30
          ctx.shadowColor = `hsla(${mhHue}, 98%, 70%, ${0.35 * life})`
          ctx.strokeStyle = `rgba(255,255,255,${0.92 * life})`
          ctx.lineWidth = lw * 2.6
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.lineTo(ex, ey)
          ctx.stroke()
          ctx.shadowBlur = 0
          ctx.strokeStyle = `hsla(${mhHue}, 96%, 68%, ${0.55 * life})`
          ctx.lineWidth = lw * 6.5
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.lineTo(ex, ey)
          ctx.stroke()
        }

        // sparks burst (metallic)
        const u2 = Math.max(h, w * 0.22)
        for (let i = 0; i < pre.mhSparks.length; i++) {
          const s = pre.mhSparks[i]!
          const q = clamp01((t - s.t0) / Math.max(1e-6, s.life))
          if (q <= 0 || q >= 1) continue
          const x = cx + s.x * u2 + s.vx * u2 * q
          const y = cy + s.y * u2 + s.vy * u2 * q + q * q * u2 * 0.26
          const aa = (1 - q) * 0.32 * fade
          const rr = s.r * (0.7 + (1 - q) * 0.5)
          const gg = ctx.createRadialGradient(x, y, 0, x, y, rr * 12)
          gg.addColorStop(0, `rgba(255,255,255,${aa})`)
          gg.addColorStop(0.22, `hsla(${(mhHue + 35) % 360}, 96%, 70%, ${aa * 0.55})`)
          gg.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = gg
          ctx.beginPath()
          ctx.arc(x, y, rr * 9, 0, Math.PI * 2)
          ctx.fill()
        }

        // still allow blood at hit timing (if hit-based profile would have it)
        // (blood drawing below stays active)
        ctx.restore()
      }

      // --- profile specific drawing ---
      if (!pre.isMhVerbatim && pre.profile === 'slash') {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.lineCap = 'round'
        const lwBase = Math.min(w, h) * 0.02
        for (let i = 0; i < pre.slashCuts.length; i++) {
          const c = pre.slashCuts[i]!
          const p = clamp01((t - c.t0) / Math.max(1e-6, c.t1 - c.t0))
          if (p <= 0 || p >= 1) continue
          const head = easeOutCubic(p)
          const tail = clamp01((p - 0.15) / 0.85)
          const x0 = c.x0 * w
          const y0 = c.y0 * h
          const x1 = c.x1 * w
          const y1 = c.y1 * h
          const sx = x0 + (x1 - x0) * tail
          const sy = y0 + (y1 - y0) * tail
          const ex = x0 + (x1 - x0) * head
          const ey = y0 + (y1 - y0) * head
          const life = 1 - p
          const lw = lwBase * c.w * (0.9 + 0.2 * Math.sin(t * 18 + i))
          ctx.shadowBlur = 28
          ctx.shadowColor = `hsla(${(hue + 10) % 360}, 98%, 70%, ${0.35 * life})`
          ctx.strokeStyle = `rgba(255,255,255,${0.95 * life})`
          ctx.lineWidth = lw * 2.8
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.lineTo(ex, ey)
          ctx.stroke()
          ctx.shadowBlur = 0
          ctx.strokeStyle = `hsla(${(hue + 18) % 360}, 98%, 70%, ${0.55 * life})`
          ctx.lineWidth = lw * 6.2
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.lineTo(ex, ey)
          ctx.stroke()
        }
        ctx.restore()
      }

      if (!pre.isMhVerbatim && pre.profile === 'shooting') {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        const u2 = Math.max(h, w * 0.22)
        for (let i = 0; i < pre.bullets.length; i++) {
          const b = pre.bullets[i]!
          const p = clamp01((t - b.t0) / Math.max(1e-6, b.t1 - b.t0))
          if (p <= 0 || p >= 1) continue
          const head = easeOutCubic(p)
          const x = (-0.2 + 1.4 * head) * w
          const y = (b.y0 + (b.y1 - b.y0) * head) * h
          const rr = b.r * u2
          const g2 = ctx.createRadialGradient(x, y, 0, x, y, rr * 16)
          g2.addColorStop(0, 'rgba(255,255,255,0.55)')
          g2.addColorStop(0.15, 'rgba(255,220,160,0.25)')
          g2.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = g2
          ctx.beginPath()
          ctx.arc(x, y, rr * 10, 0, Math.PI * 2)
          ctx.fill()
          const tail = u2 * (0.28 + 0.28 * (1 - p))
          const grad = ctx.createLinearGradient(x - tail, y, x, y)
          grad.addColorStop(0, 'rgba(255,200,120,0)')
          grad.addColorStop(0.4, 'rgba(255,220,170,0.25)')
          grad.addColorStop(1, 'rgba(255,255,255,0.75)')
          ctx.strokeStyle = grad
          ctx.lineWidth = 2.2 + (1 - p) * 3.2
          ctx.beginPath()
          ctx.moveTo(x - tail, y)
          ctx.lineTo(x, y)
          ctx.stroke()
        }
        ctx.restore()
      }

      if (!pre.isMhVerbatim && pre.profile === 'magic') {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        const appear = smoothstep(0.02, 0.18, prog)
        const spin = t * 0.9 + (pre.seed & 255) * 0.01
        const ringR = u * 0.22
        ctx.lineCap = 'round'
        for (let i = 0; i < 3; i++) {
          const r0 = ringR * (0.75 + i * 0.32)
          ctx.lineWidth = 2.4 - i * 0.4
          ctx.shadowBlur = 18
          ctx.shadowColor = `hsla(${(hue + 10) % 360}, 98%, 70%, ${0.35 * appear})`
          ctx.strokeStyle = `hsla(${(hue + i * 18) % 360}, 96%, ${78 - i * 6}%, ${0.35 * appear})`
          ctx.beginPath()
          ctx.arc(cx, cy, r0, spin + i, spin + i + Math.PI * (1.65 + i * 0.15))
          ctx.stroke()
        }
        ctx.shadowBlur = 0
        // glyph ticks
        const glyphs = 28
        for (let gI = 0; gI < glyphs; gI++) {
          const ang = (gI / glyphs) * Math.PI * 2 + spin * 0.8
          const rr = ringR * 1.15
          const x = cx + Math.cos(ang) * rr
          const y = cy + Math.sin(ang) * rr * 0.75
          const len = u * 0.018
          ctx.strokeStyle = `hsla(${(hue + gI * 7) % 360}, 96%, 82%, ${0.18 * appear})`
          ctx.lineWidth = 1.3
          ctx.beginPath()
          ctx.moveTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len)
          ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len)
          ctx.stroke()
        }
        // pulse core
        const core = smoothstep(0.1, 0.3, prog) * (1 - smoothstep(0.55, 0.9, prog))
        if (core > 0.001) {
          const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, u * 0.55)
          cg.addColorStop(0, `hsla(${(hue + 12) % 360}, 98%, 85%, ${0.22 * core})`)
          cg.addColorStop(0.35, `hsla(${hue}, 98%, 60%, ${0.12 * core})`)
          cg.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = cg
          ctx.beginPath()
          ctx.arc(cx, cy, u * 0.55, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }

      if (!pre.isMhVerbatim && pre.profile === 'explosion') {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        const p = smoothstep(0.05, 0.22, prog)
        const ringR = u * (0.08 + p * 0.78)
        const ringA = (1 - p) * 0.55
        ctx.strokeStyle = `rgba(255,230,170,${ringA})`
        ctx.lineWidth = 2.6 + (1 - p) * 6.2
        ctx.beginPath()
        ctx.ellipse(cx, cy, ringR * 1.18, ringR * 0.42, 0, 0, Math.PI * 2)
        ctx.stroke()
        // embers
        const u2 = Math.max(h, w * 0.22)
        for (let i = 0; i < pre.embers.length; i++) {
          const e = pre.embers[i]!
          const q = clamp01((t - e.t0) / Math.max(1e-6, e.life))
          if (q <= 0 || q >= 1) continue
          const x = cx + e.x * u2 + e.vx * u2 * q
          const y = cy + e.y * u2 + e.vy * u2 * q + q * q * u2 * 0.14
          const a = (1 - q) * 0.45
          const rr = e.r * (0.7 + (1 - q) * 0.6)
          const gg = ctx.createRadialGradient(x, y, 0, x, y, rr * 14)
          gg.addColorStop(0, `rgba(255,255,255,${a})`)
          gg.addColorStop(0.2, `rgba(255,180,80,${a * 0.65})`)
          gg.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = gg
          ctx.beginPath()
          ctx.arc(x, y, rr * 10, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }

      if (!pre.isMhVerbatim && pre.profile === 'lightning') {
        const inten = smoothstep(0.06, 0.2, prog) * (0.9 - prog * 0.25)
        if (inten > 0.001) {
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.shadowBlur = 18
          ctx.shadowColor = `rgba(160,230,255,${0.55 * inten})`
          ctx.strokeStyle = `rgba(230,250,255,${0.7 * inten})`
          ctx.lineWidth = 2.8
          // Start from upper area and strike downward (avoid "worm" horizontal feel).
          const s01 = ((pre.seed >>> 8) & 1023) / 1023
          const x0 = w * (0.18 + s01 * 0.64)
          const y0 = -h * 0.06
          const x1 = x0 + (Math.sin(pre.seed * 0.003) * 0.12) * w
          const y1 = h * (0.92 + (Math.sin(pre.seed * 0.004) * 0.04))
          const segs = 18
          // Make bolt rigid (not sine-wavy): resample jitter in discrete time steps.
          const tt = Math.floor(t * 30) / 30
          ctx.beginPath()
          ctx.moveTo(x0, y0)
          for (let i = 1; i <= segs; i++) {
            const pp = i / segs
            const bx = x0 + (x1 - x0) * pp
            const by = y0 + (y1 - y0) * pp
            const env = Math.sin(pp * Math.PI)
            const j = Math.sin(pre.seed * 0.123 + i * 12.9898 + tt * 78.233) * 43758.5453
            const rnd = j - Math.floor(j)
            // lateral jitter only (bolt stays vertically oriented)
            const wob = (rnd - 0.5) * u * 0.11 * env
            ctx.lineTo(bx + wob, by)
          }
          ctx.stroke()
          ctx.restore()
        }
      }

      if (!pre.isMhVerbatim && pre.profile === 'ice') {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        const u2 = Math.min(w, h)
        for (let i = 0; i < pre.ice.length; i++) {
          const s = pre.ice[i]!
          const q = clamp01((t - s.t0) / Math.max(1e-6, s.life))
          if (q <= 0 || q >= 1) continue
          const x = cx + s.x * u2 + s.vx * u2 * q
          const y = cy + s.y * u2 + s.vy * u2 * q + q * q * u2 * 0.1
          const ww = u2 * s.w
          const hh = u2 * s.h
          const a = (1 - q) * 0.3
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(s.rot + t * 0.8)
          const g3 = ctx.createLinearGradient(-ww, -hh, ww, hh)
          g3.addColorStop(0, `rgba(240,255,255,${a})`)
          g3.addColorStop(0.5, `rgba(130,240,255,${a * 0.7})`)
          g3.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = g3
          ctx.fillRect(-ww, -hh, ww * 2, hh * 2)
          ctx.restore()
        }
        ctx.restore()
      }

      if (!pre.isMhVerbatim && pre.profile === 'fire') {
        ctx.save()
        ctx.globalCompositeOperation = 'screen'
        const inten = smoothstep(0.05, 0.22, prog) * (0.95 - prog * 0.25)
        const cols = 9
        for (let i = 0; i < cols; i++) {
          const bx = w * (0.06 + (i / (cols - 1)) * 0.88)
          const baseY = h * 1.02
          const flameH = h * (0.75 + Math.sin(t * 3.2 + i) * 0.12)
          const bw = w * 0.09
          ctx.save()
          ctx.globalAlpha = 0.55 * inten
          ctx.beginPath()
          for (let k = 0; k <= 16; k++) {
            const pp = k / 16
            const y = baseY - pp * flameH
            const wob = Math.sin(t * 6.5 + i * 1.3 + pp * 7) * bw * 0.22 * pp
            const half = bw * (0.55 * (1 - pp) + 0.12) + wob
            if (k === 0) ctx.moveTo(bx - half, y)
            else ctx.lineTo(bx - half, y)
          }
          for (let k = 16; k >= 0; k--) {
            const pp = k / 16
            const y = baseY - pp * flameH
            const wob = Math.sin(t * 6.5 + i * 1.3 + pp * 7) * bw * 0.22 * pp
            const half = bw * (0.55 * (1 - pp) + 0.12) + wob
            ctx.lineTo(bx + half, y)
          }
          ctx.closePath()
          const fg = ctx.createLinearGradient(bx, baseY, bx, baseY - flameH)
          fg.addColorStop(0, `rgba(210,35,18,${0.55 * inten})`)
          fg.addColorStop(0.25, `rgba(255,85,25,${0.45 * inten})`)
          fg.addColorStop(0.55, `rgba(255,165,45,${0.35 * inten})`)
          fg.addColorStop(1, 'rgba(255,255,245,0)')
          ctx.fillStyle = fg
          ctx.fill()
          ctx.restore()
        }
        ctx.restore()
      }

      if (hit > 0.001) {
        ctx.globalCompositeOperation = 'lighter'
        const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, u * 0.25)
        hg.addColorStop(0, `rgba(255,255,255,${0.42 * hit})`)
        hg.addColorStop(0.18, `hsla(${(hue + 18) % 360}, 98%, 72%, ${0.25 * hit})`)
        hg.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = hg
        ctx.beginPath()
        ctx.arc(cx, cy, u * 0.25, 0, Math.PI * 2)
        ctx.fill()
      }

      // Blood splatter at hit timing (real-ish but not too flashy)
      if (hit > 0.001) {
        ctx.save()
        ctx.globalCompositeOperation = 'source-over'
        const u2 = Math.min(w, h)
        const bx0 = cx + (Math.sin(pre.seed * 0.01) * 0.06) * w
        const by0 = cy + (Math.cos(pre.seed * 0.012) * 0.06) * h
        // blot
        const blotR = u2 * 0.18
        const blot = ctx.createRadialGradient(bx0, by0, 0, bx0, by0, blotR)
        blot.addColorStop(0, `rgba(70,0,0,${0.22 * hit})`)
        blot.addColorStop(0.35, `rgba(120,10,10,${0.12 * hit})`)
        blot.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = blot
        ctx.beginPath()
        ctx.ellipse(bx0, by0, blotR * 1.05, blotR * 0.65, 0, 0, Math.PI * 2)
        ctx.fill()
        // drops
        for (let i = 0; i < pre.blood.length; i++) {
          const d = pre.blood[i]!
          const q = clamp01((t - d.t0) / Math.max(1e-6, d.life))
          if (q <= 0 || q >= 1) continue
          const x = bx0 + d.x * u2 + d.vx * u2 * q
          const y = by0 + d.y * u2 + d.vy * u2 * q + q * q * u2 * 0.18
          const rr = d.r * (0.9 + (1 - q) * 0.4)
          const aa = (1 - q) * 0.6 * hit
          ctx.fillStyle = `rgba(90, 5, 8, ${aa})`
          ctx.beginPath()
          ctx.arc(x, y, rr, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }

      if (!suppressAmbient && prog < 0.98) {
        ctx.globalCompositeOperation = 'screen'
        const ax = w * (0.15 + ((pre.seed & 1023) / 1023) * 0.7)
        const ay = h * (0.25 + (((pre.seed >>> 10) & 1023) / 1023) * 0.55)
        const ar = u * (0.18 + pulse * 0.06)
        const ag = ctx.createRadialGradient(ax, ay, 0, ax, ay, ar)
        ag.addColorStop(0, `hsla(${(hue + 20) % 360}, 98%, 85%, ${0.08 * pulse})`)
        ag.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = ag
        ctx.beginPath()
        ctx.arc(ax, ay, ar, 0, Math.PI * 2)
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    const ro = new ResizeObserver(() => fit())
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    fit()
    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      startMsRef.current = -1
      prevFrameRef.current = -1
    }
  }, [durationMs, frameMs, kind, pre, suppressAmbient, techniqueName])

  return <canvas ref={ref} className="tefx-layer tefx-burst-canvas" aria-hidden />
}


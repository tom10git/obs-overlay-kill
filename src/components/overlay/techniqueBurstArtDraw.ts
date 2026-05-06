/**
 * 技発動帯の Canvas アート層（60パターン・技名シードで決定的）
 * kind・語感に応じた Canvas 上乗せ（lighter・CSS と併用）:
 * meteor 落下軌道、void 裂け目、glacier 結晶、radiance 光芒、nova 星爆、phantom 霧、
 * tremor 塵・地割、plasma イオン弧、tempest 稲妻、inferno 炎、桜／星／月は技名で判定。
 */

import type { TechniqueEffectKind } from '../../constants/techniqueEffectKinds'
import {
  techniqueNameHitsAny,
  TECHNIQUE_EFFECT_CYBER_NAME_PARTS,
  TECHNIQUE_EFFECT_SANCTUM_MARKERS,
  TECHNIQUE_EFFECT_THEME_MARKERS,
  TECHNIQUE_NAME_ACCENT_BLOODTIDE_PARTS,
  TECHNIQUE_NAME_ACCENT_DUNE_PARTS,
} from '../../constants/techniqueEffectKinds'

export function stableRand(seed: number, a: number, b = 0): number {
  let x = (Math.imul(seed ^ a, 0x9e3779b9) + b) | 0
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d)
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296
}

function hsla(seed: number, i: number, a: number): string {
  const h = (seed + i * 37) % 360
  const s = 55 + stableRand(seed, i, 1) * 40
  const l = 35 + stableRand(seed, i, 2) * 45
  return `hsla(${h},${s}%,${l}%,${a})`
}

type BoltPoint = { x: number; y: number }

/** 上端付近から下端へ向かう主幹稲妻（中点変位でジグザグ） */
function boltPointsMain(seed: number, boltTag: number, w: number, h: number): BoltPoint[] {
  const x0 = w * (0.08 + stableRand(seed, boltTag, 50) * 0.84)
  const y0 = -h * (0.02 + stableRand(seed, boltTag, 51) * 0.14)
  const x1 = x0 + (stableRand(seed, boltTag, 52) - 0.5) * w * 0.48
  const y1 = h * (0.9 + stableRand(seed, boltTag, 53) * 0.18)
  const segments = 11 + ((seed >>> ((boltTag * 7) & 15)) % 10)
  const pts: BoltPoint[] = []
  for (let i = 0; i <= segments; i++) {
    const p = i / segments
    const bx = x0 + (x1 - x0) * p
    const by = y0 + (y1 - y0) * p
    const dx = x1 - x0
    const dy = y1 - y0
    const len = Math.hypot(dx, dy) || 1
    const px = -dy / len
    const py = dx / len
    const envelope = Math.sin(p * Math.PI)
    const mag =
      (stableRand(seed, boltTag * 131 + i, 54) - 0.5) *
      Math.min(w, h) *
      (0.038 + envelope * 0.13)
    pts.push({ x: bx + px * mag, y: by + py * mag })
  }
  return pts
}

function boltPointsBranch(
  seed: number,
  tag: number,
  sx: number,
  sy: number,
  dirX: number,
  dirY: number,
  length: number,
  segs: number
): BoltPoint[] {
  const len0 = Math.hypot(dirX, dirY) || 1
  const nx = dirX / len0
  const ny = dirY / len0
  const px = -ny
  const py = nx
  const pts: BoltPoint[] = [{ x: sx, y: sy }]
  let x = sx
  let y = sy
  const step = length / Math.max(1, segs)
  for (let i = 1; i <= segs; i++) {
    const q = i / segs
    const wobble = (stableRand(seed, tag + i * 17, 55) - 0.5) * length * 0.24 * Math.sin(q * Math.PI)
    x += nx * step + px * wobble
    y += ny * step + py * wobble
    pts.push({ x, y })
  }
  return pts
}

function strokeBolt(ctx: CanvasRenderingContext2D, pts: BoltPoint[], alphaMul: number): void {
  if (pts.length < 2 || alphaMul < 0.04) return
  const layer = (lw: number, color: string, blur: number) => {
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = lw
    ctx.strokeStyle = color
    ctx.shadowBlur = blur
    ctx.shadowColor = `rgba(200, 235, 255, ${0.5 * alphaMul})`
    ctx.beginPath()
    ctx.moveTo(pts[0]!.x, pts[0]!.y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y)
    ctx.stroke()
    ctx.restore()
  }
  layer(9, `rgba(70, 140, 255, ${0.16 * alphaMul})`, 20)
  layer(4, `rgba(170, 225, 255, ${0.4 * alphaMul})`, 12)
  layer(1.5, `rgba(255, 255, 255, ${0.95 * alphaMul})`, 5)
}

function tempestLightningIntensity(tt: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0.52
  const a = Math.abs(Math.sin(tt * 56))
  const b = Math.abs(Math.sin(tt * 19 + 1.3))
  const c = Math.abs(Math.sin(tt * 89 + 0.4))
  return Math.min(1, 0.15 + a * 0.44 + b * 0.36 + c * 0.26)
}

function drawTempestLightningOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const inten = tempestLightningIntensity(tt, reducedMotion)
  const boltCount = 2 + (seed % 3)
  for (let b = 0; b < boltCount; b++) {
    const main = boltPointsMain(seed, b * 997 + 1, w, h)
    strokeBolt(ctx, main, inten * (0.85 + stableRand(seed, b, 56) * 0.28))

    const branches = 1 + ((seed >>> (b + 3)) % 3)
    for (let br = 0; br < branches; br++) {
      const idx = 2 + br * 4 + ((seed >> br) & 1)
      if (idx >= main.length - 1 || idx < 1) continue
      const p0 = main[idx - 1]!
      const p1 = main[idx]!
      const p2 = main[idx + 1]!
      const tx = p2.x - p0.x
      const ty = p2.y - p0.y
      const tlen = Math.hypot(tx, ty) || 1
      const sign = br % 2 === 0 ? 1 : -1
      const bx = (-ty / tlen) * sign
      const by = (tx / tlen) * sign
      const blen = Math.min(w, h) * (0.07 + stableRand(seed, b * 17 + br, 57) * 0.14)
      const branchPts = boltPointsBranch(seed, 4000 + b * 50 + br, p1.x, p1.y, bx, by, blen, 5 + (seed % 4))
      strokeBolt(ctx, branchPts, inten * 0.72 * (0.55 + stableRand(seed, br, 58) * 0.45))
    }
  }
}

function infernoFireIntensity(tt: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0.56
  const a = Math.abs(Math.sin(tt * 6.8))
  const b = Math.abs(Math.sin(tt * 11.2 + 0.6))
  const c = Math.abs(Math.sin(tt * 3.4 + 1.1))
  return Math.min(1, 0.22 + a * 0.38 + b * 0.28 + c * 0.22)
}

/** 単一の炎柱（下広上細・揺らぎ） */
function drawInfernoFlameColumn(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  flameH: number,
  baseW: number,
  seed: number,
  colTag: number,
  tt: number,
  alphaMul: number,
  reducedMotion: boolean
): void {
  const segs = 22
  const left: BoltPoint[] = []
  const right: BoltPoint[] = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const y = baseY - t * flameH
    const wobble =
      Math.sin(tt * (reducedMotion ? 2.2 : 5.5) + t * 6 + stableRand(seed, colTag * 31 + i, 80) * 2.8) *
      baseW *
      0.22 *
      t
    const halfW = baseW * (0.52 * (1 - t * 0.92) + 0.06) + wobble
    left.push({ x: baseX - halfW, y })
    right.unshift({ x: baseX + halfW, y })
  }
  ctx.beginPath()
  ctx.moveTo(left[0]!.x, left[0]!.y)
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i]!.x, left[i]!.y)
  for (let i = 0; i < right.length; i++) ctx.lineTo(right[i]!.x, right[i]!.y)
  ctx.closePath()
  const g = ctx.createLinearGradient(baseX, baseY, baseX, baseY - flameH)
  g.addColorStop(0, `rgba(210,35,18,${0.62 * alphaMul})`)
  g.addColorStop(0.22, `rgba(255,85,25,${0.52 * alphaMul})`)
  g.addColorStop(0.48, `rgba(255,165,45,${0.42 * alphaMul})`)
  g.addColorStop(0.72, `rgba(255,230,120,${0.28 * alphaMul})`)
  g.addColorStop(1, `rgba(255,255,245,${0.06 * alphaMul})`)
  ctx.fillStyle = g
  ctx.fill()
}

function drawInfernoFireOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const inten = infernoFireIntensity(tt, reducedMotion)
  const baseY = h * 1.02
  const flameH = h * 1.15
  const cols = 5 + (seed % 4)
  for (let c = 0; c < cols; c++) {
    const bx = w * (0.05 + stableRand(seed, c * 91 + 1, 71) * 0.9)
    const bw = w * (0.065 + stableRand(seed, c * 91 + 2, 72) * 0.11)
    drawInfernoFlameColumn(
      ctx,
      bx,
      baseY,
      flameH,
      bw,
      seed,
      c,
      tt,
      inten * (0.72 + stableRand(seed, c, 73) * 0.38),
      reducedMotion
    )
  }

  const nEmber = reducedMotion ? 26 : 52
  for (let e = 0; e < nEmber; e++) {
    const ex = stableRand(seed, e, 74) * w
    const speed = 0.28 + stableRand(seed, e, 75) * 0.55
    const cycle = (tt * speed + stableRand(seed, e, 76)) % 1
    const ey = h * (0.98 - cycle * 1.08)
    const er = 0.8 + stableRand(seed, e, 77) * 2.8
    const gChannel = Math.floor(150 + stableRand(seed, e, 78) * 105)
    const ea = inten * (1 - cycle) * 0.42
    ctx.fillStyle = `rgba(255, ${gChannel}, 45, ${ea})`
    ctx.beginPath()
    ctx.arc(ex + Math.sin(tt * (reducedMotion ? 1.4 : 3.2) + e) * 5, ey, er, 0, Math.PI * 2)
    ctx.fill()
  }

  const hx = w * (0.38 + stableRand(seed, 99, 79) * 0.24)
  const hy = h * 0.88
  const hr = Math.min(w, h) * (0.14 + stableRand(seed, 100, 80) * 0.06)
  const hot = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr)
  hot.addColorStop(0, `rgba(255, 255, 230, ${0.35 * inten})`)
  hot.addColorStop(0.35, `rgba(255, 140, 40, ${0.22 * inten})`)
  hot.addColorStop(1, 'rgba(255, 50, 20, 0)')
  ctx.fillStyle = hot
  ctx.beginPath()
  ctx.ellipse(hx, hy, hr * 0.85, hr * 0.42, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawSakuraPetal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  scale: number,
  alpha: number,
  hueShift: number
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(scale, scale)
  ctx.beginPath()
  ctx.moveTo(0, -7)
  ctx.bezierCurveTo(9, -3, 9, 5, 0, 11)
  ctx.bezierCurveTo(-9, 5, -9, -3, 0, -7)
  const hBase = (328 + hueShift * 50) % 360
  const g = ctx.createLinearGradient(0, -7, 0, 11)
  g.addColorStop(0, `hsla(${hBase}, 92%, 99%, ${alpha * 0.96})`)
  g.addColorStop(0.42, `hsla(${hBase + 4}, 85%, 90%, ${alpha * 0.9})`)
  g.addColorStop(1, `hsla(${hBase + 12}, 72%, 78%, ${alpha * 0.82})`)
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = `hsla(${hBase}, 55%, 72%, ${alpha * 0.32})`
  ctx.lineWidth = 0.4
  ctx.stroke()
  ctx.restore()
}

function drawSakuraOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const gust = reducedMotion ? 0.32 : 0.62 + Math.sin(tt * 1.6) * 0.12
  const nPetals = reducedMotion ? 26 : 46
  const unit = Math.min(w, h)

  for (let i = 0; i < nPetals; i++) {
    const baseX = stableRand(seed, i, 90) * w
    const phase = stableRand(seed, i, 91)
    const speed = 0.14 + stableRand(seed, i, 92) * 0.32
    const cycle = (tt * speed + phase) % 1
    const py = -h * 0.1 + cycle * h * 1.22
    const wind = Math.sin(tt * gust * 2.4 + i * 0.55 + phase * 7) * w * 0.09
    const drift = (cycle - 0.5) * w * 0.045
    const px = baseX + wind + drift
    const rot =
      tt * (reducedMotion ? 0.35 : 0.95) * (stableRand(seed, i, 93) > 0.5 ? 1 : -1) + phase * Math.PI * 2
    const sc = unit * (0.009 + stableRand(seed, i, 94) * 0.014)
    const alpha = 0.2 + stableRand(seed, i, 95) * 0.36
    const fade = 0.55 + Math.sin(cycle * Math.PI) * 0.45
    drawSakuraPetal(ctx, px, py, rot, sc, alpha * fade, stableRand(seed, i, 96))
  }

  const nSpeck = reducedMotion ? 14 : 28
  for (let k = 0; k < nSpeck; k++) {
    const sx = stableRand(seed, k + 400, 97) * w
    const sp = stableRand(seed, k + 400, 98)
    const sy = (tt * 0.22 + sp) % 1
    const y = sy * h * 1.05 - h * 0.02
    const x = sx + Math.sin(tt * 1.9 + k) * w * 0.03
    const rr = unit * (0.004 + stableRand(seed, k, 99) * 0.006)
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr * 3)
    g.addColorStop(0, `rgba(255, 245, 250, ${0.22})`)
    g.addColorStop(0.4, `rgba(255, 192, 210, ${0.12})`)
    g.addColorStop(1, 'rgba(255, 160, 190, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, rr * 2.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawMeteorTrailOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const streaks = 4 + (seed % 3)
  const speed = reducedMotion ? 28 : 55
  for (let i = 0; i < streaks; i++) {
    ctx.save()
    const ang = -0.62 + stableRand(seed, i, 200) * 0.38 + Math.sin(tt * 1.4 + i) * 0.05
    const cx = stableRand(seed, i, 201) * w
    const phase = stableRand(seed, i, 202) * h * 2
    const gy = ((tt * speed + phase) % (h * 1.8)) - h * 0.35
    ctx.translate(cx, gy)
    ctx.rotate(ang)
    const gr = ctx.createLinearGradient(0, -h * 0.5, 0, h * 0.55)
    gr.addColorStop(0, 'rgba(255,255,250,0)')
    gr.addColorStop(0.42, 'rgba(255,235,200,0.38)')
    gr.addColorStop(0.52, 'rgba(255,170,90,0.28)')
    gr.addColorStop(1, 'rgba(200,90,50,0)')
    ctx.fillStyle = gr
    ctx.fillRect(-w * 0.045, -h * 0.35, w * 0.09, h * 0.95)
    ctx.restore()
  }
  const rocks = reducedMotion ? 4 : 7
  const u = Math.min(w, h)
  for (let r = 0; r < rocks; r++) {
    const rx = stableRand(seed, r, 203) * w
    const ph = stableRand(seed, r, 204) * h * 2
    const ry = ((tt * (speed * 0.92) + ph) % (h * 1.6)) - h * 0.2
    ctx.save()
    ctx.translate(rx, ry)
    ctx.rotate(tt * 2.2 + r + stableRand(seed, r, 205) * 4)
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, u * 0.035)
    gr.addColorStop(0, 'rgba(255,255,245,0.55)')
    gr.addColorStop(0.45, 'rgba(255,180,120,0.4)')
    gr.addColorStop(1, 'rgba(120,70,50,0)')
    ctx.fillStyle = gr
    ctx.beginPath()
    ctx.ellipse(0, 0, u * 0.022, u * 0.034, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function drawVoidVeinOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const n = reducedMotion ? 5 : 9
  for (let i = 0; i < n; i++) {
    let x = stableRand(seed, i, 210) * w
    let y = h * (0.55 + stableRand(seed, i, 211) * 0.45)
    ctx.beginPath()
    ctx.moveTo(x, y)
    const segs = 10 + (seed % 6)
    for (let k = 0; k < segs; k++) {
      x += (stableRand(seed, i * 20 + k, 212) - 0.45) * w * 0.08
      y -= h * (0.045 + stableRand(seed, i * 20 + k, 213) * 0.04)
      ctx.lineTo(x, y)
    }
    const flick = reducedMotion ? 0.26 : 0.32 + Math.sin(tt * 3 + i) * 0.1
    ctx.strokeStyle = `rgba(200, 140, 255, ${flick})`
    ctx.lineWidth = 1.2 + stableRand(seed, i, 214) * 0.8
    ctx.shadowBlur = reducedMotion ? 5 : 12
    ctx.shadowColor = 'rgba(160, 100, 255, 0.45)'
    ctx.stroke()
    ctx.shadowBlur = 0
  }
  const wisps = reducedMotion ? 6 : 12
  for (let w0 = 0; w0 < wisps; w0++) {
    const px = stableRand(seed, w0 + 300, 215) * w
    const py = stableRand(seed, w0 + 300, 216) * h
    const r = Math.min(w, h) * (0.12 + stableRand(seed, w0, 217) * 0.2)
    const g = ctx.createRadialGradient(px, py, 0, px, py, r)
    const a = 0.08 + Math.sin(tt * 2.1 + w0) * 0.05
    g.addColorStop(0, `rgba(220, 180, 255, ${a})`)
    g.addColorStop(1, 'rgba(120, 60, 200, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(px, py, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawGlacierFrostOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const flakes = reducedMotion ? 18 : 34
  const u = Math.min(w, h)
  for (let i = 0; i < flakes; i++) {
    const fx = stableRand(seed, i, 220) * w
    const fy = stableRand(seed, i, 221) * h
    const rot = tt * (reducedMotion ? 0.25 : 0.7) + stableRand(seed, i, 222) * Math.PI * 2
    const sc = u * (0.006 + stableRand(seed, i, 223) * 0.01)
    ctx.save()
    ctx.translate(fx, fy)
    ctx.rotate(rot)
    ctx.scale(sc, sc)
    ctx.beginPath()
    for (let arm = 0; arm < 6; arm++) {
      const a = (arm / 6) * Math.PI * 2
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10)
    }
    ctx.strokeStyle = `rgba(220, 248, 255, ${0.18 + stableRand(seed, i, 224) * 0.25})`
    ctx.lineWidth = 1.1
    ctx.stroke()
    ctx.restore()
  }
}

function drawRadianceRayOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const cx = w * 0.5
  const cy = h * 0.48
  const rays = reducedMotion ? 10 : 18
  const pulse = 0.55 + Math.sin(tt * (reducedMotion ? 1.8 : 3.6)) * 0.35
  for (let r = 0; r < rays; r++) {
    const ang = (r / rays) * Math.PI * 2 + stableRand(seed, r, 230) * 0.08
    const len = Math.max(w, h) * (0.42 + stableRand(seed, r, 231) * 0.35)
    const gr = ctx.createLinearGradient(cx, cy, cx + Math.cos(ang) * len, cy + Math.sin(ang) * len)
    gr.addColorStop(0, `rgba(255, 252, 235, ${0.32 * pulse})`)
    gr.addColorStop(0.35, `rgba(255, 230, 160, ${0.14 * pulse})`)
    gr.addColorStop(1, 'rgba(255, 200, 120, 0)')
    ctx.strokeStyle = gr
    ctx.lineWidth = 1.4 + stableRand(seed, r, 232) * 1.2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len)
    ctx.stroke()
  }
}

function drawNovaBurstOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const cx = w * 0.5
  const cy = h * 0.5
  const u = Math.min(w, h)
  const expand = 0.72 + Math.sin(tt * (reducedMotion ? 2.2 : 4.5)) * 0.28
  const spikes = reducedMotion ? 8 : 14
  for (let i = 0; i < spikes; i++) {
    const a0 = (i / spikes) * Math.PI * 2
    const a1 = a0 + (Math.PI / spikes) * 0.55
    const r0 = u * 0.08 * expand
    const r1 = u * (0.28 + stableRand(seed, i, 240) * 0.18) * expand
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0)
    ctx.lineTo(cx + Math.cos((a0 + a1) * 0.5) * r1, cy + Math.sin((a0 + a1) * 0.5) * r1)
    ctx.lineTo(cx + Math.cos(a1) * r0, cy + Math.sin(a1) * r0)
    ctx.closePath()
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r1 * 1.2)
    g.addColorStop(0, `rgba(255, 250, 220, ${0.45 * expand})`)
    g.addColorStop(0.5, `rgba(255, 200, 100, ${0.18 * expand})`)
    g.addColorStop(1, 'rgba(255, 120, 40, 0)')
    ctx.fillStyle = g
    ctx.fill()
  }
}

function drawPhantomMistOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const layers = reducedMotion ? 5 : 9
  for (let i = 0; i < layers; i++) {
    const mx = w * (0.1 + stableRand(seed, i, 250) * 0.8) + Math.sin(tt * 0.9 + i) * w * 0.04
    const my = h * (0.15 + stableRand(seed, i, 251) * 0.75)
    const rx = w * (0.18 + stableRand(seed, i, 252) * 0.25)
    const ry = h * (0.12 + stableRand(seed, i, 253) * 0.2)
    const rot = stableRand(seed, i, 254) * Math.PI
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, Math.max(rx, ry) * 1.1)
    const a = 0.05 + Math.sin(tt * 1.4 + i * 0.7) * 0.035
    g.addColorStop(0, `rgba(200, 180, 255, ${a})`)
    g.addColorStop(0.5, `rgba(120, 90, 180, ${a * 0.55})`)
    g.addColorStop(1, 'rgba(40, 20, 80, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(mx, my, rx, ry, rot, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawAuroraRibbonOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const bands = reducedMotion ? 3 : 7
  for (let b = 0; b < bands; b++) {
    const y0 = h * (0.12 + (b / Math.max(1, bands)) * 0.55)
    const hue = 120 + ((seed + b * 37) % 80)
    ctx.beginPath()
    for (let x = 0; x <= w; x += 3) {
      const wave =
        Math.sin(tt * (reducedMotion ? 1.8 : 3.6) + x * 0.014 + b * 0.8) * h * 0.028 +
        Math.cos(tt * 1.2 + x * 0.009 + b) * h * 0.012
      const y = y0 + wave
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    const a = 0.07 + stableRand(seed, b, 260) * 0.06
    ctx.strokeStyle = `hsla(${hue}, 88%, ${58 + (b % 4) * 6}%, ${a})`
    ctx.lineWidth = 2.2 + (b % 3) * 0.6
    ctx.shadowBlur = 14
    ctx.shadowColor = `hsla(${hue}, 92%, 60%, ${a * 1.8})`
    ctx.stroke()
  }
}

function drawBlossomSparkOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const n = reducedMotion ? 36 : 80
  for (let i = 0; i < n; i++) {
    const rx = stableRand(seed, i, 270) * w
    const ry = stableRand(seed, i, 271) * h
    const drift = Math.sin(tt * (0.55 + stableRand(seed, i, 272) * 0.35) + i * 0.2) * 8
    const cy = ry + drift - ((tt * (35 + (i % 12))) % (h * 0.55))
    const a = (0.04 + stableRand(seed, i, 273) * 0.06) * (0.65 + Math.sin(tt * 3 + i) * 0.35)
    const r = 0.65 + stableRand(seed, i, 274) * 1.35
    const pink = `rgba(255,${180 + ((i * 37) % 45)},${210 + ((i * 51) % 35)},${a})`
    ctx.fillStyle = pink
    ctx.beginPath()
    ctx.arc(rx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawCircuitSweepOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const cols = reducedMotion ? 10 : 20
  for (let i = 0; i < cols; i++) {
    const x = (i / cols) * w
    const jitter = stableRand(seed, i, 280) * 12
    const len = h * (0.35 + stableRand(seed, i, 281) * 0.55)
    const phase = ((tt * (0.85 + stableRand(seed, i, 282) * 0.55) + i * 0.13) % 1)
    const y0 = phase * -len * 0.4
    ctx.fillStyle = `rgba(${40 + ((i * 53) % 60)},255,220,${0.05 + stableRand(seed, i, 283) * 0.06})`
    ctx.fillRect(x + jitter - 1, y0, 2.2 + (i % 3) * 0.5, len)
    if (stableRand(seed, i, 284) > 0.82) {
      ctx.fillRect(x + jitter, y0 + len * stableRand(seed, i, 285), stableRand(seed, i, 286) * 40, 2)
    }
  }
}

function drawMireBlobOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const blobs = reducedMotion ? 5 : 9
  for (let i = 0; i < blobs; i++) {
    const mx = w * (0.12 + stableRand(seed, i, 290) * 0.76)
    const my = h * (0.35 + stableRand(seed, i, 291) * 0.52)
    const rx = Math.min(w, h) * (0.08 + stableRand(seed, i, 292) * 0.14)
    const ry = rx * (0.72 + stableRand(seed, i, 293) * 0.38)
    const rot = tt * (reducedMotion ? 0.2 : 0.45) + stableRand(seed, i, 294) * 6
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, rx * 1.2)
    const a = 0.06 + Math.sin(tt * 2 + i * 0.55) * 0.035
    g.addColorStop(0, `rgba(140,240,110,${a})`)
    g.addColorStop(0.42, `rgba(80,170,65,${a * 0.55})`)
    g.addColorStop(0.78, `rgba(140,95,205,${a * 0.35})`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.save()
    ctx.translate(mx, my)
    ctx.rotate(rot)
    ctx.beginPath()
    ctx.ellipse(0, 0, rx, ry, stableRand(seed, i, 295) * 0.35, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function drawBloodtideRippleOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const rings = reducedMotion ? 2 : 4
  const cy = h * 0.82
  for (let r = 0; r < rings; r++) {
    const phase = (tt * (reducedMotion ? 0.9 : 1.6) + r * 0.45 + stableRand(seed, r, 400) * 2) % 1
    const rad = Math.min(w, h) * (0.12 + phase * 0.42)
    const a = (1 - phase) * 0.22
    ctx.strokeStyle = `rgba(200,40,55,${a})`
    ctx.lineWidth = 1.4 + r * 0.35
    ctx.beginPath()
    ctx.ellipse(w * 0.5, cy, rad * 1.15, rad * 0.38, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  const drops = reducedMotion ? 14 : 32
  for (let i = 0; i < drops; i++) {
    const x = stableRand(seed, i, 410) * w
    const sp = 0.35 + stableRand(seed, i, 411) * 0.55
    const y = ((tt * sp + stableRand(seed, i, 412) * 3) % 1) * h * 0.55
    const len = 4 + (i % 5) * 2
    ctx.strokeStyle = `rgba(140,20,35,${0.08 + stableRand(seed, i, 413) * 0.12})`
    ctx.lineWidth = 1.1
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.sin(tt * 2 + i) * 2, y + len)
    ctx.stroke()
  }
}

function drawDuneSandOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const grains = reducedMotion ? 48 : 110
  const wind = reducedMotion ? 0.4 : 1.1
  for (let i = 0; i < grains; i++) {
    const y = stableRand(seed, i, 420) * h
    const x = ((stableRand(seed, i, 421) * w + tt * wind * (40 + (i % 20))) % (w * 1.2)) - w * 0.05
    const s = 0.6 + stableRand(seed, i, 422) * 1.8
    ctx.fillStyle = `rgba(230,${170 + (i % 40)},${110 + (i % 30)},${0.04 + stableRand(seed, i, 423) * 0.1})`
    ctx.fillRect(x, y, s, s * 0.45)
  }
  const haze = ctx.createLinearGradient(0, 0, 0, h * 0.45)
  haze.addColorStop(0, `rgba(255,220,160,${reducedMotion ? 0.06 : 0.1 + Math.sin(tt * 2.2) * 0.04})`)
  haze.addColorStop(1, 'rgba(255,200,120,0)')
  ctx.fillStyle = haze
  ctx.fillRect(0, 0, w, h * 0.45)
}

function drawSanctumShrineOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const beams = reducedMotion ? 5 : 9
  for (let b = 0; b < beams; b++) {
    const x = w * (0.18 + (b / Math.max(1, beams - 1)) * 0.64)
    const w0 = 2 + (b % 3)
    const pulse = 0.55 + Math.sin(tt * (reducedMotion ? 1.5 : 2.8) + b * 0.7) * 0.35
    const gr = ctx.createLinearGradient(x, h * 0.05, x, h * 0.95)
    gr.addColorStop(0, `rgba(255,248,210,${0.22 * pulse})`)
    gr.addColorStop(0.35, `rgba(255,220,150,${0.08 * pulse})`)
    gr.addColorStop(1, 'rgba(255,200,120,0)')
    ctx.fillStyle = gr
    ctx.fillRect(x - w0 * 0.5, h * 0.02, w0, h * 0.96)
  }
  const motes = reducedMotion ? 20 : 44
  for (let i = 0; i < motes; i++) {
    const mx = stableRand(seed, i, 430) * w
    const my = stableRand(seed, i, 431) * h * 0.55
    const tw = 0.5 + Math.abs(Math.sin(tt * 2.4 + i * 0.3))
    const a = (0.03 + stableRand(seed, i, 432) * 0.08) * tw
    ctx.fillStyle = `rgba(255,235,180,${a})`
    ctx.beginPath()
    ctx.arc(mx, my, 0.6 + (i % 3) * 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawCanopyVineOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const vines = reducedMotion ? 7 : 15
  for (let i = 0; i < vines; i++) {
    const x = stableRand(seed, i, 440) * w
    const sway = Math.sin(tt * (reducedMotion ? 0.75 : 1.45) + i * 0.55) * w * 0.028
    ctx.strokeStyle = `rgba(50,${140 + (i % 50)},${70 + (i % 40)},${0.07 + stableRand(seed, i, 441) * 0.08})`
    ctx.lineWidth = 1.1 + (i % 3) * 0.35
    ctx.beginPath()
    ctx.moveTo(x, h * 0.08)
    ctx.quadraticCurveTo(x + sway * 4, h * (0.35 + stableRand(seed, i, 442) * 0.25), x - sway * 2, h * 0.94)
    ctx.stroke()
  }
  const flecks = reducedMotion ? 28 : 64
  for (let i = 0; i < flecks; i++) {
    const fx = stableRand(seed, i, 443) * w
    const fy = stableRand(seed, i, 444) * h * 0.72
    const a = 0.02 + stableRand(seed, i, 445) * 0.06
    ctx.fillStyle = `rgba(120,255,160,${a})`
    ctx.fillRect(fx, fy, 1.2 + (i % 2), 1 + (i % 2))
  }
}

function drawAbyssalDepthOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const veils = reducedMotion ? 2 : 3
  for (let v = 0; v < veils; v++) {
    const g = ctx.createRadialGradient(
      w * (0.35 + v * 0.22),
      h * (0.55 + Math.sin(tt * 0.9 + v) * 0.06),
      0,
      w * 0.5,
      h * 0.55,
      Math.min(w, h) * (0.55 + v * 0.08)
    )
    const a = 0.12 - v * 0.03
    g.addColorStop(0, `rgba(30,120,200,${a})`)
    g.addColorStop(0.45, `rgba(8,40,90,${a * 0.85})`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  const sparks = reducedMotion ? 18 : 42
  for (let i = 0; i < sparks; i++) {
    const sx = stableRand(seed, i, 450) * w
    const sy = stableRand(seed, i, 451) * h * 0.65 + h * 0.2
    const tw = 0.5 + Math.abs(Math.sin(tt * 2.1 + i * 0.4))
    ctx.fillStyle = `rgba(120,255,240,${(0.04 + stableRand(seed, i, 452) * 0.09) * tw})`
    ctx.beginPath()
    ctx.arc(sx, sy, 0.5 + (i % 2) * 0.45, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawCogworkGearOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const hubs: [number, number][] = [
    [w * 0.22, h * 0.28],
    [w * 0.78, h * 0.32],
    [w * 0.5, h * 0.72],
  ]
  const nHub = reducedMotion ? 2 : 3
  for (let hIdx = 0; hIdx < nHub; hIdx++) {
    const [cx, cy] = hubs[hIdx]!
    const rot = tt * (reducedMotion ? 0.35 : 0.85) * (hIdx % 2 === 0 ? 1 : -1)
    const teeth = reducedMotion ? 6 : 10
    ctx.strokeStyle = `rgba(220,170,90,${0.12 + hIdx * 0.04})`
    ctx.lineWidth = 1.4
    for (let tooth = 0; tooth < teeth; tooth++) {
      const a0 = rot + (tooth / teeth) * Math.PI * 2
      const a1 = rot + ((tooth + 0.45) / teeth) * Math.PI * 2
      const r0 = Math.min(w, h) * (0.08 + (hIdx % 2) * 0.02)
      const r1 = r0 * 1.55
      ctx.beginPath()
      ctx.arc(cx, cy, r0, a0, a1)
      ctx.arc(cx, cy, r1, a1, a0, true)
      ctx.closePath()
      ctx.stroke()
    }
  }
  const rivets = reducedMotion ? 16 : 38
  for (let i = 0; i < rivets; i++) {
    const rx = stableRand(seed, i, 460) * w
    const ry = stableRand(seed, i, 461) * h
    ctx.fillStyle = `rgba(180,140,70,${0.05 + stableRand(seed, i, 462) * 0.08})`
    ctx.beginPath()
    ctx.arc(rx, ry, 0.9, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawConstellationOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const n = reducedMotion ? 10 : 18
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i < n; i++) {
    xs.push(stableRand(seed, i, 470) * w * 0.88 + w * 0.06)
    ys.push(stableRand(seed, i, 471) * h * 0.78 + h * 0.08)
  }
  const tw = 0.55 + Math.sin(tt * (reducedMotion ? 1.2 : 2.2)) * 0.35
  ctx.strokeStyle = `rgba(200,230,255,${0.06 * tw})`
  ctx.lineWidth = 0.7
  for (let i = 0; i < n; i++) {
    const j = (i + 3) % n
    ctx.beginPath()
    ctx.moveTo(xs[i]!, ys[i]!)
    ctx.lineTo(xs[j]!, ys[j]!)
    ctx.stroke()
  }
  for (let i = 0; i < n; i++) {
    const a = (0.12 + stableRand(seed, i, 472) * 0.18) * tw
    ctx.fillStyle = `rgba(255,252,240,${a})`
    ctx.beginPath()
    ctx.arc(xs[i]!, ys[i]!, 0.9 + (i % 4) * 0.35, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawRustFlakeOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const flakes = reducedMotion ? 40 : 96
  for (let i = 0; i < flakes; i++) {
    const x = ((stableRand(seed, i, 480) * w + tt * (reducedMotion ? 8 : 22) * (1 + (i % 5) * 0.08)) % (w + 40)) - 20
    const y = stableRand(seed, i, 481) * h
    const r = 180 + (i % 50)
    const g = 90 + (i % 40)
    const b = 40 + (i % 30)
    ctx.fillStyle = `rgba(${r},${g},${b},${0.03 + stableRand(seed, i, 482) * 0.09})`
    ctx.fillRect(x, y, 2 + (i % 3), 1.2 + (i % 2))
  }
  const patina = ctx.createLinearGradient(0, 0, w, h)
  patina.addColorStop(0, `rgba(40,140,130,${reducedMotion ? 0.04 : 0.07 + Math.sin(tt * 1.8) * 0.03})`)
  patina.addColorStop(1, 'rgba(120,60,30,0)')
  ctx.fillStyle = patina
  ctx.fillRect(0, 0, w, h)
}

function drawTremorDustOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const n = reducedMotion ? 36 : 72
  const shake = reducedMotion ? 0 : Math.sin(tt * 28) * 3
  for (let i = 0; i < n; i++) {
    const x = stableRand(seed, i, 260) * w + shake * stableRand(seed, i, 261)
    const y = stableRand(seed, i, 262) * h
    const s = 0.8 + stableRand(seed, i, 263) * 2.2
    ctx.fillStyle = `rgba(180, 150, 120, ${0.08 + stableRand(seed, i, 264) * 0.18})`
    ctx.fillRect(x, y, s, s * 0.6)
  }
  ctx.strokeStyle = `rgba(90, 70, 50, ${reducedMotion ? 0.15 : 0.2 + Math.sin(tt * 12) * 0.08})`
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(w * 0.08, h * 0.88)
  for (let k = 0; k < 12; k++) {
    ctx.lineTo(
      w * (0.08 + (k / 12) * 0.84) + (stableRand(seed, k, 265) - 0.5) * w * 0.04,
      h * (0.86 + (stableRand(seed, k, 266) - 0.5) * 0.08)
    )
  }
  ctx.stroke()
}

function drawPlasmaFilamentOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const fils = reducedMotion ? 4 : 8
  for (let f = 0; f < fils; f++) {
    let x = stableRand(seed, f, 270) * w
    let y = stableRand(seed, f, 271) * h * 0.4
    ctx.beginPath()
    ctx.moveTo(x, y)
    const segs = 8 + (seed % 5)
    for (let k = 0; k < segs; k++) {
      x += (stableRand(seed, f * 30 + k, 272) - 0.5) * w * 0.12
      y += h * (0.05 + stableRand(seed, f * 30 + k, 273) * 0.06)
      ctx.lineTo(x, y)
    }
    const hue = (f % 2 === 0 ? 185 : 300) + (seed % 40)
    ctx.strokeStyle = `hsla(${hue}, 90%, 65%, ${reducedMotion ? 0.22 : 0.28 + Math.sin(tt * 10 + f) * 0.12})`
    ctx.lineWidth = 1.1
    ctx.shadowBlur = reducedMotion ? 4 : 10
    ctx.shadowColor = `hsla(${hue}, 100%, 70%, 0.5)`
    ctx.stroke()
    ctx.shadowBlur = 0
  }
}

function drawStarTwinkleOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const stars = reducedMotion ? 22 : 42
  for (let i = 0; i < stars; i++) {
    const sx = stableRand(seed, i, 280) * w
    const sy = stableRand(seed, i, 281) * h
    const tw = 0.35 + Math.abs(Math.sin(tt * (4 + stableRand(seed, i, 282) * 6) + i)) * 0.65
    const r = 0.6 + stableRand(seed, i, 283) * 1.8
    ctx.strokeStyle = `rgba(255, 252, 235, ${0.15 * tw})`
    ctx.lineWidth = 0.6
    ctx.beginPath()
    ctx.moveTo(sx - r * 2.2, sy)
    ctx.lineTo(sx + r * 2.2, sy)
    ctx.moveTo(sx, sy - r * 2.2)
    ctx.lineTo(sx, sy + r * 2.2)
    ctx.stroke()
    ctx.fillStyle = `rgba(255, 245, 220, ${0.35 * tw})`
    ctx.beginPath()
    ctx.arc(sx, sy, r * 0.45, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawMoonGlowOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const mx = w * (0.35 + stableRand(seed, 1, 290) * 0.3)
  const my = h * (0.22 + stableRand(seed, 1, 291) * 0.25)
  const mr = Math.min(w, h) * (0.14 + stableRand(seed, 1, 292) * 0.06)
  const pulse = 0.65 + Math.sin(tt * (reducedMotion ? 1.2 : 2.4)) * 0.2
  const g = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 2.2)
  g.addColorStop(0, `rgba(255, 255, 250, ${0.28 * pulse})`)
  g.addColorStop(0.35, `rgba(230, 235, 255, ${0.14 * pulse})`)
  g.addColorStop(0.55, `rgba(200, 210, 255, ${0.08 * pulse})`)
  g.addColorStop(1, 'rgba(160, 180, 255, 0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(mx, my, mr * 2.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = `rgba(255, 255, 245, ${0.22 * pulse})`
  ctx.beginPath()
  ctx.arc(mx - mr * 0.22, my, mr * 0.95, 0, Math.PI * 2)
  ctx.fill()
}

function buildNameCodes(name: string): number[] {
  const codes: number[] = []
  for (let i = 0; i < name.length; i++) {
    codes.push(name.charCodeAt(i))
  }
  return codes
}

function drawTechniqueNameFingerprintOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  name: string,
  reducedMotion: boolean
): void {
  const codes = buildNameCodes(name)
  if (codes.length === 0) return
  const u = Math.min(w, h)

  // 1) Top signature barcode (character-by-character deterministic widths/heights/colors)
  const maxBars = 20
  const count = Math.min(maxBars, codes.length * 2)
  const left = w * 0.08
  const width = w * 0.84
  const step = width / Math.max(1, count)
  for (let i = 0; i < count; i++) {
    const code = codes[i % codes.length] ?? 0
    const barW = step * (0.3 + (code % 5) * 0.15)
    const barH = h * (0.04 + (code % 7) * 0.008)
    const x = left + i * step
    const pulse = reducedMotion ? 0.75 : 0.65 + Math.sin(tt * (1.4 + (i % 4) * 0.2) + i * 0.3) * 0.25
    const hue = (code * 7 + i * 13) % 360
    ctx.fillStyle = `hsla(${hue}, 92%, 68%, ${0.18 + pulse * 0.24})`
    ctx.fillRect(x, h * 0.08, barW, barH)
  }

  // 2) Bottom mirrored barcode (different mapping to avoid similar top/bottom rhythm)
  for (let i = 0; i < count; i++) {
    const code = codes[(codes.length - 1 - (i % codes.length) + codes.length) % codes.length] ?? 0
    const barW = step * (0.28 + (code % 6) * 0.12)
    const barH = h * (0.035 + (code % 9) * 0.007)
    const x = left + i * step
    const pulse = reducedMotion ? 0.72 : 0.62 + Math.cos(tt * (1.3 + (i % 3) * 0.25) + i * 0.22) * 0.24
    const hue = (code * 11 + i * 9 + 140) % 360
    ctx.fillStyle = `hsla(${hue}, 88%, 64%, ${0.15 + pulse * 0.2})`
    ctx.fillRect(x, h * 0.88 - barH, barW, barH)
  }

  // 3) Character radial markers around center (highly name-specific silhouette)
  const cx = w * 0.5
  const cy = h * 0.52
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i] ?? 0
    const ang = (i / Math.max(1, codes.length)) * Math.PI * 2 + (code % 37) * 0.03
    const r = u * (0.17 + (code % 19) * 0.008)
    const mx = cx + Math.cos(ang) * r
    const my = cy + Math.sin(ang) * r * 0.74
    const len = u * (0.03 + (code % 8) * 0.006)
    const dir = reducedMotion ? 0 : tt * (0.25 + (code % 5) * 0.05)
    const x2 = mx + Math.cos(ang + dir) * len
    const y2 = my + Math.sin(ang + dir) * len
    const hue = (code * 5 + i * 21 + 40) % 360
    ctx.strokeStyle = `hsla(${hue}, 96%, 74%, 0.34)`
    ctx.lineWidth = 1 + (code % 3) * 0.5
    ctx.beginPath()
    ctx.moveTo(mx, my)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
}

function detectTechniqueNameMotif(name: string): 'slash' | 'magic' | 'shooting' | 'none' {
  const slashTokens = [
    '刃',
    '斬',
    '断',
    '裂',
    '牙',
    'ラッシュ',
    'ブレイク',
    'クロス',
    'スラッシュ',
    'ストライク',
    'スプリット',
    'エッジ',
    'フィニッシュ',
  ]
  const magicTokens = [
    '術',
    '詠',
    '陣',
    '符',
    '唱',
    'スペル',
    'ミスト',
    'オーラ',
    'ルーン',
    'アストラ',
    'カワイソウニ',
    'キャスト',
    'チャント',
    'チャーム',
    'ブレッシング',
    'ゲート',
    'ブースト',
    'カース',
  ]
  const shootingTokens = [
    '弾',
    '砲',
    '射',
    '撃',
    'ショット',
    'バースト',
    'スナイプ',
    'バレット',
    'キャノン',
    '矢',
    '徹甲',
    '竜撃弾',
    'ラピッド',
    'フルオート',
    'スプレッド',
    'ロックオン',
    'チェイン',
    'エクスプロード',
  ]

  // 雷鳴* は射撃語尾でも見た目をスラッシュへ寄せる
  if (name.startsWith('雷鳴')) return 'slash'
  if (shootingTokens.some((token) => name.includes(token))) return 'shooting'
  if (magicTokens.some((token) => name.includes(token))) return 'magic'
  if (slashTokens.some((token) => name.includes(token))) return 'slash'
  return 'none'
}

type NaturalDisasterKind = 'none' | 'fire' | 'storm' | 'meteor' | 'frost' | 'quake'

function detectNaturalDisasterKind(name: string): NaturalDisasterKind {
  if (
    ['流星', '彗星', 'メテオ', '隕', '星'].some((t) => name.includes(t))
  ) return 'meteor'
  if (
    ['雷', '嵐', '豪雨', '暴風', '台風'].some((t) => name.includes(t))
  ) return 'storm'
  if (
    ['烈火', '業火', '火', '炎', '焔', '爆'].some((t) => name.includes(t))
  ) return 'fire'
  if (
    ['吹雪', '氷', '雪', '凍'].some((t) => name.includes(t))
  ) return 'frost'
  if (
    ['震', '地', '崩', '裂'].some((t) => name.includes(t))
  ) return 'quake'
  return 'none'
}

function detectNameAccentKinds(name: string): TechniqueEffectKind[] {
  const accents: TechniqueEffectKind[] = []
  const pushUnique = (kind: TechniqueEffectKind) => {
    if (!accents.includes(kind)) accents.push(kind)
  }

  // 語尾・語彙ごとの「追加アクセント」を重ね、同タイプ内の差を強める
  if (name.includes('ラッシュ')) pushUnique('tempest')
  if (name.includes('ダブル') || name.includes('トリプル')) pushUnique('tempest')
  if (name.includes('ブレイク')) pushUnique('tremor')
  if (name.includes('ストライク')) pushUnique('tremor')
  if (name.includes('クロス')) pushUnique('radiance')
  if (name.includes('牙')) pushUnique('phantom')
  if (name.includes('スプリット')) pushUnique('phantom')
  if (name.includes('エッジ')) pushUnique('radiance')
  if (name.includes('フィニッシュ')) pushUnique('nova')

  if (name.includes('詠') || name.includes('唱')) pushUnique('nova')
  if (name.includes('チャント')) pushUnique('radiance')
  if (name.includes('キャスト')) pushUnique('plasma')
  if (name.includes('チャーム') || name.includes('ブレッシング')) pushUnique('radiance')
  if (name.includes('カース') || name.includes('ゲート')) pushUnique('void')
  if (name.includes('ブースト')) pushUnique('plasma')
  if (name.includes('陣') || name.includes('符')) pushUnique('plasma')
  if (name.includes('ミスト')) pushUnique('glacier')
  if (name.includes('オーラ')) pushUnique('radiance')

  if (name.includes('砲') || name.includes('キャノン')) pushUnique('tremor')
  if (name.includes('スナイプ') || name.includes('ロックオン')) pushUnique('phantom')
  if (name.includes('バースト')) pushUnique('inferno')
  if (name.includes('ショット')) pushUnique('plasma')
  if (name.includes('エクスプロード') || name.includes('オーバードライブ')) pushUnique('inferno')
  if (name.includes('フルオート') || name.includes('ラピッド')) pushUnique('plasma')
  if (name.includes('チェイン')) pushUnique('tempest')
  if (name.includes('スプレッド')) pushUnique('meteor')
  if (name.includes('スタンピード')) pushUnique('tremor')

  if (name.includes('オーロラ') || name.includes('極光')) pushUnique('aurora')
  if (name.includes('花') || name.includes('芽') || (name.includes('華') && !name.includes('氷')))
    pushUnique('blossom')
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_CYBER_NAME_PARTS.slash)) pushUnique('circuit')
  if (name.includes('毒') || name.includes('瘴') || name.includes('菌')) pushUnique('mire')

  if (techniqueNameHitsAny(name, TECHNIQUE_NAME_ACCENT_BLOODTIDE_PARTS)) pushUnique('bloodtide')
  if (techniqueNameHitsAny(name, TECHNIQUE_NAME_ACCENT_DUNE_PARTS)) pushUnique('dune')
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_SANCTUM_MARKERS.magic)) pushUnique('sanctum')
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.canopy)) pushUnique('canopy')
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.abyssal)) pushUnique('abyssal')
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.cogwork)) pushUnique('cogwork')
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.constellation)) pushUnique('constellation')
  if (techniqueNameHitsAny(name, TECHNIQUE_EFFECT_THEME_MARKERS.rustbound)) pushUnique('rustbound')

  return accents
}

function drawNameShootingOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const bursts = reducedMotion ? 2 : 4
  const speed = reducedMotion ? 0.8 : 1.35
  for (let i = 0; i < bursts; i++) {
    const y = h * (0.25 + stableRand(seed, i, 301) * 0.5)
    const phase = (tt * speed + stableRand(seed, i, 302)) % 1
    const x = -w * 0.1 + phase * w * 1.2
    const len = w * (0.18 + stableRand(seed, i, 303) * 0.18)
    const grad = ctx.createLinearGradient(x, y, x + len, y)
    grad.addColorStop(0, 'rgba(255,255,255,0.95)')
    grad.addColorStop(0.4, 'rgba(255,210,130,0.58)')
    grad.addColorStop(1, 'rgba(255,140,70,0)')
    ctx.strokeStyle = grad
    ctx.lineWidth = 1.2 + stableRand(seed, i, 304) * 1.6
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + len, y + (stableRand(seed, i, 305) - 0.5) * h * 0.08)
    ctx.stroke()
  }
}

function drawNameMagicOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tt: number,
  seed: number,
  reducedMotion: boolean
): void {
  const cx = w * 0.5
  const cy = h * 0.54
  const u = Math.min(w, h)
  const ringCount = reducedMotion ? 2 : 3
  for (let i = 0; i < ringCount; i++) {
    const r = u * (0.15 + i * 0.08 + Math.sin(tt * 1.9 + i) * 0.015)
    ctx.strokeStyle = `rgba(220, 200, 255, ${0.24 - i * 0.05})`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, r, tt * (0.2 + i * 0.07), tt * (0.2 + i * 0.07) + Math.PI * 1.6)
    ctx.stroke()
  }

  const glyphs = reducedMotion ? 10 : 18
  for (let g = 0; g < glyphs; g++) {
    const ang = (g / glyphs) * Math.PI * 2 + tt * 0.35
    const r = u * 0.22
    const gx = cx + Math.cos(ang) * r
    const gy = cy + Math.sin(ang) * r * 0.75
    const s = 3 + stableRand(seed, g, 311) * 2
    ctx.strokeStyle = `rgba(245, 230, 255, ${0.2 + stableRand(seed, g, 312) * 0.25})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(gx - s, gy)
    ctx.lineTo(gx + s, gy)
    ctx.moveTo(gx, gy - s)
    ctx.lineTo(gx, gy + s)
    ctx.stroke()
  }
}

function drawNameSlashOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seed: number,
  reducedMotion: boolean,
  name: string
): void {
  const codes = buildNameCodes(name)
  if (codes.length === 0) return

  // 端から端へ斬る 4 本（reduced motion 時は 3 本）
  const cuts = reducedMotion ? 3 : 4
  const u = Math.min(w, h)
  const margin = u * 0.42

  const baseCode = codes[0] ?? 0
  const baseDir = (baseCode + (seed % 13)) % 2 === 0 ? 1 : -1
  const hueBase = (215 + (baseCode % 55) + (seed % 23)) % 360

  // Quadratic Bezier helper
  const quadAt = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, t: number) => {
    const it = 1 - t
    return {
      x: it * it * x0 + 2 * it * t * cx + t * t * x1,
      y: it * it * y0 + 2 * it * t * cy + t * t * y1,
    }
  }
  const quadDeriv = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, t: number) => {
    return {
      x: 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx),
      y: 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy),
    }
  }

  for (let i = 0; i < cuts; i++) {
    const code = codes[i % codes.length] ?? 0

    // start/end are outside screen to guarantee edge-to-edge coverage
    const x0 = baseDir === 1 ? -margin : w + margin
    const x1 = baseDir === 1 ? w + margin : -margin

    const tJ = stableRand(seed, i, 910) - 0.5
    const tJ2 = stableRand(seed, i, 911) - 0.5

    const y0 = h * (0.12 + i * (0.78 / Math.max(1, cuts - 1))) + tJ * h * 0.08
    const y1 = h * (0.88 - i * (0.78 / Math.max(1, cuts - 1))) + tJ2 * h * 0.08

    const dx = x1 - x0
    const dy = y1 - y0
    const len = Math.hypot(dx, dy) || 1
    const px = -dy / len
    const py = dx / len

    const curveAmp = u * (0.18 + stableRand(seed, i, 920) * 0.26) * (0.9 + (code % 9) * 0.05)
    const cX = (x0 + x1) * 0.5 + px * curveAmp * (0.75 + (tJ * 0.6 + 0.5) * 0.5) * baseDir
    const cY = (y0 + y1) * 0.5 + py * curveAmp * (0.65 + (tJ2 * 0.5 + 0.5) * 0.6)

    const hue = (hueBase + code * 0.07 + i * 14) % 360

    // Glow pass
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.shadowBlur = reducedMotion ? 10 : 18
    ctx.shadowColor = `hsla(${hue}, 95%, 65%, 0.35)`
    ctx.strokeStyle = `hsla(${hue}, 95%, 70%, ${0.12 + stableRand(seed, i, 930) * 0.08})`
    ctx.lineWidth = 9 + stableRand(seed, i, 931) * 6
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.quadraticCurveTo(cX, cY, x1, y1)
    ctx.stroke()

    // Core pass
    ctx.shadowBlur = 0
    const coreGrad = ctx.createLinearGradient(x0, y0, x1, y1)
    coreGrad.addColorStop(0, 'rgba(255,255,255,0)')
    coreGrad.addColorStop(0.25, `hsla(${hue}, 98%, 88%, 0.18)`)
    coreGrad.addColorStop(0.5, `hsla(${hue}, 98%, 92%, 0.82)`)
    coreGrad.addColorStop(0.78, `hsla(${hue}, 98%, 88%, 0.22)`)
    coreGrad.addColorStop(1, 'rgba(180,220,255,0)')
    ctx.strokeStyle = coreGrad
    ctx.lineWidth = 3.2 + stableRand(seed, i, 932) * 1.5
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.quadraticCurveTo(cX, cY, x1, y1)
    ctx.stroke()

    // Slash ticks (impact highlights) along the curve
    const tickN = reducedMotion ? 2 : 3
    for (let k = 0; k < tickN; k++) {
      const tt = 0.22 + (k + 1) / (tickN + 2)
      const p = quadAt(x0, y0, cX, cY, x1, y1, tt)
      const d = quadDeriv(x0, y0, cX, cY, x1, y1, tt)
      const dl = Math.hypot(d.x, d.y) || 1
      const nx = -d.y / dl
      const ny = d.x / dl
      const tickLen = u * (0.02 + (code % 7) * 0.0015)
      ctx.strokeStyle = `hsla(${(hue + 14) % 360}, 98%, 96%, 0.65)`
      ctx.lineWidth = 1 + stableRand(seed, i * 10 + k, 940) * 0.9
      ctx.beginPath()
      ctx.moveTo(p.x - nx * tickLen, p.y - ny * tickLen)
      ctx.lineTo(p.x + nx * tickLen, p.y + ny * tickLen)
      ctx.stroke()
    }

    // Impact glow near end
    const impactR = u * (0.035 + stableRand(seed, i, 950) * 0.02)
    const impact = ctx.createRadialGradient(x1, y1, 0, x1, y1, impactR)
    impact.addColorStop(0, `hsla(${hue}, 98%, 92%, ${0.45 + stableRand(seed, i, 951) * 0.2})`)
    impact.addColorStop(0.4, `hsla(${hue}, 98%, 70%, 0.18)`)
    impact.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = impact
    ctx.beginPath()
    ctx.arc(x1, y1, impactR, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }
}

export function drawTechniqueBurstArt(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  pattern: number,
  seed: number,
  reducedMotion: boolean,
  aux0 = 0,
  aux1 = 0,
  effectKind?: TechniqueEffectKind,
  techniqueName?: string
): void {
  const pat = ((pattern % 60) + 60) % 60
  const s = ((seed ^ (pat * 0x517cc1b7) ^ aux0 ^ (aux1 << 3)) >>> 0) | 0
  const tSpread = 0.72 + ((aux0 & 0xfff) / 0xfff) * 0.65
  const tPhase = ((aux1 & 0xffff) / 0xffff) * Math.PI * 2
  const tt = reducedMotion ? 0 : t * tSpread + tPhase
  const cx = w * 0.5
  const cy = h * 0.5
  const uScale = 0.78 + (((aux0 >>> 12) & 0xfff) / 0xfff) * 0.55
  const u = Math.min(w, h) * uScale

  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'lighter'
  const name = techniqueName?.trim() ?? ''
  const motif = detectTechniqueNameMotif(name)
  if (name.length === 0) {
    switch (pat) {
    case 0: {
      for (let r = 0; r < 10; r++) {
        const pulse = Math.sin(tt * 2.1 + r * 0.55) * 0.5 + 0.5
        const rad = u * (0.06 + r * 0.055) + pulse * u * 0.04
        ctx.strokeStyle = hsla(s, r, 0.08 + pulse * 0.1)
        ctx.lineWidth = 1.2 + stableRand(s, r, 3) * 1.5
        ctx.beginPath()
        ctx.arc(cx, cy, rad, 0, Math.PI * 2)
        ctx.stroke()
      }
      break
    }
    case 1: {
      const arms = 5
      for (let a = 0; a < arms; a++) {
        const ang = (a / arms) * Math.PI * 2 + tt * 0.35
        for (let i = 0; i < 90; i++) {
          const r = (i / 90) * u * 0.48
          const wob = Math.sin(tt * 3 + i * 0.08) * 4
          const x = cx + Math.cos(ang + i * 0.02) * (r + wob)
          const y = cy + Math.sin(ang + i * 0.02) * (r + wob)
          ctx.fillStyle = hsla(s, i + a * 17, 0.12 + (1 - i / 90) * 0.25)
          ctx.fillRect(x, y, 1.6, 1.6)
        }
      }
      break
    }
    case 2: {
      const sz = u * 0.07
      for (let gy = -2; gy < h / sz + 2; gy++) {
        for (let gx = -2; gx < w / sz + 2; gx++) {
          const ox = gx * sz * 0.866 + (gy % 2) * sz * 0.433
          const oy = gy * sz * 0.75
          const pulse = Math.sin(tt * 2 + gx * 0.2 + gy * 0.15) * 0.5 + 0.5
          ctx.strokeStyle = hsla(s, gx + gy * 31, 0.04 + pulse * 0.14)
          ctx.lineWidth = 1
          ctx.beginPath()
          for (let k = 0; k < 6; k++) {
            const ang = (k / 6) * Math.PI * 2 - Math.PI / 6
            const px = ox + Math.cos(ang) * sz * 0.55
            const py = oy + Math.sin(ang) * sz * 0.55
            if (k === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
          ctx.closePath()
          ctx.stroke()
        }
      }
      break
    }
    case 3: {
      for (let i = 0; i < 160; i++) {
        const life = (tt * 0.85 + stableRand(s, i, 4) * 4) % 1
        const x = stableRand(s, i, 5) * w
        const y = h - life * h * 1.15 + Math.sin(tt + i) * 6
        ctx.fillStyle = hsla(s, i, 0.06 + (1 - life) * 0.35)
        ctx.fillRect(x, y, 2, 2 + stableRand(s, i, 6) * 4)
      }
      break
    }
    case 4: {
      ctx.lineWidth = 2.2
      for (let b = 0; b < 5; b++) {
        ctx.beginPath()
        const y0 = h * (0.15 + b * 0.16)
        for (let x = 0; x <= w; x += 6) {
          const y = y0 + Math.sin(x * 0.02 + tt * 2.4 + b) * u * 0.08
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = hsla(s, b * 19, 0.1 + b * 0.04)
        ctx.stroke()
      }
      break
    }
    case 5: {
      ctx.lineWidth = 1.4
      const branches = 14
      for (let b = 0; b < branches; b++) {
        let x = cx + (stableRand(s, b, 7) - 0.5) * w * 0.35
        let y = stableRand(s, b, 8) * h * 0.25
        const ang = -Math.PI * 0.5 + (stableRand(s, b, 9) - 0.5) * 0.8
        const len = u * (0.22 + stableRand(s, b, 10) * 0.2)
        ctx.beginPath()
        ctx.moveTo(x, y)
        for (let i = 0; i < 28; i++) {
          x += Math.cos(ang + (stableRand(s, b, i + 11) - 0.5) * 0.6) * len * 0.04
          y += Math.sin(ang + (stableRand(s, b, i + 12) - 0.5) * 0.6) * len * 0.04 + i * 0.35
          ctx.lineTo(x, y)
        }
        ctx.strokeStyle = hsla(s + b * 20, b, 0.15 + Math.sin(tt * 8 + b) * 0.08)
        ctx.stroke()
      }
      break
    }
    case 6: {
      for (let k = 0; k < 14; k++) {
        const px = stableRand(s, k, 13) * w
        const py = stableRand(s, k, 14) * h
        const r = u * (0.08 + stableRand(s, k, 15) * 0.18) + Math.sin(tt * 2 + k) * u * 0.03
        const g = ctx.createRadialGradient(px, py, 0, px, py, r)
        g.addColorStop(0, hsla(s, k, 0.35))
        g.addColorStop(0.45, hsla(s + 40, k, 0.12))
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(px, py, r, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 7: {
      for (let i = 0; i < 220; i++) {
        const x = stableRand(s, i, 16) * w
        const y = stableRand(s, i, 17) * h
        const tw = Math.sin(tt * 5 + i * 0.7) * 0.5 + 0.5
        ctx.fillStyle = hsla(s + i, i, 0.05 + tw * 0.55)
        ctx.fillRect(x, y, 1.2, 1.2)
      }
      break
    }
    case 8: {
      for (let i = 0; i < 6; i++) {
        const r = u * (0.08 + i * 0.09 + (tt % 2) * 0.04)
        const a = 0.18 - i * 0.025
        ctx.strokeStyle = hsla(s + i * 30, i, Math.max(0.04, a))
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, cy * 1.05, r, -Math.PI * 1.05, -0.1)
        ctx.stroke()
      }
      break
    }
    case 9: {
      ctx.lineWidth = 1.2
      for (let i = 0; i < 120; i++) {
        const ang = (i / 120) * Math.PI * 8 + tt * 0.9
        const r = (i / 120) * u * 0.45
        const x = cx + Math.cos(ang) * r
        const y = cy + Math.sin(ang) * r * 0.88
        ctx.strokeStyle = hsla(s, i, 0.08 + (i / 120) * 0.22)
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + Math.cos(ang + 0.3) * 10, y + Math.sin(ang + 0.3) * 10)
        ctx.stroke()
      }
      break
    }
    case 10: {
      const step = 14
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          const v =
            Math.sin(x * 0.04 + tt) * Math.cos(y * 0.035 + tt * 0.8) * 0.5 + 0.5
          if (v > 0.55) {
            ctx.fillStyle = hsla(s, x + y, 0.04 + (v - 0.55) * 0.5)
            ctx.fillRect(x, y, 2.5, 2.5)
          }
        }
      }
      break
    }
    case 11: {
      for (let i = 0; i < 18; i++) {
        const rot = tt * (0.4 + stableRand(s, i, 18) * 0.5) + i
        const px = stableRand(s, i, 19) * w * 0.85 + w * 0.075
        const py = stableRand(s, i, 20) * h * 0.85 + h * 0.075
        ctx.save()
        ctx.translate(px, py)
        ctx.rotate(rot)
        ctx.strokeStyle = hsla(s, i, 0.12)
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(0, -u * 0.06)
        ctx.lineTo(u * 0.04, u * 0.05)
        ctx.lineTo(-u * 0.04, u * 0.05)
        ctx.closePath()
        ctx.stroke()
        ctx.restore()
      }
      break
    }
    case 12: {
      const g = Math.floor(tt * 14) % 8
      for (let i = -4; i < w / 18 + 4; i++) {
        for (let j = -4; j < h / 18 + 4; j++) {
          if (((i + j + g) & 1) === 0) continue
          const ex = (i - g * 0.5) * 18 + (tt * 40) % 22
          const ey = j * 18
          ctx.fillStyle = hsla(s, i + j * 7, 0.06)
          ctx.fillRect(ex, ey, 3, 3)
        }
      }
      break
    }
    case 13: {
      ctx.lineWidth = 1.2
      for (let i = 0; i < 70; i++) {
        const x = stableRand(s, i, 21) * w
        const y = ((tt * (120 + i * 3) + stableRand(s, i, 22) * h) % (h + 40)) - 20
        ctx.strokeStyle = hsla(s + 100, i, 0.15)
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x - 14, y + 28)
        ctx.stroke()
      }
      break
    }
    case 14: {
      for (let b = 0; b < 8; b++) {
        const y = h * (0.08 + b * 0.1) + Math.sin(tt * 1.4 + b) * u * 0.04
        const gr = ctx.createLinearGradient(0, y, w, y + 18)
        gr.addColorStop(0, 'rgba(0,0,0,0)')
        gr.addColorStop(0.5, hsla(s + b * 25, b, 0.18))
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = gr
        ctx.fillRect(0, y, w, 22)
      }
      break
    }
    case 15: {
      for (let i = 0; i < 12; i++) {
        ctx.beginPath()
        const bx = stableRand(s, i, 23) * w
        const baseY = h * (0.55 + stableRand(s, i, 24) * 0.35)
        ctx.moveTo(bx, baseY)
        for (let k = 0; k < 8; k++) {
          ctx.quadraticCurveTo(
            bx + Math.sin(tt + k + i) * 20,
            baseY - k * u * 0.05,
            bx + (stableRand(s, i + k, 25) - 0.5) * 30,
            baseY - (k + 1) * u * 0.06
          )
        }
        ctx.strokeStyle = hsla(s + i * 8, i, 0.12)
        ctx.lineWidth = 2
        ctx.stroke()
      }
      break
    }
    case 16: {
      ctx.lineWidth = 1.1
      for (let i = 0; i < 35; i++) {
        ctx.beginPath()
        let x = stableRand(s, i, 26) * w
        let y = stableRand(s, i, 27) * h
        ctx.moveTo(x, y)
        for (let k = 0; k < 12; k++) {
          x += (stableRand(s, i + k * 3, 28) - 0.5) * 22
          y += (stableRand(s, i + k * 3, 29) - 0.5) * 18 - 4
          ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `hsla(${180 + (s + i) % 80},70%,${60 + i}%,0.14)`
        ctx.stroke()
      }
      break
    }
    case 17: {
      for (let i = 0; i < 90; i++) {
        const life = (tt * 0.7 + stableRand(s, i, 30) * 5) % 1
        const x = stableRand(s, i, 31) * w
        const y = life * h * 1.1 - 10
        const r = 3 + stableRand(s, i, 32) * 5
        ctx.fillStyle = `hsla(${120 + (s % 40)},${70 + i % 20}%,45%,${0.15 * (1 - life)})`
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 18: {
      for (let k = 0; k < 4; k++) {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(tt * 0.25 + k * (Math.PI / 2))
        ctx.strokeStyle = hsla(s + k * 40, k, 0.1)
        ctx.lineWidth = 2
        const L = u * 0.22
        ctx.beginPath()
        ctx.moveTo(0, -L)
        ctx.lineTo(0, L)
        ctx.moveTo(-L * 0.65, -L * 0.35)
        ctx.lineTo(L * 0.65, L * 0.35)
        ctx.moveTo(L * 0.65, -L * 0.35)
        ctx.lineTo(-L * 0.65, L * 0.35)
        ctx.stroke()
        ctx.restore()
      }
      break
    }
    case 19: {
      const shake = Math.sin(tt * 40) * 3
      ctx.translate(shake, Math.cos(tt * 37) * 2.5)
      for (let i = 0; i < 40; i++) {
        const x = stableRand(s, i, 33) * w
        const y = stableRand(s, i, 34) * h
        ctx.fillStyle = hsla(s + 30, i, 0.08)
        ctx.fillRect(x, y, 3, 2)
      }
      break
    }
    case 20: {
      for (let i = 0; i < 18; i++) {
        const rw = w * (0.15 + i * 0.045) + Math.sin(tt + i * 0.4) * 8
        const rh = h * (0.12 + i * 0.04)
        ctx.strokeStyle = hsla(s, i, 0.07 + (i / 18) * 0.12)
        ctx.strokeRect(cx - rw / 2, cy - rh / 2, rw, rh)
      }
      break
    }
    case 21: {
      ctx.lineWidth = 16 + Math.sin(tt * 2) * 4
      ctx.strokeStyle = hsla(s, 1, 0.14)
      ctx.beginPath()
      ctx.arc(cx, cy, u * 0.32, tt * 0.9, tt * 0.9 + Math.PI * 1.75)
      ctx.stroke()
      ctx.lineWidth = 6
      ctx.strokeStyle = hsla(s + 80, 2, 0.22)
      ctx.beginPath()
      ctx.arc(cx, cy, u * 0.2, -tt * 1.1, -tt * 1.1 + Math.PI * 1.4)
      ctx.stroke()
      break
    }
    case 22: {
      const cols = Math.floor(w / 12)
      for (let c = 0; c < cols; c++) {
        const x = c * 12 + 4
        const h0 = stableRand(s, c, 35) * h * 0.4
        const off = (tt * (60 + (c % 7) * 12) + c * 17) % (h + h0)
        for (let y = 0; y < h0; y += 4) {
          const yy = off - y
          if (yy < 0 || yy > h) continue
          ctx.fillStyle = hsla(s + c * 3, c + y, 0.12 + (1 - y / h0) * 0.25)
          ctx.fillRect(x, yy, 2, 3)
        }
      }
      break
    }
    case 23: {
      for (let i = 0; i < 55; i++) {
        const r = 4 + stableRand(s, i, 36) * u * 0.12
        const x = stableRand(s, i, 37) * w
        const yJitter = stableRand(s, i, 38) * 14
        const rise = (tt * 40 + i * 13) % (h + 30)
        ctx.strokeStyle = hsla(s + 200, i, 0.1)
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(x, h - (rise % h) + yJitter, r, 0, Math.PI * 2)
        ctx.stroke()
      }
      break
    }
    case 24: {
      const branch = function self(x: number, y: number, ang: number, len: number, depth: number): void {
        if (depth > 7 || len < 4) return
        const x2 = x + Math.cos(ang) * len
        const y2 = y + Math.sin(ang) * len
        ctx.strokeStyle = hsla(s + depth * 15, depth, Math.max(0.02, 0.14 - depth * 0.015))
        ctx.lineWidth = Math.max(0.5, 2.2 - depth * 0.25)
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x2, y2)
        ctx.stroke()
        self(x2, y2, ang - 0.45 + Math.sin(tt + depth) * 0.1, len * 0.72, depth + 1)
        self(x2, y2, ang + 0.45 + Math.cos(tt + depth) * 0.1, len * 0.72, depth + 1)
      }
      ctx.lineCap = 'round'
      branch(cx, h * 0.92, -Math.PI / 2, u * 0.18, 0)
      break
    }
    case 25: {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(tt * 0.08)
      for (let i = -20; i < 20; i++) {
        ctx.strokeStyle = hsla(s, i, 0.06 + Math.abs(i % 7) * 0.02)
        ctx.beginPath()
        ctx.moveTo(i * 14, -h)
        ctx.lineTo(i * 14 + 3, h)
        ctx.stroke()
      }
      ctx.restore()
      break
    }
    case 26: {
      const wedges = 6
      for (let wn = 0; wn < wedges; wn++) {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate((wn / wedges) * Math.PI * 2 + tt * 0.12)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(u * 0.5, -u * 0.08)
        ctx.lineTo(u * 0.5, u * 0.08)
        ctx.closePath()
        const gr = ctx.createLinearGradient(0, 0, u * 0.5, 0)
        gr.addColorStop(0, hsla(s, wn, 0.2))
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = gr
        ctx.fill()
        ctx.restore()
      }
      break
    }
    case 27: {
      for (let i = 0; i < 16; i++) {
        const ang = stableRand(s, i, 39) * Math.PI * 2 + tt * 0.6
        const len = u * (0.25 + stableRand(s, i, 40) * 0.25)
        const x0 = cx + Math.cos(ang + Math.PI) * u * 0.05
        const y0 = cy + Math.sin(ang + Math.PI) * u * 0.05
        const x1 = x0 + Math.cos(ang) * len
        const y1 = y0 + Math.sin(ang) * len
        const gr = ctx.createLinearGradient(x0, y0, x1, y1)
        gr.addColorStop(0, hsla(s, i, 0.35))
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.strokeStyle = gr
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.stroke()
      }
      break
    }
    case 28: {
      for (let k = 0; k < 3; k++) {
        const n = 6
        ctx.beginPath()
        for (let i = 0; i <= n; i++) {
          const ang = (i / n) * Math.PI * 2 + tt * (1.2 + k * 0.2)
          const r = u * (0.12 + k * 0.07) + Math.sin(tt * 3 + k) * u * 0.02
          const x = cx + Math.cos(ang) * r
          const y = cy + Math.sin(ang) * r
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.strokeStyle = hsla(s, k * 40, 0.1 + k * 0.05)
        ctx.lineWidth = 2
        ctx.stroke()
      }
      break
    }
    case 29: {
      for (let i = 0; i < 8; i++) {
        const r = u * (0.08 + i * 0.055) + Math.sin(tt * 1.8 + i) * u * 0.025
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        g.addColorStop(0, hsla(s + i * 20, i, 0.08))
        g.addColorStop(0.55, 'rgba(0,0,0,0)')
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    /* ---------- 追加30（0〜29とは別アルゴリズム） ---------- */
    case 30: {
      const sc = u * 0.42
      const step = 4
      for (let px = 0; px < w; px += step) {
        for (let py = 0; py < h; py += step) {
          const zx0 = (px - cx) / sc
          const zy0 = (py - cy) / sc
          let zx = zx0 * 0.55 - 0.2
          let zy = zy0 * 0.55
          let n = 0
          while (n < 14 && zx * zx + zy * zy < 4) {
            const tx = zx * zx - zy * zy + zx0 * 0.32 - 0.48
            zy = 2 * zx * zy + zy0 * 0.32
            zx = tx
            n++
          }
          if (n > 3 && n < 14) {
            ctx.fillStyle = hsla(s + n * 18, px + py, 0.08 + n * 0.018)
            ctx.fillRect(px, py, step, step)
          }
        }
      }
      break
    }
    case 31: {
      ctx.lineWidth = 2.2
      ctx.beginPath()
      for (let i = 0; i <= 720; i++) {
        const ang = (i / 720) * Math.PI * 2 * 5 + tt * 0.4
        const x = cx + Math.sin(ang * 3 + tt * 1.1) * w * 0.4
        const y = cy + Math.sin(ang * 4 + tt * 0.9) * h * 0.42
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = hsla(s, 2, 0.18)
      ctx.stroke()
      break
    }
    case 32: {
      const cell = 18
      for (let gx = 0; gx < w / cell; gx++) {
        for (let gy = 0; gy < h / cell; gy++) {
          const n1 = stableRand(s, gx * 97 + gy, 50)
          const n2 = stableRand(s, gx * 97 + gy + 1, 51)
          const v = (n1 + n2 + Math.sin(tt + gx * 0.3 + gy * 0.2)) / 3
          if (v > 0.52) {
            ctx.fillStyle = hsla(s + gx * 5, gx + gy, 0.05 + (v - 0.52) * 0.55)
            ctx.fillRect(gx * cell, gy * cell, cell - 1, cell - 1)
          }
        }
      }
      break
    }
    case 33: {
      ctx.beginPath()
      const k = 5 + (s % 4)
      for (let i = 0; i <= 360; i++) {
        const th = (i / 360) * Math.PI * 2 + tt * 0.25
        const rr = u * 0.22 * Math.cos(k * th) * 0.5 + u * 0.08
        const x = cx + Math.cos(th) * rr
        const y = cy + Math.sin(th) * rr
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.strokeStyle = hsla(s + 40, 0, 0.16)
      ctx.lineWidth = 1.8
      ctx.stroke()
      break
    }
    case 34: {
      const tri = (x: number, y: number, sz: number, depth: number): void => {
        if (depth > 5 || sz < 4) return
        ctx.strokeStyle = hsla(s, depth * 11, 0.1 - depth * 0.012)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, y - sz)
        ctx.lineTo(x + sz * 0.866, y + sz * 0.5)
        ctx.lineTo(x - sz * 0.866, y + sz * 0.5)
        ctx.closePath()
        ctx.stroke()
        tri(x, y - sz * 0.5, sz * 0.5, depth + 1)
        tri(x + sz * 0.433, y + sz * 0.25, sz * 0.5, depth + 1)
        tri(x - sz * 0.433, y + sz * 0.25, sz * 0.5, depth + 1)
      }
      tri(cx, cy + u * 0.12, u * 0.28, 0)
      break
    }
    case 35: {
      ctx.beginPath()
      for (let i = 0; i <= 200; i++) {
        const ang = (i / 200) * Math.PI * 2
        const hx = 16 * Math.pow(Math.sin(ang), 3)
        const hy = 13 * Math.cos(ang) - 5 * Math.cos(2 * ang) - 2 * Math.cos(3 * ang) - Math.cos(4 * ang)
        const x = cx + hx * (u * 0.018)
        const y = cy - hy * (u * 0.018) - u * 0.05
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = hsla(s + 320, 1, 0.2)
      ctx.lineWidth = 2
      ctx.stroke()
      break
    }
    case 36: {
      const rays = 28
      for (let r = 0; r < rays; r++) {
        const ang = (r / rays) * Math.PI * 2 + tt * 0.45
        const gr = ctx.createLinearGradient(cx, cy, cx + Math.cos(ang) * w, cy + Math.sin(ang) * h)
        gr.addColorStop(0, hsla(s, r, 0.28))
        gr.addColorStop(0.35, hsla(s + 30, r, 0.06))
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = gr
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, u * 0.55, ang - 0.06, ang + 0.06)
        ctx.closePath()
        ctx.fill()
      }
      break
    }
    case 37: {
      const seg = 9
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2 + tt * 0.6
        const a1 = ((i + 1) / seg) * Math.PI * 2 + tt * 0.6
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, u * 0.42, a0, a1)
        ctx.closePath()
        ctx.fillStyle = hsla(s + i * 28, i, 0.06 + (i % 2) * 0.1)
        ctx.fill()
      }
      break
    }
    case 38: {
      for (let k = 0; k < 14; k++) {
        const ox = stableRand(s, k, 52) * w
        const oy = stableRand(s, k, 53) * h
        const rr = u * (0.08 + stableRand(s, k, 54) * 0.15)
        ctx.strokeStyle = hsla(s + k * 15, k, 0.07)
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(ox, oy, rr, tt + k, tt + k + Math.PI * 1.2)
        ctx.stroke()
      }
      break
    }
    case 39: {
      const step = u * 0.09
      for (let gy = 0; gy < h / step + 2; gy++) {
        for (let gx = 0; gx < w / step + 2; gx++) {
          const ox = gx * step + (gy % 2) * step * 0.5
          const oy = gy * step * 0.866
          const pulse = Math.sin(tt * 2.5 + gx * 0.4 + gy * 0.35)
          if (pulse > 0.2) {
            ctx.fillStyle = hsla(s, gx + gy, 0.04 + (pulse - 0.2) * 0.35)
            ctx.beginPath()
            ctx.arc(ox, oy, 2.2, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
      break
    }
    case 40: {
      for (let i = 0; i < 9; i++) {
        const ra = (i / 9) * Math.PI * 2 + tt * (0.35 + i * 0.04)
        const rx = w * (0.22 + stableRand(s, i, 55) * 0.2)
        const ry = h * (0.12 + stableRand(s, i, 56) * 0.15)
        const x = cx + Math.cos(ra) * rx
        const y = cy + Math.sin(ra) * ry * 0.85
        ctx.fillStyle = hsla(s + i * 25, i, 0.2)
        ctx.beginPath()
        ctx.arc(x, y, 4 + (i % 3), 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 41: {
      ctx.lineWidth = 1.6
      for (let strand = 0; strand < 2; strand++) {
        ctx.beginPath()
        for (let i = 0; i <= 200; i++) {
          const z = (i / 200) * h * 0.85
          const ph = tt * 2 + strand * Math.PI
          const x = cx + Math.sin(z * 0.08 + ph) * u * 0.12 + (strand - 0.5) * u * 0.06
          const y = h * 0.08 + z
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = hsla(s + strand * 80, strand, 0.16)
        ctx.stroke()
      }
      break
    }
    case 42: {
      for (let i = 0; i < 22; i++) {
        const ox = stableRand(s, i, 57) * w
        const oy = stableRand(s, i, 58) * h
        const rr = ((tt * 0.35 + stableRand(s, i, 59) * 3) % 1) * u * 0.22
        ctx.strokeStyle = hsla(s + i * 17, i, 0.12 * (1 - rr / (u * 0.22)))
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(ox, oy, rr, 0, Math.PI * 2)
        ctx.stroke()
      }
      break
    }
    case 43: {
      const ang = tt * 0.7
      const gr = ctx.createLinearGradient(
        cx - Math.cos(ang) * w,
        cy - Math.sin(ang) * h,
        cx + Math.cos(ang) * w,
        cy + Math.sin(ang) * h
      )
      gr.addColorStop(0, 'rgba(0,0,0,0)')
      gr.addColorStop(0.48, hsla(s, 0, 0.35))
      gr.addColorStop(0.52, hsla(s + 40, 1, 0.4))
      gr.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gr
      ctx.fillRect(0, 0, w, h)
      break
    }
    case 44: {
      for (let i = 0; i < 5; i++) {
        const r = u * (0.15 + i * 0.07) + Math.sin(tt * 2 + i) * 6
        ctx.strokeStyle = hsla(s + i * 22, i, 0.1)
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(cx * 0.95, cy * 1.05, r, -Math.PI * 0.95, -0.15)
        ctx.stroke()
      }
      break
    }
    case 45: {
      ctx.fillStyle = hsla(s, 0, 0.12)
      ctx.beginPath()
      ctx.arc(cx, cy - u * 0.08, u * 0.22, Math.PI, 0)
      ctx.fill()
      ctx.fillStyle = hsla(s + 20, 1, 0.15)
      ctx.fillRect(cx - u * 0.04, cy - u * 0.08, u * 0.08, u * 0.28)
      break
    }
    case 46: {
      const seg = 24
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2 + tt * 1.5
        const a1 = ((i + 1) / seg) * Math.PI * 2 + tt * 1.5
        const gr = ctx.createRadialGradient(cx, cy, u * 0.18, cx, cy, u * 0.42)
        gr.addColorStop(0, 'rgba(0,0,0,0)')
        gr.addColorStop(0.5, hsla(s + i * 8, i, 0.08))
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = gr
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, u * 0.42, a0, a1)
        ctx.closePath()
        ctx.fill()
      }
      break
    }
    case 47: {
      const bars = 32
      for (let i = 0; i < bars; i++) {
        const bw = w / bars
        const x = i * bw
        const bh = h * (0.15 + stableRand(s, i, 60) * 0.45 + Math.sin(tt * 2 + i * 0.3) * 0.08)
        ctx.fillStyle = hsla(s + i * 7, i, 0.14)
        ctx.fillRect(x, h - bh, bw - 1, bh)
      }
      break
    }
    case 48: {
      ctx.strokeStyle = hsla(s, 0, 0.18)
      ctx.lineWidth = 1.5
      ctx.beginPath()
      let y = cy
      for (let x = 0; x < w; x += 8) {
        y = cy + Math.sin(x * 0.15 + tt * 3) * 10 + (stableRand(s, x, 61) - 0.5) * 14
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      break
    }
    case 49: {
      ctx.strokeStyle = hsla(s + 120, 0, 0.12)
      ctx.lineWidth = 1.4
      for (let i = 0; i < 55; i++) {
        const x = stableRand(s, i, 62) * w * 0.9 + w * 0.05
        const y = stableRand(s, i, 63) * h * 0.9 + h * 0.05
        const horiz = stableRand(s, i, 64) > 0.5
        const len = 12 + stableRand(s, i, 65) * 40
        ctx.beginPath()
        if (horiz) {
          ctx.moveTo(x, y)
          ctx.lineTo(x + len, y)
          ctx.moveTo(x, y)
          ctx.lineTo(x, y + len * 0.35)
        } else {
          ctx.moveTo(x, y)
          ctx.lineTo(x, y + len)
          ctx.moveTo(x, y)
          ctx.lineTo(x + len * 0.35, y)
        }
        ctx.stroke()
      }
      break
    }
    case 50: {
      for (let i = 0; i < 16; i++) {
        const a0 = (i / 16) * Math.PI + tt * 0.4
        const a1 = ((i + 1) / 16) * Math.PI + tt * 0.4
        ctx.beginPath()
        ctx.arc(cx, cy * 1.1, u * 0.45, a0, a1)
        ctx.strokeStyle = hsla(s + i * 20, i, 0.09)
        ctx.lineWidth = 6
        ctx.stroke()
      }
      break
    }
    case 51: {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(tt * 0.35)
      for (let i = -14; i < 14; i++) {
        ctx.fillStyle = hsla(s, i, 0.05 + Math.abs(i % 5) * 0.03)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(Math.cos((i / 14) * Math.PI * 0.5) * u * 0.55, Math.sin((i / 14) * Math.PI * 0.5) * u * 0.55)
        ctx.lineTo(Math.cos(((i + 1) / 14) * Math.PI * 0.5) * u * 0.55, Math.sin(((i + 1) / 14) * Math.PI * 0.5) * u * 0.55)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
      break
    }
    case 52: {
      for (let i = 0; i < 10; i++) {
        const bx = stableRand(s, i, 66) * w * 0.8 + w * 0.1
        const by = stableRand(s, i, 67) * h * 0.5 + h * 0.35
        const r = 10 + stableRand(s, i, 68) * 18
        ctx.strokeStyle = hsla(s + i * 30, i, 0.1)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(bx, by, r, 0, Math.PI * 2)
        ctx.moveTo(bx, by + r)
        ctx.quadraticCurveTo(bx + (stableRand(s, i, 69) - 0.5) * 20, by + r + u * 0.12, cx, h * 0.92)
        ctx.stroke()
      }
      break
    }
    case 53: {
      ctx.strokeStyle = hsla(s, 0, 0.2)
      ctx.lineWidth = 2
      for (let k = 0; k < 18; k++) {
        const fade = 1 - k / 18
        ctx.globalAlpha = fade * 0.45
        const ang = Math.sin(tt + k * 0.2) * 0.35
        const px = cx + Math.sin(ang) * u * 0.25
        const py = h * 0.12 + k * (h * 0.04)
        ctx.beginPath()
        ctx.arc(px, py, 5 + k * 0.4, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      break
    }
    case 54: {
      const n = 48
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + tt * 0.1
        const len = u * (0.25 + Math.sin(tt * 6 + i) * 0.08)
        ctx.strokeStyle = hsla(s + i * 5, i, 0.15)
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len)
        ctx.stroke()
      }
      break
    }
    case 55: {
      for (let k = 0; k < 8; k++) {
        const x1 = stableRand(s, k, 70) * w
        const y1 = stableRand(s, k, 71) * h
        const x2 = stableRand(s, k, 72) * w
        const y2 = stableRand(s, k, 73) * h
        const r = u * (0.1 + stableRand(s, k, 74) * 0.12) + Math.sin(tt * 2 + k) * 5
        const g = ctx.createRadialGradient(x1, y1, 0, x1, y1, r)
        g.addColorStop(0, hsla(s, k, 0.22))
        g.addColorStop(0.45, hsla(s + 40, k, 0.06))
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x1, y1, r, 0, Math.PI * 2)
        ctx.fill()
        const g2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, r * 0.9)
        g2.addColorStop(0, hsla(s + 80, k, 0.18))
        g2.addColorStop(0.5, 'rgba(0,0,0,0)')
        ctx.fillStyle = g2
        ctx.beginPath()
        ctx.arc(x2, y2, r * 0.9, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 56: {
      for (let i = 0; i < 45; i++) {
        ctx.save()
        const px = stableRand(s, i, 75) * w
        const py = stableRand(s, i, 76) * h
        ctx.translate(px, py)
        ctx.rotate(stableRand(s, i, 77) * Math.PI * 2 + tt * 0.3)
        ctx.fillStyle = hsla(s, i, 0.06)
        ctx.beginPath()
        ctx.moveTo(0, -8)
        ctx.lineTo(10, 12)
        ctx.lineTo(-9, 12)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }
      break
    }
    case 57: {
      const bands = 18
      for (let i = 0; i < bands; i++) {
        const x = (i / bands) * w + Math.sin(tt * 2 + i) * 6
        const gr = ctx.createLinearGradient(x, 0, x + 4, h)
        gr.addColorStop(0, `hsla(${(s + i * 18) % 360},85%,55%,0.15)`)
        gr.addColorStop(0.5, `hsla(${(s + i * 18 + 40) % 360},70%,60%,0.22)`)
        gr.addColorStop(1, `hsla(${(s + i * 18 + 80) % 360},75%,50%,0.12)`)
        ctx.fillStyle = gr
        ctx.fillRect(x, 0, 5, h)
      }
      break
    }
    case 58: {
      for (let i = 0; i < 80; i++) {
        const y = stableRand(s, i, 78) * h
        const x = ((tt * (180 + i * 5) + stableRand(s, i, 79) * w) % (w + 80)) - 40
        const ww = 20 + stableRand(s, i, 80) * 60
        ctx.fillStyle = hsla(s, i, 0.06 + stableRand(s, i, 81) * 0.1)
        ctx.fillRect(x, y, ww, 3)
      }
      break
    }
    case 59: {
      const stars = 28
      const xs: number[] = []
      const ys: number[] = []
      for (let i = 0; i < stars; i++) {
        xs.push(stableRand(s, i, 82) * w * 0.85 + w * 0.075)
        ys.push(stableRand(s, i, 83) * h * 0.85 + h * 0.075)
        ctx.fillStyle = hsla(s, i, 0.35)
        ctx.fillRect(xs[i]!, ys[i]!, 2, 2)
      }
      ctx.strokeStyle = hsla(s + 50, 0, 0.08)
      ctx.lineWidth = 0.8
      for (let i = 0; i < stars; i++) {
        let best = -1
        let bestD = 1e9
        for (let j = 0; j < stars; j++) {
          if (i === j) continue
          const d = (xs[i]! - xs[j]!) ** 2 + (ys[i]! - ys[j]!) ** 2
          if (d < bestD && d < (u * 0.22) ** 2) {
            bestD = d
            best = j
          }
        }
        if (best >= 0) {
          ctx.beginPath()
          ctx.moveTo(xs[i]!, ys[i]!)
          ctx.lineTo(xs[best]!, ys[best]!)
          ctx.stroke()
        }
      }
      break
    }
      default:
        break
    }
  } else {
    // 斬撃は DOM の tefx-slash-cut で見せたいので、キャンバス側の指紋ノイズを抑制して邪魔しない
    // （雷鳴撃もスラッシュ強制なので、同様に指紋ノイズを抑制）
    if (motif === 'slash') {
      // 空のまま（kind 側の効果は下の effectKind 分岐で描画される）
    } else {
      drawTechniqueNameFingerprintOverlay(ctx, w, h, tt, name, reducedMotion)
    }
  }

  if (effectKind != null) {
    switch (effectKind) {
      case 'meteor':
        drawMeteorTrailOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'void':
        drawVoidVeinOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'glacier':
        drawGlacierFrostOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'radiance':
        drawRadianceRayOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'nova':
        drawNovaBurstOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'phantom':
        drawPhantomMistOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'tremor':
        drawTremorDustOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'plasma':
        drawPlasmaFilamentOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'tempest':
        drawTempestLightningOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'inferno':
        drawInfernoFireOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'aurora':
        drawAuroraRibbonOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'blossom':
        drawBlossomSparkOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'circuit':
        drawCircuitSweepOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'mire':
        drawMireBlobOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'bloodtide':
        drawBloodtideRippleOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'dune':
        drawDuneSandOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'sanctum':
        drawSanctumShrineOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'canopy':
        drawCanopyVineOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'abyssal':
        drawAbyssalDepthOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'cogwork':
        drawCogworkGearOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'constellation':
        drawConstellationOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      case 'rustbound':
        drawRustFlakeOverlay(ctx, w, h, tt, s, reducedMotion)
        break
      default: {
        const _exhaustive: never = effectKind
        void _exhaustive
      }
    }
  }

  if (name.includes('桜')) {
    drawSakuraOverlay(ctx, w, h, tt, s, reducedMotion)
  }
  if (name.includes('星')) {
    drawStarTwinkleOverlay(ctx, w, h, tt, s, reducedMotion)
  }
  if (name.includes('月')) {
    drawMoonGlowOverlay(ctx, w, h, tt, s, reducedMotion)
  }
  if (motif === 'shooting') {
    drawNameShootingOverlay(ctx, w, h, tt, s, reducedMotion)
  }
  if (motif === 'magic') {
    drawNameMagicOverlay(ctx, w, h, tt, s, reducedMotion)
  }
  if (motif === 'slash') {
    drawNameSlashOverlay(ctx, w, h, s, reducedMotion, name)
  }

  // 斬撃モチーフは「刃線が主役」。語彙アクセント（放射線/稲妻/地割れ等）が混ざると
  // 放射状の筋が“静止して見える”ことがあるため、追加アクセントは出さない。
  if (motif !== 'slash') {
    const disaster = detectNaturalDisasterKind(name)
    if (disaster === 'meteor') {
      drawMeteorTrailOverlay(ctx, w, h, tt, s ^ 0x31a5, reducedMotion)
    }
    if (disaster === 'storm') {
      drawTempestLightningOverlay(ctx, w, h, tt, s ^ 0x52c7, reducedMotion)
    }
    if (disaster === 'fire') {
      drawInfernoFireOverlay(ctx, w, h, tt, s ^ 0x91f3, reducedMotion)
    }
    if (disaster === 'frost') {
      drawGlacierFrostOverlay(ctx, w, h, tt, s ^ 0x4be1, reducedMotion)
    }
    if (disaster === 'quake') {
      drawTremorDustOverlay(ctx, w, h, tt, s ^ 0x7d2b, reducedMotion)
    }

    const accentKinds = detectNameAccentKinds(name)
    for (let i = 0; i < accentKinds.length; i++) {
      const accentSeed = s ^ (0x9e37 + i * 0x51c3)
      const accentKind = accentKinds[i]!
      switch (accentKind) {
        case 'meteor':
          drawMeteorTrailOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'void':
          drawVoidVeinOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'glacier':
          drawGlacierFrostOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'radiance':
          drawRadianceRayOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'nova':
          drawNovaBurstOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'phantom':
          drawPhantomMistOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'tremor':
          drawTremorDustOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'plasma':
          drawPlasmaFilamentOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'tempest':
          drawTempestLightningOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'inferno':
          drawInfernoFireOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'aurora':
          drawAuroraRibbonOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'blossom':
          drawBlossomSparkOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'circuit':
          drawCircuitSweepOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'mire':
          drawMireBlobOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'bloodtide':
          drawBloodtideRippleOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'dune':
          drawDuneSandOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'sanctum':
          drawSanctumShrineOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'canopy':
          drawCanopyVineOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'abyssal':
          drawAbyssalDepthOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'cogwork':
          drawCogworkGearOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'constellation':
          drawConstellationOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        case 'rustbound':
          drawRustFlakeOverlay(ctx, w, h, tt, accentSeed, reducedMotion)
          break
        default: {
          const _exhaustive: never = accentKind
          void _exhaustive
        }
      }
    }
  }

  ctx.restore()
}

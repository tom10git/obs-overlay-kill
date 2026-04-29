/**
 * ガラス着弾: 清潔なガラス → 予兆 → 銃弾5連射 → 最終弾で放射状に割れ大きな破片が順に落ちる → 余韻 → フェードアウト
 * タイムライン 210f @ 60fps（約3.5s）に合わせた Canvas。
 */

import { useEffect, useRef, type CSSProperties } from 'react'
import { cappedCanvasBitmapSize } from '../../utils/canvasInternalSize'
import './NormalAttackGlassCanvas.css'

const FPS = 60
const TOTAL_FRAMES = 210
const FRAME_MS = 1000 / FPS

const F_STATIC_END = 24
const F_ANTICIPATION_END = 36
/** 1〜5発目の着弾フレーム（60fps・約0.2秒間隔の連射） */
const HIT_FRAMES = [38, 50, 62, 74, 86] as const
const F_LAST_HIT = HIT_FRAMES[HIT_FRAMES.length - 1]
/** 着弾を散らす円盤の半径（ガラス短辺に対する比・中央付近に綺麗に分布） */
const BURST_SCATTER_R = 0.145
/** 着弾群の中心を画面中心からずらす幅（ガラス面に対する比） */
const BURST_CENTER_JX = 0.065
const BURST_CENTER_JY = 0.055
/** 各着弾座標の微ジッター（px） */
const BURST_POS_JITTER_PX = 3.5

/** 着弾フレームからこの間は弾痕をはっきり表示 */
const HOLE_MARK_STRONG_FRAMES = 14
/** その後このフレーム数で弾痕アルファを 1→0（余韻では弾痕を残さない） */
const HOLE_MARK_FADE_FRAMES = 16
/** 各着弾の破片量（連発で重くなりすぎないよう段階的に減らす） */
const HIT_SPAWN_INTENSITY: readonly number[] = [1, 0.84, 0.7, 0.58, 0.48]
/** 密集破片の強い重力区間の終わり（最終着弾後の全面砕け・大破片落下も含む） */
const F_BURST_END = F_LAST_HIT + 72
/** 最終着弾後、ガラス板が消えていくフレーム数（楔形破片が順に落ち終わるまで） */
const F_SHATTER_PANEL_FADE_FR = 94
/** 全面砕けの放射亀裂の本数 */
const F_SHATTER_CRACK_RAYS = 11
/** 亀裂が外周まで伸び切るまでのフレーム数 */
const F_CRACK_GROW_FR = 24
/** 一枚の板から「放射状に割れた大きな破片」へ見える切替（最終着弾からの相対フレーム） */
const F_PANE_PARTITION_REL = 10
const F_PANE_PARTITION = F_LAST_HIT + F_PANE_PARTITION_REL
/** 最終着弾点を頂点とする楔形の枚数（不規則な角度で割り、時間差で落とす） */
const GLASS_WEDGE_COUNT = 7
/** 分割後、最初の破片が落ち始めるまでの待ち */
const F_PANE_FIRST_DROP_GAP = 5
/** 隣の破片が落ち始めるまでの間隔 */
const F_PANE_DROP_STAGGER = 6
/** 崩落第2波（分割直後・下側から） */
const F_SHATTER_WAVE2 = F_PANE_PARTITION + 3
/** 崩落第3波（下端の塊） */
const F_SHATTER_WAVE3 = F_PANE_PARTITION + 13
const F_LINGER_END = 172
const F_CLIP_END = TOTAL_FRAMES

/** 円盤内に均等に近い配置（黄金角）— 中心付近から外側へなだらかに散る */
function phyllotaxisDiskOffset(
  i: number,
  n: number,
  maxR: number,
  baseAngle: number
): { ox: number; oy: number } {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  const r = maxR * Math.sqrt((i + 0.5) / n)
  const theta = baseAngle + i * goldenAngle
  return { ox: r * Math.cos(theta), oy: r * Math.sin(theta) }
}

/** 新しい銃弾の弾痕のみ。着弾〜連射の短い区間で見え、すぐフェード */
function alphaForNewBulletHole(f: number, hitFrame: number): number {
  if (f < hitFrame) return 0
  const age = f - hitFrame
  if (age <= HOLE_MARK_STRONG_FRAMES) return 1
  const t = age - HOLE_MARK_STRONG_FRAMES
  if (t >= HOLE_MARK_FADE_FRAMES) return 0
  return 1 - t / HOLE_MARK_FADE_FRAMES
}

/** 最終着弾後のガラス板アルファ（1→0） */
function panelAlphaAfterLastHit(f: number): number {
  if (f < F_LAST_HIT) return 1
  const t = f - F_LAST_HIT
  if (t >= F_SHATTER_PANEL_FADE_FR) return 0
  const u = t / F_SHATTER_PANEL_FADE_FR
  return 1 - u * u
}

/** 亀裂の伸び（0→1、ease-out） */
function crackGrowthT(age: number): number {
  if (age <= 0) return 0
  const u = Math.min(1, age / F_CRACK_GROW_FR)
  return 1 - (1 - u) * (1 - u)
}

type ShatterRay = { x0: number; y0: number; x1: number; y1: number; lw: number }

function randomPointOnRectPerimeter(
  rng: () => number,
  rx0: number,
  ry0: number,
  rw: number,
  rh: number
): { x: number; y: number } {
  const p = 2 * (rw + rh)
  let t = rng() * p
  if (t < rw) return { x: rx0 + t, y: ry0 + rh }
  t -= rw
  if (t < rh) return { x: rx0 + rw, y: ry0 + rh - t }
  t -= rh
  if (t < rw) return { x: rx0 + rw - t, y: ry0 }
  t -= rw
  return { x: rx0, y: ry0 + t }
}

function buildShatterRays(
  rng: () => number,
  rx0: number,
  ry0: number,
  rw: number,
  rh: number,
  ox: number,
  oy: number,
  nRays: number
): ShatterRay[] {
  const rays: ShatterRay[] = []
  for (let i = 0; i < nRays; i++) {
    const e = randomPointOnRectPerimeter(rng, rx0, ry0, rw, rh)
    rays.push({
      x0: ox + (rng() - 0.5) * 10,
      y0: oy + (rng() - 0.5) * 10,
      x1: e.x + (rng() - 0.5) * 14,
      y1: e.y + (rng() - 0.5) * 14,
      lw: 0.85 + rng() * 2.1,
    })
  }
  return rays
}

function drawShatterRays(
  ctx: CanvasRenderingContext2D,
  rays: ShatterRay[],
  f: number,
  panelA: number
): void {
  if (f < F_LAST_HIT || panelA < 0.02) return
  const age = f - F_LAST_HIT
  const grow = crackGrowthT(age - 1)
  const partBlend = f < F_PANE_PARTITION ? 1 : 0.44
  const crackA = 0.34 * panelA * partBlend * (1 - Math.min(1, age / 30) * 0.82)
  if (crackA < 0.02 || grow < 0.02) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const r of rays) {
    const xe = r.x0 + (r.x1 - r.x0) * grow
    const ye = r.y0 + (r.y1 - r.y0) * grow
    ctx.beginPath()
    ctx.moveTo(r.x0, r.y0)
    ctx.lineTo(xe, ye)
    ctx.strokeStyle = `rgba(180, 205, 228, ${crackA * 0.52})`
    ctx.lineWidth = r.lw + 2.4
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(r.x0, r.y0)
    ctx.lineTo(xe, ye)
    ctx.strokeStyle = `rgba(235, 248, 255, ${crackA})`
    ctx.lineWidth = r.lw
    ctx.stroke()
  }
  ctx.restore()
}

/** 最終弾着弾フレーム用：パネル全体を粗く吹き飛ばす破片＋粉 */
function spawnWholePanelShatter(
  rng: () => number,
  rx0: number,
  ry0: number,
  rw: number,
  rh: number,
  frame: number,
  originX: number,
  originY: number
): { shards: Shard[]; burstDust: DustMote[] } {
  const shards: Shard[] = []
  const burstDust: DustMote[] = []
  const margin = 16
  const innerW = rw - margin * 2
  const innerH = rh - margin * 2
  const nSites = 15 + Math.floor(rng() * 6)

  for (let i = 0; i < nSites; i++) {
    const px = rx0 + margin + rng() * innerW
    const py = ry0 + margin + rng() * innerH
    let bx = px - originX
    let by = py - originY
    const bl = Math.hypot(bx, by)
    if (bl < 6) {
      const ang = rng() * Math.PI * 2
      bx = Math.cos(ang)
      by = Math.sin(ang)
    } else {
      bx /= bl
      by /= bl
    }

    const nMed = 2 + Math.floor(rng() * 2)
    for (let j = 0; j < nMed; j++) {
      const tang = (rng() - 0.5) * 7
      const perpX = -by
      const perpY = bx
      const spd = 11 + rng() * 26
      shards.push({
        x: px + (rng() - 0.5) * 10,
        y: py + (rng() - 0.5) * 10,
        vx: bx * spd * (0.45 + rng() * 0.55) + perpX * tang + (rng() - 0.5) * 5,
        vy: by * spd * (0.45 + rng() * 0.55) + perpY * tang + (rng() - 0.5) * 5 - rng() * 14,
        angle: rng() * Math.PI * 2,
        va: (rng() - 0.5) * 0.75,
        halfW: 4 + rng() * 12,
        halfH: 2.5 + rng() * 8,
        bornFrame: frame,
        lifeFrames: 72 + Math.floor(rng() * 58),
        kind: 'medium',
      })
    }

    const nFine = 4 + Math.floor(rng() * 7)
    for (let j = 0; j < nFine; j++) {
      const ang = rng() * Math.PI * 2
      const spd = 4 + rng() * 18
      shards.push({
        x: px + (rng() - 0.5) * 4,
        y: py + (rng() - 0.5) * 4,
        vx: bx * spd * 0.55 + Math.cos(ang) * spd * 0.9,
        vy: by * spd * 0.55 + Math.sin(ang) * spd * 0.9 - rng() * 10,
        angle: rng() * Math.PI * 2,
        va: (rng() - 0.5) * 0.85,
        halfW: 0.55 + rng() * 2.2,
        halfH: 0.35 + rng() * 1.4,
        bornFrame: frame,
        lifeFrames: 75 + Math.floor(rng() * 70),
        kind: 'fine',
      })
    }

    if (rng() < 0.65) {
      const nd = 3 + Math.floor(rng() * 5)
      for (let k = 0; k < nd; k++) {
        const a = rng() * Math.PI * 2
        const s = 1.2 + rng() * 9
        burstDust.push({
          x: px + (rng() - 0.5) * 12,
          y: py + (rng() - 0.5) * 12,
          vx: Math.cos(a) * s + bx * (2 + rng() * 6),
          vy: Math.sin(a) * s + by * (2 + rng() * 6) - rng() * 5,
          r: 0.4 + rng() * 1.8,
          phase: rng() * Math.PI * 2,
          layer: 'burst',
          bornFrame: frame,
          lifeFrames: 85 + Math.floor(rng() * 60),
        })
      }
    }
  }

  return { shards, burstDust }
}

/** 下側から剥がれ落ちる中〜大破片（第2波） */
function spawnShatterCrumbleFall(
  rng: () => number,
  rx0: number,
  ry0: number,
  rw: number,
  rh: number,
  frame: number,
  originX: number,
  originY: number
): { shards: Shard[]; burstDust: DustMote[] } {
  const shards: Shard[] = []
  const burstDust: DustMote[] = []
  const margin = 16
  const innerW = rw - margin * 2
  const innerH = rh - margin * 2
  const nSites = 10 + Math.floor(rng() * 5)

  for (let i = 0; i < nSites; i++) {
    const px = rx0 + margin + rng() * innerW
    const py = ry0 + margin + innerH * (0.18 + Math.pow(rng(), 0.52) * 0.82)
    let bx = px - originX
    let by = py - originY
    const bl = Math.hypot(bx, by)
    if (bl < 8) {
      const ang = rng() * Math.PI * 2
      bx = Math.cos(ang) * 0.35
      by = Math.sin(ang) * 0.35 + 0.65
    } else {
      bx /= bl
      by = by / bl + 0.45
      const nn = Math.hypot(bx, by)
      bx /= nn
      by /= nn
    }

    const nMed = 2 + Math.floor(rng() * 2)
    for (let j = 0; j < nMed; j++) {
      const spd = 8 + rng() * 20
      const down = 4 + rng() * 10
      shards.push({
        x: px + (rng() - 0.5) * 12,
        y: py + (rng() - 0.5) * 12,
        vx: bx * spd + (rng() - 0.5) * 6,
        vy: by * spd + down,
        angle: rng() * Math.PI * 2,
        va: (rng() - 0.5) * 0.85,
        halfW: 5 + rng() * 14,
        halfH: 3 + rng() * 9,
        bornFrame: frame,
        lifeFrames: 78 + Math.floor(rng() * 55),
        kind: 'medium',
      })
    }
    const nFine = 3 + Math.floor(rng() * 6)
    for (let j = 0; j < nFine; j++) {
      const ang = rng() * Math.PI * 2
      const spd = 3 + rng() * 14
      shards.push({
        x: px + (rng() - 0.5) * 5,
        y: py + (rng() - 0.5) * 5,
        vx: Math.cos(ang) * spd + bx * 3,
        vy: Math.sin(ang) * spd + by * 3 + 2 + rng() * 8,
        angle: rng() * Math.PI * 2,
        va: (rng() - 0.5) * 0.9,
        halfW: 0.5 + rng() * 2,
        halfH: 0.3 + rng() * 1.3,
        bornFrame: frame,
        lifeFrames: 80 + Math.floor(rng() * 65),
        kind: 'fine',
      })
    }
    if (rng() < 0.5) {
      for (let k = 0; k < 2 + Math.floor(rng() * 4); k++) {
        const a = rng() * Math.PI * 2
        const s = 1 + rng() * 7
        burstDust.push({
          x: px + (rng() - 0.5) * 14,
          y: py + (rng() - 0.5) * 14,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s + 3 + rng() * 6,
          r: 0.35 + rng() * 1.5,
          phase: rng() * Math.PI * 2,
          layer: 'burst',
          bornFrame: frame,
          lifeFrames: 80 + Math.floor(rng() * 55),
        })
      }
    }
  }
  return { shards, burstDust }
}

/** 下端からドサッと落ちる塊（第3波） */
function spawnShatterEdgeSlough(
  rng: () => number,
  rx0: number,
  ry0: number,
  rw: number,
  rh: number,
  frame: number,
  originX: number,
  originY: number
): { shards: Shard[]; burstDust: DustMote[] } {
  const shards: Shard[] = []
  const burstDust: DustMote[] = []
  const margin = 14
  const stripH = Math.min(rh * 0.2, 140)
  const nSites = 9 + Math.floor(rng() * 4)

  for (let i = 0; i < nSites; i++) {
    const px = rx0 + margin + rng() * (rw - margin * 2)
    const py = ry0 + rh - margin - rng() * stripH
    let bx = px - originX
    let by = py - originY
    const bl = Math.hypot(bx, by)
    if (bl < 1e-3) {
      bx = 0
      by = 1
    } else {
      bx /= bl
      by = by / bl + 0.85
      const nn = Math.hypot(bx, by)
      bx /= nn
      by /= nn
    }

    for (let j = 0; j < 2 + Math.floor(rng() * 2); j++) {
      shards.push({
        x: px + (rng() - 0.5) * 16,
        y: py + (rng() - 0.5) * 10,
        vx: (rng() - 0.5) * 8 + bx * (6 + rng() * 14),
        vy: 6 + rng() * 18 + by * (8 + rng() * 16),
        angle: rng() * Math.PI * 2,
        va: (rng() - 0.5) * 1.1,
        halfW: 6 + rng() * 16,
        halfH: 3.5 + rng() * 10,
        bornFrame: frame,
        lifeFrames: 85 + Math.floor(rng() * 50),
        kind: 'medium',
      })
    }
    for (let j = 0; j < 3 + Math.floor(rng() * 5); j++) {
      shards.push({
        x: px + (rng() - 0.5) * 8,
        y: py + (rng() - 0.5) * 6,
        vx: (rng() - 0.5) * 10 + bx * 4,
        vy: 4 + rng() * 14,
        angle: rng() * Math.PI * 2,
        va: (rng() - 0.5) * 0.95,
        halfW: 0.45 + rng() * 1.8,
        halfH: 0.28 + rng() * 1.1,
        bornFrame: frame,
        lifeFrames: 85 + Math.floor(rng() * 70),
        kind: 'fine',
      })
    }
    if (rng() < 0.55) {
      burstDust.push({
        x: px,
        y: py,
        vx: (rng() - 0.5) * 4,
        vy: 2 + rng() * 9,
        r: 0.5 + rng() * 2,
        phase: rng() * Math.PI * 2,
        layer: 'burst',
        bornFrame: frame,
        lifeFrames: 90 + Math.floor(rng() * 50),
      })
    }
  }
  return { shards, burstDust }
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

type Hole = { x: number; y: number; r: number; crackN: number; rot: number }

type Shard = {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  va: number
  halfW: number
  halfH: number
  bornFrame: number
  lifeFrames: number
  kind: 'medium' | 'fine'
}

type DustMote = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  phase: number
  /** ambient (0–24) or burst */
  layer: 'ambient' | 'burst'
  bornFrame: number
  lifeFrames: number
}

export type NormalAttackGlassCanvasProps = {
  canvasWidthPx: number
  canvasHeightPx: number
  /**
   * 値が変わるたびにクリップ（約3.5秒）を先頭から再生。
   * 省略時はマウント時に 1 回だけ再生（プレビュー用）。
   */
  playbackKey?: number | string
  onClipEnd?: () => void
}

function spawnShardsAndBurstDust(
  rng: () => number,
  hx: number,
  hy: number,
  frame: number,
  intensity = 1
): { shards: Shard[]; burstDust: DustMote[] } {
  const shards: Shard[] = []
  const burstDust: DustMote[] = []
  const m = Math.max(0.35, Math.min(1.2, intensity))

  const nMedium = Math.max(14, Math.floor((42 + Math.floor(rng() * 18)) * m))
  for (let i = 0; i < nMedium; i++) {
    const ang = rng() * Math.PI * 2
    const spd = 6 + rng() * 22
    const vzBias = rng() * 14
    shards.push({
      x: hx,
      y: hy,
      vx: Math.cos(ang) * spd + (rng() - 0.5) * 3,
      vy: Math.sin(ang) * spd - vzBias,
      angle: rng() * Math.PI * 2,
      va: (rng() - 0.5) * 0.45,
      halfW: 2 + rng() * 5,
      halfH: 1 + rng() * 3.5,
      bornFrame: frame,
      lifeFrames: 55 + Math.floor(rng() * 55),
      kind: 'medium',
    })
  }

  const nFine = Math.max(28, Math.floor((95 + Math.floor(rng() * 45)) * m))
  for (let i = 0; i < nFine; i++) {
    const ang = rng() * Math.PI * 2
    const spd = 2 + rng() * 12
    shards.push({
      x: hx,
      y: hy,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - rng() * 6,
      angle: rng() * Math.PI * 2,
      va: (rng() - 0.5) * 0.65,
      halfW: 0.6 + rng() * 1.8,
      halfH: 0.35 + rng() * 1.1,
      bornFrame: frame,
      lifeFrames: 70 + Math.floor(rng() * 80),
      kind: 'fine',
    })
  }

  const nDust = Math.max(20, Math.floor((55 + Math.floor(rng() * 35)) * m))
  for (let i = 0; i < nDust; i++) {
    const ang = rng() * Math.PI * 2
    const spd = 0.8 + rng() * 7
    burstDust.push({
      x: hx + (rng() - 0.5) * 8,
      y: hy + (rng() - 0.5) * 8,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - rng() * 4,
      r: 0.35 + rng() * 1.6,
      phase: rng() * Math.PI * 2,
      layer: 'burst',
      bornFrame: frame,
      lifeFrames: 95 + Math.floor(rng() * 70),
    })
  }

  return { shards, burstDust }
}

function pathRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rw: number,
  rh: number,
  r: number
): void {
  const rr = Math.min(r, rw / 2, rh / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + rw - rr, y)
  ctx.quadraticCurveTo(x + rw, y, x + rw, y + rr)
  ctx.lineTo(x + rw, y + rh - rr)
  ctx.quadraticCurveTo(x + rw, y + rh, x + rw - rr, y + rh)
  ctx.lineTo(x + rr, y + rh)
  ctx.quadraticCurveTo(x, y + rh, x, y + rh - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

/** 最終着弾点からの半直線がガラス矩形の辺へ出るまで（AABB 近似） */
function rayExitAabb(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  xMin: number,
  yMin: number,
  xMax: number,
  yMax: number
): { x: number; y: number } {
  let tMin = Number.POSITIVE_INFINITY
  const eps = 1e-8
  const consider = (t: number) => {
    if (t <= eps) return
    const px = ox + t * dx
    const py = oy + t * dy
    if (px >= xMin - 0.5 && px <= xMax + 0.5 && py >= yMin - 0.5 && py <= yMax + 0.5) {
      tMin = Math.min(tMin, t)
    }
  }
  if (Math.abs(dx) > eps) {
    consider((xMin - ox) / dx)
    consider((xMax - ox) / dx)
  }
  if (Math.abs(dy) > eps) {
    consider((yMin - oy) / dy)
    consider((yMax - oy) / dy)
  }
  const t = Number.isFinite(tMin) && tMin < 1e11 ? tMin : Math.max(xMax - xMin, yMax - yMin) * 2
  return { x: ox + t * dx, y: oy + t * dy }
}

type GlassWedgePane = {
  p1x: number
  p1y: number
  p2x: number
  p2y: number
  px: number
  py: number
  releaseFrame: number
  rotSign: number
}

function buildGlassWedgePanes(
  rng: () => number,
  x0: number,
  y0: number,
  gw: number,
  gh: number,
  ox: number,
  oy: number,
  n: number
): { panes: GlassWedgePane[]; splitAngles: number[] } {
  const xMin = x0
  const yMin = y0
  const xMax = x0 + gw
  const yMax = y0 + gh
  const angles: number[] = []
  for (let i = 0; i < n; i++) {
    angles.push(rng() * Math.PI * 2)
  }
  angles.sort((a, b) => a - b)

  const panes: GlassWedgePane[] = []
  for (let i = 0; i < n; i++) {
    const th0 = angles[i]!
    const th1 = i + 1 < n ? angles[i + 1]! : angles[0]! + Math.PI * 2
    const dx0 = Math.cos(th0)
    const dy0 = Math.sin(th0)
    const dx1 = Math.cos(th1)
    const dy1 = Math.sin(th1)
    const p1 = rayExitAabb(ox, oy, dx0, dy0, xMin, yMin, xMax, yMax)
    const p2 = rayExitAabb(ox, oy, dx1, dy1, xMin, yMin, xMax, yMax)
    const px = (ox + p1.x + p2.x) / 3
    const py = (oy + p1.y + p2.y) / 3
    panes.push({
      p1x: p1.x,
      p1y: p1.y,
      p2x: p2.x,
      p2y: p2.y,
      px,
      py,
      releaseFrame: 0,
      rotSign: i % 2 === 0 ? 1 : -1,
    })
  }

  panes.sort(
    (a, b) => Math.atan2(a.py - oy, a.px - ox) - Math.atan2(b.py - oy, b.px - ox)
  )
  for (let i = 0; i < panes.length; i++) {
    const p = panes[i]
    if (p) {
      p.releaseFrame = F_PANE_PARTITION + F_PANE_FIRST_DROP_GAP + i * F_PANE_DROP_STAGGER
    }
  }

  return { panes, splitAngles: angles.slice() }
}

function drawGlassWedgePane(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  x0: number,
  y0: number,
  gw: number,
  gh: number,
  cornerR: number,
  pane: GlassWedgePane,
  f: number,
  distort: number,
  baseAlpha: number,
  cx: number,
  cy: number
): void {
  if (baseAlpha < 0.008) return
  const age = f - pane.releaseFrame

  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(1 + distort * 0.018, 1 - distort * 0.01)
  ctx.translate(-cx, -cy)

  if (age > 0) {
    const t = Math.min(1, age / 58)
    const drop = t * t * Math.min(gh * 0.58, 480)
    const rot = pane.rotSign * Math.sin(age * 0.072) * 0.13 * Math.min(1, age / 16)
    const sway = Math.sin(age * 0.102 + pane.px * 0.012) * 3.5 * Math.min(1, age / 24)
    ctx.translate(pane.px, pane.py)
    ctx.rotate(rot)
    ctx.translate(-pane.px, -pane.py)
    ctx.translate(sway, drop)
  }

  ctx.beginPath()
  pathRoundedRect(ctx, x0, y0, gw, gh, cornerR)
  ctx.clip()
  ctx.beginPath()
  ctx.moveTo(ox, oy)
  ctx.lineTo(pane.p1x, pane.p1y)
  ctx.lineTo(pane.p2x, pane.p2y)
  ctx.closePath()
  ctx.clip()

  ctx.beginPath()
  pathRoundedRect(ctx, x0, y0, gw, gh, cornerR)
  ctx.fillStyle = `rgba(195, 218, 235, ${0.038 * baseAlpha})`
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.12 * baseAlpha})`
  ctx.lineWidth = 1
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

/** 放射状の割れ目（楔形の境界） */
function drawGlassWedgeSeams(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  gw: number,
  gh: number,
  cornerR: number,
  ox: number,
  oy: number,
  splitAngles: readonly number[],
  f: number,
  alpha: number
): void {
  if (f < F_PANE_PARTITION || alpha < 0.03) return
  const g = Math.min(1, (f - F_PANE_PARTITION) / 12)
  const xMin = x0
  const yMin = y0
  const xMax = x0 + gw
  const yMax = y0 + gh
  ctx.save()
  ctx.beginPath()
  pathRoundedRect(ctx, x0, y0, gw, gh, cornerR)
  ctx.clip()
  for (const th of splitAngles) {
    const dx = Math.cos(th)
    const dy = Math.sin(th)
    const end = rayExitAabb(ox, oy, dx, dy, xMin, yMin, xMax, yMax)
    const ex = ox + (end.x - ox) * g
    const ey = oy + (end.y - oy) * g
    ctx.beginPath()
    ctx.moveTo(ox, oy)
    ctx.lineTo(ex, ey)
    ctx.strokeStyle = `rgba(12, 22, 36, ${0.5 * alpha * (0.45 + 0.55 * g)})`
    ctx.lineWidth = 2.1
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(ox, oy)
    ctx.lineTo(ex, ey)
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.19 * alpha})`
    ctx.lineWidth = 0.65
    ctx.stroke()
  }
  ctx.restore()
}

function drawGlassPanel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  gw: number,
  gh: number,
  distort: number,
  panelA: number
): void {
  if (panelA < 0.005) return
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(1 + distort * 0.018, 1 - distort * 0.01)
  ctx.translate(-cx, -cy)

  const x0 = cx - gw / 2
  const y0 = cy - gh / 2
  const cornerR = Math.min(22, Math.max(8, Math.min(gw, gh) * 0.014))
  pathRoundedRect(ctx, x0, y0, gw, gh, cornerR)
  /* 透過オーバーレイ上で白く浮かないよう極薄（形状のヒントだけ） */
  ctx.fillStyle = `rgba(195, 218, 235, ${0.035 * panelA})`
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.11 * panelA})`
  ctx.lineWidth = 1
  ctx.fill()
  ctx.stroke()

  ctx.restore()
}

function drawHole(
  ctx: CanvasRenderingContext2D,
  h: Hole,
  alphaScale: number,
  extraCrackBoost: number
): void {
  const { x, y, r, crackN, rot } = h

  ctx.beginPath()
  ctx.arc(x, y, r * 1.15, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.14 * alphaScale})`
  ctx.lineWidth = 0.75
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x, y, r * 0.55, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(8, 14, 22, ${0.82 * alphaScale})`
  ctx.fill()

  ctx.beginPath()
  ctx.arc(x, y, r * 0.2, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(0, 0, 0, ${0.55 * alphaScale})`
  ctx.fill()

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  const boost = 1 + extraCrackBoost
  for (let i = 0; i < crackN; i++) {
    const a = (i / crackN) * Math.PI * 2
    const len = r * (2.2 + (i % 3) * 0.45) * boost
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35)
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len)
    ctx.strokeStyle = `rgba(220, 235, 248, ${0.24 * alphaScale})`
    ctx.lineWidth = 0.5
    ctx.stroke()
  }
  ctx.restore()
}

function drawAnticipation(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  f: number,
  cx: number,
  cy: number
): void {
  if (f >= F_STATIC_END && f < F_ANTICIPATION_END) {
    const t = (f - F_STATIC_END) / (F_ANTICIPATION_END - F_STATIC_END)
    const ringR = 40 + t * Math.max(w, h) * 0.55
    ctx.beginPath()
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.14 * (1 - t)})`
    ctx.lineWidth = 2
    ctx.stroke()

    const flash = Math.sin(t * Math.PI) * 0.22
    if (flash > 0.01) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flash})`
      ctx.fillRect(0, 0, w, h)
    }
    return
  }

  for (let i = 1; i < HIT_FRAMES.length; i++) {
    const hf = HIT_FRAMES[i]
    const t0 = hf - 4
    if (f < t0 || f >= hf) continue
    const t = (f - t0) / (hf - t0)
    const ringR = 28 + t * Math.max(w, h) * 0.22
    ctx.beginPath()
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.08 * (1 - t * 0.5)})`
    ctx.lineWidth = 1.25
    ctx.stroke()
    const flash = Math.sin(t * Math.PI) * 0.09
    if (flash > 0.008) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flash})`
      ctx.fillRect(0, 0, w, h)
    }
    return
  }
}

function drawHitFlash(ctx: CanvasRenderingContext2D, w: number, h: number, f: number): void {
  for (const hf of HIT_FRAMES) {
    if (f === hf) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.34)'
      ctx.fillRect(0, 0, w, h)
      return
    }
    if (f === hf + 1) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.11)'
      ctx.fillRect(0, 0, w, h)
      return
    }
  }
}

export function NormalAttackGlassCanvas({
  canvasWidthPx,
  canvasHeightPx,
  playbackKey,
  onClipEnd,
}: NormalAttackGlassCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)
  /** 親の再レンダーで onClipEnd の参照が変わってもアニメを巻き戻さない */
  const onClipEndRef = useRef(onClipEnd)
  onClipEndRef.current = onClipEnd

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { w, h } = cappedCanvasBitmapSize(canvasWidthPx, canvasHeightPx, {
      maxLongEdge: 960,
      minEdge: 48,
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
    const canvasArea = w * h
    const qualityScale =
      canvasArea >= 1_050_000 ? 0.6 :
        canvasArea >= 820_000 ? 0.7 :
          canvasArea >= 620_000 ? 0.8 :
            canvasArea >= 460_000 ? 0.9 : 1
    const fineShardFrameStride = qualityScale <= 0.7 ? 3 : qualityScale <= 0.85 ? 2 : 1
    const dustFrameStride = qualityScale <= 0.7 ? 3 : qualityScale <= 0.85 ? 2 : 1
    /** ビューポート全面に近いガラス面（旧 72%×82% は中央の箱に見えていた） */
    const edgeInset = Math.max(8, Math.round(Math.min(w, h) * 0.012))
    const gw = w - edgeInset * 2
    const gh = h - edgeInset * 2

    const rng = mulberry32(0x4e0d4154)
    const x0 = cx - gw / 2
    const y0 = cy - gh / 2
    const burstCenterX = cx + (rng() - 0.5) * gw * BURST_CENTER_JX * 2
    const burstCenterY = cy + (rng() - 0.5) * gh * BURST_CENTER_JY * 2
    const scatterMaxR = Math.min(gw, gh) * BURST_SCATTER_R
    const baseAngle = rng() * Math.PI * 2
    const holeMargin = 22
    const newHoles: Hole[] = []
    const nHits = HIT_FRAMES.length
    for (let i = 0; i < nHits; i++) {
      const { ox, oy } = phyllotaxisDiskOffset(i, nHits, scatterMaxR, baseAngle)
      let hx = burstCenterX + ox + (rng() - 0.5) * 2 * BURST_POS_JITTER_PX
      let hy = burstCenterY + oy + (rng() - 0.5) * 2 * BURST_POS_JITTER_PX
      hx = Math.max(x0 + holeMargin, Math.min(x0 + gw - holeMargin, hx))
      hy = Math.max(y0 + holeMargin, Math.min(y0 + gh - holeMargin, hy))
      newHoles.push({
        x: hx,
        y: hy,
        r: 4.4 + rng() * 3.2,
        crackN: 8 + Math.floor(rng() * 4),
        rot: rng() * Math.PI * 2,
      })
    }

    const lastHole = newHoles[newHoles.length - 1]!
    const rayRng = mulberry32(0x87291cee)
    const shatterRays = buildShatterRays(
      rayRng,
      x0,
      y0,
      gw,
      gh,
      lastHole.x,
      lastHole.y,
      F_SHATTER_CRACK_RAYS
    )

    const wedgeRng = mulberry32(0x9a1e0173)
    const wedgeBuilt = buildGlassWedgePanes(
      wedgeRng,
      x0,
      y0,
      gw,
      gh,
      lastHole.x,
      lastHole.y,
      GLASS_WEDGE_COUNT
    )
    const glassWedges = wedgeBuilt.panes
    const wedgeSplitAngles = wedgeBuilt.splitAngles
    const glassCornerR = Math.min(22, Math.max(8, Math.min(gw, gh) * 0.014))

    const ambientDust: DustMote[] = []
    const ambientDustCount = Math.max(16, Math.round(48 * qualityScale))
    for (let i = 0; i < ambientDustCount; i++) {
      ambientDust.push({
        x: cx + (rng() - 0.5) * gw,
        y: cy + (rng() - 0.5) * gh,
        vx: (rng() - 0.5) * 0.35,
        vy: (rng() - 0.5) * 0.28 - 0.15,
        r: 0.25 + rng() * 0.9,
        phase: rng() * Math.PI * 2,
        layer: 'ambient',
        bornFrame: 0,
        lifeFrames: TOTAL_FRAMES,
      })
    }

    let shards: Shard[] = []
    let burstDust: DustMote[] = []
    const spawnedHitFrames = new Set<number>()
    let panelShatterSpawned = false
    let shatterWave2Spawned = false
    let shatterWave3Spawned = false

    const stepPhysics = (f: number) => {
      const gMedium = f < F_BURST_END ? 0.38 : 0.52
      const gFine = f < F_BURST_END ? 0.22 : 0.35
      const collapseBoost =
        f >= F_LAST_HIT && f < F_LAST_HIT + 56 ? (f < F_LAST_HIT + 28 ? 0.16 : 0.1) : 0

      for (const s of shards) {
        if (f < s.bornFrame) continue
        s.vy += (s.kind === 'medium' ? gMedium : gFine) + (s.kind === 'medium' ? collapseBoost : collapseBoost * 0.62)
        s.x += s.vx
        s.y += s.vy
        s.vx *= 0.985
        s.angle += s.va
      }

      for (const d of ambientDust) {
        d.x += d.vx + Math.sin(f * 0.05 + d.phase) * (0.08 * qualityScale)
        d.y += d.vy
      }

      for (const d of burstDust) {
        if (f < d.bornFrame) continue
        d.vy += 0.12
        d.x += d.vx
        d.y += d.vy
        d.vx *= 0.988
      }
    }

    const drawShards = (ctx2: CanvasRenderingContext2D, f: number, fadeOut: number) => {
      const fillMedium = 'rgb(215, 235, 255)'
      const fillFine = 'rgb(200, 220, 240)'
      const strokeWhite = 'rgb(255, 255, 255)'
      for (const s of shards) {
        if (s.kind === 'fine' && fineShardFrameStride > 1 && (f % fineShardFrameStride) !== 0) continue
        if (f < s.bornFrame) continue
        const age = f - s.bornFrame
        if (age >= s.lifeFrames) continue
        const t = age / s.lifeFrames
        const baseA = s.kind === 'medium' ? 0.55 : 0.38
        const a = baseA * (1 - t * 0.92) * fadeOut

        ctx2.save()
        ctx2.translate(s.x, s.y)
        ctx2.rotate(s.angle)
        ctx2.fillStyle = s.kind === 'medium' ? fillMedium : fillFine
        ctx2.strokeStyle = strokeWhite
        ctx2.globalAlpha = s.kind === 'medium' ? a : a * 0.95
        ctx2.lineWidth = 0.5
        ctx2.beginPath()
        ctx2.rect(-s.halfW, -s.halfH, s.halfW * 2, s.halfH * 2)
        ctx2.fill()
        ctx2.globalAlpha = a * 0.45
        ctx2.stroke()
        ctx2.restore()
      }
    }

    const drawDust = (ctx2: CanvasRenderingContext2D, f: number, fadeOut: number) => {
      if (dustFrameStride > 1 && (f % dustFrameStride) !== 0) {
        return
      }
      const ambientDustColor = 'rgb(230, 240, 255)'
      const burstDustColor = 'rgb(220, 235, 250)'
      for (const d of ambientDust) {
        if (f > F_ANTICIPATION_END) continue
        const flicker = 0.65 + 0.35 * Math.sin(f * 0.12 + d.phase)
        const staticT = f <= F_STATIC_END ? 1 : Math.max(0, 1 - (f - F_STATIC_END) / (F_ANTICIPATION_END - F_STATIC_END))
        const a = 0.1 * flicker * fadeOut * staticT
        if (a < 0.008) continue
        ctx2.fillStyle = ambientDustColor
        ctx2.globalAlpha = a
        ctx2.beginPath()
        ctx2.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx2.fill()
      }

      for (const d of burstDust) {
        if (f < d.bornFrame) continue
        const age = f - d.bornFrame
        if (age >= d.lifeFrames) continue
        const t = age / d.lifeFrames
        const a = 0.28 * (1 - t) * fadeOut
        ctx2.fillStyle = burstDustColor
        ctx2.globalAlpha = a
        ctx2.beginPath()
        ctx2.arc(d.x, d.y, d.r * (1 + t * 0.2), 0, Math.PI * 2)
        ctx2.fill()
      }
      ctx2.globalAlpha = 1
    }

    startRef.current = performance.now()

    let completed = false
    const clipMs = TOTAL_FRAMES * FRAME_MS
    let safetyId: ReturnType<typeof window.setTimeout> | undefined
    let prevFrame = -1
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

    const tick = (now: number) => {
      const elapsed = now - startRef.current
      const f = Math.min(TOTAL_FRAMES - 1, Math.floor(elapsed / FRAME_MS))
      // 120Hz環境などで同一フレームを重複描画しない（演出の進行は維持）
      if (f === prevFrame) {
        if (elapsed >= clipMs - 0.001) {
          finishClip()
          return
        }
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      prevFrame = f

      for (let hi = 0; hi < HIT_FRAMES.length; hi++) {
        const hf = HIT_FRAMES[hi]
        if (f < hf || spawnedHitFrames.has(hf)) continue
        spawnedHitFrames.add(hf)
        const hole = newHoles[hi]
        const spawnRng = mulberry32(0x481c4a11 + hf * 0x9e3779b1)
        const intensity = HIT_SPAWN_INTENSITY[hi] ?? 0.45
        const spawned = spawnShardsAndBurstDust(spawnRng, hole.x, hole.y, hf, intensity)
        const reducedShards = qualityScale >= 0.99
          ? spawned.shards
          : spawned.shards.filter((s, idx) => (s.kind === 'medium' ? true : idx % Math.max(1, Math.round(1 / qualityScale)) === 0))
        const reducedBurstDust = qualityScale >= 0.99
          ? spawned.burstDust
          : spawned.burstDust.filter((_, idx) => idx % Math.max(1, Math.round(1 / qualityScale)) === 0)
        shards = shards.concat(reducedShards)
        burstDust = burstDust.concat(reducedBurstDust)
      }

      if (f >= F_LAST_HIT && !panelShatterSpawned) {
        panelShatterSpawned = true
        const sg = spawnWholePanelShatter(
          mulberry32(0x5ea10acc),
          x0,
          y0,
          gw,
          gh,
          F_LAST_HIT,
          lastHole.x,
          lastHole.y
        )
        const reducedShards = qualityScale >= 0.99
          ? sg.shards
          : sg.shards.filter((s, idx) => (s.kind === 'medium' ? true : idx % Math.max(1, Math.round(1 / qualityScale)) === 0))
        const reducedBurstDust = qualityScale >= 0.99
          ? sg.burstDust
          : sg.burstDust.filter((_, idx) => idx % Math.max(1, Math.round(1 / qualityScale)) === 0)
        shards = shards.concat(reducedShards)
        burstDust = burstDust.concat(reducedBurstDust)
      }

      if (f >= F_SHATTER_WAVE2 && !shatterWave2Spawned) {
        shatterWave2Spawned = true
        const w2 = spawnShatterCrumbleFall(
          mulberry32(0xc0ffee21),
          x0,
          y0,
          gw,
          gh,
          F_SHATTER_WAVE2,
          lastHole.x,
          lastHole.y
        )
        const reducedShards = qualityScale >= 0.99
          ? w2.shards
          : w2.shards.filter((s, idx) => (s.kind === 'medium' ? true : idx % Math.max(1, Math.round(1 / qualityScale)) === 0))
        const reducedBurstDust = qualityScale >= 0.99
          ? w2.burstDust
          : w2.burstDust.filter((_, idx) => idx % Math.max(1, Math.round(1 / qualityScale)) === 0)
        shards = shards.concat(reducedShards)
        burstDust = burstDust.concat(reducedBurstDust)
      }

      if (f >= F_SHATTER_WAVE3 && !shatterWave3Spawned) {
        shatterWave3Spawned = true
        const w3 = spawnShatterEdgeSlough(
          mulberry32(0x3d9e5153),
          x0,
          y0,
          gw,
          gh,
          F_SHATTER_WAVE3,
          lastHole.x,
          lastHole.y
        )
        const reducedShards = qualityScale >= 0.99
          ? w3.shards
          : w3.shards.filter((s, idx) => (s.kind === 'medium' ? true : idx % Math.max(1, Math.round(1 / qualityScale)) === 0))
        const reducedBurstDust = qualityScale >= 0.99
          ? w3.burstDust
          : w3.burstDust.filter((_, idx) => idx % Math.max(1, Math.round(1 / qualityScale)) === 0)
        shards = shards.concat(reducedShards)
        burstDust = burstDust.concat(reducedBurstDust)
      }

      stepPhysics(f)
      if ((f & 7) === 0) {
        shards = shards.filter((s) => f < s.bornFrame + s.lifeFrames)
        burstDust = burstDust.filter((d) => f < d.bornFrame + d.lifeFrames)
      }

      const fadeOut = f < F_LINGER_END ? 1 : Math.max(0, 1 - (f - F_LINGER_END) / (F_CLIP_END - F_LINGER_END))

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'

      let distort =
        f >= F_STATIC_END && f < F_ANTICIPATION_END
          ? Math.sin(((f - F_STATIC_END) / (F_ANTICIPATION_END - F_STATIC_END)) * Math.PI)
          : 0
      for (const hf of HIT_FRAMES) {
        const dt = f - hf
        if (dt >= 0 && dt < 7) {
          distort += 0.11 * Math.sin((dt / 7) * Math.PI)
        }
      }

      const panelA = panelAlphaAfterLastHit(f)
      if (f >= F_LAST_HIT) {
        const t = f - F_LAST_HIT
        distort +=
          panelA *
          (0.09 * Math.sin(t * 0.82) + 0.055 * Math.sin(t * 1.63 + 0.7) + 0.035 * Math.sin(t * 2.4))
      }

      if (f < F_PANE_PARTITION) {
        drawGlassPanel(ctx, cx, cy, gw, gh, distort, panelA)
      } else {
        for (const wedge of glassWedges) {
          drawGlassWedgePane(
            ctx,
            lastHole.x,
            lastHole.y,
            x0,
            y0,
            gw,
            gh,
            glassCornerR,
            wedge,
            f,
            distort,
            panelA,
            cx,
            cy
          )
        }
        drawGlassWedgeSeams(
          ctx,
          x0,
          y0,
          gw,
          gh,
          glassCornerR,
          lastHole.x,
          lastHole.y,
          wedgeSplitAngles,
          f,
          panelA
        )
      }
      drawShatterRays(ctx, shatterRays, f, panelA)

      for (let hi = 0; hi < newHoles.length; hi++) {
        const hf = HIT_FRAMES[hi]
        if (f < hf) continue
        const markAlpha = alphaForNewBulletHole(f, hf)
        if (markAlpha <= 0.001) continue
        const hole = newHoles[hi]
        /** 亀裂の「伸び」は着弾からの経過のみ。markAlpha を掛けると傷だけ先に消えて見える */
        const crackBoost = Math.min(0.38, (f - hf) / 22)
        drawHole(ctx, hole, fadeOut * markAlpha, crackBoost)
      }

      drawAnticipation(ctx, w, h, f, cx, cy)
      drawDust(ctx, f, fadeOut)
      drawShards(ctx, f, fadeOut)
      drawHitFlash(ctx, w, h, f)

      if (elapsed >= clipMs - 0.001) {
        ctx.clearRect(0, 0, w, h)
        finishClip()
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    safetyId = window.setTimeout(finishClip, clipMs + 120)

    return () => {
      if (safetyId !== undefined) window.clearTimeout(safetyId)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [canvasWidthPx, canvasHeightPx, playbackKey])

  const { w, h } = cappedCanvasBitmapSize(canvasWidthPx, canvasHeightPx, {
    maxLongEdge: 960,
    minEdge: 48,
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
    zIndex: 200000,
  }

  return (
    <div className="normal-attack-glass-root" style={rootStyle} aria-hidden>
      <canvas
        ref={canvasRef}
        className="normal-attack-glass-canvas"
        width={w}
        height={h}
        style={{ width: '100%', height: '100%' }}
        aria-hidden
      />
    </div>
  )
}

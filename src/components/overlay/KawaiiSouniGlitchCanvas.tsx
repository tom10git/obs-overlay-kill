/**
 * カワイソウニ debuff 中の HP ゲージ上乗せ（初期実装に近い: screen 横スライス RGB・lighter ブロック・走査線）
 * 約3秒ごとにマクロの乱数状態が切り替わり、その間は短い間隔でランダムに形が跳ねるグリッチ表現。
 * Adobe のグリッチ加⼯サンプルに近い近未来的なノイズ表現を狙う。
 * @see https://www.adobe.com/jp/learn/photoshop/web/jp-1min-feature-ps-glitch?ntd=1
 */

import { useEffect, useRef } from 'react'
import './KawaiiSouniGlitchCanvas.css'

function rand01(seed: number, i: number): number {
  const x = (Math.imul(seed ^ (i * 0x517cc1b7), 0x9e3779b9) >>> 0) ^ (seed >>> 11)
  return (x % 10007) / 10007
}

function drawKawaiiSouniGlitch(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tSec: number,
  nowMs: number,
  pulseKey: number,
  spikeBoost: number,
  reducedMotion: boolean
): void {
  /** 3秒周期で全体の乱数パターンが変わる（同じ秒ループを避ける） */
  const periodMs = 3000
  const cycleIndex = (Math.floor(nowMs / periodMs) >>> 0) as number
  /** ティックごとにノイズ形状がランダムに切り替わる */
  const tickMs = reducedMotion ? 130 : 68
  const tickId = (Math.floor(nowMs / tickMs) >>> 0) as number
  const patchSeed =
    (((pulseKey >>> 0) * 0x9e3779b1) ^ cycleIndex * 0x7f4a7c15 ^ tickId * 0x165667b1) >>> 0
  /** 白／シアン・ブロックだけより速く座標を切り替え（大きな白矩形が張り付いて見えないようにする） */
  const blockFrame = Math.floor(nowMs / (reducedMotion ? 95 : 38)) >>> 0
  const blockSeed =
    (((pulseKey >>> 0) * 0x27d4eb2d) ^ cycleIndex * 0xb5297a7d ^ blockFrame * 0x94d049bb) >>> 0

  const driftX = Math.sin(nowMs * 0.0027) * w * 0.055
  const driftY = Math.cos(nowMs * 0.0021) * h * 0.042
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)

  /** 初期の「派手」寄りのコントラスト（白帯対策で後から下げていた baseA より強い） */
  const baseA = (reducedMotion ? 0.13 : 0.2) * (0.52 + spikeBoost * 0.58)
  const sliceCount = reducedMotion ? 15 : 32
  const tFast = tSec * (reducedMotion ? 1.55 : 3.1)

  ctx.globalCompositeOperation = 'screen'

  for (let i = 0; i < sliceCount; i++) {
    const slicePhase = i * 0.31 + rand01(patchSeed, i + 17) * 2.4
    const yRand =
      (rand01(patchSeed, i * 5 + 3) - 0.5) * h * (reducedMotion ? 0.055 : 0.12) * spikeBoost
    const yJitter =
      Math.sin(tFast * 18 + slicePhase) * (reducedMotion ? 1.05 : 2.85) * spikeBoost + yRand
    const y0 = (i / sliceCount) * h * 1.06 - h * 0.03 + yJitter + driftY * 0.35
    const bandH =
      (h / sliceCount) *
      (0.45 + rand01(patchSeed, i * 3 + 9) * 0.62) *
      (0.88 + 0.2 * rand01(patchSeed, i * 11 + 1))
    const wobble =
      (rand01(patchSeed, i + 401) - 0.5) * (reducedMotion ? 18 : 38) * spikeBoost +
      Math.sin(tFast * 16 + i * 0.9) * (reducedMotion ? 1.5 : 4.6) * spikeBoost
    const dxR = (Math.sin(tFast * 33 + i * 0.4) * 8.5 + wobble + driftX) * spikeBoost
    const dxG = (Math.sin(tFast * 28 + i * 0.55) * 6 + driftX * 0.72) * spikeBoost
    const dxB = (Math.sin(tFast * 37 + i * 0.35) * 9.5 - wobble * 0.58 + driftX * 1.25) * spikeBoost

    ctx.fillStyle = `rgba(255, 45, 200, ${baseA * 0.52})`
    ctx.fillRect(dxR, y0, w * 1.15, bandH)
    ctx.fillStyle = `rgba(40, 255, 230, ${baseA * 0.46})`
    ctx.fillRect(dxG, y0, w * 1.15, bandH)
    ctx.fillStyle = `rgba(160, 210, 255, ${baseA * 0.44})`
    ctx.fillRect(dxB, y0, w * 1.15, bandH)
  }

  ctx.globalCompositeOperation = 'lighter'
  const blocks = reducedMotion ? 18 : 44
  for (let b = 0; b < blocks; b++) {
    const scroll = (nowMs * 0.035 + b * 97.3) % (w + h)
    const bx =
      (((((rand01(blockSeed, b * 17 + 99) + Math.sin(nowMs * 0.0038 + b * 1.9) * 0.06) % 1) + 1) % 1) * w +
        driftX * 0.8 +
        w) %
      w
    const by =
      (((((rand01(blockSeed, b * 13 + 88) + Math.cos(nowMs * 0.0031 + b * 2.4) * 0.06) % 1) + 1) % 1) * h +
        scroll * 0.08 +
        driftY +
        h) %
      h
    const bw = (5 + rand01(blockSeed, b) * (reducedMotion ? 20 : 52)) * spikeBoost
    const bh = (2 + rand01(blockSeed, b + 40) * (reducedMotion ? 12 : 26)) * spikeBoost
    const flick = 0.18 + rand01(blockSeed, b + 60) * 0.44 * (0.48 + spikeBoost * 0.58)
    if ((b + Math.floor(tFast * 28)) % 3 === 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flick * baseA * 2.85})`
    } else {
      ctx.fillStyle = `rgba(120, 255, 255, ${flick * baseA * 2.35})`
    }
    ctx.fillRect(bx, by, bw, bh)
  }

  const tearSeed = (blockSeed ^ (Math.floor(nowMs / 17) * 0x2c2b5c41)) >>> 0
  const tears = reducedMotion ? 2 : 5
  for (let t = 0; t < tears; t++) {
    const tw = w * (0.06 + rand01(tearSeed, t * 13 + 3000) * 0.34) * spikeBoost
    const th = 1 + rand01(tearSeed, t + 3010) * (reducedMotion ? 2.5 : 5) * spikeBoost
    const txRaw = rand01(tearSeed, t * 17 + 3020) * (w + tw * 0.5) - tw * 0.25 + driftX * 0.4
    const tx = ((txRaw % w) + w) % w
    const tyBase = rand01(tearSeed, t * 19 + 3030) * h
    const ty = (tyBase + Math.sin(nowMs * 0.011 + t * 2.7) * h * 0.08) % h
    const ta = (0.06 + rand01(tearSeed, t + 3040) * 0.2) * baseA * spikeBoost
    ctx.fillStyle =
      rand01(tearSeed, t + 3050) > 0.48
        ? `rgba(255, 255, 255, ${ta * 2.2})`
        : `rgba(170, 255, 255, ${ta * 1.9})`
    ctx.fillRect(tx, ty, tw, th)
  }

  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.06 + spikeBoost * 0.095})`
  ctx.lineWidth = reducedMotion ? 1 : 1.15
  const scanStep = reducedMotion ? 4 : 2
  for (let y = 0; y < h; y += scanStep) {
    const off = Math.sin(tFast * 44 + y * 0.09 + nowMs * 0.0015) * (2.8 + 7.5 * spikeBoost)
    ctx.beginPath()
    ctx.moveTo(off, y)
    ctx.lineTo(w + off, y)
    ctx.stroke()
  }

  ctx.globalCompositeOperation = 'overlay'
  const glitchLine = reducedMotion ? 4 : 8
  for (let g = 0; g < glitchLine; g++) {
    const gyBase = rand01(patchSeed, 500 + g) * h
    const gy = (gyBase + Math.sin(nowMs * 0.0024 + g * 2.1) * h * 0.055) % h
    const gx0 =
      (rand01(patchSeed, 700 + g) - 0.5) * w * 0.55 +
      Math.sin(tFast * 52 + g + nowMs * 0.001) * w * 0.11
    ctx.strokeStyle = `rgba(255, 80, 220, ${0.22 * spikeBoost})`
    ctx.lineWidth = 1.1 + rand01(patchSeed, 600 + g) * 2.8
    ctx.beginPath()
    ctx.moveTo(gx0, gy)
    ctx.lineTo(
      w + gx0 * 0.32,
      gy + (Math.sin(nowMs * 0.005 + g) * 0.5) * 14
    )
    ctx.stroke()
  }

  ctx.restore()
}

export interface KawaiiSouniGlitchCanvasProps {
  /** 被ダメ・DOT のたびに増やしてフラッシュ強度を上げる */
  pulseKey: number
}

export function KawaiiSouniGlitchCanvas({ pulseKey }: KawaiiSouniGlitchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const spikeUntilRef = useRef(0)
  const prevPulseRef = useRef<number | null>(null)

  useEffect(() => {
    if (prevPulseRef.current === null) {
      prevPulseRef.current = pulseKey
      return
    }
    if (pulseKey !== prevPulseRef.current) {
      prevPulseRef.current = pulseKey
      spikeUntilRef.current = performance.now() + 520
    }
  }, [pulseKey])

  useEffect(() => {
    const canvas = canvasRef.current
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

    const drawOnce = (now: number) => {
      const p = canvas.parentElement
      if (!p) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cssW = Math.max(1, p.clientWidth)
      const cssH = Math.max(1, p.clientHeight)
      if (cssW < 2 || cssH < 2) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const tSec = now * 0.001
      const dt = spikeUntilRef.current - now
      const spikeBoost = dt > 0 ? Math.min(1, dt / 520) : 0.42 + Math.sin(tSec * 8) * 0.2
      drawKawaiiSouniGlitch(ctx, cssW, cssH, tSec, now, pulseKey, spikeBoost, mq.matches)
    }

    const ro = new ResizeObserver(() => {
      fit()
      drawOnce(performance.now())
    })
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    fit()

    const onMq = () => drawOnce(performance.now())
    mq.addEventListener('change', onMq)

    const loop = (now: number) => {
      drawOnce(now)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      mq.removeEventListener('change', onMq)
    }
  }, [pulseKey])

  return <canvas ref={canvasRef} className="kawaii-souni-glitch-canvas" aria-hidden />
}

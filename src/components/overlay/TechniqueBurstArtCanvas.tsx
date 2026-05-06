/**
 * 技名で決まる Canvas アート（帯の上に screen で重ねる）
 */

import { useEffect, useRef } from 'react'
import type { TechniqueBurstArtParams, TechniqueEffectKind } from '../../constants/techniqueEffectKinds'
import { drawTechniqueBurstArt } from './techniqueBurstArtDraw'

export interface TechniqueBurstArtCanvasProps {
  art: TechniqueBurstArtParams
  /** 指定時は kind 専用の Canvas 上乗せ（例: tempest で稲妻） */
  effectKind?: TechniqueEffectKind
  /** 指定時は語に応じた上乗せ（例: 「桜」を含む技名で花びら） */
  techniqueName?: string
  /** true のとき、常時アニメを止めて静止画（1フレーム）にする */
  forceReducedMotion?: boolean
}

export function TechniqueBurstArtCanvas({
  art,
  effectKind,
  techniqueName,
  forceReducedMotion = false,
}: TechniqueBurstArtCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const lastDrawMsRef = useRef<number>(-1)

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

    const drawFrame = (now: number) => {
      const p = canvas.parentElement
      if (!p) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cssW = Math.max(1, p.clientWidth)
      const cssH = Math.max(1, p.clientHeight)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawTechniqueBurstArt(
        ctx,
        cssW,
        cssH,
        now * 0.001,
        art.pattern,
        art.seed,
        mq.matches,
        art.aux0,
        art.aux1,
        effectKind,
        techniqueName
      )
    }

    const ro = new ResizeObserver(() => {
      fit()
      drawFrame(performance.now())
    })
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    fit()

    const onMq = () => {
      drawFrame(performance.now())
    }
    mq.addEventListener('change', onMq)

    const reduced = forceReducedMotion || mq.matches
    if (reduced) {
      drawFrame(0)
    } else {
      const loop = (now: number) => {
        // メインスレッド負荷を抑えるため、帯アートは 30fps 程度に間引く（他エフェクトと同時発火しやすい）
        const last = lastDrawMsRef.current
        if (last < 0 || now - last >= 1000 / 30) {
          lastDrawMsRef.current = now
          drawFrame(now)
        }
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      mq.removeEventListener('change', onMq)
    }
  }, [art, effectKind, techniqueName, forceReducedMotion])

  return <canvas ref={ref} className="tefx-layer tefx-art-canvas" aria-hidden />
}

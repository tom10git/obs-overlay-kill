/**
 * HPゲージ枠（hp-gauge-frame / hp-gauge-wrapper）のインラインスタイル。
 * HPGauge とオーバーレイ帯で見た目がずれないよう共通化する。
 */

import type { CSSProperties } from 'react'
import type { GaugeColorConfig, GaugeDesign, GaugeShapeConfig } from '../types/overlay'

export function buildHpGaugeWrapperStyle(
  gaugeDesign: GaugeDesign,
  gs: GaugeShapeConfig,
  gc: Pick<GaugeColorConfig, 'frameBackground' | 'frameBorderInner' | 'frameBorderOuter'>
): CSSProperties {
  return {
    ...(gaugeDesign === 'parallelogram' ? { transform: `skewX(${-gs.skewDeg}deg)` } : {}),
    ...({
      '--gauge-default-radius': `${gs.defaultBorderRadiusPx}px`,
      '--gauge-default-white': `${gs.defaultBorderWhitePx}px`,
      '--gauge-default-gray': `${gs.defaultBorderGrayPx}px`,
      '--gauge-para-radius': `${gs.parallelogramBorderRadiusPx}px`,
      '--gauge-para-white': `${gs.parallelogramBorderWhitePx}px`,
      '--gauge-para-gray': `${gs.parallelogramBorderGrayPx}px`,
      '--gauge-frame-bg': gc.frameBackground,
      '--gauge-border-inner': gc.frameBorderInner,
      '--gauge-border-outer': gc.frameBorderOuter,
    } as CSSProperties),
  }
}

export function buildHpGaugeFrameStyle(args: {
  gaugeDesign: GaugeDesign
  gs: GaugeShapeConfig
  widthPx: number
  heightPx: number
  /** 帯などでビューポート幅を抑えるとき min(幅, 100vw-16) */
  widthMinVwExpr?: string
}): CSSProperties {
  const { gaugeDesign, gs, widthPx, heightPx, widthMinVwExpr } = args
  return {
    ...(widthMinVwExpr != null
      ? { width: `min(${widthPx}px, ${widthMinVwExpr})` }
      : {}),
    maxWidth: `${widthPx}px`,
    height: `${heightPx}px`,
    ...(gaugeDesign === 'parallelogram'
      ? {
          paddingLeft: `${gs.parallelogramFramePaddingPx}px`,
          paddingRight: `${gs.parallelogramFramePaddingPx}px`,
        }
      : {}),
  }
}

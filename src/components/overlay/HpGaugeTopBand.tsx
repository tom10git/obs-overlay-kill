/**
 * HPゲージに追従して固定配置する帯（子に演出・UIを載せる）
 * - 既定: ゲージ上端の少し上に幅を合わせて配置
 * - overlayOnGauge: ゲージ枠（config.hp の中心・幅・高さ）と同じ位置に重ねる
 */

import type { CSSProperties, ReactNode } from 'react'
import type { GaugeColorConfig, GaugeDesign, GaugeShapeConfig } from '../../types/overlay'
import { HP_GAUGE_TOP_BAND_GAP_PX } from '../../constants/hpGaugeOverlay'
import { buildHpGaugeFrameStyle, buildHpGaugeWrapperStyle } from '../../utils/hpGaugeAppearanceStyles'
import './HpGaugeTopBand.css'
import './HPGauge.css'

/** 技演出など、ゲージ枠と同じ見た目でクリップ・スキューさせるときに渡す */
export interface HpGaugeFrameMatchConfig {
  design: GaugeDesign
  shape: GaugeShapeConfig
  colors: Pick<GaugeColorConfig, 'frameBackground' | 'frameBorderInner' | 'frameBorderOuter'>
}

export interface HpGaugeTopBandProps {
  gaugeWidthPx: number
  hpX: number
  hpY: number
  hpHeight: number
  /** 指定時: 帯の高さをゲージと同じ px にし、子を縦いっぱいに伸ばす（技演出など） */
  bandHeightPx?: number
  /** true のときゲージ枠と同じ中心・幅・高さで重ねる（HPGauge の外側ラッパーと同じ座標系） */
  overlayOnGauge?: boolean
  /** overlayOnGauge 時: hp-gauge-frame / wrapper と同じ二重枠・角丸・平行四辺形スキューで子をクリップ */
  gaugeFrameMatch?: HpGaugeFrameMatchConfig
  gapAboveGaugePx?: number
  children?: ReactNode
  className?: string
  style?: CSSProperties
  zIndex?: number
}

export function HpGaugeTopBand({
  gaugeWidthPx,
  hpX,
  hpY,
  hpHeight,
  bandHeightPx,
  overlayOnGauge = false,
  gaugeFrameMatch,
  gapAboveGaugePx = HP_GAUGE_TOP_BAND_GAP_PX,
  children,
  className = '',
  style,
  zIndex = 10010,
}: HpGaugeTopBandProps) {
  const safeW = Math.max(120, gaugeWidthPx)
  const hFrame = Math.max(1, hpHeight)
  const anchorTop = `calc(50% + ${hpY}px - ${hFrame / 2}px - ${gapAboveGaugePx}px)`
  const fixedH = bandHeightPx != null ? Math.max(1, bandHeightPx) : null
  const shellCfg = overlayOnGauge && gaugeFrameMatch ? gaugeFrameMatch : null
  const useGaugeFrameShell = shellCfg != null
  const sizeClass =
    fixedH != null && !useGaugeFrameShell ? ' hp-gauge-top-band--gauge-size' : ''
  const overlayClass = overlayOnGauge ? ' hp-gauge-top-band--overlay' : ''
  const frameMatchClass = useGaugeFrameShell ? ' hp-gauge-top-band--gauge-frame-match' : ''

  const frameH = fixedH ?? hFrame
  const inner = shellCfg ? (
    <div
      className={`hp-gauge-frame ${shellCfg.design === 'parallelogram' ? 'hp-gauge-frame--parallelogram' : ''}`}
      style={buildHpGaugeFrameStyle({
        gaugeDesign: shellCfg.design,
        gs: shellCfg.shape,
        widthPx: gaugeWidthPx,
        heightPx: frameH,
        widthMinVwExpr: 'calc(100vw - 16px)',
      })}
    >
      <div
        className={`hp-gauge-wrapper hp-gauge-wrapper--${shellCfg.design}`}
        style={
          {
            ...buildHpGaugeWrapperStyle(shellCfg.design, shellCfg.shape, shellCfg.colors),
            ...(shellCfg.design === 'parallelogram'
              ? { '--hp-gauge-counter-skew': `${shellCfg.shape.skewDeg}deg` }
              : {}),
          } as CSSProperties
        }
      >
        {children}
      </div>
    </div>
  ) : (
    children
  )

  const positionStyle: CSSProperties = overlayOnGauge
    ? {
        left: `calc(50% + ${hpX}px)`,
        top: `calc(50% + ${hpY}px)`,
        transform: 'translate(-50%, -50%)',
      }
    : {
        left: `calc(50% + ${hpX}px)`,
        top: anchorTop,
        transform: 'translate(-50%, -100%)',
      }

  return (
    <div
      className={`hp-gauge-top-band${sizeClass}${overlayClass}${frameMatchClass} ${className}`.trim()}
      style={
        {
          ...positionStyle,
          ...(!useGaugeFrameShell ? { width: `min(${safeW}px, calc(100vw - 16px))` } : {}),
          zIndex,
          ...(fixedH != null && !useGaugeFrameShell
            ? { height: `${fixedH}px`, minHeight: `${fixedH}px`, maxHeight: `${fixedH}px` }
            : {}),
          ...style,
        } as CSSProperties
      }
    >
      {inner}
    </div>
  )
}

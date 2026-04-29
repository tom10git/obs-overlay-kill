/**
 * ダメージ数値表示コンポーネント
 */

import { memo, useMemo } from 'react'
import './DamageNumber.css'
import type { AttackDebuffKind, DamageColorConfig } from '../../types/overlay'

type RasterizedDamageText = {
  src: string
  width: number
  height: number
}

export type DamagePopupKind =
  | 'normal'
  | 'critical'
  | 'combo'
  | 'roulette'
  | 'rouletteChain'
  | 'finishing'

const DAMAGE_TEXT_RASTER_CACHE = new Map<string, RasterizedDamageText>()
const DAMAGE_TEXT_RASTER_CACHE_KEYS: string[] = []
const DAMAGE_TEXT_RASTER_CACHE_MAX = 320
const DAMAGE_TEXT_STYLE_REV = 'outline-source-kind-v1'

function outlineByPopupKind(kind: DamagePopupKind): { outer: string; inner: string } {
  switch (kind) {
    case 'critical':
      return { outer: '#8a5b00', inner: '#ffe27a' }
    case 'combo':
      return { outer: '#3f1457', inner: '#f1b5ff' }
    case 'roulette':
      return { outer: '#083a58', inner: '#8ee7ff' }
    case 'rouletteChain':
      return { outer: '#004d22', inner: '#8bffba' }
    case 'finishing':
      return { outer: '#4a0b10', inner: '#ffb1ba' }
    case 'normal':
    default:
      return { outer: '#000000', inner: '#ffffff' }
  }
}

function escapeXml(s: string): string {
  // `replaceAll` が TS の lib 指定により使えない環境があるため、`/g` ベースに統一
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function getOrCreateRasterizedDamageText(params: {
  amountLabel: string
  color: string
  popupKind: DamagePopupKind
}): RasterizedDamageText {
  const isCritical = params.popupKind === 'critical'
  const fontSize = isCritical ? 102 : 96
  const pad = isCritical ? 24 : 20
  const outerStroke = isCritical ? 13 : 12
  const innerStroke = isCritical ? 4.2 : 3.8
  const fontWeight = isCritical ? 820 : 780
  const outline = outlineByPopupKind(params.popupKind)
  const width = Math.max(140, Math.ceil(params.amountLabel.length * (fontSize * 0.74) + pad * 2))
  const height = Math.ceil(fontSize + pad * 2)
  const y = Math.round(pad + fontSize * 0.82)
  const key = `${DAMAGE_TEXT_STYLE_REV}|${params.amountLabel}|${params.color}|${params.popupKind}`
  const cached = DAMAGE_TEXT_RASTER_CACHE.get(key)
  if (cached) return cached

  const text = escapeXml(params.amountLabel)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
  <filter id="w" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="0" stdDeviation="0.6" flood-color="#fff" flood-opacity="1"/>
    <feDropShadow dx="0" dy="0" stdDeviation="0.6" flood-color="#fff" flood-opacity="1"/>
  </filter>
</defs>
<text x="${width / 2}" y="${y}" text-anchor="middle" font-size="${fontSize}" font-weight="${fontWeight}"
  font-family="Arial Black, Hiragino Kaku Gothic ProN, Yu Gothic UI, Meiryo, sans-serif"
  fill="${params.color}" stroke="${outline.outer}" stroke-width="${outerStroke}" stroke-linejoin="round"
  paint-order="stroke fill" filter="url(#w)">${text}</text>
<text x="${width / 2}" y="${y}" text-anchor="middle" font-size="${fontSize}" font-weight="${fontWeight}"
  font-family="Arial Black, Hiragino Kaku Gothic ProN, Yu Gothic UI, Meiryo, sans-serif"
  fill="${params.color}" stroke="${outline.inner}" stroke-width="${innerStroke}" stroke-linejoin="round"
  paint-order="stroke fill">${text}</text>
<text x="${width / 2}" y="${y}" text-anchor="middle" font-size="${fontSize}" font-weight="${fontWeight}"
  font-family="Arial Black, Hiragino Kaku Gothic ProN, Yu Gothic UI, Meiryo, sans-serif"
  fill="${params.color}">${text}</text>
</svg>`
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  const created: RasterizedDamageText = { src, width, height }
  DAMAGE_TEXT_RASTER_CACHE.set(key, created)
  DAMAGE_TEXT_RASTER_CACHE_KEYS.push(key)
  if (DAMAGE_TEXT_RASTER_CACHE_KEYS.length > DAMAGE_TEXT_RASTER_CACHE_MAX) {
    const oldest = DAMAGE_TEXT_RASTER_CACHE_KEYS.shift()
    if (oldest) DAMAGE_TEXT_RASTER_CACHE.delete(oldest)
  }
  return created
}

function dotDebuffFallbackHex(kind: AttackDebuffKind | undefined, damageColors: DamageColorConfig): string {
  switch (kind ?? 'bleed') {
    case 'poison':
      return damageColors.dotPoison ?? '#66dd88'
    case 'burn':
      return damageColors.dotBurn ?? '#ff9944'
    default:
      return damageColors.bleed
  }
}

interface DamageNumberProps {
  amount: number
  /** 50〜200＝%÷100。既定 100 */
  fontScalePercent?: number
  isCritical?: boolean
  isBleed?: boolean // 持続ダメージ（DOT）かどうか
  /** DOT の種別（既定の数値色に使用。省略時は bleed） */
  dotDebuffKind?: AttackDebuffKind
  /** DOT 時のみ。指定時は種別の既定色より優先（#RGB / #RRGGBB） */
  bleedColorOverride?: string
  angle?: number // 放射状の角度（度）
  distance?: number // 放射状の距離（px）
  id: number
  damageColors: DamageColorConfig
  popupKind?: DamagePopupKind
}

function DamageNumberImpl({
  amount,
  fontScalePercent = 100,
  isCritical = false,
  isBleed = false,
  dotDebuffKind = 'bleed',
  bleedColorOverride,
  angle = 0,
  distance = 0,
  id,
  damageColors,
  popupKind,
}: DamageNumberProps) {
  const color = useMemo(() => {
    const bleedHex =
      isBleed && bleedColorOverride && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(bleedColorOverride.trim())
        ? bleedColorOverride.trim()
        : null
    const dotBase = dotDebuffFallbackHex(dotDebuffKind, damageColors)
    return isBleed ? (bleedHex ?? dotBase) : (isCritical ? damageColors.critical : damageColors.normal)
  }, [isBleed, bleedColorOverride, dotDebuffKind, damageColors, isCritical])

  // 出血ダメージの場合は角度と距離からx, y座標を計算
  const bleedStyle = useMemo(() => {
    if (!isBleed) return undefined
    const angleRad = (angle * Math.PI) / 180
    const endX = Math.cos(angleRad) * distance
    const endY = Math.sin(angleRad) * distance
    // 中間位置も計算（アニメーション用）
    const midX = endX * 0.3
    const midY = endY * 0.3
    return {
      '--bleed-end-x': `${endX}px`,
      '--bleed-end-y': `${endY}px`,
      '--bleed-mid-x': `${midX}px`,
      '--bleed-mid-y': `${midY}px`,
    } as React.CSSProperties & {
      '--bleed-end-x': string
      '--bleed-end-y': string
      '--bleed-mid-x': string
      '--bleed-mid-y': string
    }
  }, [isBleed, angle, distance])

  // 色をRGBに変換してtext-shadowを生成
  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    let s = hex.replace(/^#/, '')
    if (s.length === 3) {
      s = `${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`
    }
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(s)
    return result
      ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
      : null
  }

  const rgb = useMemo(() => hexToRgb(color), [color])
  const effectivePopupKind: DamagePopupKind =
    popupKind ?? (isCritical ? 'critical' : 'normal')
  const useSvgOutlineText = !isBleed
  const textShadowStyle = rgb ? {
    color: color,
    textShadow: isBleed
      ? `0 1px 2px rgba(0, 0, 0, 0.82), 0 0 6px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.48)`
      : isCritical
        ? `0 1px 2px rgba(0, 0, 0, 0.92), 1px 0 0 rgba(0, 0, 0, 0.85), -1px 0 0 rgba(0, 0, 0, 0.85), 0 0 7px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.66), 0 0 15px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.48)`
        : `
          1px 0 0 #ffffff,
          -1px 0 0 #ffffff,
          0 1px 0 #ffffff,
          0 -1px 0 #ffffff,
          2px 0 0 #ffffff,
          -2px 0 0 #ffffff,
          0 2px 0 #ffffff,
          0 -2px 0 #ffffff,
          2px 2px 0 #ffffff,
          -2px 2px 0 #ffffff,
          2px -2px 0 #ffffff,
          -2px -2px 0 #ffffff,
          3px 0 0 #12428f,
          -3px 0 0 #12428f,
          0 3px 0 #12428f,
          0 -3px 0 #12428f,
          3px 3px 0 #12428f,
          -3px 3px 0 #12428f,
          3px -3px 0 #12428f,
          -3px -3px 0 #12428f,
          4px 0 0 #12428f,
          -4px 0 0 #12428f,
          0 4px 0 #12428f,
          0 -4px 0 #12428f
        `,
    filter: isBleed
      ? undefined
      : isCritical
        ? `drop-shadow(0 0 10px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.34))`
        : 'none'
  } : { color: color }

  const popupScale = Math.min(200, Math.max(50, Math.round(fontScalePercent))) / 100
  const amountLabel = String(amount)
  const rasterized = useMemo(
    () => (useSvgOutlineText ? getOrCreateRasterizedDamageText({ amountLabel, color, popupKind: effectivePopupKind }) : null),
    [useSvgOutlineText, amountLabel, color, effectivePopupKind]
  )

  return (
    <div
      className={`damage-number ${isCritical ? 'critical' : ''} ${isBleed ? 'bleed' : ''}`}
      key={id}
      data-damage={amount}
      style={{
        ...bleedStyle,
        ...(useSvgOutlineText ? {} : textShadowStyle),
        ['--damage-popup-font-scale' as string]: String(popupScale),
      }}
    >
      {useSvgOutlineText ? (
        <img
          className="damage-number-svg"
          width={rasterized?.width}
          height={rasterized?.height}
          src={rasterized?.src}
          alt=""
          aria-hidden
          draggable={false}
        />
      ) : (
        <>
          {amount}
        </>
      )}
    </div>
  )
}

export const DamageNumber = memo(DamageNumberImpl)

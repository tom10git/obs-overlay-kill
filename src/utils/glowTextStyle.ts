import type { CSSProperties } from 'react'

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim().replace(/^#/, '')
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16)
    const g = parseInt(raw[1] + raw[1], 16)
    const b = parseInt(raw[2] + raw[2], 16)
    if ([r, g, b].some((n) => Number.isNaN(n))) return null
    return { r, g, b }
  }
  const m = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(raw)
  if (!m) return null
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

function expandHexForCss(hex: string): string {
  const raw = hex.trim().replace(/^#/, '')
  if (raw.length === 3) {
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toLowerCase()
  }
  return hex.trim().startsWith('#') ? hex.trim().toLowerCase() : `#${raw.trim().toLowerCase()}`
}

/**
 * ダメージ・回復数値や MISS 表示など、16進カラーを前提にした発光テキスト用インラインスタイル
 */
export function glowTextStyleFromHex(hex: string, variant: 'heal' | 'miss' = 'heal'): CSSProperties {
  const normalized = expandHexForCss(hex)
  const rgb = parseHexRgb(normalized)
  if (!rgb) {
    return { color: hex.trim() }
  }
  const { r, g, b } = rgb

  if (variant === 'miss') {
    return {
      color: normalized,
      textShadow:
        `0 2px 0 rgba(${r}, ${g}, ${b}, 0.55),` +
        `0 0 12px rgba(${r}, ${g}, ${b}, 0.65),` +
        `0 0 20px rgba(${r}, ${g}, ${b}, 1),` +
        `2px 2px 8px rgba(0, 0, 0, 0.9)`,
      filter: `drop-shadow(0 0 12px rgba(${r}, ${g}, ${b}, 0.5))`,
    }
  }

  return {
    color: normalized,
    textShadow:
      `0 0 4px rgba(${r}, ${g}, ${b}, 0.9),` +
      `0 0 8px rgba(${r}, ${g}, ${b}, 0.8),` +
      `0 0 16px rgba(${r}, ${g}, ${b}, 0.7),` +
      `0 0 24px rgba(${r}, ${g}, ${b}, 0.6),` +
      `0 0 32px rgba(${r}, ${g}, ${b}, 0.5),` +
      `0 0 48px rgba(${r}, ${g}, ${b}, 0.4),` +
      `0 0 64px rgba(${r}, ${g}, ${b}, 0.3),` +
      `2px 2px 8px rgba(0, 0, 0, 0.9)`,
    filter: `drop-shadow(0 0 12px rgba(${r}, ${g}, ${b}, 0.5))`,
  }
}

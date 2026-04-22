/**
 * ノイズ屈折（SVG フィルタ）— Canvas アートの上に薄く重ねる
 */

import { useId } from 'react'
import type { TechniqueBurstArtParams } from '../../constants/techniqueEffectKinds'

export interface TechniqueBurstArtSvgProps {
  art: TechniqueBurstArtParams
}

export function TechniqueBurstArtSvg({ art }: TechniqueBurstArtSvgProps) {
  const rid = useId().replace(/:/g, '')
  const { seed, pattern: patternIndex, aux0, aux1 } = art
  const bf =
    0.014 +
    (seed % 19) * 0.001 +
    (patternIndex % 7) * 0.00032 +
    (aux0 % 13) * 0.00015 +
    (aux1 % 11) * 0.00012
  const scale = 3.5 + (seed % 11) + (aux0 % 5) * 0.35
  const turbSeed = (seed ^ patternIndex * 997 ^ aux0 * 17 ^ (aux1 << 1)) % 500
  const fid = `tefx-filt-${rid}`

  return (
    <svg className="tefx-layer tefx-art-svg" aria-hidden>
      <defs>
        <filter id={fid} x="-12%" y="-12%" width="124%" height="124%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency={`${bf} ${bf * 0.92}`}
            numOctaves="2"
            seed={String(turbSeed)}
            result="t"
          />
          <feDisplacementMap in="SourceGraphic" in2="t" scale={scale} />
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="rgba(255,255,255,0.035)" filter={`url(#${fid})`} />
    </svg>
  )
}

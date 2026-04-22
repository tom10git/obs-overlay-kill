/**
 * HPゲージ直上・ゲージ幅いっぱいの帯に載せる技発動演出（技ごとにプリセットが異なる）
 */

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { TechniqueEffectKind } from '../../constants/techniqueEffectKinds'
import {
  buildTechniqueBurstVisualStyles,
  getTechniqueEffectKind,
  getTechniqueBurstArtParams,
} from '../../constants/techniqueEffectKinds'
import { TechniqueBurstArtCanvas } from './TechniqueBurstArtCanvas'
import { TechniqueBurstArtSvg } from './TechniqueBurstArtSvg'
import './TechniqueEffectBurst.css'
import './TechniqueEffectBurst-finale-kinds.css'
import './TechniqueEffectBurst-extra.css'
import './TechniqueEffectBurst-kinds.css'
import './TechniqueEffectBurst-variants.css'

export interface TechniqueEffectBurstProps {
  techniqueName: string
  /** HPゲージと同寸の帯に入れるとき true（親の高さいっぱいに広げる） */
  fillGaugeBand?: boolean
  /** fillGaugeBand 時: ルーレット追加攻撃など、帯内でも技名を大きめに */
  largeBandTypography?: boolean
  /** largeBandTypography 時: 技名の相対スケール（50〜200＝%÷100。既定 100） */
  rouletteBandFontScalePercent?: number
  /**
   * fillGaugeBand かつ largeBandTypography でないとき（合わせ技成功の帯表示など）の技名スケール（50〜200%、既定 100）
   */
  gaugeBandCompactFontScalePercent?: number
  /** 成功時など、終盤にきらびやかな爆発フィニッシュを重ねる */
  finale?: boolean
  className?: string
}

function FinaleLayers({ kind, style }: { kind: TechniqueEffectKind; style?: CSSProperties }) {
  return (
    <div className={`tefx-finale tefx-finale--${kind}`} style={style} aria-hidden>
      <div className="tefx-layer tefx-finale__flash" />
      <div className="tefx-layer tefx-finale__burst" />
      <div className="tefx-layer tefx-finale__orbs" />
      <div className="tefx-layer tefx-finale__shards" />
      <div className="tefx-layer tefx-finale__glitter" />
      <div className="tefx-layer tefx-finale__ring-wrap">
        <div className="tefx-finale__ring" />
      </div>
    </div>
  )
}

function TefxCommonLayers({ kind }: { kind: TechniqueEffectKind }) {
  return (
    <div className={`tefx-common tefx-common--${kind}`} aria-hidden>
      <div className="tefx-common__vignette" />
      <div className="tefx-common__grid" />
      <div className="tefx-common__scan" />
      <div className="tefx-common__sparkles" />
      <div className="tefx-common__frame" />
      <div className="tefx-common__gloss" />
    </div>
  )
}

function KindLayers({ kind }: { kind: TechniqueEffectKind }) {
  const sig = <div className={`tefx-layer tefx-sig tefx-sig--${kind}`} aria-hidden />
  switch (kind) {
    case 'inferno':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-inferno-glow" aria-hidden />
          <div className="tefx-layer tefx-inferno-heat" aria-hidden />
          <div className="tefx-layer tefx-inferno-embers" aria-hidden />
          <div className="tefx-layer tefx-inferno-embers tefx-inferno-embers--late" aria-hidden />
          <div className="tefx-layer tefx-inferno-ripples" aria-hidden />
          <div className="tefx-layer tefx-inferno-ripples tefx-inferno-ripples--2" aria-hidden />
          <div className="tefx-layer tefx-inferno-tongues" aria-hidden />
        </>
      )
    case 'meteor':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-meteor-sky" aria-hidden />
          <div className="tefx-layer tefx-meteor-debris" aria-hidden />
          <div className="tefx-layer tefx-meteor-rock tefx-meteor-rock--1" aria-hidden />
          <div className="tefx-layer tefx-meteor-rock tefx-meteor-rock--2" aria-hidden />
          <div className="tefx-layer tefx-meteor-rock tefx-meteor-rock--3" aria-hidden />
          <div className="tefx-layer tefx-meteor-streak tefx-meteor-streak--a" aria-hidden />
          <div className="tefx-layer tefx-meteor-streak tefx-meteor-streak--b" aria-hidden />
          <div className="tefx-layer tefx-meteor-streak tefx-meteor-streak--c" aria-hidden />
          <div className="tefx-layer tefx-meteor-streak tefx-meteor-streak--d" aria-hidden />
          <div className="tefx-layer tefx-meteor-streak tefx-meteor-streak--e" aria-hidden />
          <div className="tefx-layer tefx-meteor-impact" aria-hidden />
          <div className="tefx-layer tefx-meteor-shockwave" aria-hidden />
          <div className="tefx-layer tefx-meteor-crater" aria-hidden />
        </>
      )
    case 'void':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-void-deep" aria-hidden />
          <div className="tefx-layer tefx-void-vortex" aria-hidden />
          <div className="tefx-layer tefx-void-rim" aria-hidden />
          <div className="tefx-layer tefx-void-rim tefx-void-rim--echo" aria-hidden />
          <div className="tefx-layer tefx-void-grains" aria-hidden />
          <div className="tefx-layer tefx-void-tendrils" aria-hidden />
        </>
      )
    case 'tempest':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-tempest-cloud" aria-hidden />
          <div className="tefx-layer tefx-tempest-rain" aria-hidden />
          <div className="tefx-layer tefx-tempest-fork" aria-hidden />
          <div className="tefx-layer tefx-tempest-fork tefx-tempest-fork--mirror" aria-hidden />
          <div className="tefx-layer tefx-tempest-bolt tefx-tempest-bolt--1" aria-hidden />
          <div className="tefx-layer tefx-tempest-bolt tefx-tempest-bolt--2" aria-hidden />
          <div className="tefx-layer tefx-tempest-bolt tefx-tempest-bolt--3" aria-hidden />
          <div className="tefx-layer tefx-tempest-bolt tefx-tempest-bolt--4" aria-hidden />
          <div className="tefx-layer tefx-tempest-bolt tefx-tempest-bolt--5" aria-hidden />
          <div className="tefx-layer tefx-tempest-bolt tefx-tempest-bolt--6" aria-hidden />
          <div className="tefx-layer tefx-tempest-bolt tefx-tempest-bolt--7" aria-hidden />
          <div className="tefx-layer tefx-tempest-inazuma" aria-hidden />
          <div className="tefx-layer tefx-tempest-afterglow" aria-hidden />
        </>
      )
    case 'glacier':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-glacier-fog" aria-hidden />
          <div className="tefx-layer tefx-glacier-snow" aria-hidden />
          <div className="tefx-layer tefx-glacier-shard tefx-glacier-shard--1" aria-hidden />
          <div className="tefx-layer tefx-glacier-shard tefx-glacier-shard--2" aria-hidden />
          <div className="tefx-layer tefx-glacier-shard tefx-glacier-shard--3" aria-hidden />
          <div className="tefx-layer tefx-glacier-shard tefx-glacier-shard--4" aria-hidden />
          <div className="tefx-layer tefx-glacier-shine" aria-hidden />
          <div className="tefx-layer tefx-glacier-prism" aria-hidden />
        </>
      )
    case 'plasma':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-plasma-field" aria-hidden />
          <div className="tefx-layer tefx-plasma-hex" aria-hidden />
          <div className="tefx-layer tefx-plasma-arc tefx-plasma-arc--a" aria-hidden />
          <div className="tefx-layer tefx-plasma-arc tefx-plasma-arc--b" aria-hidden />
          <div className="tefx-layer tefx-plasma-arc tefx-plasma-arc--c" aria-hidden />
          <div className="tefx-layer tefx-plasma-pulse" aria-hidden />
          <div className="tefx-layer tefx-plasma-surge" aria-hidden />
        </>
      )
    case 'radiance':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-radiance-bloom" aria-hidden />
          <div className="tefx-layer tefx-radiance-cross" aria-hidden />
          <div className="tefx-layer tefx-radiance-pillar tefx-radiance-pillar--l" aria-hidden />
          <div className="tefx-layer tefx-radiance-pillar tefx-radiance-pillar--c" aria-hidden />
          <div className="tefx-layer tefx-radiance-pillar tefx-radiance-pillar--r" aria-hidden />
          <div className="tefx-layer tefx-radiance-ring" aria-hidden />
          <div className="tefx-layer tefx-radiance-dust" aria-hidden />
        </>
      )
    case 'tremor':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-tremor-dust" aria-hidden />
          <div className="tefx-layer tefx-tremor-pebbles" aria-hidden />
          <div className="tefx-layer tefx-tremor-crack tefx-tremor-crack--1" aria-hidden />
          <div className="tefx-layer tefx-tremor-crack tefx-tremor-crack--2" aria-hidden />
          <div className="tefx-layer tefx-tremor-crack tefx-tremor-crack--3" aria-hidden />
          <div className="tefx-layer tefx-tremor-shock" aria-hidden />
          <div className="tefx-layer tefx-tremor-shock tefx-tremor-shock--2" aria-hidden />
        </>
      )
    case 'phantom':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-phantom-mist" aria-hidden />
          <div className="tefx-layer tefx-phantom-wisp" aria-hidden />
          <div className="tefx-layer tefx-phantom-orbs" aria-hidden />
          <div className="tefx-layer tefx-phantom-orbs tefx-phantom-orbs--2" aria-hidden />
          <div className="tefx-layer tefx-phantom-scan" aria-hidden />
          <div className="tefx-layer tefx-phantom-scan tefx-phantom-scan--reverse" aria-hidden />
        </>
      )
    case 'nova':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-nova-core" aria-hidden />
          <div className="tefx-layer tefx-nova-rays" aria-hidden />
          <div className="tefx-layer tefx-nova-rays tefx-nova-rays--ccw" aria-hidden />
          <div className="tefx-layer tefx-nova-flash" aria-hidden />
          <div className="tefx-layer tefx-nova-ring tefx-nova-ring--o" aria-hidden />
          <div className="tefx-layer tefx-nova-ring tefx-nova-ring--i" aria-hidden />
          <div className="tefx-layer tefx-nova-ring tefx-nova-ring--m" aria-hidden />
        </>
      )
  }
}

export function TechniqueEffectBurst({
  techniqueName,
  fillGaugeBand = false,
  largeBandTypography = false,
  rouletteBandFontScalePercent = 100,
  gaugeBandCompactFontScalePercent = 100,
  finale = false,
  className = '',
}: TechniqueEffectBurstProps) {
  const tefxRef = useRef<HTMLDivElement>(null)
  const [finalePortalTarget, setFinalePortalTarget] = useState<HTMLElement | null>(null)
  const kind = getTechniqueEffectKind(techniqueName)
  const burstVisual = useMemo(() => buildTechniqueBurstVisualStyles(techniqueName), [techniqueName])
  const burstArt = useMemo(() => getTechniqueBurstArtParams(techniqueName), [techniqueName])
  const slashMotif = useMemo(() => techniqueName.includes('斬'), [techniqueName])
  const isPhantom = kind === 'phantom'
  const bandLarge =
    fillGaugeBand && largeBandTypography ? ' tefx--fill-gauge-band-large-type' : ''
  const rouletteScale = Math.min(200, Math.max(50, Math.round(rouletteBandFontScalePercent))) / 100
  const compactScale = Math.min(200, Math.max(50, Math.round(gaugeBandCompactFontScalePercent))) / 100
  const bandFontStyle: CSSProperties | undefined = (() => {
    if (fillGaugeBand && largeBandTypography) {
      return { ['--tefx-roulette-band-font-scale' as string]: String(rouletteScale) }
    }
    if (fillGaugeBand && !largeBandTypography) {
      return { ['--tefx-gauge-band-compact-font-scale' as string]: String(compactScale) }
    }
    return undefined
  })()

  // フィニッシュ演出だけは、ゲージ形状マスク（hp-gauge-wrapper overflow: hidden）の外に出したい。
  // 可能なら hp-gauge-frame 直下へ portal して描画する（frame は overflow でクリップされない）。
  useLayoutEffect(() => {
    if (!finale) {
      setFinalePortalTarget(null)
      return
    }
    const el = tefxRef.current
    if (!el) return
    const frame = el.closest('.hp-gauge-frame') as HTMLElement | null
    setFinalePortalTarget(frame)
  }, [finale])

  return (
    <div
      className={`tefx-wrap${fillGaugeBand ? ' tefx-wrap--fill-gauge-band' : ''} ${className}`.trim()}
      aria-hidden
    >
      {/* フィニッシュ爆発はマスク（ゲージ形状）外にも飛び出させたいので、マスク対象(tefx)の外側に描画する */}
      {finale &&
        (finalePortalTarget
          ? createPortal(<FinaleLayers kind={kind} style={burstVisual.finale} />, finalePortalTarget)
          : <FinaleLayers kind={kind} style={burstVisual.finale} />)}
      <div
        className={`tefx tefx--${kind} tefx--pat-${burstArt.pattern}${slashMotif ? ' tefx--slash-motif' : ''}${fillGaugeBand ? ' tefx--fill-gauge-band' : ''}${bandLarge}`.trim()}
        style={{ ...burstVisual.root, ...bandFontStyle }}
        ref={tefxRef}
      >
        <KindLayers kind={kind} />
        {slashMotif && <div className="tefx-layer tefx-slash-cut" aria-hidden />}
        {slashMotif && <div className="tefx-layer tefx-slash-cut tefx-slash-cut--echo" aria-hidden />}
        <TechniqueBurstArtCanvas art={burstArt} effectKind={kind} techniqueName={techniqueName} />
        <TechniqueBurstArtSvg art={burstArt} />
        <div className="tefx-layer tefx-entropy" aria-hidden />
        <div className="tefx-layer tefx-distort" aria-hidden />
        <TefxCommonLayers kind={kind} />
        <div className="tefx__text-plane">
          {isPhantom ? (
            <div className="tefx__title-stack">
              <span className="tefx__phantom-echo">{techniqueName}</span>
              <p className="tefx__name">{techniqueName}</p>
            </div>
          ) : (
            <p className="tefx__name">{techniqueName}</p>
          )}
        </div>
      </div>
    </div>
  )
}

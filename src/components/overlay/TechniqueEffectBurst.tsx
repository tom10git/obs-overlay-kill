/**
 * HPゲージ直上・ゲージ幅いっぱいの帯に載せる技発動演出（技ごとにプリセットが異なる）
 */

import type { TechniqueEffectKind } from '../../constants/techniqueEffectKinds'
import { getTechniqueEffectKind } from '../../constants/techniqueEffectKinds'
import './TechniqueEffectBurst.css'
import './TechniqueEffectBurst-extra.css'
import './TechniqueEffectBurst-kinds.css'

export interface TechniqueEffectBurstProps {
  techniqueName: string
  /** HPゲージと同寸の帯に入れるとき true（親の高さいっぱいに広げる） */
  fillGaugeBand?: boolean
  /** fillGaugeBand 時: ルーレット追加攻撃など、帯内でも技名を大きめに */
  largeBandTypography?: boolean
  className?: string
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
          <div className="tefx-layer tefx-meteor-streak tefx-meteor-streak--a" aria-hidden />
          <div className="tefx-layer tefx-meteor-streak tefx-meteor-streak--b" aria-hidden />
          <div className="tefx-layer tefx-meteor-streak tefx-meteor-streak--c" aria-hidden />
          <div className="tefx-layer tefx-meteor-impact" aria-hidden />
          <div className="tefx-layer tefx-meteor-shockwave" aria-hidden />
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
          <div className="tefx-layer tefx-tempest-bolt tefx-tempest-bolt--1" aria-hidden />
          <div className="tefx-layer tefx-tempest-bolt tefx-tempest-bolt--2" aria-hidden />
          <div className="tefx-layer tefx-tempest-bolt tefx-tempest-bolt--3" aria-hidden />
          <div className="tefx-layer tefx-tempest-bolt tefx-tempest-bolt--4" aria-hidden />
          <div className="tefx-layer tefx-tempest-bolt tefx-tempest-bolt--5" aria-hidden />
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
  className = '',
}: TechniqueEffectBurstProps) {
  const kind = getTechniqueEffectKind(techniqueName)
  const isPhantom = kind === 'phantom'
  const bandLarge =
    fillGaugeBand && largeBandTypography ? ' tefx--fill-gauge-band-large-type' : ''

  return (
    <div
      className={`tefx tefx--${kind}${fillGaugeBand ? ' tefx--fill-gauge-band' : ''}${bandLarge} ${className}`.trim()}
      aria-hidden
    >
      <KindLayers kind={kind} />
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
  )
}

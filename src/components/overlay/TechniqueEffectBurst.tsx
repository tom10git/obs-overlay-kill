/**
 * HPゲージ直上・ゲージ幅いっぱいの帯に載せる技発動演出（技ごとにプリセットが異なる）
 */

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { TechniqueEffectKind } from '../../constants/techniqueEffectKinds'
import {
  MAGIC_TECHNIQUE_NAMES,
  SHOOTING_TECHNIQUE_NAMES,
  SLASH_TECHNIQUE_NAMES,
} from '../../constants/comboTechniqueNames'
import {
  buildTechniqueBurstVisualStyles,
  getTechniqueEffectKind,
  getTechniqueBurstArtParams,
} from '../../constants/techniqueEffectKinds'
import { TechniqueBurstArtCanvas } from './TechniqueBurstArtCanvas'
import { TechniqueBurstArtSvg } from './TechniqueBurstArtSvg'
import { SlashElementCanvas } from './SlashElementCanvas'
import { TechniqueEffectBurstCanvasLayer } from './TechniqueEffectBurstCanvasLayer'
import './TechniqueEffectBurst.css'
import './TechniqueEffectBurst-finale-kinds.css'
import './TechniqueEffectBurst-extra.css'
import './TechniqueEffectBurst-kinds.css'
import './TechniqueEffectBurst-kinds-more.css'
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
  /**
   * true のとき、Canvas 系の常時アニメを止めて静止画寄りにする。
   * 攻撃エフェクト（WebM/Canvas）と重なるとメインスレッド/デコードが詰まり「フリーズ→再開」に見えるため。
   */
  suppressContinuousCanvasAnimation?: boolean
  className?: string
}

type TechniqueNameType = 'slash' | 'magic' | 'shooting' | 'other'

const SLASH_NAME_SET = new Set<string>(SLASH_TECHNIQUE_NAMES)
const MAGIC_NAME_SET = new Set<string>(MAGIC_TECHNIQUE_NAMES)
const SHOOTING_NAME_SET = new Set<string>(SHOOTING_TECHNIQUE_NAMES)

function getTechniqueNameType(name: string): TechniqueNameType {
  const s = name.trim()
  // 雷鳴*（射撃名）は演出上スラッシュ扱いに寄せる
  if (SHOOTING_NAME_SET.has(s) && s.startsWith('雷鳴')) return 'slash'
  if (SLASH_NAME_SET.has(s)) return 'slash'
  if (MAGIC_NAME_SET.has(s)) return 'magic'
  if (SHOOTING_NAME_SET.has(s)) return 'shooting'
  return 'other'
}

type SlashVariant = 'default' | 'rush' | 'break' | 'cross' | 'fang'

function detectSlashVariant(name: string): SlashVariant {
  const s = name.trim()
  // 語尾の質感に合わせて“見せ方”を変える
  if (s.includes('クロス')) return 'cross'
  if (s.includes('ラッシュ')) return 'rush'
  if (s.includes('ブレイク')) return 'break'
  if (s.includes('牙')) return 'fang'
  // 追加語尾（カタカナ/英語風）
  if (s.includes('スプリット')) return 'break'
  if (s.includes('フィニッシュ')) return 'break'
  if (s.includes('ダブル') || s.includes('トリプル')) return 'rush'
  if (s.includes('エッジ')) return 'fang'
  // MH / 属性系の「溜め・解放」は破断寄り、居合・気刃は速度寄り
  if (s.includes('居合')) return 'rush'
  if (s.includes('気刃')) return 'rush'
  if (s.includes('溜め')) return 'break'
  if (s.includes('解放') || s.includes('零距離')) return 'break'
  if (s.includes('兜割')) return 'break'
  // 単漢字語尾（斬/断/裂/閃）は上の語尾より優先度を下げつつも差を出す
  if (s.endsWith('断')) return 'break'
  if (s.endsWith('裂')) return 'fang'
  if (s.endsWith('閃')) return 'rush'
  return 'default'
}

type SlashHead =
  | 'kurenai' // 紅刃
  | 'aoi' // 蒼刃
  | 'raijin' // 雷刃
  | 'kage' // 影刃
  | 'shiro' // 白刃
  | 'kuro' // 黒刃
  | 'tsuki' // 月刃
  | 'tora' // 虎刃
  | 'ryu' // 龍刃
  | 'kaze' // 風刃
  | 'blade' // ブレイド
  | 'shadow' // シャドウ
  | 'other'

function detectSlashHead(name: string): SlashHead {
  const s = name.trim()
  if (s.includes('紅刃')) return 'kurenai'
  if (s.includes('クリムゾン') || s.includes('インフェルノ')) return 'kurenai'
  if (s.includes('蒼刃')) return 'aoi'
  if (s.includes('アズール') || s.includes('フロスト')) return 'aoi'
  if (s.includes('雷刃')) return 'raijin'
  if (s.includes('ライジン') || s.includes('テンペスト')) return 'raijin'
  if (s.includes('影刃')) return 'kage'
  if (s.includes('白刃')) return 'shiro'
  if (s.includes('ホワイト')) return 'shiro'
  if (s.includes('黒刃')) return 'kuro'
  if (s.includes('ブラック')) return 'kuro'
  if (s.includes('ヴォイド')) return 'kuro'
  if (s.includes('月刃')) return 'tsuki'
  if (s.includes('ムーンライト')) return 'tsuki'
  if (s.includes('虎刃')) return 'tora'
  if (s.includes('龍刃')) return 'ryu'
  if (s.includes('ノヴァ')) return 'ryu'
  if (s.includes('風刃')) return 'kaze'
  if (s.includes('ウィンド')) return 'kaze'
  if (s.includes('ブレイド')) return 'blade'
  if (s.includes('シャドウ')) return 'shadow'
  if (s.includes('シャドー') || s.includes('ファントム')) return 'shadow'
  return 'other'
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

function KindLayers({
  kind,
  suppressKindFx = false,
}: {
  kind: TechniqueEffectKind
  suppressKindFx?: boolean
}) {
  const sig = <div className={`tefx-layer tefx-sig tefx-sig--${kind}`} aria-hidden />
  // 斬撃モチーフは「刃線が主役」。kind 固有の背景レイヤが混ざると筋/面が残って見えやすいので抑止する。
  if (suppressKindFx) return <>{sig}</>
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
    case 'aurora':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-aurora-field" aria-hidden />
          <div className="tefx-layer tefx-aurora-wave tefx-aurora-wave--a" aria-hidden />
          <div className="tefx-layer tefx-aurora-wave tefx-aurora-wave--b" aria-hidden />
          <div className="tefx-layer tefx-aurora-curtain tefx-aurora-curtain--1" aria-hidden />
          <div className="tefx-layer tefx-aurora-curtain tefx-aurora-curtain--2" aria-hidden />
          <div className="tefx-layer tefx-aurora-speck" aria-hidden />
        </>
      )
    case 'blossom':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-blossom-haze" aria-hidden />
          <div className="tefx-layer tefx-blossom-petal tefx-blossom-petal--1" aria-hidden />
          <div className="tefx-layer tefx-blossom-petal tefx-blossom-petal--2" aria-hidden />
          <div className="tefx-layer tefx-blossom-pollen" aria-hidden />
          <div className="tefx-layer tefx-blossom-rim" aria-hidden />
        </>
      )
    case 'circuit':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-circuit-back" aria-hidden />
          <div className="tefx-layer tefx-circuit-grid" aria-hidden />
          <div className="tefx-layer tefx-circuit-rain tefx-circuit-rain--s" aria-hidden />
          <div className="tefx-layer tefx-circuit-rain tefx-circuit-rain--f" aria-hidden />
          <div className="tefx-layer tefx-circuit-pulse" aria-hidden />
        </>
      )
    case 'mire':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-mire-deep" aria-hidden />
          <div className="tefx-layer tefx-mire-bubbles" aria-hidden />
          <div className="tefx-layer tefx-mire-ooze" aria-hidden />
          <div className="tefx-layer tefx-mire-fume" aria-hidden />
          <div className="tefx-layer tefx-mire-ring" aria-hidden />
        </>
      )
    case 'bloodtide':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-bloodtide-pool" aria-hidden />
          <div className="tefx-layer tefx-bloodtide-ripple tefx-bloodtide-ripple--1" aria-hidden />
          <div className="tefx-layer tefx-bloodtide-ripple tefx-bloodtide-ripple--2" aria-hidden />
          <div className="tefx-layer tefx-bloodtide-drip" aria-hidden />
          <div className="tefx-layer tefx-bloodtide-gloss" aria-hidden />
        </>
      )
    case 'dune':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-dune-sky" aria-hidden />
          <div className="tefx-layer tefx-dune-dune tefx-dune-dune--a" aria-hidden />
          <div className="tefx-layer tefx-dune-dune tefx-dune-dune--b" aria-hidden />
          <div className="tefx-layer tefx-dune-heat" aria-hidden />
          <div className="tefx-layer tefx-dune-grit" aria-hidden />
        </>
      )
    case 'sanctum':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-sanctum-vault" aria-hidden />
          <div className="tefx-layer tefx-sanctum-column tefx-sanctum-column--l" aria-hidden />
          <div className="tefx-layer tefx-sanctum-column tefx-sanctum-column--r" aria-hidden />
          <div className="tefx-layer tefx-sanctum-gold" aria-hidden />
          <div className="tefx-layer tefx-sanctum-ray" aria-hidden />
        </>
      )
    case 'canopy':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-canopy-mist" aria-hidden />
          <div className="tefx-layer tefx-canopy-leaf tefx-canopy-leaf--a" aria-hidden />
          <div className="tefx-layer tefx-canopy-leaf tefx-canopy-leaf--b" aria-hidden />
          <div className="tefx-layer tefx-canopy-vine" aria-hidden />
          <div className="tefx-layer tefx-canopy-dapple" aria-hidden />
        </>
      )
    case 'abyssal':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-abyssal-deep" aria-hidden />
          <div className="tefx-layer tefx-abyssal-bloom" aria-hidden />
          <div className="tefx-layer tefx-abyssal-kelp" aria-hidden />
          <div className="tefx-layer tefx-abyssal-spark" aria-hidden />
        </>
      )
    case 'cogwork':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-cogwork-smoke" aria-hidden />
          <div className="tefx-layer tefx-cogwork-gear tefx-cogwork-gear--a" aria-hidden />
          <div className="tefx-layer tefx-cogwork-gear tefx-cogwork-gear--b" aria-hidden />
          <div className="tefx-layer tefx-cogwork-brass" aria-hidden />
          <div className="tefx-layer tefx-cogwork-steam" aria-hidden />
        </>
      )
    case 'constellation':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-constel-field" aria-hidden />
          <div className="tefx-layer tefx-constel-line tefx-constel-line--1" aria-hidden />
          <div className="tefx-layer tefx-constel-line tefx-constel-line--2" aria-hidden />
          <div className="tefx-layer tefx-constel-star" aria-hidden />
        </>
      )
    case 'rustbound':
      return (
        <>
          {sig}
          <div className="tefx-layer tefx-rust-oxide" aria-hidden />
          <div className="tefx-layer tefx-rust-flake" aria-hidden />
          <div className="tefx-layer tefx-rust-drip" aria-hidden />
          <div className="tefx-layer tefx-rust-edge" aria-hidden />
        </>
      )
  }
}

/** 射撃タイプのみ: kind に加えた弾種の質感を軽く足す（色相・コントラだけ微調整） */
function detectShootingVisualProfile(name: string): string {
  const s = name.trim()
  if (/ブラックアウト|ホワイトノイズ|スモーク|黒翼/.test(s)) return 'tefx-shoot-tone-stealth'
  if (/エクスプロード|オーバードライブ|竜撃弾|竜熱|烈火/.test(s)) return 'tefx-shoot-tone-erupt'
  if (/ヘイル/.test(s)) return 'tefx-shoot-tone-frost'
  if (/フルオート|ラピッド|チェイン|スプレッド/.test(s)) return 'tefx-shoot-tone-rapid'
  if (/ロックオン|スナイプ/.test(s)) return 'tefx-shoot-tone-precise'
  if (/ハンター|スタンピード|マグナム|バスター/.test(s)) return 'tefx-shoot-tone-heavy'
  return ''
}

function TypeImpactLayers({ type }: { type: TechniqueNameType }) {
  if (type === 'shooting') {
    return (
      <>
        <div className="tefx-layer tefx-type-shooting-bang" aria-hidden />
        <div className="tefx-layer tefx-type-shooting-sparks" aria-hidden />
        <div className="tefx-layer tefx-type-shooting-flash" aria-hidden />
        <div className="tefx-layer tefx-type-shooting-tracer tefx-type-shooting-tracer--1" aria-hidden />
        <div className="tefx-layer tefx-type-shooting-tracer tefx-type-shooting-tracer--2" aria-hidden />
        <div className="tefx-layer tefx-type-shooting-tracer tefx-type-shooting-tracer--3" aria-hidden />
        <div className="tefx-layer tefx-type-shooting-impact" aria-hidden />
      </>
    )
  }

  if (type === 'magic') {
    return (
      <>
        <div className="tefx-layer tefx-type-magic-glitter" aria-hidden />
        <div className="tefx-layer tefx-type-magic-circle" aria-hidden />
        <div className="tefx-layer tefx-type-magic-runes" aria-hidden />
        <div className="tefx-layer tefx-type-magic-chant" aria-hidden />
        <div className="tefx-layer tefx-type-magic-pulse" aria-hidden />
      </>
    )
  }

  return null
}

export function TechniqueEffectBurst({
  techniqueName,
  fillGaugeBand = false,
  largeBandTypography = false,
  rouletteBandFontScalePercent = 100,
  gaugeBandCompactFontScalePercent = 100,
  finale = false,
  suppressContinuousCanvasAnimation = false,
  className = '',
}: TechniqueEffectBurstProps) {
  const tefxRef = useRef<HTMLDivElement>(null)
  const [finalePortalTarget, setFinalePortalTarget] = useState<HTMLElement | null>(null)
  const kind = getTechniqueEffectKind(techniqueName)
  const burstVisual = useMemo(() => buildTechniqueBurstVisualStyles(techniqueName), [techniqueName])
  const burstArt = useMemo(() => getTechniqueBurstArtParams(techniqueName), [techniqueName])
  const techniqueType = useMemo(() => getTechniqueNameType(techniqueName), [techniqueName])
  // SLASH_TECHNIQUE_NAMES 全般で DOM の tefx-slash-cut を出す
  const slashStyleActive = techniqueType === 'slash'
  const slashVariant = useMemo(() => (slashStyleActive ? detectSlashVariant(techniqueName) : 'default'), [
    slashStyleActive,
    techniqueName,
  ])
  const slashHead = useMemo(() => (slashStyleActive ? detectSlashHead(techniqueName) : 'other'), [
    slashStyleActive,
    techniqueName,
  ])
  const shootingToneClass = techniqueType === 'shooting' ? detectShootingVisualProfile(techniqueName) : ''
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
        className={`tefx tefx--${kind} tefx--type-${techniqueType}${shootingToneClass ? ` ${shootingToneClass}` : ''}${slashStyleActive ? ' tefx--slash-motif' : ''}${slashStyleActive ? ` tefx--slash-variant-${slashVariant}` : ''}${slashStyleActive ? ` tefx--slash-head-${slashHead}` : ''}${fillGaugeBand ? ' tefx--fill-gauge-band' : ''}${bandLarge}`.trim()}
        style={{ ...burstVisual.root, ...bandFontStyle }}
        ref={tefxRef}
      >
        <KindLayers kind={kind} suppressKindFx={slashStyleActive} />
        <TypeImpactLayers type={techniqueType} />
        {slashStyleActive && <div className="tefx-layer tefx-slash-cut" aria-hidden />}
        {slashStyleActive && <div className="tefx-layer tefx-slash-cut tefx-slash-cut--echo" aria-hidden />}
        {/* 斬撃モチーフ: 刃線だけだと「切ってる感」が薄いので火花/命中演出も重ねる */}
        {slashStyleActive && slashVariant === 'cross' && (
          <div className="tefx-layer tefx-slash-cut tefx-slash-cut--cross" aria-hidden />
        )}
        {slashStyleActive && slashVariant !== 'cross' && (
          <div className="tefx-layer tefx-slash-cut tefx-slash-cut--arc2" aria-hidden />
        )}
        {slashStyleActive && slashVariant === 'rush' && (
          <>
            <div className="tefx-layer tefx-slash-cut tefx-slash-cut--upper" aria-hidden />
            <div className="tefx-layer tefx-slash-cut tefx-slash-cut--lower" aria-hidden />
          </>
        )}
        {slashStyleActive && slashVariant === 'break' && (
          <>
            <div className="tefx-layer tefx-slash-cut tefx-slash-cut--drop" aria-hidden />
            <div className="tefx-layer tefx-slash-cut tefx-slash-cut--rise" aria-hidden />
          </>
        )}
        {slashStyleActive && slashVariant === 'fang' && (
          <div className="tefx-layer tefx-slash-cut tefx-slash-cut--rise" aria-hidden />
        )}
        {slashStyleActive && <div className="tefx-layer tefx-slash-sparks" aria-hidden />}
        {slashStyleActive && <div className="tefx-layer tefx-slash-impact-flash" aria-hidden />}
        {slashStyleActive && <div className="tefx-layer tefx-slash-impact-ring" aria-hidden />}
        {slashStyleActive && <div className="tefx-layer tefx-slash-impact-ring tefx-slash-impact-ring--echo" aria-hidden />}
        {slashStyleActive && <div className="tefx-layer tefx-slash-afterglow" aria-hidden />}
        {slashStyleActive && <div className="tefx-layer tefx-slash-aura" aria-hidden />}
        {slashStyleActive && <div className="tefx-layer tefx-slash-aura tefx-slash-aura--2" aria-hidden />}
        {slashStyleActive && <div className="tefx-layer tefx-slash-orbit" aria-hidden />}
        {slashStyleActive && (
          <SlashElementCanvas
            kind={kind}
            seed={burstArt.seed}
            slashHead={slashHead}
            forceReducedMotion={suppressContinuousCanvasAnimation}
          />
        )}
        {slashStyleActive && <div className="tefx-layer tefx-slash-rift" aria-hidden />}
        {slashStyleActive && <div className="tefx-layer tefx-slash-shards" aria-hidden />}
        {slashStyleActive && <div className="tefx-layer tefx-slash-burst" aria-hidden />}
        {slashStyleActive && <div className="tefx-layer tefx-slash-glitter" aria-hidden />}
        <TechniqueEffectBurstCanvasLayer
          techniqueName={techniqueName}
          kind={kind}
          suppressAmbient={suppressContinuousCanvasAnimation}
        />
        {/* 斬撃モチーフは放射線状の筋（radiance等）が邪魔になりやすいので、Canvas の kind 上乗せは抑止 */}
        <TechniqueBurstArtCanvas
          art={burstArt}
          effectKind={slashStyleActive ? undefined : kind}
          techniqueName={techniqueName}
          forceReducedMotion={suppressContinuousCanvasAnimation}
        />
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

/**
 * 設定UIの inputValues（フォーカス外し前のテキスト）を OverlayConfig に取り込む。
 * 各項目の onBlur 相当の変換に合わせる（保存漏れ防止）。
 */

import type { GaugeShapeConfig, OverlayConfig } from '../types/overlay'
import { DEFAULT_GAUGE_SHAPE } from './overlayConfig'

const GAUGE_SHAPE_FLUSH_META: {
  shapeKey: keyof GaugeShapeConfig
  min: number
  max: number
  int: boolean
}[] = [
  { shapeKey: 'skewDeg', min: -60, max: 60, int: false },
  { shapeKey: 'defaultBorderRadiusPx', min: 0, max: 200, int: true },
  { shapeKey: 'defaultBorderWhitePx', min: 0, max: 80, int: true },
  { shapeKey: 'defaultBorderGrayPx', min: 0, max: 160, int: true },
  { shapeKey: 'parallelogramBorderRadiusPx', min: 0, max: 80, int: true },
  { shapeKey: 'parallelogramBorderWhitePx', min: 0, max: 80, int: true },
  { shapeKey: 'parallelogramBorderGrayPx', min: 0, max: 160, int: true },
  { shapeKey: 'parallelogramFramePaddingPx', min: 0, max: 200, int: true },
]

function cloneConfig(base: OverlayConfig): OverlayConfig {
  return JSON.parse(JSON.stringify(base)) as OverlayConfig
}

/** 共通: 空・不正時は fallback、それ以外は int */
function flushInt(raw: string | undefined, emptyOrInvalidFallback: number): number | undefined {
  if (raw === undefined) return undefined
  const v = raw.trim()
  if (v === '' || Number.isNaN(parseInt(v, 10))) return emptyOrInvalidFallback
  const num = parseInt(v, 10)
  return Number.isNaN(num) ? emptyOrInvalidFallback : num
}

function flushFloat(raw: string | undefined, emptyFallback: number): number | undefined {
  if (raw === undefined) return undefined
  const v = raw.trim()
  if (v === '' || Number.isNaN(parseFloat(v))) return emptyFallback
  const num = parseFloat(v)
  return Number.isNaN(num) ? emptyFallback : num
}

export function mergePendingFieldInputs(base: OverlayConfig, pending: Record<string, string>): OverlayConfig {
  if (!pending || Object.keys(pending).length === 0) {
    return base
  }

  const draft = cloneConfig(base)
  const p = pending

  if (p['hp.max'] !== undefined) {
    const n = flushInt(p['hp.max'], 100)
    if (n !== undefined) draft.hp.max = Math.max(1, n)
  }
  if (p['hp.current'] !== undefined) {
    const v = p['hp.current'].trim()
    if (v === '' || Number.isNaN(parseInt(v, 10))) {
      draft.hp.current = 0
    } else {
      const num = parseInt(v, 10)
      if (!Number.isNaN(num)) draft.hp.current = Math.min(num, draft.hp.max)
    }
  }
  if (p['hp.gaugeCount'] !== undefined) {
    const n = flushInt(p['hp.gaugeCount'], 3)
    if (n !== undefined) draft.hp.gaugeCount = Math.max(1, n)
  }
  if (p['hp.x'] !== undefined) {
    const v = p['hp.x'].trim()
    if (v === '' || Number.isNaN(parseInt(v, 10))) draft.hp.x = 0
    else {
      const num = parseInt(v, 10)
      if (!Number.isNaN(num)) draft.hp.x = Math.min(10000, Math.max(-10000, num))
    }
  }
  if (p['hp.y'] !== undefined) {
    const v = p['hp.y'].trim()
    if (v === '' || Number.isNaN(parseInt(v, 10))) draft.hp.y = 0
    else {
      const num = parseInt(v, 10)
      if (!Number.isNaN(num)) draft.hp.y = Math.min(10000, Math.max(-10000, num))
    }
  }
  if (p['hp.width'] !== undefined) {
    const v = p['hp.width'].trim()
    if (v === '' || Number.isNaN(parseInt(v, 10))) draft.hp.width = 800
    else {
      const num = parseInt(v, 10)
      if (!Number.isNaN(num)) draft.hp.width = Math.min(8000, Math.max(40, num))
    }
  }
  if (p['hp.height'] !== undefined) {
    const v = p['hp.height'].trim()
    if (v === '' || Number.isNaN(parseInt(v, 10))) draft.hp.height = 60
    else {
      const num = parseInt(v, 10)
      if (!Number.isNaN(num)) draft.hp.height = Math.min(800, Math.max(12, num))
    }
  }
  if (p['hp.rouletteBandTechniqueFontScalePercent'] !== undefined) {
    const v = p['hp.rouletteBandTechniqueFontScalePercent'].trim()
    if (v === '' || Number.isNaN(parseInt(v, 10))) draft.hp.rouletteBandTechniqueFontScalePercent = 100
    else {
      const num = parseInt(v, 10)
      if (!Number.isNaN(num)) draft.hp.rouletteBandTechniqueFontScalePercent = Math.min(200, Math.max(50, num))
    }
  }
  if (p['hp.roulettePanelFontScalePercent'] !== undefined) {
    const v = p['hp.roulettePanelFontScalePercent'].trim()
    if (v === '' || Number.isNaN(parseInt(v, 10))) draft.hp.roulettePanelFontScalePercent = 100
    else {
      const num = parseInt(v, 10)
      if (!Number.isNaN(num)) draft.hp.roulettePanelFontScalePercent = Math.min(200, Math.max(50, num))
    }
  }
  if (p['hp.rouletteOffsetX'] !== undefined) {
    const v = p['hp.rouletteOffsetX'].trim()
    if (v === '' || Number.isNaN(parseInt(v, 10))) draft.hp.rouletteOffsetX = 0
    else {
      const num = parseInt(v, 10)
      if (!Number.isNaN(num)) draft.hp.rouletteOffsetX = Math.min(10000, Math.max(-10000, num))
    }
  }
  if (p['hp.rouletteOffsetY'] !== undefined) {
    const v = p['hp.rouletteOffsetY'].trim()
    if (v === '' || Number.isNaN(parseInt(v, 10))) draft.hp.rouletteOffsetY = 0
    else {
      const num = parseInt(v, 10)
      if (!Number.isNaN(num)) draft.hp.rouletteOffsetY = Math.min(10000, Math.max(-10000, num))
    }
  }

  if (p['attack.damageMin'] !== undefined) {
    const n = Number(p['attack.damageMin'].trim())
    if (!Number.isNaN(n) && n >= 1) draft.attack.damageMin = n
  }
  if (p['attack.damageMax'] !== undefined) {
    const n = Number(p['attack.damageMax'].trim())
    if (!Number.isNaN(n) && n >= 1) draft.attack.damageMax = n
  }
  if (p['attack.damageRandomStep'] !== undefined) {
    const n = Number(p['attack.damageRandomStep'].trim())
    if (!Number.isNaN(n) && n >= 1) draft.attack.damageRandomStep = Math.floor(n)
  }
  if (p['attack.damage'] !== undefined) {
    const v = p['attack.damage'].trim()
    if (v === '' || Number.isNaN(parseInt(v, 10))) draft.attack.damage = 10
    else {
      const num = parseInt(v, 10)
      if (!Number.isNaN(num) && num >= 1) draft.attack.damage = num
    }
  }
  if (p['attack.missProbability'] !== undefined) {
    const v = p['attack.missProbability'].trim()
    if (v === '' || Number.isNaN(parseFloat(v))) draft.attack.missProbability = 0
    else {
      const num = parseFloat(v)
      if (!Number.isNaN(num)) draft.attack.missProbability = num
    }
  }
  if (p['attack.missSoundVolume'] !== undefined) {
    const n = flushFloat(p['attack.missSoundVolume'], 0.7)
    if (n !== undefined) draft.attack.missSoundVolume = Math.min(1, Math.max(0, n))
  }
  if (p['attack.criticalProbability'] !== undefined) {
    const v = p['attack.criticalProbability'].trim()
    if (v === '' || Number.isNaN(parseFloat(v))) draft.attack.criticalProbability = 0
    else {
      const num = parseFloat(v)
      if (!Number.isNaN(num)) draft.attack.criticalProbability = num
    }
  }
  if (p['attack.criticalMultiplier'] !== undefined) {
    const v = p['attack.criticalMultiplier'].trim()
    if (v === '' || Number.isNaN(parseFloat(v))) draft.attack.criticalMultiplier = 2.0
    else {
      const num = parseFloat(v)
      if (!Number.isNaN(num) && num >= 1) draft.attack.criticalMultiplier = num
    }
  }
  if (p['attack.bleedProbability'] !== undefined) {
    const v = p['attack.bleedProbability'].trim()
    if (v === '' || Number.isNaN(parseFloat(v))) draft.attack.bleedProbability = 0
    else {
      const num = parseFloat(v)
      if (!Number.isNaN(num)) draft.attack.bleedProbability = Math.min(100, Math.max(0, num))
    }
  }
  if (p['attack.bleedDamage'] !== undefined) {
    const n = flushInt(p['attack.bleedDamage'], 5)
    if (n !== undefined) draft.attack.bleedDamage = Math.max(1, n)
  }
  if (p['attack.bleedDuration'] !== undefined) {
    const n = flushInt(p['attack.bleedDuration'], 10)
    if (n !== undefined) draft.attack.bleedDuration = Math.max(1, n)
  }
  if (p['attack.bleedInterval'] !== undefined) {
    const v = p['attack.bleedInterval'].trim()
    if (v === '' || Number.isNaN(parseFloat(v))) draft.attack.bleedInterval = 1
    else {
      const num = parseFloat(v)
      if (!Number.isNaN(num)) draft.attack.bleedInterval = Math.max(0.1, num)
    }
  }
  if (p['attack.bleedSoundVolume'] !== undefined) {
    const n = flushFloat(p['attack.bleedSoundVolume'], 0.7)
    if (n !== undefined) draft.attack.bleedSoundVolume = Math.min(1, Math.max(0, n))
  }
  if (p['attack.soundVolume'] !== undefined) {
    const n = flushFloat(p['attack.soundVolume'], 0.7)
    if (n !== undefined) draft.attack.soundVolume = Math.min(1, Math.max(0, n))
  }
  if (p['attack.survivalHp1Probability'] !== undefined) {
    const v = p['attack.survivalHp1Probability'].trim()
    if (v === '' || Number.isNaN(parseFloat(v))) draft.attack.survivalHp1Probability = 30
    else {
      const num = parseFloat(v)
      if (!Number.isNaN(num)) draft.attack.survivalHp1Probability = Math.min(100, Math.max(0, num))
    }
  }

  if (p['heal.healAmount'] !== undefined) {
    const n = flushInt(p['heal.healAmount'], 20)
    if (n !== undefined) draft.heal.healAmount = n
  }
  if (p['heal.healMin'] !== undefined) {
    const n = flushInt(p['heal.healMin'], 10)
    if (n !== undefined) draft.heal.healMin = n
  }
  if (p['heal.healMax'] !== undefined) {
    const n = flushInt(p['heal.healMax'], 30)
    if (n !== undefined) draft.heal.healMax = n
  }
  if (p['heal.healRandomStep'] !== undefined) {
    const n = Number(p['heal.healRandomStep'].trim())
    if (!Number.isNaN(n) && n >= 1) draft.heal.healRandomStep = Math.floor(n)
  }
  if (p['heal.soundVolume'] !== undefined) {
    const n = flushFloat(p['heal.soundVolume'], 0.7)
    if (n !== undefined) draft.heal.soundVolume = Math.min(1, Math.max(0, n))
  }

  if (p['retry.streamerHealAmount'] !== undefined) {
    const n = Number(p['retry.streamerHealAmount'].trim())
    if (!Number.isNaN(n) && n >= 1) draft.retry.streamerHealAmount = n
  }
  if (p['retry.streamerHealMin'] !== undefined) {
    const n = Number(p['retry.streamerHealMin'].trim())
    if (!Number.isNaN(n) && n >= 1) draft.retry.streamerHealMin = n
  }
  if (p['retry.streamerHealMax'] !== undefined) {
    const n = Number(p['retry.streamerHealMax'].trim())
    if (!Number.isNaN(n) && n >= 1) draft.retry.streamerHealMax = n
  }
  if (p['retry.streamerHealRandomStep'] !== undefined) {
    const n = Number(p['retry.streamerHealRandomStep'].trim())
    if (!Number.isNaN(n) && n >= 1) draft.retry.streamerHealRandomStep = Math.floor(n)
  }
  if (p['retry.soundVolume'] !== undefined) {
    const n = flushFloat(p['retry.soundVolume'], 0.7)
    if (n !== undefined) draft.retry.soundVolume = Math.min(1, Math.max(0, n))
  }

  if (p['animation.duration'] !== undefined) {
    const n = flushInt(p['animation.duration'], 500)
    if (n !== undefined) draft.animation.duration = Math.max(0, n)
  }

  if (p['display.fontSize'] !== undefined) {
    const n = flushInt(p['display.fontSize'], 24)
    if (n !== undefined) draft.display.fontSize = Math.max(1, n)
  }
  if (p['display.damageHealPopupFontScalePercent'] !== undefined) {
    const v = p['display.damageHealPopupFontScalePercent'].trim()
    if (v === '' || Number.isNaN(parseInt(v, 10))) draft.display.damageHealPopupFontScalePercent = 100
    else {
      const num = parseInt(v, 10)
      if (!Number.isNaN(num)) draft.display.damageHealPopupFontScalePercent = Math.min(200, Math.max(50, num))
    }
  }
  if (p['display.overlayBannerFontScalePercent'] !== undefined) {
    const v = p['display.overlayBannerFontScalePercent'].trim()
    if (v === '' || Number.isNaN(parseInt(v, 10))) draft.display.overlayBannerFontScalePercent = 100
    else {
      const num = parseInt(v, 10)
      if (!Number.isNaN(num)) draft.display.overlayBannerFontScalePercent = Math.min(200, Math.max(50, num))
    }
  }

  for (const { shapeKey, min, max, int } of GAUGE_SHAPE_FLUSH_META) {
    const key = `display.gaugeShape.${String(shapeKey)}`
    if (p[key] === undefined) continue
    const raw = p[key].trim()
    const fallback = DEFAULT_GAUGE_SHAPE[shapeKey]
    if (raw === '') {
      draft.display.gaugeShape[shapeKey] = fallback
      continue
    }
    const num = int ? Math.round(parseFloat(raw)) : parseFloat(raw)
    if (!Number.isFinite(num)) {
      draft.display.gaugeShape[shapeKey] = fallback
      continue
    }
    draft.display.gaugeShape[shapeKey] = int
      ? (Math.min(max, Math.max(min, num)) as GaugeShapeConfig[typeof shapeKey])
      : (Math.min(max, Math.max(min, Math.round(num * 1000) / 1000)) as GaugeShapeConfig[typeof shapeKey])
  }

  if (p['zeroHpSound.volume'] !== undefined) {
    const n = flushFloat(p['zeroHpSound.volume'], 0.7)
    if (n !== undefined) draft.zeroHpSound.volume = Math.min(1, Math.max(0, n))
  }

  if (p['zeroHpEffect.duration'] !== undefined) {
    const v = p['zeroHpEffect.duration'].trim()
    if (v === '' || Number.isNaN(parseInt(v, 10))) draft.zeroHpEffect.duration = 2000
    else {
      const num = parseInt(v, 10)
      if (!Number.isNaN(num)) draft.zeroHpEffect.duration = Math.max(100, num)
    }
  }

  if (p['obsCaptureGuide.insetPx'] !== undefined) {
    const n = flushInt(p['obsCaptureGuide.insetPx'], draft.obsCaptureGuide.insetPx)
    if (n !== undefined) draft.obsCaptureGuide.insetPx = Math.min(400, Math.max(0, n))
  }

  if (p['pvp.viewerMaxHp'] !== undefined) {
    const v = p['pvp.viewerMaxHp'].trim()
    const num = v === '' ? 100 : parseInt(v, 10)
    if (!Number.isNaN(num) && num >= 1) draft.pvp.viewerMaxHp = num
  }

  if (p['pvp.streamerHealOnAttackProbability'] !== undefined) {
    const num = Number(p['pvp.streamerHealOnAttackProbability'].trim())
    if (!Number.isNaN(num) && num >= 0 && num <= 100) draft.pvp.streamerHealOnAttackProbability = num
  }
  if (p['pvp.streamerHealOnAttackMin'] !== undefined) {
    const num = Number(p['pvp.streamerHealOnAttackMin'].trim())
    if (!Number.isNaN(num) && num >= 1) draft.pvp.streamerHealOnAttackMin = num
  }
  if (p['pvp.streamerHealOnAttackMax'] !== undefined) {
    const num = Number(p['pvp.streamerHealOnAttackMax'].trim())
    if (!Number.isNaN(num) && num >= 1) draft.pvp.streamerHealOnAttackMax = num
  }
  if (p['pvp.streamerHealOnAttackRandomStep'] !== undefined) {
    const num = Number(p['pvp.streamerHealOnAttackRandomStep'].trim())
    if (!Number.isNaN(num) && num >= 1) draft.pvp.streamerHealOnAttackRandomStep = Math.floor(num)
  }
  if (p['pvp.streamerHealOnAttackAmount'] !== undefined) {
    const num = Number(p['pvp.streamerHealOnAttackAmount'].trim())
    if (!Number.isNaN(num) && num >= 1) draft.pvp.streamerHealOnAttackAmount = num
  }

  const vva = draft.pvp.viewerVsViewerAttack
  if (p['pvp.viewerVsViewerAttack.damageMin'] !== undefined) {
    const num = Number(p['pvp.viewerVsViewerAttack.damageMin'].trim())
    if (!Number.isNaN(num) && num >= 1) vva.damageMin = num
  }
  if (p['pvp.viewerVsViewerAttack.damageMax'] !== undefined) {
    const num = Number(p['pvp.viewerVsViewerAttack.damageMax'].trim())
    if (!Number.isNaN(num) && num >= 1) vva.damageMax = num
  }
  if (p['pvp.viewerVsViewerAttack.damageRandomStep'] !== undefined) {
    const num = Number(p['pvp.viewerVsViewerAttack.damageRandomStep'].trim())
    if (!Number.isNaN(num) && num >= 1) vva.damageRandomStep = Math.floor(num)
  }
  if (p['pvp.viewerVsViewerAttack.damage'] !== undefined) {
    const num = Number(p['pvp.viewerVsViewerAttack.damage'].trim())
    vva.damage = !Number.isNaN(num) && num >= 1 ? num : 10
  }

  if (p['pvp.strengthBuffDuration'] !== undefined) {
    const num = Number(p['pvp.strengthBuffDuration'].trim())
    draft.pvp.strengthBuffDuration = !Number.isNaN(num) && num >= 1 ? num : 300
  }

  if (p['pvp.viewerHealAmount'] !== undefined) {
    const num = Number(p['pvp.viewerHealAmount'].trim())
    if (!Number.isNaN(num) && num >= 1) draft.pvp.viewerHealAmount = num
  }
  if (p['pvp.viewerHealMin'] !== undefined) {
    const num = Number(p['pvp.viewerHealMin'].trim())
    if (!Number.isNaN(num) && num >= 1) draft.pvp.viewerHealMin = num
  }
  if (p['pvp.viewerHealMax'] !== undefined) {
    const num = Number(p['pvp.viewerHealMax'].trim())
    if (!Number.isNaN(num) && num >= 1) draft.pvp.viewerHealMax = num
  }
  if (p['pvp.viewerHealRandomStep'] !== undefined) {
    const num = Number(p['pvp.viewerHealRandomStep'].trim())
    if (!Number.isNaN(num) && num >= 1) draft.pvp.viewerHealRandomStep = Math.floor(num)
  }

  const sa = draft.pvp.streamerAttack
  if (p['pvp.streamerAttack.damageMin'] !== undefined) {
    const num = Number(p['pvp.streamerAttack.damageMin'].trim())
    if (!Number.isNaN(num) && num >= 1) sa.damageMin = num
  }
  if (p['pvp.streamerAttack.damageMax'] !== undefined) {
    const num = Number(p['pvp.streamerAttack.damageMax'].trim())
    if (!Number.isNaN(num) && num >= 1) sa.damageMax = num
  }
  if (p['pvp.streamerAttack.damageRandomStep'] !== undefined) {
    const num = Number(p['pvp.streamerAttack.damageRandomStep'].trim())
    if (!Number.isNaN(num) && num >= 1) sa.damageRandomStep = Math.floor(num)
  }
  if (p['pvp.streamerAttack.damage'] !== undefined) {
    const num = Number(p['pvp.streamerAttack.damage'].trim())
    sa.damage = !Number.isNaN(num) && num >= 1 ? num : sa.damage
  }
  if (p['pvp.streamerAttack.missProbability'] !== undefined) {
    const num = Number(p['pvp.streamerAttack.missProbability'].trim())
    sa.missProbability =
      !Number.isNaN(num) && num >= 0 && num <= 100 ? num : sa.missProbability
  }
  if (p['pvp.streamerAttack.criticalProbability'] !== undefined) {
    const num = Number(p['pvp.streamerAttack.criticalProbability'].trim())
    sa.criticalProbability =
      !Number.isNaN(num) && num >= 0 && num <= 100 ? num : sa.criticalProbability
  }
  if (p['pvp.streamerAttack.criticalMultiplier'] !== undefined) {
    const num = Number(p['pvp.streamerAttack.criticalMultiplier'].trim())
    sa.criticalMultiplier = !Number.isNaN(num) && num >= 1 ? num : sa.criticalMultiplier
  }
  if (p['pvp.streamerAttack.survivalHp1Probability'] !== undefined) {
    const num = Number(p['pvp.streamerAttack.survivalHp1Probability'].trim())
    sa.survivalHp1Probability =
      !Number.isNaN(num) && num >= 0 && num <= 100 ? num : sa.survivalHp1Probability
  }

  if (p['pvp.viewerFinishingMoveProbability'] !== undefined) {
    const v = p['pvp.viewerFinishingMoveProbability'].trim()
    const num = v === '' ? 0.01 : parseFloat(v)
    if (!Number.isNaN(num) && num >= 0 && num <= 100) {
      draft.pvp.viewerFinishingMoveProbability = Math.round(num * 100) / 100
    }
  }
  if (p['pvp.viewerFinishingMoveMultiplier'] !== undefined) {
    const v = p['pvp.viewerFinishingMoveMultiplier'].trim()
    const num = v === '' ? 10 : parseFloat(v)
    if (!Number.isNaN(num) && num >= 1) draft.pvp.viewerFinishingMoveMultiplier = num
  }

  const clampPct = (n: number) => Math.min(100, Math.max(0, n))
  if (p['attack.testPanelSimulation.comboTriggerPercent'] !== undefined) {
    const v = p['attack.testPanelSimulation.comboTriggerPercent'].trim()
    const cur = draft.attack.testPanelSimulation.comboTriggerPercent
    const num = v === '' || Number.isNaN(parseFloat(v)) ? cur : parseFloat(v)
    if (!Number.isNaN(num)) {
      draft.attack.testPanelSimulation = {
        ...draft.attack.testPanelSimulation,
        comboTriggerPercent: clampPct(num),
      }
    }
  }
  if (p['attack.testPanelSimulation.rouletteTriggerPercent'] !== undefined) {
    const v = p['attack.testPanelSimulation.rouletteTriggerPercent'].trim()
    const cur = draft.attack.testPanelSimulation.rouletteTriggerPercent
    const num = v === '' || Number.isNaN(parseFloat(v)) ? cur : parseFloat(v)
    if (!Number.isNaN(num)) {
      draft.attack.testPanelSimulation = {
        ...draft.attack.testPanelSimulation,
        rouletteTriggerPercent: clampPct(num),
      }
    }
  }
  if (p['attack.comboTechniqueDurationSec'] !== undefined) {
    const v = p['attack.comboTechniqueDurationSec'].trim()
    const cur = draft.attack.comboTechniqueDurationSec
    const num = v === '' || Number.isNaN(parseInt(v, 10)) ? cur : parseInt(v, 10)
    if (!Number.isNaN(num)) {
      const clamped = Math.min(300, Math.max(3, num))
      draft.attack.comboTechniqueDurationSec = clamped
    }
  }
  if (p['attack.comboTechniqueResultFontScalePercent'] !== undefined) {
    const v = p['attack.comboTechniqueResultFontScalePercent'].trim()
    if (v === '' || Number.isNaN(parseInt(v, 10))) draft.attack.comboTechniqueResultFontScalePercent = 100
    else {
      const num = parseInt(v, 10)
      if (!Number.isNaN(num)) draft.attack.comboTechniqueResultFontScalePercent = Math.min(200, Math.max(50, num))
    }
  }
  if (p['attack.comboTechniqueChallengeFontScalePercent'] !== undefined) {
    const v = p['attack.comboTechniqueChallengeFontScalePercent'].trim()
    if (v === '' || Number.isNaN(parseInt(v, 10))) draft.attack.comboTechniqueChallengeFontScalePercent = 100
    else {
      const num = parseInt(v, 10)
      if (!Number.isNaN(num)) draft.attack.comboTechniqueChallengeFontScalePercent = Math.min(200, Math.max(50, num))
    }
  }

  if (p['attack.testPanelSimulation.rouletteSuccessPercent'] !== undefined) {
    const v = p['attack.testPanelSimulation.rouletteSuccessPercent'].trim()
    const cur = draft.attack.testPanelSimulation.rouletteSuccessPercent
    const num = v === '' || Number.isNaN(parseFloat(v)) ? cur : parseFloat(v)
    if (!Number.isNaN(num)) {
      draft.attack.testPanelSimulation = {
        ...draft.attack.testPanelSimulation,
        rouletteSuccessPercent: clampPct(num),
      }
    }
  }

  return draft
}

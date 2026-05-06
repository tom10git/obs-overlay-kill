/**
 * オーバーレイ設定ファイルの読み込みと保存
 */

import type {
  AttackBleedVariant,
  AttackDebuffKind,
  ComboRouletteOverlayVisual,
  GaugeDesign,
  GaugeShapeConfig,
  OverlayConfig,
  TestPanelAttackSimulationConfig,
} from '../types/overlay'
import { logger } from '../lib/logger'
import { isValidUrl, isInRange, isValidLength } from './security'
import { sanitizeStrengthBuffChatTemplates } from './messageTemplate'
import { COMBO_TECHNIQUE_PREFIX } from '../constants/comboTechnique'

/** 確率以外の数値項目の上限（上限を設けないため十分大きな値） */
const MAX_NUM = 999999

/** ゲージ枠のデフォルト形状（HPGauge.css 従来値に相当） */
export const DEFAULT_GAUGE_SHAPE: GaugeShapeConfig = {
  skewDeg: 11,
  defaultBorderRadiusPx: 28,
  defaultBorderWhitePx: 6,
  defaultBorderGrayPx: 12,
  parallelogramBorderRadiusPx: 4,
  parallelogramBorderWhitePx: 4,
  parallelogramBorderGrayPx: 8,
  parallelogramFramePaddingPx: 12,
}

function sanitizeGaugeShapeField(
  raw: unknown,
  min: number,
  max: number,
  fallback: number,
  round: boolean
): number {
  if (raw === undefined || raw === null || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  const x = round ? Math.round(n) : Math.round(n * 1000) / 1000
  return Math.min(max, Math.max(min, x))
}

const DEFAULT_TEST_PANEL_SIMULATION: TestPanelAttackSimulationConfig = {
  overkillOnZeroHp: true,
  comboChanceEnabled: true,
  comboTriggerPercent: 30,
  rouletteBonusEnabled: true,
  rouletteTriggerPercent: 40,
  rouletteSuccessPercent: 50,
}

function sanitizeComboRouletteVisual(raw: unknown): ComboRouletteOverlayVisual {
  if (raw === 'glassCanvas') return 'glassCanvas'
  if (raw === 'slashArc') return 'slashArc'
  return 'webm'
}

function sanitizeTestPanelSimulation(
  simRaw: unknown,
  legacyTest?: Record<string, unknown>,
): TestPanelAttackSimulationConfig {
  const raw = (simRaw as Record<string, unknown> | undefined) || {}
  const leg = legacyTest || {}
  const legOverkill =
    typeof leg.overkillOnTestAttack === 'boolean' ? (leg.overkillOnTestAttack as boolean) : undefined
  const legComboEn =
    typeof leg.simulateComboOnTestAttack === 'boolean'
      ? (leg.simulateComboOnTestAttack as boolean)
      : undefined
  const legComboPct = isInRange(Number(leg.comboTriggerPercent), 0, 100)
    ? Number(leg.comboTriggerPercent)
    : undefined
  const legRbEn =
    typeof leg.simulateRouletteOnTestAttack === 'boolean'
      ? (leg.simulateRouletteOnTestAttack as boolean)
      : undefined
  const legRbTrig = isInRange(Number(leg.rouletteTriggerPercent), 0, 100)
    ? Number(leg.rouletteTriggerPercent)
    : undefined
  const legRbSucc = isInRange(Number(leg.rouletteSuccessPercent), 0, 100)
    ? Number(leg.rouletteSuccessPercent)
    : undefined

  return {
    overkillOnZeroHp:
      typeof raw.overkillOnZeroHp === 'boolean' ? raw.overkillOnZeroHp : legOverkill ?? DEFAULT_TEST_PANEL_SIMULATION.overkillOnZeroHp,
    comboChanceEnabled:
      typeof raw.comboChanceEnabled === 'boolean'
        ? raw.comboChanceEnabled
        : legComboEn ?? DEFAULT_TEST_PANEL_SIMULATION.comboChanceEnabled,
    comboTriggerPercent: isInRange(Number(raw.comboTriggerPercent), 0, 100)
      ? Number(raw.comboTriggerPercent) || DEFAULT_TEST_PANEL_SIMULATION.comboTriggerPercent
      : legComboPct ?? DEFAULT_TEST_PANEL_SIMULATION.comboTriggerPercent,
    rouletteBonusEnabled:
      typeof raw.rouletteBonusEnabled === 'boolean'
        ? raw.rouletteBonusEnabled
        : legRbEn ?? DEFAULT_TEST_PANEL_SIMULATION.rouletteBonusEnabled,
    rouletteTriggerPercent: isInRange(Number(raw.rouletteTriggerPercent), 0, 100)
      ? Number(raw.rouletteTriggerPercent) || DEFAULT_TEST_PANEL_SIMULATION.rouletteTriggerPercent
      : legRbTrig ?? DEFAULT_TEST_PANEL_SIMULATION.rouletteTriggerPercent,
    rouletteSuccessPercent: isInRange(Number(raw.rouletteSuccessPercent), 0, 100)
      ? Number(raw.rouletteSuccessPercent) || DEFAULT_TEST_PANEL_SIMULATION.rouletteSuccessPercent
      : legRbSucc ?? DEFAULT_TEST_PANEL_SIMULATION.rouletteSuccessPercent,
  }
}

const DEFAULT_CONFIG: OverlayConfig = {
  hp: {
    max: 100,
    current: 100,
    gaugeCount: 3,
    x: 0,
    y: 0,
    width: 800,
    height: 60,
    rouletteBandTechniqueFontScalePercent: 100,
    roulettePanelFontScalePercent: 100,
    rouletteOffsetX: 0,
    rouletteOffsetY: 0,
    messageWhenZeroHp: '配信者を {attacker} が倒しました！',
  },
  attack: {
    customText: '',
    enabled: true,
    damageType: 'fixed',
    damage: 10,
    damageMin: 5,
    damageMax: 15,
    damageRandomStep: 1,
    missEnabled: false,
    missProbability: 0,
    missSoundEnabled: false,
    missSoundUrl: '',
    missSoundVolume: 0.7,
    missTextColor: '#ffffff',
    criticalEnabled: false,
    criticalProbability: 0,
    criticalMultiplier: 2.0,
    bleedEnabled: false,
    bleedProbability: 0,
    bleedDamage: 5,
    bleedDuration: 10,
    bleedInterval: 1,
    bleedSoundEnabled: false,
    bleedSoundUrl: '',
    bleedSoundVolume: 0.7,
    dotPoisonSoundEnabled: false,
    dotPoisonSoundUrl: '',
    dotPoisonSoundVolume: 0.7,
    dotBurnSoundEnabled: false,
    dotBurnSoundUrl: '',
    dotBurnSoundVolume: 0.7,
    dotPoisonAttackSoundEnabled: false,
    dotPoisonAttackSoundUrl: '',
    dotPoisonAttackSoundVolume: 0.7,
    dotBurnAttackSoundEnabled: false,
    dotBurnAttackSoundUrl: '',
    dotBurnAttackSoundVolume: 0.7,
    soundEnabled: false,
    soundUrl: '',
    soundVolume: 0.7,
    comboTechniqueSoundEnabled: false,
    comboTechniqueSoundUrl: '',
    comboTechniqueSoundVolume: 0.7,
    rouletteSoundEnabled: false,
    rouletteSoundUrl: '',
    rouletteSoundVolume: 0.7,
    filterEffectEnabled: true,
    attackEffectEnabled: false,
    attackEffectVisual: 'webm',
    attackEffectVideoUrl: '',
    comboTechniqueEffectEnabled: false,
    comboTechniqueEffectVisual: 'webm',
    comboTechniqueEffectVideoUrl: '',
    rouletteEffectEnabled: false,
    rouletteEffectVisual: 'webm',
    rouletteEffectVideoUrl: '',
    comboTechniqueEnabled: true,
    comboTechniqueDurationSec: 30,
    comboTechniqueInputPrefix: COMBO_TECHNIQUE_PREFIX,
    comboTechniqueAllowAnyUserInput: true,
    comboTechniqueResultFontScalePercent: 100,
    comboTechniqueChallengeFontScalePercent: 100,
    comboTechniqueChallengeLongTextThresholdChars: 18,
    comboTechniqueChallengeLongTextScalePercent: 85,
    comboTechniqueChallengeGapAboveGaugePx: 10,
    comboTechniqueChallengeOffsetXPx: 0,
    comboTechniqueChallengeOffsetYPx: 0,
    comboTechniqueChallengeTextAlign: 'center',
    testPanelSimulation: { ...DEFAULT_TEST_PANEL_SIMULATION },
    testNoDamageCommand: '!testhit',
    survivalHp1Enabled: false,
    survivalHp1Probability: 30,
    survivalHp1Message: '食いしばり!',
  },
  heal: {
    customText: '',
    enabled: true,
    effectEnabled: true,
    healType: 'fixed',
    healAmount: 20,
    healMin: 10,
    healMax: 30,
    healRandomStep: 1,
    soundEnabled: false,
    soundUrl: '',
    soundVolume: 0.7,
    filterEffectEnabled: true,
    healWhenZeroEnabled: true,
    autoReplyEnabled: false,
    autoReplyMessageTemplate: '配信者の残りHP: {hp}/{max}',
  },
  retry: {
    command: '!retry',
    streamerAutoReplyEnabled: true,
    fullHealCommand: '!fullheal',
    fullResetAllCommand: '!resetall',
    streamerHealCommand: '!heal',
    streamerHealType: 'fixed',
    streamerHealAmount: 20,
    streamerHealMin: 10,
    streamerHealMax: 30,
    streamerHealRandomStep: 1,
    streamerHealWhenZeroEnabled: true,
    enabled: true,
    soundEnabled: false,
    soundUrl: '',
    soundVolume: 0.7,
  },
  animation: {
    duration: 500,
    easing: 'ease-out',
  },
  display: {
    showMaxHp: true,
    fontSize: 24,
    damageHealPopupFontScalePercent: 100,
    overlayBannerFontScalePercent: 100,
    gaugeDesign: 'default',
    gaugeShape: { ...DEFAULT_GAUGE_SHAPE },
  },
  zeroHpImage: {
    enabled: true,
    imageUrl: '',
    scale: 4,
    offsetX: 0,
    offsetY: 0,
    backgroundColor: 'transparent',
  },
  zeroHpSound: {
    enabled: true,
    soundUrl: '',
    volume: 0.7,
  },
  zeroHpEffect: {
    enabled: true,
    videoUrl: '', // 透過WebM動画
    duration: 2000, // 2秒
  },
  test: {
    enabled: false,
  },
  pvp: {
    enabled: false,
    streamerAttack: {
      customText: '',
      enabled: true,
      damageType: 'fixed',
      damage: 15,
      damageMin: 10,
      damageMax: 25,
      damageRandomStep: 1,
      missEnabled: false,
      missProbability: 0,
      missSoundEnabled: false,
      missSoundUrl: '',
      missSoundVolume: 0.7,
      missTextColor: '#ffffff',
      criticalEnabled: false,
      criticalProbability: 0,
      criticalMultiplier: 2.0,
      bleedEnabled: false,
      bleedProbability: 0,
      bleedDamage: 5,
      bleedDuration: 10,
      bleedInterval: 1,
      bleedSoundEnabled: false,
      bleedSoundUrl: '',
      bleedSoundVolume: 0.7,
      dotPoisonSoundEnabled: false,
      dotPoisonSoundUrl: '',
      dotPoisonSoundVolume: 0.7,
      dotBurnSoundEnabled: false,
      dotBurnSoundUrl: '',
      dotBurnSoundVolume: 0.7,
      dotPoisonAttackSoundEnabled: false,
      dotPoisonAttackSoundUrl: '',
      dotPoisonAttackSoundVolume: 0.7,
      dotBurnAttackSoundEnabled: false,
      dotBurnAttackSoundUrl: '',
      dotBurnAttackSoundVolume: 0.7,
      soundEnabled: false,
      soundUrl: '',
      soundVolume: 0.7,
    comboTechniqueSoundEnabled: false,
    comboTechniqueSoundUrl: '',
    comboTechniqueSoundVolume: 0.7,
    rouletteSoundEnabled: false,
    rouletteSoundUrl: '',
    rouletteSoundVolume: 0.7,
      filterEffectEnabled: true,
    attackEffectEnabled: false,
    attackEffectVisual: 'webm',
    attackEffectVideoUrl: '',
    comboTechniqueEffectEnabled: false,
    comboTechniqueEffectVisual: 'webm',
    comboTechniqueEffectVideoUrl: '',
    rouletteEffectEnabled: false,
    rouletteEffectVisual: 'webm',
    rouletteEffectVideoUrl: '',
      comboTechniqueEnabled: true,
      comboTechniqueDurationSec: 30,
      comboTechniqueInputPrefix: COMBO_TECHNIQUE_PREFIX,
      comboTechniqueAllowAnyUserInput: true,
      comboTechniqueResultFontScalePercent: 100,
      comboTechniqueChallengeFontScalePercent: 100,
      comboTechniqueChallengeLongTextThresholdChars: 18,
      comboTechniqueChallengeLongTextScalePercent: 85,
      comboTechniqueChallengeGapAboveGaugePx: 10,
      comboTechniqueChallengeOffsetXPx: 0,
      comboTechniqueChallengeOffsetYPx: 0,
      comboTechniqueChallengeTextAlign: 'center',
      testPanelSimulation: { ...DEFAULT_TEST_PANEL_SIMULATION },
      survivalHp1Enabled: false,
      survivalHp1Probability: 30,
      survivalHp1Message: '食いしばり!',
    },
    viewerMaxHp: 100,
    counterCommand: '!counter',
    autoReplyMessageTemplate: '{username} の残りHP: {hp}/{max}',
    hpCheckCommand: '!hp',
    viewerFullHealCommand: '!fullheal',
    viewerHealCommand: '!heal',
    viewerHealType: 'fixed',
    viewerHealAmount: 20,
    viewerHealMin: 10,
    viewerHealMax: 30,
    viewerHealRandomStep: 1,
    viewerHealWhenZeroEnabled: true,
    counterOnAttackTargetAttacker: true,
    counterOnAttackTargetRandom: false,
    counterCommandAcceptsUsername: false,
    messageWhenAttackBlockedByZeroHp: 'HPが0なので攻撃できません。',
    messageWhenHealBlockedByZeroHp: 'HPが0なので回復できません。',
    messageWhenViewerZeroHp: '視聴者 {username} のHPが0になりました。',
    autoReplyAttackCounter: true,
    autoReplyWhenViewerZeroHp: true,
    autoReplyHpCheck: true,
    autoReplyFullHeal: true,
    autoReplyHeal: true,
    autoReplyBlockedByZeroHp: true,
    attackMode: 'both',
    viewerAttackViewerCommand: '!attack',
    streamerHealOnAttackEnabled: false,
    streamerHealOnAttackProbability: 10,
    streamerHealOnAttackType: 'fixed',
    streamerHealOnAttackAmount: 10,
    streamerHealOnAttackMin: 5,
    streamerHealOnAttackMax: 20,
    streamerHealOnAttackRandomStep: 1,
    strengthBuffCommand: '!strength',
    strengthBuffCheckCommand: '!buff',
    strengthBuffDuration: 300,
    strengthBuffTarget: 'individual',
    autoReplyStrengthBuff: true,
    autoReplyStrengthBuffCheck: true,
    messageWhenStrengthBuffActivated: '{username} にストレングス効果を付与しました！（効果時間: {duration_human}）',
    messageWhenStrengthBuffCheck: '{username} のストレングス効果: 残り {remaining_human} / 効果時間 {duration_human}',
    strengthBuffSoundEnabled: false,
    strengthBuffSoundUrl: '',
    strengthBuffSoundVolume: 0.7,
    konamiStreamerBuffEnabled: true,
    konamiStreamerBuffSoundEnabled: false,
    konamiStreamerBuffSoundUrl: '',
    konamiStreamerBuffSoundVolume: 0.7,
    viewerFinishingMoveEnabled: true,
    viewerFinishingMoveProbability: 0.01,
    finishingMoveText: '必殺技！',
    viewerFinishingMoveMultiplier: 10,
    messageWhenViewerFinishingMove: '{username} が必殺技を繰り出した！ ダメージ: {damage}',
    autoReplyViewerFinishingMove: true,
    finishingMoveSoundEnabled: false,
    finishingMoveSoundUrl: '',
    finishingMoveSoundVolume: 0.7,
    viewerVsViewerAttack: {
      customText: '',
      enabled: true,
      damageType: 'fixed',
      damage: 10,
      damageMin: 5,
      damageMax: 15,
      damageRandomStep: 1,
      missEnabled: false,
      missProbability: 0,
      missSoundEnabled: false,
      missSoundUrl: '',
      missSoundVolume: 0.7,
      missTextColor: '#ffffff',
      criticalEnabled: false,
      criticalProbability: 0,
      criticalMultiplier: 2.0,
      bleedEnabled: false,
      bleedProbability: 0,
      bleedDamage: 5,
      bleedDuration: 10,
      bleedInterval: 1,
      bleedSoundEnabled: false,
      bleedSoundUrl: '',
      bleedSoundVolume: 0.7,
      dotPoisonSoundEnabled: false,
      dotPoisonSoundUrl: '',
      dotPoisonSoundVolume: 0.7,
      dotBurnSoundEnabled: false,
      dotBurnSoundUrl: '',
      dotBurnSoundVolume: 0.7,
      dotPoisonAttackSoundEnabled: false,
      dotPoisonAttackSoundUrl: '',
      dotPoisonAttackSoundVolume: 0.7,
      dotBurnAttackSoundEnabled: false,
      dotBurnAttackSoundUrl: '',
      dotBurnAttackSoundVolume: 0.7,
      soundEnabled: false,
      soundUrl: '',
      soundVolume: 0.7,
    comboTechniqueSoundEnabled: false,
    comboTechniqueSoundUrl: '',
    comboTechniqueSoundVolume: 0.7,
    rouletteSoundEnabled: false,
    rouletteSoundUrl: '',
    rouletteSoundVolume: 0.7,
      filterEffectEnabled: true,
    attackEffectEnabled: false,
    attackEffectVisual: 'webm',
    attackEffectVideoUrl: '',
    comboTechniqueEffectEnabled: false,
    comboTechniqueEffectVisual: 'webm',
    comboTechniqueEffectVideoUrl: '',
    rouletteEffectEnabled: false,
    rouletteEffectVisual: 'webm',
    rouletteEffectVideoUrl: '',
      comboTechniqueEnabled: true,
      comboTechniqueDurationSec: 30,
      comboTechniqueInputPrefix: COMBO_TECHNIQUE_PREFIX,
      comboTechniqueAllowAnyUserInput: true,
      comboTechniqueResultFontScalePercent: 100,
      comboTechniqueChallengeFontScalePercent: 100,
      comboTechniqueChallengeLongTextThresholdChars: 18,
      comboTechniqueChallengeLongTextScalePercent: 85,
      comboTechniqueChallengeGapAboveGaugePx: 10,
      comboTechniqueChallengeOffsetXPx: 0,
      comboTechniqueChallengeOffsetYPx: 0,
      comboTechniqueChallengeTextAlign: 'center',
      testPanelSimulation: { ...DEFAULT_TEST_PANEL_SIMULATION },
      survivalHp1Enabled: false,
      survivalHp1Probability: 30,
      survivalHp1Message: '食いしばり!',
    },
  },
  webmLoop: {
    enabled: false,
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    opacity: 1.0,
    zIndex: 1,
    videoUrl: '',
    loop: true,
  },
  damageEffectFilter: {
    sepia: 0.3,
    hueRotate: -10,
    saturate: 1.2,
    brightness: 0.95,
    contrast: 1.1,
  },
  healEffectFilter: {
    sepia: 0.1,
    hueRotate: 180,
    saturate: 1.2,
    brightness: 1.15,
    contrast: 1.1,
  },
  gaugeColors: {
    lastGauge: '#FF0000', // 最後の1ゲージ = 赤
    secondGauge: '#FFA500', // 2ゲージ目 = オレンジ
    patternColor1: '#8000FF', // 3ゲージ目以降の交互パターン1（3, 5, 7, 9...ゲージ目）= 紫
    patternColor2: '#4aa3ff', // 3ゲージ目以降の交互パターン2（4, 6, 8, 10...ゲージ目）= 青
    frameBackground: '#000000',
    frameBorderInner: '#ffffff',
    frameBorderOuter: '#808080',
  },
  damageColors: {
    normal: '#cc0000', // 通常ダメージの色
    critical: '#cc8800', // クリティカルダメージの色
    bleed: '#ff6666', // 出血DOTの既定色
    dotPoison: '#66dd88', // 毒DOTの既定色
    dotBurn: '#ff9944', // 炎DOTの既定色
  },
  healColors: {
    normal: '#00ff88', // 回復数値の色（明るい緑）
  },
  obsCaptureGuide: {
    enabled: false,
    insetPx: 16,
  },
  obsWebSocket: {
    enabled: false,
    host: '127.0.0.1',
    port: 4455,
    password: '',
    sceneName: '',
    sourceName: '',
    effects: {
      damageShakeEnabled: false,
      damageShakeStrengthPx: 14,
      damageShakeDurationMs: 450,
      healGlowEnabled: false,
      healGlowScale: 1.08,
      healGlowDurationMs: 500,
      dodgeMoveEnabled: false,
      dodgeMoveDistancePx: 42,
      dodgeMoveDurationMs: 380,
      finishingMoveEnabled: false,
      finishingMoveShakeStrengthPx: 26,
      finishingMoveShakeDurationMs: 650,
      finishingMoveGlowScale: 1.14,
      finishingMoveGlowDurationMs: 750,
    },
  },
  background: {
    mode: 'green',
    customColor: '#00ff00',
  },
}

/**
 * 設定ファイルを読み込む
 * 保存先はJSONファイルのみ。優先順位: JSONファイル → デフォルト設定
 */
export async function loadOverlayConfig(): Promise<OverlayConfig> {
  try {
    const response = await fetch('/config/overlay-config.json')
    if (!response.ok) {
      logger.warn('設定ファイルが見つかりません。デフォルト設定を使用します。')
      return DEFAULT_CONFIG
    }
    const config = await response.json()
    // 設定値を検証・サニタイズ
    const validated = validateAndSanitizeConfig(config)
    // デフォルト値でマージ（不足している項目を補完）
    return {
      ...DEFAULT_CONFIG,
      ...validated,
      hp: { ...DEFAULT_CONFIG.hp, ...validated.hp },
      attack: { ...DEFAULT_CONFIG.attack, ...validated.attack },
      heal: { ...DEFAULT_CONFIG.heal, ...validated.heal },
      retry: { ...DEFAULT_CONFIG.retry, ...validated.retry },
      animation: { ...DEFAULT_CONFIG.animation, ...validated.animation },
      display: {
        ...DEFAULT_CONFIG.display,
        ...validated.display,
        gaugeShape: {
          ...DEFAULT_CONFIG.display.gaugeShape,
          ...validated.display.gaugeShape,
        },
      },
      zeroHpImage: { ...DEFAULT_CONFIG.zeroHpImage, ...validated.zeroHpImage },
      zeroHpSound: { ...DEFAULT_CONFIG.zeroHpSound, ...validated.zeroHpSound },
      zeroHpEffect: { ...DEFAULT_CONFIG.zeroHpEffect, ...validated.zeroHpEffect },
      test: { ...DEFAULT_CONFIG.test, ...validated.test },
      pvp: {
        ...DEFAULT_CONFIG.pvp,
        ...validated.pvp,
        streamerAttack: { ...DEFAULT_CONFIG.pvp.streamerAttack, ...validated.pvp.streamerAttack },
        viewerVsViewerAttack: { ...DEFAULT_CONFIG.pvp.viewerVsViewerAttack, ...(validated.pvp?.viewerVsViewerAttack || {}) },
      },
      webmLoop: { ...DEFAULT_CONFIG.webmLoop, ...validated.webmLoop },
      damageEffectFilter: { ...DEFAULT_CONFIG.damageEffectFilter, ...validated.damageEffectFilter },
      healEffectFilter: { ...DEFAULT_CONFIG.healEffectFilter, ...validated.healEffectFilter },
      gaugeColors: { ...DEFAULT_CONFIG.gaugeColors, ...validated.gaugeColors },
      damageColors: { ...DEFAULT_CONFIG.damageColors, ...validated.damageColors },
      healColors: { ...DEFAULT_CONFIG.healColors, ...validated.healColors },
      obsCaptureGuide: { ...DEFAULT_CONFIG.obsCaptureGuide, ...validated.obsCaptureGuide },
      obsWebSocket: {
        ...DEFAULT_CONFIG.obsWebSocket,
        ...validated.obsWebSocket,
        effects: {
          ...DEFAULT_CONFIG.obsWebSocket.effects,
          ...(validated.obsWebSocket?.effects || {}),
        },
      },
      background: { ...DEFAULT_CONFIG.background, ...validated.background },
    }
  } catch (error) {
    logger.error('設定ファイルの読み込みに失敗しました:', error)
    return DEFAULT_CONFIG
  }
}

/**
 * JSONファイルから設定を読み込む（loadOverlayConfig と同じ内容。設定画面の「JSONファイルから読み込み」用）
 */
export async function loadOverlayConfigFromFile(): Promise<OverlayConfig> {
  try {
    const response = await fetch('/config/overlay-config.json')
    if (!response.ok) {
      logger.warn('設定ファイルが見つかりません。デフォルト設定を使用します。')
      return DEFAULT_CONFIG
    }
    const config = await response.json()
    const validated = validateAndSanitizeConfig(config)
    return {
      ...DEFAULT_CONFIG,
      ...validated,
      hp: { ...DEFAULT_CONFIG.hp, ...validated.hp },
      attack: { ...DEFAULT_CONFIG.attack, ...validated.attack },
      heal: { ...DEFAULT_CONFIG.heal, ...validated.heal },
      retry: { ...DEFAULT_CONFIG.retry, ...validated.retry },
      animation: { ...DEFAULT_CONFIG.animation, ...validated.animation },
      display: {
        ...DEFAULT_CONFIG.display,
        ...validated.display,
        gaugeShape: {
          ...DEFAULT_CONFIG.display.gaugeShape,
          ...validated.display.gaugeShape,
        },
      },
      zeroHpImage: { ...DEFAULT_CONFIG.zeroHpImage, ...validated.zeroHpImage },
      zeroHpSound: { ...DEFAULT_CONFIG.zeroHpSound, ...validated.zeroHpSound },
      zeroHpEffect: { ...DEFAULT_CONFIG.zeroHpEffect, ...validated.zeroHpEffect },
      test: { ...DEFAULT_CONFIG.test, ...validated.test },
      pvp: {
        ...DEFAULT_CONFIG.pvp,
        ...validated.pvp,
        streamerAttack: { ...DEFAULT_CONFIG.pvp.streamerAttack, ...validated.pvp.streamerAttack },
        viewerVsViewerAttack: { ...DEFAULT_CONFIG.pvp.viewerVsViewerAttack, ...(validated.pvp?.viewerVsViewerAttack || {}) },
      },
      webmLoop: { ...DEFAULT_CONFIG.webmLoop, ...validated.webmLoop },
      damageEffectFilter: { ...DEFAULT_CONFIG.damageEffectFilter, ...validated.damageEffectFilter },
      healEffectFilter: { ...DEFAULT_CONFIG.healEffectFilter, ...validated.healEffectFilter },
      gaugeColors: { ...DEFAULT_CONFIG.gaugeColors, ...validated.gaugeColors },
      damageColors: { ...DEFAULT_CONFIG.damageColors, ...validated.damageColors },
      healColors: { ...DEFAULT_CONFIG.healColors, ...validated.healColors },
      obsCaptureGuide: { ...DEFAULT_CONFIG.obsCaptureGuide, ...validated.obsCaptureGuide },
      obsWebSocket: {
        ...DEFAULT_CONFIG.obsWebSocket,
        ...validated.obsWebSocket,
        effects: {
          ...DEFAULT_CONFIG.obsWebSocket.effects,
          ...(validated.obsWebSocket?.effects || {}),
        },
      },
      background: { ...DEFAULT_CONFIG.background, ...validated.background },
    }
  } catch (error) {
    logger.error('設定ファイルの読み込みに失敗しました:', error)
    return DEFAULT_CONFIG
  }
}

/**
 * 設定ファイルをJSONファイルとして保存する
 * 開発環境ではAPI経由でファイルに保存、本番環境ではダウンロード
 */
export async function saveOverlayConfig(config: OverlayConfig): Promise<boolean> {
  try {
    // 設定値を検証・サニタイズ
    const validated = validateAndSanitizeConfig(config)

    // 開発環境ではAPI経由でファイルに保存
    if (import.meta.env.DEV) {
      try {
        const response = await fetch('/api/config/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(validated, null, 2),
        })

        if (!response.ok) {
          let errorMessage = '設定の保存に失敗しました'
          try {
            const errorBody = await response.json()
            if (errorBody && typeof errorBody.error === 'string') errorMessage = errorBody.error
          } catch {
            errorMessage = `HTTP ${response.status}`
          }
          throw new Error(errorMessage)
        }

        const result = await response.json().catch(() => ({ message: '設定を保存しました' }))
        logger.info('✅ 設定をJSONファイルに保存しました:', result.message)
        return true
      } catch (apiError) {
        logger.warn('API経由での保存に失敗しました。ダウンロード方式にフォールバックします:', apiError)
        return downloadConfigAsJson(validated)
      }
    }

    // 本番環境ではダウンロード方式
    return downloadConfigAsJson(validated)
  } catch (error) {
    logger.error('設定の保存に失敗しました:', error)
    return false
  }
}

/**
 * 設定をJSONファイルとしてダウンロード
 */
function downloadConfigAsJson(config: OverlayConfig): boolean {
  try {
    const jsonString = JSON.stringify(config, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'overlay-config.json'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    logger.info('✅ 設定をJSONファイルとしてダウンロードしました')
    return true
  } catch (error) {
    logger.error('JSONファイルのダウンロードに失敗しました:', error)
    return false
  }
}

/**
 * 設定値を検証・サニタイズ
 */
export function validateAndSanitizeConfig(config: unknown): OverlayConfig {
  // 型ガード
  if (!config || typeof config !== 'object') {
    return DEFAULT_CONFIG
  }

  const c = config as Record<string, unknown>
  // 色の検証（#RGB / #RRGGBB）。attack など上位の検証より前に置く
  const isValidColor = (color: unknown): boolean => {
    if (typeof color !== 'string') return false
    return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color)
  }

  const sanitizeDebuffKind = (raw: unknown): AttackDebuffKind => {
    if (typeof raw === 'string') {
      const s = raw.trim().toLowerCase()
      if (s === 'poison' || s === 'burn' || s === 'bleed') return s
    }
    return 'bleed'
  }

  const sanitizeBleedVariants = (raw: unknown): AttackBleedVariant[] | undefined => {
    if (!Array.isArray(raw)) return undefined
    const out: AttackBleedVariant[] = []
    for (const el of raw) {
      if (!el || typeof el !== 'object') continue
      const o = el as Record<string, unknown>
      const weight = Number(o.weight)
      const damage = Number(o.damage)
      const duration = Number(o.duration)
      const interval = Number(o.interval)
      if (!isInRange(weight, 0, MAX_NUM) || weight <= 0) continue
      if (!isInRange(damage, 1, MAX_NUM)) continue
      if (!isInRange(duration, 1, MAX_NUM)) continue
      if (!isInRange(interval, 0.1, MAX_NUM)) continue
      const dc = typeof o.damageColor === 'string' ? o.damageColor.trim() : ''
      const damageColor = dc !== '' && isValidColor(dc) ? dc : undefined
      const debuffKind = sanitizeDebuffKind(o.debuffKind)
      out.push({ weight, damage, duration, interval, damageColor, debuffKind })
    }
    return out.length > 0 ? out : undefined
  }

  // HP設定の検証
  const hpConfig = (c.hp as Record<string, unknown> | undefined) || {}
  const hpMax = Number(hpConfig.max) || DEFAULT_CONFIG.hp.max
  const hp = {
    max: isInRange(hpMax, 1, MAX_NUM) ? hpMax : DEFAULT_CONFIG.hp.max,
    current: isInRange(Number(hpConfig.current), 0, hpMax)
      ? Math.max(0, Math.min(Number(hpConfig.current) || 0, hpMax))
      : DEFAULT_CONFIG.hp.current,
    gaugeCount: isInRange(Number(hpConfig.gaugeCount), 1, MAX_NUM)
      ? Number(hpConfig.gaugeCount) || DEFAULT_CONFIG.hp.gaugeCount
      : DEFAULT_CONFIG.hp.gaugeCount,
    x: isInRange(Number(hpConfig.x), -10000, 10000)
      ? Number(hpConfig.x) || 0
      : 0,
    y: isInRange(Number(hpConfig.y), -10000, 10000)
      ? Number(hpConfig.y) || 0
      : 0,
    width: isInRange(Number(hpConfig.width), 1, MAX_NUM)
      ? Number(hpConfig.width) || DEFAULT_CONFIG.hp.width
      : DEFAULT_CONFIG.hp.width,
    height: isInRange(Number(hpConfig.height), 1, MAX_NUM)
      ? Number(hpConfig.height) || DEFAULT_CONFIG.hp.height
      : DEFAULT_CONFIG.hp.height,
    rouletteBandTechniqueFontScalePercent: isInRange(Number(hpConfig.rouletteBandTechniqueFontScalePercent), 50, 200)
      ? Math.round(Number(hpConfig.rouletteBandTechniqueFontScalePercent) || DEFAULT_CONFIG.hp.rouletteBandTechniqueFontScalePercent)
      : DEFAULT_CONFIG.hp.rouletteBandTechniqueFontScalePercent,
    roulettePanelFontScalePercent: isInRange(Number(hpConfig.roulettePanelFontScalePercent), 50, 200)
      ? Math.round(Number(hpConfig.roulettePanelFontScalePercent) || DEFAULT_CONFIG.hp.roulettePanelFontScalePercent)
      : DEFAULT_CONFIG.hp.roulettePanelFontScalePercent,
    rouletteOffsetX: isInRange(Number(hpConfig.rouletteOffsetX), -10000, 10000)
      ? Number(hpConfig.rouletteOffsetX) || 0
      : DEFAULT_CONFIG.hp.rouletteOffsetX,
    rouletteOffsetY: isInRange(Number(hpConfig.rouletteOffsetY), -10000, 10000)
      ? Number(hpConfig.rouletteOffsetY) || 0
      : DEFAULT_CONFIG.hp.rouletteOffsetY,
    messageWhenZeroHp: typeof hpConfig.messageWhenZeroHp === 'string' ? hpConfig.messageWhenZeroHp : DEFAULT_CONFIG.hp.messageWhenZeroHp,
  }

  // 攻撃設定の検証
  const attackConfig = (c.attack as Record<string, unknown> | undefined) || {}
  const legacyTestForPanelSim = (c.test as Record<string, unknown> | undefined) || {}
  const attackDamageType: 'fixed' | 'random' = attackConfig.damageType === 'random' ? 'random' : 'fixed'
  const attack = {
    customText: typeof attackConfig.customText === 'string' ? attackConfig.customText : '',
    enabled: typeof attackConfig.enabled === 'boolean' ? attackConfig.enabled : true,
    damageType: attackDamageType,
    damage: isInRange(Number(attackConfig.damage), 1, MAX_NUM)
      ? Number(attackConfig.damage) || 10
      : 10,
    damageMin: isInRange(Number(attackConfig.damageMin), 1, MAX_NUM)
      ? Number(attackConfig.damageMin) || 5
      : 5,
    damageMax: isInRange(Number(attackConfig.damageMax), 1, MAX_NUM)
      ? Number(attackConfig.damageMax) || 15
      : 15,
    damageRandomStep: isInRange(Number(attackConfig.damageRandomStep), 1, MAX_NUM)
      ? Number(attackConfig.damageRandomStep) || 1
      : 1,
    missEnabled: typeof attackConfig.missEnabled === 'boolean' ? attackConfig.missEnabled : false,
    missProbability: isInRange(Number(attackConfig.missProbability), 0, 100)
      ? Number(attackConfig.missProbability) || 0
      : 0,
    missSoundEnabled: typeof attackConfig.missSoundEnabled === 'boolean' ? attackConfig.missSoundEnabled : false,
    missSoundUrl:
      typeof attackConfig.missSoundUrl === 'string' && isValidUrl(attackConfig.missSoundUrl)
        ? attackConfig.missSoundUrl
        : '',
    missSoundVolume: isInRange(Number(attackConfig.missSoundVolume), 0, 1)
      ? Number(attackConfig.missSoundVolume) || 0.7
      : 0.7,
    missTextColor: isValidColor(attackConfig.missTextColor)
      ? (attackConfig.missTextColor as string)
      : DEFAULT_CONFIG.attack.missTextColor,
    criticalEnabled: typeof attackConfig.criticalEnabled === 'boolean' ? attackConfig.criticalEnabled : false,
    criticalProbability: isInRange(Number(attackConfig.criticalProbability), 0, 100)
      ? Number(attackConfig.criticalProbability) || 0
      : 0,
    criticalMultiplier: isInRange(Number(attackConfig.criticalMultiplier), 1.0, MAX_NUM)
      ? Number(attackConfig.criticalMultiplier) || 2.0
      : 2.0,
    bleedEnabled: typeof attackConfig.bleedEnabled === 'boolean' ? attackConfig.bleedEnabled : false,
    bleedProbability: isInRange(Number(attackConfig.bleedProbability), 0, 100)
      ? Number(attackConfig.bleedProbability) || 0
      : 0,
    bleedDamage: isInRange(Number(attackConfig.bleedDamage), 1, MAX_NUM)
      ? Number(attackConfig.bleedDamage) || 5
      : 5,
    bleedDuration: isInRange(Number(attackConfig.bleedDuration), 1, MAX_NUM)
      ? Number(attackConfig.bleedDuration) || 10
      : 10,
    bleedInterval: isInRange(Number(attackConfig.bleedInterval), 0.1, MAX_NUM)
      ? Number(attackConfig.bleedInterval) || 1
      : 1,
    bleedVariants: sanitizeBleedVariants(attackConfig.bleedVariants),
    bleedSoundEnabled: typeof attackConfig.bleedSoundEnabled === 'boolean' ? attackConfig.bleedSoundEnabled : false,
    bleedSoundUrl:
      typeof attackConfig.bleedSoundUrl === 'string' && isValidUrl(attackConfig.bleedSoundUrl)
        ? attackConfig.bleedSoundUrl
        : '',
    bleedSoundVolume: isInRange(Number(attackConfig.bleedSoundVolume), 0, 1)
      ? Number(attackConfig.bleedSoundVolume) || 0.7
      : 0.7,
    dotPoisonSoundEnabled: typeof attackConfig.dotPoisonSoundEnabled === 'boolean' ? attackConfig.dotPoisonSoundEnabled : false,
    dotPoisonSoundUrl:
      typeof attackConfig.dotPoisonSoundUrl === 'string' && isValidUrl(attackConfig.dotPoisonSoundUrl)
        ? attackConfig.dotPoisonSoundUrl
        : '',
    dotPoisonSoundVolume: isInRange(Number(attackConfig.dotPoisonSoundVolume), 0, 1)
      ? Number(attackConfig.dotPoisonSoundVolume) || 0.7
      : 0.7,
    dotBurnSoundEnabled: typeof attackConfig.dotBurnSoundEnabled === 'boolean' ? attackConfig.dotBurnSoundEnabled : false,
    dotBurnSoundUrl:
      typeof attackConfig.dotBurnSoundUrl === 'string' && isValidUrl(attackConfig.dotBurnSoundUrl)
        ? attackConfig.dotBurnSoundUrl
        : '',
    dotBurnSoundVolume: isInRange(Number(attackConfig.dotBurnSoundVolume), 0, 1)
      ? Number(attackConfig.dotBurnSoundVolume) || 0.7
      : 0.7,
    dotPoisonAttackSoundEnabled: typeof attackConfig.dotPoisonAttackSoundEnabled === 'boolean' ? attackConfig.dotPoisonAttackSoundEnabled : false,
    dotPoisonAttackSoundUrl:
      typeof attackConfig.dotPoisonAttackSoundUrl === 'string' && isValidUrl(attackConfig.dotPoisonAttackSoundUrl)
        ? attackConfig.dotPoisonAttackSoundUrl
        : '',
    dotPoisonAttackSoundVolume: isInRange(Number(attackConfig.dotPoisonAttackSoundVolume), 0, 1)
      ? Number(attackConfig.dotPoisonAttackSoundVolume) || 0.7
      : 0.7,
    dotBurnAttackSoundEnabled: typeof attackConfig.dotBurnAttackSoundEnabled === 'boolean' ? attackConfig.dotBurnAttackSoundEnabled : false,
    dotBurnAttackSoundUrl:
      typeof attackConfig.dotBurnAttackSoundUrl === 'string' && isValidUrl(attackConfig.dotBurnAttackSoundUrl)
        ? attackConfig.dotBurnAttackSoundUrl
        : '',
    dotBurnAttackSoundVolume: isInRange(Number(attackConfig.dotBurnAttackSoundVolume), 0, 1)
      ? Number(attackConfig.dotBurnAttackSoundVolume) || 0.7
      : 0.7,
    soundEnabled: typeof attackConfig.soundEnabled === 'boolean' ? attackConfig.soundEnabled : false,
    soundUrl:
      typeof attackConfig.soundUrl === 'string' && isValidUrl(attackConfig.soundUrl)
        ? attackConfig.soundUrl
        : '',
    soundVolume: isInRange(Number(attackConfig.soundVolume), 0, 1)
      ? Number(attackConfig.soundVolume) || 0.7
      : 0.7,
    comboTechniqueSoundEnabled:
      typeof attackConfig.comboTechniqueSoundEnabled === 'boolean' ? attackConfig.comboTechniqueSoundEnabled : false,
    comboTechniqueSoundUrl:
      typeof attackConfig.comboTechniqueSoundUrl === 'string' && isValidUrl(attackConfig.comboTechniqueSoundUrl)
        ? attackConfig.comboTechniqueSoundUrl
        : '',
    comboTechniqueSoundVolume: isInRange(Number(attackConfig.comboTechniqueSoundVolume), 0, 1)
      ? Number(attackConfig.comboTechniqueSoundVolume) || 0.7
      : 0.7,
    rouletteSoundEnabled:
      typeof attackConfig.rouletteSoundEnabled === 'boolean' ? attackConfig.rouletteSoundEnabled : false,
    rouletteSoundUrl:
      typeof attackConfig.rouletteSoundUrl === 'string' && isValidUrl(attackConfig.rouletteSoundUrl)
        ? attackConfig.rouletteSoundUrl
        : '',
    rouletteSoundVolume: isInRange(Number(attackConfig.rouletteSoundVolume), 0, 1)
      ? Number(attackConfig.rouletteSoundVolume) || 0.7
      : 0.7,
    filterEffectEnabled: typeof attackConfig.filterEffectEnabled === 'boolean' ? attackConfig.filterEffectEnabled : true,
    attackEffectEnabled:
      typeof attackConfig.attackEffectEnabled === 'boolean' ? attackConfig.attackEffectEnabled : false,
    attackEffectVisual: sanitizeComboRouletteVisual(attackConfig.attackEffectVisual),
    attackEffectVideoUrl:
      typeof attackConfig.attackEffectVideoUrl === 'string' && isValidUrl(attackConfig.attackEffectVideoUrl)
        ? attackConfig.attackEffectVideoUrl
        : '',
    comboTechniqueEffectEnabled:
      typeof attackConfig.comboTechniqueEffectEnabled === 'boolean' ? attackConfig.comboTechniqueEffectEnabled : false,
    comboTechniqueEffectVisual: sanitizeComboRouletteVisual(attackConfig.comboTechniqueEffectVisual),
    comboTechniqueEffectVideoUrl:
      typeof attackConfig.comboTechniqueEffectVideoUrl === 'string' && isValidUrl(attackConfig.comboTechniqueEffectVideoUrl)
        ? attackConfig.comboTechniqueEffectVideoUrl
        : '',
    rouletteEffectEnabled:
      typeof attackConfig.rouletteEffectEnabled === 'boolean' ? attackConfig.rouletteEffectEnabled : false,
    rouletteEffectVisual: sanitizeComboRouletteVisual(attackConfig.rouletteEffectVisual),
    rouletteEffectVideoUrl:
      typeof attackConfig.rouletteEffectVideoUrl === 'string' && isValidUrl(attackConfig.rouletteEffectVideoUrl)
        ? attackConfig.rouletteEffectVideoUrl
        : '',
    comboTechniqueEnabled: typeof attackConfig.comboTechniqueEnabled === 'boolean' ? attackConfig.comboTechniqueEnabled : true,
    comboTechniqueDurationSec: (() => {
      const n = Math.floor(Number(attackConfig.comboTechniqueDurationSec))
      return isInRange(n, 3, 300) ? n || DEFAULT_CONFIG.attack.comboTechniqueDurationSec : DEFAULT_CONFIG.attack.comboTechniqueDurationSec
    })(),
    comboTechniqueInputPrefix: (() => {
      const raw = attackConfig.comboTechniqueInputPrefix
      const s = typeof raw === 'string' ? raw.trim() : ''
      if (s.length === 0) return COMBO_TECHNIQUE_PREFIX
      const max = 40
      return s.length > max ? s.slice(0, max) : s
    })(),
    comboTechniqueAllowAnyUserInput:
      typeof attackConfig.comboTechniqueAllowAnyUserInput === 'boolean'
        ? attackConfig.comboTechniqueAllowAnyUserInput
        : DEFAULT_CONFIG.attack.comboTechniqueAllowAnyUserInput,
    comboTechniqueResultFontScalePercent: isInRange(Number(attackConfig.comboTechniqueResultFontScalePercent), 50, 200)
      ? Math.round(Number(attackConfig.comboTechniqueResultFontScalePercent) || DEFAULT_CONFIG.attack.comboTechniqueResultFontScalePercent)
      : DEFAULT_CONFIG.attack.comboTechniqueResultFontScalePercent,
    comboTechniqueChallengeFontScalePercent: isInRange(Number(attackConfig.comboTechniqueChallengeFontScalePercent), 50, 200)
      ? Math.round(Number(attackConfig.comboTechniqueChallengeFontScalePercent) || DEFAULT_CONFIG.attack.comboTechniqueChallengeFontScalePercent)
      : DEFAULT_CONFIG.attack.comboTechniqueChallengeFontScalePercent,
    comboTechniqueChallengeLongTextThresholdChars: isInRange(
      Number(attackConfig.comboTechniqueChallengeLongTextThresholdChars),
      0,
      80
    )
      ? Math.floor(
        Number(attackConfig.comboTechniqueChallengeLongTextThresholdChars) ||
            DEFAULT_CONFIG.attack.comboTechniqueChallengeLongTextThresholdChars
      )
      : DEFAULT_CONFIG.attack.comboTechniqueChallengeLongTextThresholdChars,
    comboTechniqueChallengeLongTextScalePercent: isInRange(
      Number(attackConfig.comboTechniqueChallengeLongTextScalePercent),
      30,
      100
    )
      ? Math.round(
        Number(attackConfig.comboTechniqueChallengeLongTextScalePercent) ||
            DEFAULT_CONFIG.attack.comboTechniqueChallengeLongTextScalePercent
      )
      : DEFAULT_CONFIG.attack.comboTechniqueChallengeLongTextScalePercent,
    comboTechniqueChallengeGapAboveGaugePx: isInRange(
      Number(attackConfig.comboTechniqueChallengeGapAboveGaugePx),
      0,
      300
    )
      ? Math.round(
        Number(attackConfig.comboTechniqueChallengeGapAboveGaugePx) ||
            DEFAULT_CONFIG.attack.comboTechniqueChallengeGapAboveGaugePx
      )
      : DEFAULT_CONFIG.attack.comboTechniqueChallengeGapAboveGaugePx,
    comboTechniqueChallengeOffsetXPx: isInRange(Number(attackConfig.comboTechniqueChallengeOffsetXPx), -1000, 1000)
      ? Math.round(Number(attackConfig.comboTechniqueChallengeOffsetXPx) || 0)
      : DEFAULT_CONFIG.attack.comboTechniqueChallengeOffsetXPx,
    comboTechniqueChallengeOffsetYPx: isInRange(Number(attackConfig.comboTechniqueChallengeOffsetYPx), -1000, 1000)
      ? Math.round(Number(attackConfig.comboTechniqueChallengeOffsetYPx) || 0)
      : DEFAULT_CONFIG.attack.comboTechniqueChallengeOffsetYPx,
    comboTechniqueChallengeTextAlign:
      attackConfig.comboTechniqueChallengeTextAlign === 'left' ||
      attackConfig.comboTechniqueChallengeTextAlign === 'right' ||
      attackConfig.comboTechniqueChallengeTextAlign === 'center'
        ? (attackConfig.comboTechniqueChallengeTextAlign as 'left' | 'center' | 'right')
        : DEFAULT_CONFIG.attack.comboTechniqueChallengeTextAlign,
    testPanelSimulation: sanitizeTestPanelSimulation(attackConfig.testPanelSimulation, legacyTestForPanelSim),
    testNoDamageCommand:
      typeof attackConfig.testNoDamageCommand === 'string' && isValidLength(attackConfig.testNoDamageCommand, 1, 50)
        ? (attackConfig.testNoDamageCommand as string).replace(/[<>"']/g, '')
        : DEFAULT_CONFIG.attack.testNoDamageCommand,
    survivalHp1Enabled: typeof attackConfig.survivalHp1Enabled === 'boolean' ? attackConfig.survivalHp1Enabled : false,
    survivalHp1Probability: isInRange(Number(attackConfig.survivalHp1Probability), 0, 100)
      ? Number(attackConfig.survivalHp1Probability) || 30
      : 30,
    survivalHp1Message: typeof attackConfig.survivalHp1Message === 'string' ? attackConfig.survivalHp1Message : '食いしばり!',
  }

  // 回復設定の検証
  const healConfig = (c.heal as Record<string, unknown> | undefined) || {}
  const heal = {
    customText: typeof healConfig.customText === 'string' ? healConfig.customText : '',
    enabled: typeof healConfig.enabled === 'boolean' ? healConfig.enabled : true,
    effectEnabled: typeof healConfig.effectEnabled === 'boolean' ? healConfig.effectEnabled : true,
    healType: (healConfig.healType === 'random' ? 'random' : 'fixed') as 'fixed' | 'random',
    healAmount: isInRange(Number(healConfig.healAmount), 1, 999999)
      ? Number(healConfig.healAmount) || 20
      : 20,
    healMin: isInRange(Number(healConfig.healMin), 1, 999999)
      ? Number(healConfig.healMin) || 10
      : 10,
    healMax: isInRange(Number(healConfig.healMax), 1, 999999)
      ? Number(healConfig.healMax) || 30
      : 30,
    healRandomStep: isInRange(Number(healConfig.healRandomStep), 1, 999999)
      ? Math.floor(Number(healConfig.healRandomStep)) || 1
      : 1,
    soundEnabled: typeof healConfig.soundEnabled === 'boolean' ? healConfig.soundEnabled : false,
    soundUrl:
      typeof healConfig.soundUrl === 'string' && isValidUrl(healConfig.soundUrl)
        ? healConfig.soundUrl
        : '',
    soundVolume: isInRange(Number(healConfig.soundVolume), 0, 1)
      ? Number(healConfig.soundVolume) || 0.7
      : 0.7,
    filterEffectEnabled: typeof healConfig.filterEffectEnabled === 'boolean' ? healConfig.filterEffectEnabled : true,
    healWhenZeroEnabled: typeof healConfig.healWhenZeroEnabled === 'boolean' ? healConfig.healWhenZeroEnabled : true,
    autoReplyEnabled: typeof healConfig.autoReplyEnabled === 'boolean' ? healConfig.autoReplyEnabled : false,
    autoReplyMessageTemplate: typeof healConfig.autoReplyMessageTemplate === 'string' ? healConfig.autoReplyMessageTemplate : '配信者の残りHP: {hp}/{max}',
  }

  // リトライ設定の検証
  const retryConfig = (c.retry as Record<string, unknown> | undefined) || {}
  const retry = {
    command:
      typeof retryConfig.command === 'string' && isValidLength(retryConfig.command, 1, 50)
        ? retryConfig.command.replace(/[<>"']/g, '') // 危険な文字を削除
        : '!retry',
    streamerAutoReplyEnabled: typeof retryConfig.streamerAutoReplyEnabled === 'boolean' ? retryConfig.streamerAutoReplyEnabled : true,
    fullHealCommand:
      typeof retryConfig.fullHealCommand === 'string' && isValidLength(retryConfig.fullHealCommand, 1, 50)
        ? (retryConfig.fullHealCommand as string).replace(/[<>"']/g, '')
        : '!fullheal',
    fullResetAllCommand:
      typeof retryConfig.fullResetAllCommand === 'string' && isValidLength(retryConfig.fullResetAllCommand, 1, 50)
        ? (retryConfig.fullResetAllCommand as string).replace(/[<>"']/g, '')
        : '!resetall',
    streamerHealCommand:
      typeof retryConfig.streamerHealCommand === 'string' && isValidLength(retryConfig.streamerHealCommand, 1, 50)
        ? (retryConfig.streamerHealCommand as string).replace(/[<>"']/g, '')
        : '!heal',
    streamerHealType: (retryConfig.streamerHealType === 'random' ? 'random' : 'fixed') as 'fixed' | 'random',
    streamerHealAmount: isInRange(Number(retryConfig.streamerHealAmount), 1, 999999) ? Number(retryConfig.streamerHealAmount) || 20 : 20,
    streamerHealMin: isInRange(Number(retryConfig.streamerHealMin), 1, 999999) ? Number(retryConfig.streamerHealMin) || 10 : 10,
    streamerHealMax: isInRange(Number(retryConfig.streamerHealMax), 1, 999999) ? Number(retryConfig.streamerHealMax) || 30 : 30,
    streamerHealRandomStep: isInRange(Number(retryConfig.streamerHealRandomStep), 1, 999999) ? Math.floor(Number(retryConfig.streamerHealRandomStep)) || 1 : 1,
    streamerHealWhenZeroEnabled: typeof retryConfig.streamerHealWhenZeroEnabled === 'boolean' ? retryConfig.streamerHealWhenZeroEnabled : true,
    enabled: typeof retryConfig.enabled === 'boolean' ? retryConfig.enabled : true,
    soundEnabled: typeof retryConfig.soundEnabled === 'boolean' ? retryConfig.soundEnabled : false,
    soundUrl:
      typeof retryConfig.soundUrl === 'string' && isValidUrl(retryConfig.soundUrl)
        ? retryConfig.soundUrl
        : '',
    soundVolume: isInRange(Number(retryConfig.soundVolume), 0, 1)
      ? Number(retryConfig.soundVolume) || 0.7
      : 0.7,
  }

  // アニメーション設定の検証
  const animationConfig = (c.animation as Record<string, unknown> | undefined) || {}
  const animation = {
    duration: isInRange(Number(animationConfig.duration), 0, MAX_NUM)
      ? Number(animationConfig.duration) || 500
      : 500,
    easing: typeof animationConfig.easing === 'string' ? animationConfig.easing : 'ease-out',
  }

  // 表示設定の検証
  const displayConfig = (c.display as Record<string, unknown> | undefined) || {}
  const gaugeDesignRaw = displayConfig.gaugeDesign
  const gaugeDesign: GaugeDesign =
    gaugeDesignRaw === 'parallelogram' || gaugeDesignRaw === 'default' ? gaugeDesignRaw : 'default'

  const shapeRaw = (displayConfig.gaugeShape as Record<string, unknown> | undefined) || {}
  const shapeDefaults = DEFAULT_CONFIG.display.gaugeShape
  const gaugeShape: GaugeShapeConfig = {
    skewDeg: sanitizeGaugeShapeField(shapeRaw.skewDeg, -60, 60, shapeDefaults.skewDeg, false),
    defaultBorderRadiusPx: sanitizeGaugeShapeField(
      shapeRaw.defaultBorderRadiusPx,
      0,
      200,
      shapeDefaults.defaultBorderRadiusPx,
      true
    ),
    defaultBorderWhitePx: sanitizeGaugeShapeField(
      shapeRaw.defaultBorderWhitePx,
      0,
      80,
      shapeDefaults.defaultBorderWhitePx,
      true
    ),
    defaultBorderGrayPx: sanitizeGaugeShapeField(
      shapeRaw.defaultBorderGrayPx,
      0,
      160,
      shapeDefaults.defaultBorderGrayPx,
      true
    ),
    parallelogramBorderRadiusPx: sanitizeGaugeShapeField(
      shapeRaw.parallelogramBorderRadiusPx,
      0,
      80,
      shapeDefaults.parallelogramBorderRadiusPx,
      true
    ),
    parallelogramBorderWhitePx: sanitizeGaugeShapeField(
      shapeRaw.parallelogramBorderWhitePx,
      0,
      80,
      shapeDefaults.parallelogramBorderWhitePx,
      true
    ),
    parallelogramBorderGrayPx: sanitizeGaugeShapeField(
      shapeRaw.parallelogramBorderGrayPx,
      0,
      160,
      shapeDefaults.parallelogramBorderGrayPx,
      true
    ),
    parallelogramFramePaddingPx: sanitizeGaugeShapeField(
      shapeRaw.parallelogramFramePaddingPx,
      0,
      200,
      shapeDefaults.parallelogramFramePaddingPx,
      true
    ),
  }

  const display = {
    showMaxHp: typeof displayConfig.showMaxHp === 'boolean' ? displayConfig.showMaxHp : true,
    fontSize: isInRange(Number(displayConfig.fontSize), 1, MAX_NUM)
      ? Number(displayConfig.fontSize) || 24
      : 24,
    damageHealPopupFontScalePercent: isInRange(Number(displayConfig.damageHealPopupFontScalePercent), 50, 200)
      ? Math.round(Number(displayConfig.damageHealPopupFontScalePercent) || DEFAULT_CONFIG.display.damageHealPopupFontScalePercent)
      : DEFAULT_CONFIG.display.damageHealPopupFontScalePercent,
    overlayBannerFontScalePercent: isInRange(Number(displayConfig.overlayBannerFontScalePercent), 50, 200)
      ? Math.round(Number(displayConfig.overlayBannerFontScalePercent) || DEFAULT_CONFIG.display.overlayBannerFontScalePercent)
      : DEFAULT_CONFIG.display.overlayBannerFontScalePercent,
    gaugeDesign,
    gaugeShape,
  }

  // 画像URLの検証
  const zeroHpImageConfig = (c.zeroHpImage as Record<string, unknown> | undefined) || {}
  const zeroHpImage = {
    enabled: typeof zeroHpImageConfig.enabled === 'boolean' ? zeroHpImageConfig.enabled : true,
    imageUrl:
      typeof zeroHpImageConfig.imageUrl === 'string' && isValidUrl(zeroHpImageConfig.imageUrl)
        ? zeroHpImageConfig.imageUrl
        : '',
    // スケール倍率は 0.1 以上なら上限なし（異常値のみデフォルトにフォールバック）
    scale: isInRange(Number(zeroHpImageConfig.scale), 0.1, MAX_NUM)
      ? Number(zeroHpImageConfig.scale) || DEFAULT_CONFIG.zeroHpImage.scale
      : DEFAULT_CONFIG.zeroHpImage.scale,
    offsetX: isInRange(Number(zeroHpImageConfig.offsetX), -10000, 10000)
      ? Number(zeroHpImageConfig.offsetX) || DEFAULT_CONFIG.zeroHpImage.offsetX
      : DEFAULT_CONFIG.zeroHpImage.offsetX,
    offsetY: isInRange(Number(zeroHpImageConfig.offsetY), -10000, 10000)
      ? Number(zeroHpImageConfig.offsetY) || DEFAULT_CONFIG.zeroHpImage.offsetY
      : DEFAULT_CONFIG.zeroHpImage.offsetY,
    backgroundColor:
      typeof zeroHpImageConfig.backgroundColor === 'string' && isValidLength(zeroHpImageConfig.backgroundColor, 1, 50)
        ? (zeroHpImageConfig.backgroundColor as string)
        : DEFAULT_CONFIG.zeroHpImage.backgroundColor,
  }

  // 音声URLの検証
  const zeroHpSoundConfig = (c.zeroHpSound as Record<string, unknown> | undefined) || {}
  const zeroHpSound = {
    enabled: typeof zeroHpSoundConfig.enabled === 'boolean' ? zeroHpSoundConfig.enabled : true,
    soundUrl:
      typeof zeroHpSoundConfig.soundUrl === 'string' && isValidUrl(zeroHpSoundConfig.soundUrl)
        ? zeroHpSoundConfig.soundUrl
        : '',
    volume: isInRange(Number(zeroHpSoundConfig.volume), 0, 1)
      ? Number(zeroHpSoundConfig.volume) || 0.7
      : 0.7,
  }

  // 動画URLの検証
  const zeroHpEffectConfig = (c.zeroHpEffect as Record<string, unknown> | undefined) || {}
  const zeroHpEffect = {
    enabled: typeof zeroHpEffectConfig.enabled === 'boolean' ? zeroHpEffectConfig.enabled : true,
    videoUrl:
      typeof zeroHpEffectConfig.videoUrl === 'string' && isValidUrl(zeroHpEffectConfig.videoUrl)
        ? zeroHpEffectConfig.videoUrl
        : DEFAULT_CONFIG.zeroHpEffect.videoUrl,
    duration: isInRange(Number(zeroHpEffectConfig.duration), 1, MAX_NUM)
      ? Number(zeroHpEffectConfig.duration) || 2000
      : 2000,
  }

  // テスト設定の検証
  const testConfig = (c.test as Record<string, unknown> | undefined) || {}
  const test = {
    enabled: typeof testConfig.enabled === 'boolean' ? testConfig.enabled : false,
  }

  // WebMループ設定の検証
  const webmLoopConfig = (c.webmLoop as Record<string, unknown> | undefined) || {}
  const webmLoop = {
    enabled: typeof webmLoopConfig.enabled === 'boolean' ? webmLoopConfig.enabled : false,
    x: isInRange(Number(webmLoopConfig.x), -10000, 10000)
      ? Number(webmLoopConfig.x) || 0
      : 0,
    y: isInRange(Number(webmLoopConfig.y), -10000, 10000)
      ? Number(webmLoopConfig.y) || 0
      : 0,
    width: isInRange(Number(webmLoopConfig.width), 1, MAX_NUM)
      ? Number(webmLoopConfig.width) || 800
      : 800,
    height: isInRange(Number(webmLoopConfig.height), 1, MAX_NUM)
      ? Number(webmLoopConfig.height) || 600
      : 600,
    opacity: isInRange(Number(webmLoopConfig.opacity), 0, 1)
      ? Number(webmLoopConfig.opacity) || 1.0
      : 1.0,
    zIndex: isInRange(Number(webmLoopConfig.zIndex), -100, 100)
      ? Number(webmLoopConfig.zIndex) || 1
      : 1,
    videoUrl:
      typeof webmLoopConfig.videoUrl === 'string' && isValidUrl(webmLoopConfig.videoUrl)
        ? webmLoopConfig.videoUrl
        : '',
    loop: typeof webmLoopConfig.loop === 'boolean' ? webmLoopConfig.loop : true,
  }

  // ダメージエフェクトフィルター設定の検証
  const damageEffectFilterConfig = (c.damageEffectFilter as Record<string, unknown> | undefined) || {}
  const damageEffectFilter = {
    sepia: isInRange(Number(damageEffectFilterConfig.sepia), 0, 1)
      ? Number(damageEffectFilterConfig.sepia) || DEFAULT_CONFIG.damageEffectFilter.sepia
      : DEFAULT_CONFIG.damageEffectFilter.sepia,
    hueRotate: isInRange(Number(damageEffectFilterConfig.hueRotate), -360, 360)
      ? Number(damageEffectFilterConfig.hueRotate) || DEFAULT_CONFIG.damageEffectFilter.hueRotate
      : DEFAULT_CONFIG.damageEffectFilter.hueRotate,
    saturate: isInRange(Number(damageEffectFilterConfig.saturate), 0, 2)
      ? Number(damageEffectFilterConfig.saturate) || DEFAULT_CONFIG.damageEffectFilter.saturate
      : DEFAULT_CONFIG.damageEffectFilter.saturate,
    brightness: isInRange(Number(damageEffectFilterConfig.brightness), 0, 2)
      ? Number(damageEffectFilterConfig.brightness) || DEFAULT_CONFIG.damageEffectFilter.brightness
      : DEFAULT_CONFIG.damageEffectFilter.brightness,
    contrast: isInRange(Number(damageEffectFilterConfig.contrast), 0, 2)
      ? Number(damageEffectFilterConfig.contrast) || DEFAULT_CONFIG.damageEffectFilter.contrast
      : DEFAULT_CONFIG.damageEffectFilter.contrast,
  }

  // 回復エフェクトフィルター設定の検証
  const healEffectFilterConfig = (c.healEffectFilter as Record<string, unknown> | undefined) || {}
  const healEffectFilter = {
    sepia: isInRange(Number(healEffectFilterConfig.sepia), 0, 1)
      ? Number(healEffectFilterConfig.sepia) || DEFAULT_CONFIG.healEffectFilter.sepia
      : DEFAULT_CONFIG.healEffectFilter.sepia,
    hueRotate: isInRange(Number(healEffectFilterConfig.hueRotate), -360, 360)
      ? Number(healEffectFilterConfig.hueRotate) || DEFAULT_CONFIG.healEffectFilter.hueRotate
      : DEFAULT_CONFIG.healEffectFilter.hueRotate,
    saturate: isInRange(Number(healEffectFilterConfig.saturate), 0, 2)
      ? Number(healEffectFilterConfig.saturate) || DEFAULT_CONFIG.healEffectFilter.saturate
      : DEFAULT_CONFIG.healEffectFilter.saturate,
    brightness: isInRange(Number(healEffectFilterConfig.brightness), 0, 2)
      ? Number(healEffectFilterConfig.brightness) || DEFAULT_CONFIG.healEffectFilter.brightness
      : DEFAULT_CONFIG.healEffectFilter.brightness,
    contrast: isInRange(Number(healEffectFilterConfig.contrast), 0, 2)
      ? Number(healEffectFilterConfig.contrast) || DEFAULT_CONFIG.healEffectFilter.contrast
      : DEFAULT_CONFIG.healEffectFilter.contrast,
  }

  // HPゲージ色設定の検証
  const gaugeColorsConfig = (c.gaugeColors as Record<string, unknown> | undefined) || {}
  const gaugeColors = {
    lastGauge: isValidColor(gaugeColorsConfig.lastGauge) ? (gaugeColorsConfig.lastGauge as string) : DEFAULT_CONFIG.gaugeColors.lastGauge,
    secondGauge: isValidColor(gaugeColorsConfig.secondGauge) ? (gaugeColorsConfig.secondGauge as string) : DEFAULT_CONFIG.gaugeColors.secondGauge,
    patternColor1: isValidColor(gaugeColorsConfig.patternColor1) ? (gaugeColorsConfig.patternColor1 as string) : (isValidColor(gaugeColorsConfig.thirdGauge) ? (gaugeColorsConfig.thirdGauge as string) : DEFAULT_CONFIG.gaugeColors.patternColor1), // 後方互換性: thirdGaugeもチェック
    patternColor2: isValidColor(gaugeColorsConfig.patternColor2) ? (gaugeColorsConfig.patternColor2 as string) : (isValidColor(gaugeColorsConfig.fourthGauge) ? (gaugeColorsConfig.fourthGauge as string) : DEFAULT_CONFIG.gaugeColors.patternColor2), // 後方互換性: fourthGaugeもチェック
    frameBackground: isValidColor(gaugeColorsConfig.frameBackground)
      ? (gaugeColorsConfig.frameBackground as string)
      : DEFAULT_CONFIG.gaugeColors.frameBackground,
    frameBorderInner: isValidColor(gaugeColorsConfig.frameBorderInner)
      ? (gaugeColorsConfig.frameBorderInner as string)
      : DEFAULT_CONFIG.gaugeColors.frameBorderInner,
    frameBorderOuter: isValidColor(gaugeColorsConfig.frameBorderOuter)
      ? (gaugeColorsConfig.frameBorderOuter as string)
      : DEFAULT_CONFIG.gaugeColors.frameBorderOuter,
  }

  // ダメージ値色設定の検証
  const damageColorsConfig = (c.damageColors as Record<string, unknown> | undefined) || {}
  const damageColors = {
    normal: isValidColor(damageColorsConfig.normal) ? (damageColorsConfig.normal as string) : DEFAULT_CONFIG.damageColors.normal,
    critical: isValidColor(damageColorsConfig.critical) ? (damageColorsConfig.critical as string) : DEFAULT_CONFIG.damageColors.critical,
    bleed: isValidColor(damageColorsConfig.bleed) ? (damageColorsConfig.bleed as string) : DEFAULT_CONFIG.damageColors.bleed,
    dotPoison: isValidColor(damageColorsConfig.dotPoison)
      ? (damageColorsConfig.dotPoison as string)
      : DEFAULT_CONFIG.damageColors.dotPoison,
    dotBurn: isValidColor(damageColorsConfig.dotBurn)
      ? (damageColorsConfig.dotBurn as string)
      : DEFAULT_CONFIG.damageColors.dotBurn,
  }

  // 回復値色設定の検証
  const healColorsConfig = (c.healColors as Record<string, unknown> | undefined) || {}
  const healColors = {
    normal: isValidColor(healColorsConfig.normal) ? (healColorsConfig.normal as string) : DEFAULT_CONFIG.healColors.normal,
  }

  const obsCaptureGuideConfig = (c.obsCaptureGuide as Record<string, unknown> | undefined) || {}
  const obsCaptureGuide = {
    enabled:
      typeof obsCaptureGuideConfig.enabled === 'boolean'
        ? obsCaptureGuideConfig.enabled
        : DEFAULT_CONFIG.obsCaptureGuide.enabled,
    insetPx: isInRange(Number(obsCaptureGuideConfig.insetPx), 0, 400)
      ? Math.max(0, Math.floor(Number(obsCaptureGuideConfig.insetPx)))
      : DEFAULT_CONFIG.obsCaptureGuide.insetPx,
  }

  const obsWebSocketConfig = (c.obsWebSocket as Record<string, unknown> | undefined) || {}
  const obsWebSocketEffectsConfig = (obsWebSocketConfig.effects as Record<string, unknown> | undefined) || {}
  const obsWebSocket = {
    enabled: typeof obsWebSocketConfig.enabled === 'boolean' ? obsWebSocketConfig.enabled : DEFAULT_CONFIG.obsWebSocket.enabled,
    host:
      typeof obsWebSocketConfig.host === 'string' && isValidLength(obsWebSocketConfig.host.trim(), 1, 200)
        ? obsWebSocketConfig.host.trim()
        : DEFAULT_CONFIG.obsWebSocket.host,
    port: isInRange(Number(obsWebSocketConfig.port), 1, 65535)
      ? Math.floor(Number(obsWebSocketConfig.port))
      : DEFAULT_CONFIG.obsWebSocket.port,
    password: typeof obsWebSocketConfig.password === 'string' ? obsWebSocketConfig.password : DEFAULT_CONFIG.obsWebSocket.password,
    sceneName: typeof obsWebSocketConfig.sceneName === 'string' ? obsWebSocketConfig.sceneName : DEFAULT_CONFIG.obsWebSocket.sceneName,
    sourceName: typeof obsWebSocketConfig.sourceName === 'string' ? obsWebSocketConfig.sourceName : DEFAULT_CONFIG.obsWebSocket.sourceName,
    effects: {
      damageShakeEnabled: typeof obsWebSocketEffectsConfig.damageShakeEnabled === 'boolean'
        ? obsWebSocketEffectsConfig.damageShakeEnabled
        : DEFAULT_CONFIG.obsWebSocket.effects.damageShakeEnabled,
      damageShakeStrengthPx: isInRange(Number(obsWebSocketEffectsConfig.damageShakeStrengthPx), 0, 500)
        ? Math.floor(Number(obsWebSocketEffectsConfig.damageShakeStrengthPx))
        : DEFAULT_CONFIG.obsWebSocket.effects.damageShakeStrengthPx,
      damageShakeDurationMs: isInRange(Number(obsWebSocketEffectsConfig.damageShakeDurationMs), 0, 10000)
        ? Math.floor(Number(obsWebSocketEffectsConfig.damageShakeDurationMs))
        : DEFAULT_CONFIG.obsWebSocket.effects.damageShakeDurationMs,

      healGlowEnabled: typeof obsWebSocketEffectsConfig.healGlowEnabled === 'boolean'
        ? obsWebSocketEffectsConfig.healGlowEnabled
        : DEFAULT_CONFIG.obsWebSocket.effects.healGlowEnabled,
      healGlowScale: isInRange(Number(obsWebSocketEffectsConfig.healGlowScale), 1, 3)
        ? Math.round(Number(obsWebSocketEffectsConfig.healGlowScale) * 100) / 100
        : DEFAULT_CONFIG.obsWebSocket.effects.healGlowScale,
      healGlowDurationMs: isInRange(Number(obsWebSocketEffectsConfig.healGlowDurationMs), 0, 10000)
        ? Math.floor(Number(obsWebSocketEffectsConfig.healGlowDurationMs))
        : DEFAULT_CONFIG.obsWebSocket.effects.healGlowDurationMs,

      dodgeMoveEnabled: typeof obsWebSocketEffectsConfig.dodgeMoveEnabled === 'boolean'
        ? obsWebSocketEffectsConfig.dodgeMoveEnabled
        : DEFAULT_CONFIG.obsWebSocket.effects.dodgeMoveEnabled,
      dodgeMoveDistancePx: isInRange(Number(obsWebSocketEffectsConfig.dodgeMoveDistancePx), 0, 2000)
        ? Math.floor(Number(obsWebSocketEffectsConfig.dodgeMoveDistancePx))
        : DEFAULT_CONFIG.obsWebSocket.effects.dodgeMoveDistancePx,
      dodgeMoveDurationMs: isInRange(Number(obsWebSocketEffectsConfig.dodgeMoveDurationMs), 0, 10000)
        ? Math.floor(Number(obsWebSocketEffectsConfig.dodgeMoveDurationMs))
        : DEFAULT_CONFIG.obsWebSocket.effects.dodgeMoveDurationMs,

      finishingMoveEnabled: typeof obsWebSocketEffectsConfig.finishingMoveEnabled === 'boolean'
        ? obsWebSocketEffectsConfig.finishingMoveEnabled
        : DEFAULT_CONFIG.obsWebSocket.effects.finishingMoveEnabled,
      finishingMoveShakeStrengthPx: isInRange(Number(obsWebSocketEffectsConfig.finishingMoveShakeStrengthPx), 0, 1000)
        ? Math.floor(Number(obsWebSocketEffectsConfig.finishingMoveShakeStrengthPx))
        : DEFAULT_CONFIG.obsWebSocket.effects.finishingMoveShakeStrengthPx,
      finishingMoveShakeDurationMs: isInRange(Number(obsWebSocketEffectsConfig.finishingMoveShakeDurationMs), 0, 15000)
        ? Math.floor(Number(obsWebSocketEffectsConfig.finishingMoveShakeDurationMs))
        : DEFAULT_CONFIG.obsWebSocket.effects.finishingMoveShakeDurationMs,
      finishingMoveGlowScale: isInRange(Number(obsWebSocketEffectsConfig.finishingMoveGlowScale), 1, 5)
        ? Math.round(Number(obsWebSocketEffectsConfig.finishingMoveGlowScale) * 100) / 100
        : DEFAULT_CONFIG.obsWebSocket.effects.finishingMoveGlowScale,
      finishingMoveGlowDurationMs: isInRange(Number(obsWebSocketEffectsConfig.finishingMoveGlowDurationMs), 0, 15000)
        ? Math.floor(Number(obsWebSocketEffectsConfig.finishingMoveGlowDurationMs))
        : DEFAULT_CONFIG.obsWebSocket.effects.finishingMoveGlowDurationMs,
    },
  }

  const backgroundConfig = (c.background as Record<string, unknown> | undefined) || {}
  const sanitizeBgMode = (raw: unknown): 'green' | 'dark-gray' | 'custom' | 'transparent' => {
    if (typeof raw === 'string') {
      const s = raw.trim()
      if (s === 'green' || s === 'dark-gray' || s === 'custom' || s === 'transparent') return s
    }
    return DEFAULT_CONFIG.background.mode
  }
  const background = {
    mode: sanitizeBgMode(backgroundConfig.mode),
    customColor:
      typeof backgroundConfig.customColor === 'string' && isValidLength(backgroundConfig.customColor.trim(), 1, 50)
        ? backgroundConfig.customColor.trim()
        : DEFAULT_CONFIG.background.customColor,
  }

  // PvP設定の検証（streamerAttack は attack と同じ構造）
  const pvpConfig = (c.pvp as Record<string, unknown> | undefined) || {}
  const sa = (pvpConfig.streamerAttack as Record<string, unknown> | undefined) || {}
  const streamerDamageType: 'fixed' | 'random' = sa.damageType === 'random' ? 'random' : 'fixed'
  const streamerAttack = {
    customText: typeof sa.customText === 'string' ? sa.customText : '',
    enabled: typeof sa.enabled === 'boolean' ? sa.enabled : true,
    damageType: streamerDamageType,
    damage: isInRange(Number(sa.damage), 1, MAX_NUM) ? Number(sa.damage) || 15 : 15,
    damageMin: isInRange(Number(sa.damageMin), 1, MAX_NUM) ? Number(sa.damageMin) || 10 : 10,
    damageMax: isInRange(Number(sa.damageMax), 1, MAX_NUM) ? Number(sa.damageMax) || 25 : 25,
    damageRandomStep: isInRange(Number(sa.damageRandomStep), 1, MAX_NUM) ? Number(sa.damageRandomStep) || 1 : 1,
    missEnabled: typeof sa.missEnabled === 'boolean' ? sa.missEnabled : false,
    missProbability: isInRange(Number(sa.missProbability), 0, 100) ? Number(sa.missProbability) || 0 : 0,
    missSoundEnabled: typeof sa.missSoundEnabled === 'boolean' ? sa.missSoundEnabled : false,
    missSoundUrl: typeof sa.missSoundUrl === 'string' ? sa.missSoundUrl : '',
    missSoundVolume: isInRange(Number(sa.missSoundVolume), 0, 1) ? Number(sa.missSoundVolume) || 0.7 : 0.7,
    missTextColor: isValidColor(sa.missTextColor) ? (sa.missTextColor as string) : DEFAULT_CONFIG.pvp.streamerAttack.missTextColor,
    criticalEnabled: typeof sa.criticalEnabled === 'boolean' ? sa.criticalEnabled : false,
    criticalProbability: isInRange(Number(sa.criticalProbability), 0, 100) ? Number(sa.criticalProbability) || 0 : 0,
    criticalMultiplier: isInRange(Number(sa.criticalMultiplier), 1, MAX_NUM) ? Number(sa.criticalMultiplier) || 2 : 2,
    bleedEnabled: typeof sa.bleedEnabled === 'boolean' ? sa.bleedEnabled : false,
    bleedProbability: isInRange(Number(sa.bleedProbability), 0, 100) ? Number(sa.bleedProbability) || 0 : 0,
    bleedDamage: isInRange(Number(sa.bleedDamage), 1, MAX_NUM) ? Number(sa.bleedDamage) || 5 : 5,
    bleedDuration: isInRange(Number(sa.bleedDuration), 1, MAX_NUM) ? Number(sa.bleedDuration) || 10 : 10,
    bleedInterval: isInRange(Number(sa.bleedInterval), 0.1, MAX_NUM) ? Number(sa.bleedInterval) || 1 : 1,
    bleedVariants: sanitizeBleedVariants(sa.bleedVariants),
    bleedSoundEnabled: typeof sa.bleedSoundEnabled === 'boolean' ? sa.bleedSoundEnabled : false,
    bleedSoundUrl: typeof sa.bleedSoundUrl === 'string' ? sa.bleedSoundUrl : '',
    bleedSoundVolume: isInRange(Number(sa.bleedSoundVolume), 0, 1) ? Number(sa.bleedSoundVolume) || 0.7 : 0.7,
    dotPoisonSoundEnabled: typeof sa.dotPoisonSoundEnabled === 'boolean' ? sa.dotPoisonSoundEnabled : false,
    dotPoisonSoundUrl: typeof sa.dotPoisonSoundUrl === 'string' ? sa.dotPoisonSoundUrl : '',
    dotPoisonSoundVolume: isInRange(Number(sa.dotPoisonSoundVolume), 0, 1) ? Number(sa.dotPoisonSoundVolume) || 0.7 : 0.7,
    dotBurnSoundEnabled: typeof sa.dotBurnSoundEnabled === 'boolean' ? sa.dotBurnSoundEnabled : false,
    dotBurnSoundUrl: typeof sa.dotBurnSoundUrl === 'string' ? sa.dotBurnSoundUrl : '',
    dotBurnSoundVolume: isInRange(Number(sa.dotBurnSoundVolume), 0, 1) ? Number(sa.dotBurnSoundVolume) || 0.7 : 0.7,
    dotPoisonAttackSoundEnabled: typeof sa.dotPoisonAttackSoundEnabled === 'boolean' ? sa.dotPoisonAttackSoundEnabled : false,
    dotPoisonAttackSoundUrl: typeof sa.dotPoisonAttackSoundUrl === 'string' ? sa.dotPoisonAttackSoundUrl : '',
    dotPoisonAttackSoundVolume: isInRange(Number(sa.dotPoisonAttackSoundVolume), 0, 1) ? Number(sa.dotPoisonAttackSoundVolume) || 0.7 : 0.7,
    dotBurnAttackSoundEnabled: typeof sa.dotBurnAttackSoundEnabled === 'boolean' ? sa.dotBurnAttackSoundEnabled : false,
    dotBurnAttackSoundUrl: typeof sa.dotBurnAttackSoundUrl === 'string' ? sa.dotBurnAttackSoundUrl : '',
    dotBurnAttackSoundVolume: isInRange(Number(sa.dotBurnAttackSoundVolume), 0, 1) ? Number(sa.dotBurnAttackSoundVolume) || 0.7 : 0.7,
    soundEnabled: typeof sa.soundEnabled === 'boolean' ? sa.soundEnabled : false,
    soundUrl: typeof sa.soundUrl === 'string' ? sa.soundUrl : '',
    soundVolume: isInRange(Number(sa.soundVolume), 0, 1) ? Number(sa.soundVolume) || 0.7 : 0.7,
    comboTechniqueSoundEnabled:
      typeof sa.comboTechniqueSoundEnabled === 'boolean' ? sa.comboTechniqueSoundEnabled : false,
    comboTechniqueSoundUrl:
      typeof sa.comboTechniqueSoundUrl === 'string' && isValidUrl(sa.comboTechniqueSoundUrl)
        ? sa.comboTechniqueSoundUrl
        : '',
    comboTechniqueSoundVolume: isInRange(Number(sa.comboTechniqueSoundVolume), 0, 1)
      ? Number(sa.comboTechniqueSoundVolume) || 0.7
      : 0.7,
    rouletteSoundEnabled:
      typeof sa.rouletteSoundEnabled === 'boolean' ? sa.rouletteSoundEnabled : false,
    rouletteSoundUrl:
      typeof sa.rouletteSoundUrl === 'string' && isValidUrl(sa.rouletteSoundUrl)
        ? sa.rouletteSoundUrl
        : '',
    rouletteSoundVolume: isInRange(Number(sa.rouletteSoundVolume), 0, 1)
      ? Number(sa.rouletteSoundVolume) || 0.7
      : 0.7,
    filterEffectEnabled: typeof sa.filterEffectEnabled === 'boolean' ? sa.filterEffectEnabled : true,
    attackEffectEnabled:
      typeof sa.attackEffectEnabled === 'boolean' ? sa.attackEffectEnabled : false,
    attackEffectVisual: sanitizeComboRouletteVisual(sa.attackEffectVisual),
    attackEffectVideoUrl:
      typeof sa.attackEffectVideoUrl === 'string' && isValidUrl(sa.attackEffectVideoUrl)
        ? sa.attackEffectVideoUrl
        : '',
    comboTechniqueEffectEnabled:
      typeof sa.comboTechniqueEffectEnabled === 'boolean' ? sa.comboTechniqueEffectEnabled : false,
    comboTechniqueEffectVisual: sanitizeComboRouletteVisual(sa.comboTechniqueEffectVisual),
    comboTechniqueEffectVideoUrl:
      typeof sa.comboTechniqueEffectVideoUrl === 'string' && isValidUrl(sa.comboTechniqueEffectVideoUrl)
        ? sa.comboTechniqueEffectVideoUrl
        : '',
    rouletteEffectEnabled:
      typeof sa.rouletteEffectEnabled === 'boolean' ? sa.rouletteEffectEnabled : false,
    rouletteEffectVisual: sanitizeComboRouletteVisual(sa.rouletteEffectVisual),
    rouletteEffectVideoUrl:
      typeof sa.rouletteEffectVideoUrl === 'string' && isValidUrl(sa.rouletteEffectVideoUrl)
        ? sa.rouletteEffectVideoUrl
        : '',
    comboTechniqueEnabled: typeof sa.comboTechniqueEnabled === 'boolean' ? sa.comboTechniqueEnabled : true,
    comboTechniqueDurationSec: (() => {
      const n = Math.floor(Number(sa.comboTechniqueDurationSec))
      return isInRange(n, 3, 300) ? n || DEFAULT_CONFIG.pvp.streamerAttack.comboTechniqueDurationSec : DEFAULT_CONFIG.pvp.streamerAttack.comboTechniqueDurationSec
    })(),
    comboTechniqueInputPrefix: (() => {
      const raw = sa.comboTechniqueInputPrefix
      const s = typeof raw === 'string' ? raw.trim() : ''
      if (s.length === 0) return COMBO_TECHNIQUE_PREFIX
      const max = 40
      return s.length > max ? s.slice(0, max) : s
    })(),
    comboTechniqueAllowAnyUserInput:
      typeof sa.comboTechniqueAllowAnyUserInput === 'boolean'
        ? sa.comboTechniqueAllowAnyUserInput
        : DEFAULT_CONFIG.pvp.streamerAttack.comboTechniqueAllowAnyUserInput,
    comboTechniqueResultFontScalePercent: isInRange(Number(sa.comboTechniqueResultFontScalePercent), 50, 200)
      ? Math.round(Number(sa.comboTechniqueResultFontScalePercent) || DEFAULT_CONFIG.pvp.streamerAttack.comboTechniqueResultFontScalePercent)
      : DEFAULT_CONFIG.pvp.streamerAttack.comboTechniqueResultFontScalePercent,
    comboTechniqueChallengeFontScalePercent: isInRange(Number(sa.comboTechniqueChallengeFontScalePercent), 50, 200)
      ? Math.round(Number(sa.comboTechniqueChallengeFontScalePercent) || DEFAULT_CONFIG.pvp.streamerAttack.comboTechniqueChallengeFontScalePercent)
      : DEFAULT_CONFIG.pvp.streamerAttack.comboTechniqueChallengeFontScalePercent,
    comboTechniqueChallengeLongTextThresholdChars: isInRange(Number(sa.comboTechniqueChallengeLongTextThresholdChars), 0, 80)
      ? Math.floor(
        Number(sa.comboTechniqueChallengeLongTextThresholdChars) ||
            DEFAULT_CONFIG.pvp.streamerAttack.comboTechniqueChallengeLongTextThresholdChars
      )
      : DEFAULT_CONFIG.pvp.streamerAttack.comboTechniqueChallengeLongTextThresholdChars,
    comboTechniqueChallengeLongTextScalePercent: isInRange(Number(sa.comboTechniqueChallengeLongTextScalePercent), 30, 100)
      ? Math.round(
        Number(sa.comboTechniqueChallengeLongTextScalePercent) ||
            DEFAULT_CONFIG.pvp.streamerAttack.comboTechniqueChallengeLongTextScalePercent
      )
      : DEFAULT_CONFIG.pvp.streamerAttack.comboTechniqueChallengeLongTextScalePercent,
    testPanelSimulation: sanitizeTestPanelSimulation(sa.testPanelSimulation, undefined),
    survivalHp1Enabled: typeof sa.survivalHp1Enabled === 'boolean' ? sa.survivalHp1Enabled : false,
    survivalHp1Probability: isInRange(Number(sa.survivalHp1Probability), 0, 100) ? Number(sa.survivalHp1Probability) || 30 : 30,
    survivalHp1Message: typeof sa.survivalHp1Message === 'string' ? sa.survivalHp1Message : '食いしばり!',
  }
  const viewerMaxHp = typeof pvpConfig.viewerMaxHp === 'number' && pvpConfig.viewerMaxHp > 0
    ? Math.floor(pvpConfig.viewerMaxHp)
    : 100
  const legacyAutoReply = typeof (pvpConfig as { autoReplyEnabled?: boolean }).autoReplyEnabled === 'boolean' ? (pvpConfig as { autoReplyEnabled: boolean }).autoReplyEnabled : true
  const vva = (pvpConfig.viewerVsViewerAttack as Record<string, unknown> | undefined) || {}
  const viewerDamageType: 'fixed' | 'random' = vva.damageType === 'random' ? 'random' : 'fixed'
  const viewerVsViewerAttack = {
    customText: typeof vva.customText === 'string' ? vva.customText : '',
    enabled: typeof vva.enabled === 'boolean' ? vva.enabled : true,
    damageType: viewerDamageType,
    damage: (() => { const d = Number(vva.damage); return (!isNaN(d) && d >= 1) ? d : 10; })(),
    damageMin: isInRange(Number(vva.damageMin), 1, MAX_NUM) ? Number(vva.damageMin) || 5 : 5,
    damageMax: isInRange(Number(vva.damageMax), 1, MAX_NUM) ? Number(vva.damageMax) || 15 : 15,
    damageRandomStep: isInRange(Number(vva.damageRandomStep), 1, MAX_NUM) ? Number(vva.damageRandomStep) || 1 : 1,
    missEnabled: typeof vva.missEnabled === 'boolean' ? vva.missEnabled : false,
    missProbability: isInRange(Number(vva.missProbability), 0, 100) ? Number(vva.missProbability) || 0 : 0,
    missSoundEnabled: typeof vva.missSoundEnabled === 'boolean' ? vva.missSoundEnabled : false,
    missSoundUrl: typeof vva.missSoundUrl === 'string' ? vva.missSoundUrl : '',
    missSoundVolume: isInRange(Number(vva.missSoundVolume), 0, 1) ? Number(vva.missSoundVolume) || 0.7 : 0.7,
    missTextColor: isValidColor(vva.missTextColor) ? (vva.missTextColor as string) : DEFAULT_CONFIG.pvp.viewerVsViewerAttack.missTextColor,
    criticalEnabled: typeof vva.criticalEnabled === 'boolean' ? vva.criticalEnabled : false,
    criticalProbability: isInRange(Number(vva.criticalProbability), 0, 100) ? Number(vva.criticalProbability) || 0 : 0,
    criticalMultiplier: isInRange(Number(vva.criticalMultiplier), 1, MAX_NUM) ? Number(vva.criticalMultiplier) || 2 : 2,
    bleedEnabled: typeof vva.bleedEnabled === 'boolean' ? vva.bleedEnabled : false,
    bleedProbability: isInRange(Number(vva.bleedProbability), 0, 100) ? Number(vva.bleedProbability) || 0 : 0,
    bleedDamage: isInRange(Number(vva.bleedDamage), 1, MAX_NUM) ? Number(vva.bleedDamage) || 5 : 5,
    bleedDuration: isInRange(Number(vva.bleedDuration), 1, MAX_NUM) ? Number(vva.bleedDuration) || 10 : 10,
    bleedInterval: isInRange(Number(vva.bleedInterval), 0.1, MAX_NUM) ? Number(vva.bleedInterval) || 1 : 1,
    bleedVariants: sanitizeBleedVariants(vva.bleedVariants),
    bleedSoundEnabled: typeof vva.bleedSoundEnabled === 'boolean' ? vva.bleedSoundEnabled : false,
    bleedSoundUrl: typeof vva.bleedSoundUrl === 'string' ? vva.bleedSoundUrl : '',
    bleedSoundVolume: isInRange(Number(vva.bleedSoundVolume), 0, 1) ? Number(vva.bleedSoundVolume) || 0.7 : 0.7,
    dotPoisonSoundEnabled: typeof vva.dotPoisonSoundEnabled === 'boolean' ? vva.dotPoisonSoundEnabled : false,
    dotPoisonSoundUrl: typeof vva.dotPoisonSoundUrl === 'string' ? vva.dotPoisonSoundUrl : '',
    dotPoisonSoundVolume: isInRange(Number(vva.dotPoisonSoundVolume), 0, 1) ? Number(vva.dotPoisonSoundVolume) || 0.7 : 0.7,
    dotBurnSoundEnabled: typeof vva.dotBurnSoundEnabled === 'boolean' ? vva.dotBurnSoundEnabled : false,
    dotBurnSoundUrl: typeof vva.dotBurnSoundUrl === 'string' ? vva.dotBurnSoundUrl : '',
    dotBurnSoundVolume: isInRange(Number(vva.dotBurnSoundVolume), 0, 1) ? Number(vva.dotBurnSoundVolume) || 0.7 : 0.7,
    dotPoisonAttackSoundEnabled: typeof vva.dotPoisonAttackSoundEnabled === 'boolean' ? vva.dotPoisonAttackSoundEnabled : false,
    dotPoisonAttackSoundUrl: typeof vva.dotPoisonAttackSoundUrl === 'string' ? vva.dotPoisonAttackSoundUrl : '',
    dotPoisonAttackSoundVolume: isInRange(Number(vva.dotPoisonAttackSoundVolume), 0, 1) ? Number(vva.dotPoisonAttackSoundVolume) || 0.7 : 0.7,
    dotBurnAttackSoundEnabled: typeof vva.dotBurnAttackSoundEnabled === 'boolean' ? vva.dotBurnAttackSoundEnabled : false,
    dotBurnAttackSoundUrl: typeof vva.dotBurnAttackSoundUrl === 'string' ? vva.dotBurnAttackSoundUrl : '',
    dotBurnAttackSoundVolume: isInRange(Number(vva.dotBurnAttackSoundVolume), 0, 1) ? Number(vva.dotBurnAttackSoundVolume) || 0.7 : 0.7,
    soundEnabled: typeof vva.soundEnabled === 'boolean' ? vva.soundEnabled : false,
    soundUrl: typeof vva.soundUrl === 'string' ? vva.soundUrl : '',
    soundVolume: isInRange(Number(vva.soundVolume), 0, 1) ? Number(vva.soundVolume) || 0.7 : 0.7,
    comboTechniqueSoundEnabled:
      typeof vva.comboTechniqueSoundEnabled === 'boolean' ? vva.comboTechniqueSoundEnabled : false,
    comboTechniqueSoundUrl:
      typeof vva.comboTechniqueSoundUrl === 'string' && isValidUrl(vva.comboTechniqueSoundUrl)
        ? vva.comboTechniqueSoundUrl
        : '',
    comboTechniqueSoundVolume: isInRange(Number(vva.comboTechniqueSoundVolume), 0, 1)
      ? Number(vva.comboTechniqueSoundVolume) || 0.7
      : 0.7,
    rouletteSoundEnabled:
      typeof vva.rouletteSoundEnabled === 'boolean' ? vva.rouletteSoundEnabled : false,
    rouletteSoundUrl:
      typeof vva.rouletteSoundUrl === 'string' && isValidUrl(vva.rouletteSoundUrl)
        ? vva.rouletteSoundUrl
        : '',
    rouletteSoundVolume: isInRange(Number(vva.rouletteSoundVolume), 0, 1)
      ? Number(vva.rouletteSoundVolume) || 0.7
      : 0.7,
    filterEffectEnabled: typeof vva.filterEffectEnabled === 'boolean' ? vva.filterEffectEnabled : true,
    attackEffectEnabled:
      typeof vva.attackEffectEnabled === 'boolean' ? vva.attackEffectEnabled : false,
    attackEffectVisual: sanitizeComboRouletteVisual(vva.attackEffectVisual),
    attackEffectVideoUrl:
      typeof vva.attackEffectVideoUrl === 'string' && isValidUrl(vva.attackEffectVideoUrl)
        ? vva.attackEffectVideoUrl
        : '',
    comboTechniqueEffectEnabled:
      typeof vva.comboTechniqueEffectEnabled === 'boolean' ? vva.comboTechniqueEffectEnabled : false,
    comboTechniqueEffectVisual: sanitizeComboRouletteVisual(vva.comboTechniqueEffectVisual),
    comboTechniqueEffectVideoUrl:
      typeof vva.comboTechniqueEffectVideoUrl === 'string' && isValidUrl(vva.comboTechniqueEffectVideoUrl)
        ? vva.comboTechniqueEffectVideoUrl
        : '',
    rouletteEffectEnabled:
      typeof vva.rouletteEffectEnabled === 'boolean' ? vva.rouletteEffectEnabled : false,
    rouletteEffectVisual: sanitizeComboRouletteVisual(vva.rouletteEffectVisual),
    rouletteEffectVideoUrl:
      typeof vva.rouletteEffectVideoUrl === 'string' && isValidUrl(vva.rouletteEffectVideoUrl)
        ? vva.rouletteEffectVideoUrl
        : '',
    comboTechniqueEnabled: typeof vva.comboTechniqueEnabled === 'boolean' ? vva.comboTechniqueEnabled : true,
    comboTechniqueDurationSec: (() => {
      const n = Math.floor(Number(vva.comboTechniqueDurationSec))
      return isInRange(n, 3, 300) ? n || DEFAULT_CONFIG.pvp.viewerVsViewerAttack.comboTechniqueDurationSec : DEFAULT_CONFIG.pvp.viewerVsViewerAttack.comboTechniqueDurationSec
    })(),
    comboTechniqueInputPrefix: (() => {
      const raw = vva.comboTechniqueInputPrefix
      const s = typeof raw === 'string' ? raw.trim() : ''
      if (s.length === 0) return COMBO_TECHNIQUE_PREFIX
      const max = 40
      return s.length > max ? s.slice(0, max) : s
    })(),
    comboTechniqueAllowAnyUserInput:
      typeof vva.comboTechniqueAllowAnyUserInput === 'boolean'
        ? vva.comboTechniqueAllowAnyUserInput
        : DEFAULT_CONFIG.pvp.viewerVsViewerAttack.comboTechniqueAllowAnyUserInput,
    comboTechniqueResultFontScalePercent: isInRange(Number(vva.comboTechniqueResultFontScalePercent), 50, 200)
      ? Math.round(Number(vva.comboTechniqueResultFontScalePercent) || DEFAULT_CONFIG.pvp.viewerVsViewerAttack.comboTechniqueResultFontScalePercent)
      : DEFAULT_CONFIG.pvp.viewerVsViewerAttack.comboTechniqueResultFontScalePercent,
    comboTechniqueChallengeFontScalePercent: isInRange(Number(vva.comboTechniqueChallengeFontScalePercent), 50, 200)
      ? Math.round(Number(vva.comboTechniqueChallengeFontScalePercent) || DEFAULT_CONFIG.pvp.viewerVsViewerAttack.comboTechniqueChallengeFontScalePercent)
      : DEFAULT_CONFIG.pvp.viewerVsViewerAttack.comboTechniqueChallengeFontScalePercent,
    comboTechniqueChallengeLongTextThresholdChars: isInRange(Number(vva.comboTechniqueChallengeLongTextThresholdChars), 0, 80)
      ? Math.floor(
        Number(vva.comboTechniqueChallengeLongTextThresholdChars) ||
            DEFAULT_CONFIG.pvp.viewerVsViewerAttack.comboTechniqueChallengeLongTextThresholdChars
      )
      : DEFAULT_CONFIG.pvp.viewerVsViewerAttack.comboTechniqueChallengeLongTextThresholdChars,
    comboTechniqueChallengeLongTextScalePercent: isInRange(Number(vva.comboTechniqueChallengeLongTextScalePercent), 30, 100)
      ? Math.round(
        Number(vva.comboTechniqueChallengeLongTextScalePercent) ||
            DEFAULT_CONFIG.pvp.viewerVsViewerAttack.comboTechniqueChallengeLongTextScalePercent
      )
      : DEFAULT_CONFIG.pvp.viewerVsViewerAttack.comboTechniqueChallengeLongTextScalePercent,
    testPanelSimulation: sanitizeTestPanelSimulation(vva.testPanelSimulation, undefined),
    survivalHp1Enabled: typeof vva.survivalHp1Enabled === 'boolean' ? vva.survivalHp1Enabled : false,
    survivalHp1Probability: isInRange(Number(vva.survivalHp1Probability), 0, 100) ? Number(vva.survivalHp1Probability) || 30 : 30,
    survivalHp1Message: typeof vva.survivalHp1Message === 'string' ? vva.survivalHp1Message : '食いしばり!',
  }
  const pvp = {
    enabled: typeof pvpConfig.enabled === 'boolean' ? pvpConfig.enabled : false,
    autoReplyAttackCounter: typeof pvpConfig.autoReplyAttackCounter === 'boolean' ? pvpConfig.autoReplyAttackCounter : legacyAutoReply,
    autoReplyWhenViewerZeroHp: typeof pvpConfig.autoReplyWhenViewerZeroHp === 'boolean' ? pvpConfig.autoReplyWhenViewerZeroHp : legacyAutoReply,
    autoReplyHpCheck: typeof pvpConfig.autoReplyHpCheck === 'boolean' ? pvpConfig.autoReplyHpCheck : (typeof (pvpConfig as { autoReplyViewerCommands?: boolean }).autoReplyViewerCommands === 'boolean' ? (pvpConfig as { autoReplyViewerCommands: boolean }).autoReplyViewerCommands : true),
    autoReplyFullHeal: typeof pvpConfig.autoReplyFullHeal === 'boolean' ? pvpConfig.autoReplyFullHeal : (typeof (pvpConfig as { autoReplyViewerCommands?: boolean }).autoReplyViewerCommands === 'boolean' ? (pvpConfig as { autoReplyViewerCommands: boolean }).autoReplyViewerCommands : true),
    autoReplyHeal: typeof pvpConfig.autoReplyHeal === 'boolean' ? pvpConfig.autoReplyHeal : (typeof (pvpConfig as { autoReplyViewerCommands?: boolean }).autoReplyViewerCommands === 'boolean' ? (pvpConfig as { autoReplyViewerCommands: boolean }).autoReplyViewerCommands : true),
    autoReplyBlockedByZeroHp: typeof pvpConfig.autoReplyBlockedByZeroHp === 'boolean' ? pvpConfig.autoReplyBlockedByZeroHp : legacyAutoReply,
    viewerMaxHp,
    streamerAttack,
    counterOnAttackTargetAttacker: typeof pvpConfig.counterOnAttackTargetAttacker === 'boolean' ? pvpConfig.counterOnAttackTargetAttacker : true,
    counterOnAttackTargetRandom: typeof pvpConfig.counterOnAttackTargetRandom === 'boolean' ? pvpConfig.counterOnAttackTargetRandom : false,
    counterCommandAcceptsUsername: typeof pvpConfig.counterCommandAcceptsUsername === 'boolean' ? pvpConfig.counterCommandAcceptsUsername : false,
    messageWhenAttackBlockedByZeroHp: typeof pvpConfig.messageWhenAttackBlockedByZeroHp === 'string' ? pvpConfig.messageWhenAttackBlockedByZeroHp : 'HPが0なので攻撃できません。',
    messageWhenHealBlockedByZeroHp: typeof pvpConfig.messageWhenHealBlockedByZeroHp === 'string' ? pvpConfig.messageWhenHealBlockedByZeroHp : 'HPが0なので回復できません。',
    messageWhenViewerZeroHp: typeof pvpConfig.messageWhenViewerZeroHp === 'string' ? pvpConfig.messageWhenViewerZeroHp : '視聴者 {username} のHPが0になりました。',
    counterCommand: typeof pvpConfig.counterCommand === 'string' && isValidLength(pvpConfig.counterCommand, 1, 50)
      ? (pvpConfig.counterCommand as string).replace(/[<>"']/g, '')
      : '!counter',
    autoReplyMessageTemplate: typeof pvpConfig.autoReplyMessageTemplate === 'string' ? pvpConfig.autoReplyMessageTemplate : '{username} の残りHP: {hp}/{max}',
    hpCheckCommand: typeof pvpConfig.hpCheckCommand === 'string' && isValidLength(pvpConfig.hpCheckCommand, 1, 50)
      ? (pvpConfig.hpCheckCommand as string).replace(/[<>"']/g, '')
      : '!hp',
    viewerFullHealCommand: typeof pvpConfig.viewerFullHealCommand === 'string' && isValidLength(pvpConfig.viewerFullHealCommand, 1, 50)
      ? (pvpConfig.viewerFullHealCommand as string).replace(/[<>"']/g, '')
      : '!fullheal',
    viewerHealCommand: typeof pvpConfig.viewerHealCommand === 'string' && isValidLength(pvpConfig.viewerHealCommand, 1, 50)
      ? (pvpConfig.viewerHealCommand as string).replace(/[<>"']/g, '')
      : '!heal',
    viewerHealType: (pvpConfig.viewerHealType === 'random' ? 'random' : 'fixed') as 'fixed' | 'random',
    viewerHealAmount: isInRange(Number(pvpConfig.viewerHealAmount), 1, 999999) ? Number(pvpConfig.viewerHealAmount) || 20 : 20,
    viewerHealMin: isInRange(Number(pvpConfig.viewerHealMin), 1, 999999) ? Number(pvpConfig.viewerHealMin) || 10 : 10,
    viewerHealMax: isInRange(Number(pvpConfig.viewerHealMax), 1, 999999) ? Number(pvpConfig.viewerHealMax) || 30 : 30,
    viewerHealRandomStep: isInRange(Number(pvpConfig.viewerHealRandomStep), 1, 999999) ? Math.floor(Number(pvpConfig.viewerHealRandomStep)) || 1 : 1,
    viewerHealWhenZeroEnabled: typeof pvpConfig.viewerHealWhenZeroEnabled === 'boolean' ? pvpConfig.viewerHealWhenZeroEnabled : true,
    attackMode: (pvpConfig.attackMode === 'streamer_only' ? 'streamer_only' : 'both') as 'streamer_only' | 'both',
    viewerAttackViewerCommand: typeof pvpConfig.viewerAttackViewerCommand === 'string' && isValidLength(pvpConfig.viewerAttackViewerCommand, 1, 50)
      ? (pvpConfig.viewerAttackViewerCommand as string).replace(/[<>"']/g, '')
      : '!attack',
    streamerHealOnAttackEnabled: typeof pvpConfig.streamerHealOnAttackEnabled === 'boolean' ? pvpConfig.streamerHealOnAttackEnabled : false,
    streamerHealOnAttackProbability: isInRange(Number(pvpConfig.streamerHealOnAttackProbability), 0, 100) ? Number(pvpConfig.streamerHealOnAttackProbability) || 10 : 10,
    streamerHealOnAttackType: (pvpConfig.streamerHealOnAttackType === 'random' ? 'random' : 'fixed') as 'fixed' | 'random',
    streamerHealOnAttackAmount: isInRange(Number(pvpConfig.streamerHealOnAttackAmount), 1, 999999) ? Number(pvpConfig.streamerHealOnAttackAmount) || 10 : 10,
    streamerHealOnAttackMin: isInRange(Number(pvpConfig.streamerHealOnAttackMin), 1, 999999) ? Number(pvpConfig.streamerHealOnAttackMin) || 5 : 5,
    streamerHealOnAttackMax: isInRange(Number(pvpConfig.streamerHealOnAttackMax), 1, 999999) ? Number(pvpConfig.streamerHealOnAttackMax) || 20 : 20,
    streamerHealOnAttackRandomStep: isInRange(Number(pvpConfig.streamerHealOnAttackRandomStep), 1, 999999) ? Number(pvpConfig.streamerHealOnAttackRandomStep) || 1 : 1,
    strengthBuffCommand: typeof pvpConfig.strengthBuffCommand === 'string' && isValidLength(pvpConfig.strengthBuffCommand, 1, 50)
      ? (pvpConfig.strengthBuffCommand as string).replace(/[<>"']/g, '')
      : '!strength',
    strengthBuffCheckCommand: typeof pvpConfig.strengthBuffCheckCommand === 'string' && isValidLength(pvpConfig.strengthBuffCheckCommand, 1, 50)
      ? (pvpConfig.strengthBuffCheckCommand as string).replace(/[<>"']/g, '')
      : '!buff',
    strengthBuffDuration: isInRange(Number(pvpConfig.strengthBuffDuration), 1, 999999) ? Number(pvpConfig.strengthBuffDuration) || 300 : 300,
    strengthBuffTarget: (pvpConfig.strengthBuffTarget === 'all' ? 'all' : 'individual') as 'individual' | 'all',
    autoReplyStrengthBuff: typeof pvpConfig.autoReplyStrengthBuff === 'boolean' ? pvpConfig.autoReplyStrengthBuff : true,
    autoReplyStrengthBuffCheck: typeof pvpConfig.autoReplyStrengthBuffCheck === 'boolean' ? pvpConfig.autoReplyStrengthBuffCheck : true,
    messageWhenStrengthBuffActivated: sanitizeStrengthBuffChatTemplates(
      typeof pvpConfig.messageWhenStrengthBuffActivated === 'string'
        ? pvpConfig.messageWhenStrengthBuffActivated
        : '{username} にストレングス効果を付与しました！（効果時間: {duration_human}）'
    ),
    messageWhenStrengthBuffCheck: sanitizeStrengthBuffChatTemplates(
      typeof pvpConfig.messageWhenStrengthBuffCheck === 'string'
        ? pvpConfig.messageWhenStrengthBuffCheck
        : '{username} のストレングス効果: 残り {remaining_human} / 効果時間 {duration_human}'
    ),
    strengthBuffSoundEnabled: typeof pvpConfig.strengthBuffSoundEnabled === 'boolean' ? pvpConfig.strengthBuffSoundEnabled : false,
    strengthBuffSoundUrl: typeof pvpConfig.strengthBuffSoundUrl === 'string'
      ? (pvpConfig.strengthBuffSoundUrl.trim() === '' || isValidUrl(pvpConfig.strengthBuffSoundUrl)
        ? pvpConfig.strengthBuffSoundUrl.trim()
        : '')
      : '',
    strengthBuffSoundVolume: (() => {
      if (typeof pvpConfig.strengthBuffSoundVolume === 'number' && !isNaN(pvpConfig.strengthBuffSoundVolume) && pvpConfig.strengthBuffSoundVolume >= 0 && pvpConfig.strengthBuffSoundVolume <= 1) {
        return pvpConfig.strengthBuffSoundVolume
      }
      const num = Number(pvpConfig.strengthBuffSoundVolume)
      if (!isNaN(num) && num >= 0 && num <= 1) {
        return num
      }
      return 0.7
    })(),
    konamiStreamerBuffEnabled:
      typeof pvpConfig.konamiStreamerBuffEnabled === 'boolean' ? pvpConfig.konamiStreamerBuffEnabled : true,
    konamiStreamerBuffSoundEnabled:
      typeof pvpConfig.konamiStreamerBuffSoundEnabled === 'boolean' ? pvpConfig.konamiStreamerBuffSoundEnabled : false,
    konamiStreamerBuffSoundUrl: typeof pvpConfig.konamiStreamerBuffSoundUrl === 'string'
      ? (pvpConfig.konamiStreamerBuffSoundUrl.trim() === '' || isValidUrl(pvpConfig.konamiStreamerBuffSoundUrl)
        ? pvpConfig.konamiStreamerBuffSoundUrl.trim()
        : '')
      : '',
    konamiStreamerBuffSoundVolume: (() => {
      if (
        typeof pvpConfig.konamiStreamerBuffSoundVolume === 'number' &&
        !isNaN(pvpConfig.konamiStreamerBuffSoundVolume) &&
        pvpConfig.konamiStreamerBuffSoundVolume >= 0 &&
        pvpConfig.konamiStreamerBuffSoundVolume <= 1
      ) {
        return pvpConfig.konamiStreamerBuffSoundVolume
      }
      const num = Number(pvpConfig.konamiStreamerBuffSoundVolume)
      if (!isNaN(num) && num >= 0 && num <= 1) {
        return num
      }
      return 0.7
    })(),
    viewerFinishingMoveEnabled: typeof pvpConfig.viewerFinishingMoveEnabled === 'boolean' ? pvpConfig.viewerFinishingMoveEnabled : true,
    viewerFinishingMoveProbability: (() => {
      const n = Number(pvpConfig.viewerFinishingMoveProbability)
      return isInRange(n, 0, 100) ? (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0.01) : 0.01
    })(),
    viewerFinishingMoveMultiplier: isInRange(Number(pvpConfig.viewerFinishingMoveMultiplier), 1, MAX_NUM) ? Number(pvpConfig.viewerFinishingMoveMultiplier) || 10 : 10,
    messageWhenViewerFinishingMove: typeof pvpConfig.messageWhenViewerFinishingMove === 'string' ? pvpConfig.messageWhenViewerFinishingMove : '{username} が必殺技を繰り出した！ ダメージ: {damage}',
    autoReplyViewerFinishingMove: typeof pvpConfig.autoReplyViewerFinishingMove === 'boolean' ? pvpConfig.autoReplyViewerFinishingMove : true,
    finishingMoveText: typeof pvpConfig.finishingMoveText === 'string' && pvpConfig.finishingMoveText.trim().length > 0 ? pvpConfig.finishingMoveText.trim() : '必殺技！',
    finishingMoveSoundEnabled: typeof pvpConfig.finishingMoveSoundEnabled === 'boolean' ? pvpConfig.finishingMoveSoundEnabled : false,
    finishingMoveSoundUrl: typeof pvpConfig.finishingMoveSoundUrl === 'string'
      ? (pvpConfig.finishingMoveSoundUrl.trim() === '' || isValidUrl(pvpConfig.finishingMoveSoundUrl)
        ? pvpConfig.finishingMoveSoundUrl.trim()
        : '')
      : '',
    finishingMoveSoundVolume: (() => {
      if (typeof pvpConfig.finishingMoveSoundVolume === 'number' && !isNaN(pvpConfig.finishingMoveSoundVolume) && pvpConfig.finishingMoveSoundVolume >= 0 && pvpConfig.finishingMoveSoundVolume <= 1) {
        return pvpConfig.finishingMoveSoundVolume
      }
      const num = Number(pvpConfig.finishingMoveSoundVolume)
      if (!isNaN(num) && num >= 0 && num <= 1) {
        return num
      }
      return 0.7
    })(),
    viewerVsViewerAttack,
  }

  return {
    hp,
    attack,
    heal,
    retry,
    animation,
    display,
    zeroHpImage,
    zeroHpSound,
    zeroHpEffect,
    test,
    pvp,
    webmLoop,
    damageEffectFilter,
    healEffectFilter,
    gaugeColors,
    damageColors,
    healColors,
    obsCaptureGuide,
    obsWebSocket,
    background,
  }
}

/**
 * デフォルト設定を取得
 */
export function getDefaultConfig(): OverlayConfig {
  return { ...DEFAULT_CONFIG }
}

/**
 * オーバーレイ設定ファイルの読み込みと保存
 */

import type { OverlayConfig } from '../types/overlay'
import { isValidUrl, isInRange, isValidLength } from './security'

/** 確率以外の数値項目の上限（上限を設けないため十分大きな値） */
const MAX_NUM = 999999

const DEFAULT_CONFIG: OverlayConfig = {
  hp: {
    max: 100,
    current: 100,
    gaugeCount: 3,
    x: 0,
    y: 0,
    width: 800,
    height: 60,
    messageWhenZeroHp: '配信者を {attacker} が倒しました！',
  },
  attack: {
    rewardId: '',
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
    soundEnabled: false,
    soundUrl: '',
    soundVolume: 0.7,
    filterEffectEnabled: true,
    survivalHp1Enabled: false,
    survivalHp1Probability: 30,
    survivalHp1Message: '食いしばり!',
  },
  heal: {
    rewardId: '',
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
  },
  zeroHpImage: {
    enabled: true,
    imageUrl: '',
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
      rewardId: '',
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
      soundEnabled: false,
      soundUrl: '',
      soundVolume: 0.7,
      filterEffectEnabled: true,
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
    messageWhenStrengthBuffActivated: '{username} にストレングス効果を付与しました！（効果時間: {duration}秒）',
    messageWhenStrengthBuffCheck: '{username} のストレングス効果: 残り {remaining}秒 / 効果時間 {duration}秒',
    strengthBuffSoundEnabled: false,
    strengthBuffSoundUrl: '',
    strengthBuffSoundVolume: 0.7,
    viewerFinishingMoveEnabled: true,
    viewerFinishingMoveProbability: 0.001,
    viewerFinishingMoveMultiplier: 10,
    messageWhenViewerFinishingMove: '{username} が必殺技を繰り出した！ ダメージ: {damage}',
    autoReplyViewerFinishingMove: true,
    viewerVsViewerAttack: {
      rewardId: '',
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
      soundEnabled: false,
      soundUrl: '',
      soundVolume: 0.7,
      filterEffectEnabled: true,
      survivalHp1Enabled: false,
      survivalHp1Probability: 30,
      survivalHp1Message: '食いしばり!',
    },
  },
  externalWindow: {
    enabled: false,
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    opacity: 1.0,
    zIndex: 1, // HPゲージより後ろに配置
  },
  webmLoop: {
    enabled: false,
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    opacity: 1.0,
    zIndex: 1, // 外部ウィンドウと同じz-index
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
  },
  damageColors: {
    normal: '#cc0000', // 通常ダメージの色
    critical: '#cc8800', // クリティカルダメージの色
    bleed: '#ff6666', // 出血ダメージの色
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
      console.warn('設定ファイルが見つかりません。デフォルト設定を使用します。')
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
      display: { ...DEFAULT_CONFIG.display, ...validated.display },
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
      externalWindow: { ...DEFAULT_CONFIG.externalWindow, ...validated.externalWindow },
      webmLoop: { ...DEFAULT_CONFIG.webmLoop, ...validated.webmLoop },
      damageEffectFilter: { ...DEFAULT_CONFIG.damageEffectFilter, ...validated.damageEffectFilter },
      healEffectFilter: { ...DEFAULT_CONFIG.healEffectFilter, ...validated.healEffectFilter },
      gaugeColors: { ...DEFAULT_CONFIG.gaugeColors, ...validated.gaugeColors },
      damageColors: { ...DEFAULT_CONFIG.damageColors, ...validated.damageColors },
    }
  } catch (error) {
    console.error('設定ファイルの読み込みに失敗しました:', error)
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
      console.warn('設定ファイルが見つかりません。デフォルト設定を使用します。')
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
      display: { ...DEFAULT_CONFIG.display, ...validated.display },
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
      externalWindow: { ...DEFAULT_CONFIG.externalWindow, ...validated.externalWindow },
      webmLoop: { ...DEFAULT_CONFIG.webmLoop, ...validated.webmLoop },
      damageEffectFilter: { ...DEFAULT_CONFIG.damageEffectFilter, ...validated.damageEffectFilter },
      healEffectFilter: { ...DEFAULT_CONFIG.healEffectFilter, ...validated.healEffectFilter },
      gaugeColors: { ...DEFAULT_CONFIG.gaugeColors, ...validated.gaugeColors },
      damageColors: { ...DEFAULT_CONFIG.damageColors, ...validated.damageColors },
    }
  } catch (error) {
    console.error('設定ファイルの読み込みに失敗しました:', error)
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
          } catch (_) {
            errorMessage = `HTTP ${response.status}`
          }
          throw new Error(errorMessage)
        }

        const result = await response.json().catch(() => ({ message: '設定を保存しました' }))
        console.log('✅ 設定をJSONファイルに保存しました:', result.message)
        return true
      } catch (apiError) {
        console.warn('API経由での保存に失敗しました。ダウンロード方式にフォールバックします:', apiError)
        return downloadConfigAsJson(validated)
      }
    }

    // 本番環境ではダウンロード方式
    return downloadConfigAsJson(validated)
  } catch (error) {
    console.error('設定の保存に失敗しました:', error)
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
    console.log('✅ 設定をJSONファイルとしてダウンロードしました')
    return true
  } catch (error) {
    console.error('JSONファイルのダウンロードに失敗しました:', error)
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
    messageWhenZeroHp: typeof hpConfig.messageWhenZeroHp === 'string' ? hpConfig.messageWhenZeroHp : DEFAULT_CONFIG.hp.messageWhenZeroHp,
  }

  // 攻撃設定の検証
  const attackConfig = (c.attack as Record<string, unknown> | undefined) || {}
  const attackDamageType: 'fixed' | 'random' = attackConfig.damageType === 'random' ? 'random' : 'fixed'
  const attack = {
    rewardId: typeof attackConfig.rewardId === 'string' ? attackConfig.rewardId : '',
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
    bleedSoundEnabled: typeof attackConfig.bleedSoundEnabled === 'boolean' ? attackConfig.bleedSoundEnabled : false,
    bleedSoundUrl:
      typeof attackConfig.bleedSoundUrl === 'string' && isValidUrl(attackConfig.bleedSoundUrl)
        ? attackConfig.bleedSoundUrl
        : '',
    bleedSoundVolume: isInRange(Number(attackConfig.bleedSoundVolume), 0, 1)
      ? Number(attackConfig.bleedSoundVolume) || 0.7
      : 0.7,
    soundEnabled: typeof attackConfig.soundEnabled === 'boolean' ? attackConfig.soundEnabled : false,
    soundUrl:
      typeof attackConfig.soundUrl === 'string' && isValidUrl(attackConfig.soundUrl)
        ? attackConfig.soundUrl
        : '',
    soundVolume: isInRange(Number(attackConfig.soundVolume), 0, 1)
      ? Number(attackConfig.soundVolume) || 0.7
      : 0.7,
    filterEffectEnabled: typeof attackConfig.filterEffectEnabled === 'boolean' ? attackConfig.filterEffectEnabled : true,
    survivalHp1Enabled: typeof attackConfig.survivalHp1Enabled === 'boolean' ? attackConfig.survivalHp1Enabled : false,
    survivalHp1Probability: isInRange(Number(attackConfig.survivalHp1Probability), 0, 100)
      ? Number(attackConfig.survivalHp1Probability) || 30
      : 30,
    survivalHp1Message: typeof attackConfig.survivalHp1Message === 'string' ? attackConfig.survivalHp1Message : '食いしばり!',
  }

  // 回復設定の検証
  const healConfig = (c.heal as Record<string, unknown> | undefined) || {}
  const heal = {
    rewardId: typeof healConfig.rewardId === 'string' ? healConfig.rewardId : '',
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
  const display = {
    showMaxHp: typeof displayConfig.showMaxHp === 'boolean' ? displayConfig.showMaxHp : true,
    fontSize: isInRange(Number(displayConfig.fontSize), 1, MAX_NUM)
      ? Number(displayConfig.fontSize) || 24
      : 24,
  }

  // 画像URLの検証
  const zeroHpImageConfig = (c.zeroHpImage as Record<string, unknown> | undefined) || {}
  const zeroHpImage = {
    enabled: typeof zeroHpImageConfig.enabled === 'boolean' ? zeroHpImageConfig.enabled : true,
    imageUrl:
      typeof zeroHpImageConfig.imageUrl === 'string' && isValidUrl(zeroHpImageConfig.imageUrl)
        ? zeroHpImageConfig.imageUrl
        : '',
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

  // 外部ウィンドウ設定の検証
  const externalWindowConfig = (c.externalWindow as Record<string, unknown> | undefined) || {}
  const externalWindow = {
    enabled: typeof externalWindowConfig.enabled === 'boolean' ? externalWindowConfig.enabled : false,
    x: isInRange(Number(externalWindowConfig.x), -10000, 10000)
      ? Number(externalWindowConfig.x) || 0
      : 0,
    y: isInRange(Number(externalWindowConfig.y), -10000, 10000)
      ? Number(externalWindowConfig.y) || 0
      : 0,
    width: isInRange(Number(externalWindowConfig.width), 1, MAX_NUM)
      ? Number(externalWindowConfig.width) || 800
      : 800,
    height: isInRange(Number(externalWindowConfig.height), 1, MAX_NUM)
      ? Number(externalWindowConfig.height) || 600
      : 600,
    opacity: isInRange(Number(externalWindowConfig.opacity), 0, 1)
      ? Number(externalWindowConfig.opacity) || 1.0
      : 1.0,
    zIndex: isInRange(Number(externalWindowConfig.zIndex), -100, 100)
      ? Number(externalWindowConfig.zIndex) || 1
      : 1,
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

  // 色の検証関数（16進数カラーコード形式をチェック）
  const isValidColor = (color: unknown): boolean => {
    if (typeof color !== 'string') return false
    // #RRGGBB または #RGB 形式をチェック
    return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color)
  }

  // HPゲージ色設定の検証
  const gaugeColorsConfig = (c.gaugeColors as Record<string, unknown> | undefined) || {}
  const gaugeColors = {
    lastGauge: isValidColor(gaugeColorsConfig.lastGauge) ? (gaugeColorsConfig.lastGauge as string) : DEFAULT_CONFIG.gaugeColors.lastGauge,
    secondGauge: isValidColor(gaugeColorsConfig.secondGauge) ? (gaugeColorsConfig.secondGauge as string) : DEFAULT_CONFIG.gaugeColors.secondGauge,
    patternColor1: isValidColor(gaugeColorsConfig.patternColor1) ? (gaugeColorsConfig.patternColor1 as string) : (isValidColor(gaugeColorsConfig.thirdGauge) ? (gaugeColorsConfig.thirdGauge as string) : DEFAULT_CONFIG.gaugeColors.patternColor1), // 後方互換性: thirdGaugeもチェック
    patternColor2: isValidColor(gaugeColorsConfig.patternColor2) ? (gaugeColorsConfig.patternColor2 as string) : (isValidColor(gaugeColorsConfig.fourthGauge) ? (gaugeColorsConfig.fourthGauge as string) : DEFAULT_CONFIG.gaugeColors.patternColor2), // 後方互換性: fourthGaugeもチェック
  }

  // ダメージ値色設定の検証
  const damageColorsConfig = (c.damageColors as Record<string, unknown> | undefined) || {}
  const damageColors = {
    normal: isValidColor(damageColorsConfig.normal) ? (damageColorsConfig.normal as string) : DEFAULT_CONFIG.damageColors.normal,
    critical: isValidColor(damageColorsConfig.critical) ? (damageColorsConfig.critical as string) : DEFAULT_CONFIG.damageColors.critical,
    bleed: isValidColor(damageColorsConfig.bleed) ? (damageColorsConfig.bleed as string) : DEFAULT_CONFIG.damageColors.bleed,
  }

  // PvP設定の検証（streamerAttack は attack と同じ構造）
  const pvpConfig = (c.pvp as Record<string, unknown> | undefined) || {}
  const sa = (pvpConfig.streamerAttack as Record<string, unknown> | undefined) || {}
  const streamerDamageType: 'fixed' | 'random' = sa.damageType === 'random' ? 'random' : 'fixed'
  const streamerAttack = {
    rewardId: typeof sa.rewardId === 'string' ? sa.rewardId : '',
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
    criticalEnabled: typeof sa.criticalEnabled === 'boolean' ? sa.criticalEnabled : false,
    criticalProbability: isInRange(Number(sa.criticalProbability), 0, 100) ? Number(sa.criticalProbability) || 0 : 0,
    criticalMultiplier: isInRange(Number(sa.criticalMultiplier), 1, MAX_NUM) ? Number(sa.criticalMultiplier) || 2 : 2,
    bleedEnabled: typeof sa.bleedEnabled === 'boolean' ? sa.bleedEnabled : false,
    bleedProbability: isInRange(Number(sa.bleedProbability), 0, 100) ? Number(sa.bleedProbability) || 0 : 0,
    bleedDamage: isInRange(Number(sa.bleedDamage), 1, MAX_NUM) ? Number(sa.bleedDamage) || 5 : 5,
    bleedDuration: isInRange(Number(sa.bleedDuration), 1, MAX_NUM) ? Number(sa.bleedDuration) || 10 : 10,
    bleedInterval: isInRange(Number(sa.bleedInterval), 0.1, MAX_NUM) ? Number(sa.bleedInterval) || 1 : 1,
    bleedSoundEnabled: typeof sa.bleedSoundEnabled === 'boolean' ? sa.bleedSoundEnabled : false,
    bleedSoundUrl: typeof sa.bleedSoundUrl === 'string' ? sa.bleedSoundUrl : '',
    bleedSoundVolume: isInRange(Number(sa.bleedSoundVolume), 0, 1) ? Number(sa.bleedSoundVolume) || 0.7 : 0.7,
    soundEnabled: typeof sa.soundEnabled === 'boolean' ? sa.soundEnabled : false,
    soundUrl: typeof sa.soundUrl === 'string' ? sa.soundUrl : '',
    soundVolume: isInRange(Number(sa.soundVolume), 0, 1) ? Number(sa.soundVolume) || 0.7 : 0.7,
    filterEffectEnabled: typeof sa.filterEffectEnabled === 'boolean' ? sa.filterEffectEnabled : true,
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
    rewardId: typeof vva.rewardId === 'string' ? vva.rewardId : '',
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
    criticalEnabled: typeof vva.criticalEnabled === 'boolean' ? vva.criticalEnabled : false,
    criticalProbability: isInRange(Number(vva.criticalProbability), 0, 100) ? Number(vva.criticalProbability) || 0 : 0,
    criticalMultiplier: isInRange(Number(vva.criticalMultiplier), 1, MAX_NUM) ? Number(vva.criticalMultiplier) || 2 : 2,
    bleedEnabled: typeof vva.bleedEnabled === 'boolean' ? vva.bleedEnabled : false,
    bleedProbability: isInRange(Number(vva.bleedProbability), 0, 100) ? Number(vva.bleedProbability) || 0 : 0,
    bleedDamage: isInRange(Number(vva.bleedDamage), 1, MAX_NUM) ? Number(vva.bleedDamage) || 5 : 5,
    bleedDuration: isInRange(Number(vva.bleedDuration), 1, MAX_NUM) ? Number(vva.bleedDuration) || 10 : 10,
    bleedInterval: isInRange(Number(vva.bleedInterval), 0.1, MAX_NUM) ? Number(vva.bleedInterval) || 1 : 1,
    bleedSoundEnabled: typeof vva.bleedSoundEnabled === 'boolean' ? vva.bleedSoundEnabled : false,
    bleedSoundUrl: typeof vva.bleedSoundUrl === 'string' ? vva.bleedSoundUrl : '',
    bleedSoundVolume: isInRange(Number(vva.bleedSoundVolume), 0, 1) ? Number(vva.bleedSoundVolume) || 0.7 : 0.7,
    soundEnabled: typeof vva.soundEnabled === 'boolean' ? vva.soundEnabled : false,
    soundUrl: typeof vva.soundUrl === 'string' ? vva.soundUrl : '',
    soundVolume: isInRange(Number(vva.soundVolume), 0, 1) ? Number(vva.soundVolume) || 0.7 : 0.7,
    filterEffectEnabled: typeof vva.filterEffectEnabled === 'boolean' ? vva.filterEffectEnabled : true,
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
    messageWhenStrengthBuffActivated: typeof pvpConfig.messageWhenStrengthBuffActivated === 'string' ? pvpConfig.messageWhenStrengthBuffActivated : '{username} にストレングス効果を付与しました！（効果時間: {duration}秒）',
    messageWhenStrengthBuffCheck: typeof pvpConfig.messageWhenStrengthBuffCheck === 'string' ? pvpConfig.messageWhenStrengthBuffCheck : '{username} のストレングス効果: 残り {remaining}秒 / 効果時間 {duration}秒',
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
    viewerFinishingMoveEnabled: typeof pvpConfig.viewerFinishingMoveEnabled === 'boolean' ? pvpConfig.viewerFinishingMoveEnabled : true,
    viewerFinishingMoveProbability: isInRange(Number(pvpConfig.viewerFinishingMoveProbability), 0, 100) ? Number(pvpConfig.viewerFinishingMoveProbability) || 0.001 : 0.001,
    viewerFinishingMoveMultiplier: isInRange(Number(pvpConfig.viewerFinishingMoveMultiplier), 1, MAX_NUM) ? Number(pvpConfig.viewerFinishingMoveMultiplier) || 10 : 10,
    messageWhenViewerFinishingMove: typeof pvpConfig.messageWhenViewerFinishingMove === 'string' ? pvpConfig.messageWhenViewerFinishingMove : '{username} が必殺技を繰り出した！ ダメージ: {damage}',
    autoReplyViewerFinishingMove: typeof pvpConfig.autoReplyViewerFinishingMove === 'boolean' ? pvpConfig.autoReplyViewerFinishingMove : true,
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
    externalWindow,
    webmLoop,
    damageEffectFilter,
    healEffectFilter,
    gaugeColors,
    damageColors,
  }
}

/**
 * デフォルト設定を取得
 */
export function getDefaultConfig(): OverlayConfig {
  return { ...DEFAULT_CONFIG }
}

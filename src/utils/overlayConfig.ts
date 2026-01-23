/**
 * オーバーレイ設定ファイルの読み込みと保存
 */

import type { OverlayConfig } from '../types/overlay'
import { isValidUrl, isInRange, isValidLength, validateConfigStructure } from './security'

const DEFAULT_CONFIG: OverlayConfig = {
  hp: {
    max: 100,
    current: 100,
    gaugeCount: 3,
  },
  attack: {
    rewardId: '',
    customText: '',
    enabled: true,
    damage: 10,
    missEnabled: false,
    missProbability: 0,
    criticalEnabled: false,
    criticalProbability: 0,
    criticalMultiplier: 2.0,
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
  },
  retry: {
    command: '!retry',
    enabled: true,
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
    videoUrl: 'src/images/bakuhatsu.webm', // 透過WebM動画
    duration: 2000, // 2秒
  },
  test: {
    enabled: false,
  },
}

/**
 * 設定ファイルを読み込む
 * 優先順位: ローカルストレージ > JSONファイル > デフォルト設定
 */
export async function loadOverlayConfig(): Promise<OverlayConfig> {
  // まずローカルストレージをチェック
  const storedConfig = loadOverlayConfigFromStorage()
  if (storedConfig) {
    console.log('ローカルストレージから設定を読み込みました。')
    // デフォルト値でマージ（不足している項目を補完）
    return {
      ...DEFAULT_CONFIG,
      ...storedConfig,
      hp: { ...DEFAULT_CONFIG.hp, ...storedConfig.hp },
      attack: { ...DEFAULT_CONFIG.attack, ...storedConfig.attack },
      heal: { ...DEFAULT_CONFIG.heal, ...storedConfig.heal },
      retry: { ...DEFAULT_CONFIG.retry, ...storedConfig.retry },
      animation: { ...DEFAULT_CONFIG.animation, ...storedConfig.animation },
      display: { ...DEFAULT_CONFIG.display, ...storedConfig.display },
      zeroHpImage: { ...DEFAULT_CONFIG.zeroHpImage, ...storedConfig.zeroHpImage },
      zeroHpSound: { ...DEFAULT_CONFIG.zeroHpSound, ...storedConfig.zeroHpSound },
      zeroHpEffect: { ...DEFAULT_CONFIG.zeroHpEffect, ...storedConfig.zeroHpEffect },
      test: { ...DEFAULT_CONFIG.test, ...storedConfig.test },
    }
  }

  // ローカルストレージにない場合はJSONファイルから読み込む
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
          const error = await response.json()
          throw new Error(error.error || '設定の保存に失敗しました')
        }

        const result = await response.json()
        console.log('✅ 設定をJSONファイルに保存しました:', result.message)
        // ローカルストレージにも保存（フォールバック用）
        localStorage.setItem('overlay-config', JSON.stringify(validated))
        return true
      } catch (apiError) {
        console.warn('API経由での保存に失敗しました。ダウンロード方式にフォールバックします:', apiError)
        // APIが失敗した場合はダウンロード方式にフォールバック
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
 * ローカルストレージから設定を読み込む
 */
export function loadOverlayConfigFromStorage(): OverlayConfig | null {
  try {
    const stored = localStorage.getItem('overlay-config')
    if (!stored) return null

    // JSONパース
    const parsed = JSON.parse(stored)

    // 基本的な構造検証
    if (!validateConfigStructure(parsed)) {
      console.warn('設定の構造が不正です。デフォルト設定を使用します。')
      return null
    }

    // 設定値の検証とサニタイズ
    const validated = validateAndSanitizeConfig(parsed)
    return validated
  } catch (error) {
    console.error('ローカルストレージからの設定読み込みに失敗しました:', error)
    return null
  }
}

/**
 * 設定値を検証・サニタイズ
 */
function validateAndSanitizeConfig(config: unknown): OverlayConfig {
  // 型ガード
  if (!config || typeof config !== 'object') {
    return DEFAULT_CONFIG
  }

  const c = config as Record<string, unknown>
  // HP設定の検証
  const hpConfig = (c.hp as Record<string, unknown> | undefined) || {}
  const hpMax = Number(hpConfig.max) || DEFAULT_CONFIG.hp.max
  const hp = {
    max: isInRange(hpMax, 1, 10000) ? hpMax : DEFAULT_CONFIG.hp.max,
    current: isInRange(Number(hpConfig.current), 0, hpMax)
      ? Math.max(0, Math.min(Number(hpConfig.current) || 0, hpMax))
      : DEFAULT_CONFIG.hp.current,
    gaugeCount: isInRange(Number(hpConfig.gaugeCount), 1, 10)
      ? Number(hpConfig.gaugeCount) || DEFAULT_CONFIG.hp.gaugeCount
      : DEFAULT_CONFIG.hp.gaugeCount,
  }

  // 攻撃設定の検証
  const attackConfig = (c.attack as Record<string, unknown> | undefined) || {}
  const attack = {
    rewardId: typeof attackConfig.rewardId === 'string' ? attackConfig.rewardId : '',
    customText: typeof attackConfig.customText === 'string' ? attackConfig.customText : '',
    enabled: typeof attackConfig.enabled === 'boolean' ? attackConfig.enabled : true,
    damage: isInRange(Number(attackConfig.damage), 1, 1000)
      ? Number(attackConfig.damage) || 10
      : 10,
    missEnabled: typeof attackConfig.missEnabled === 'boolean' ? attackConfig.missEnabled : false,
    missProbability: isInRange(Number(attackConfig.missProbability), 0, 100)
      ? Number(attackConfig.missProbability) || 0
      : 0,
    criticalEnabled: typeof attackConfig.criticalEnabled === 'boolean' ? attackConfig.criticalEnabled : false,
    criticalProbability: isInRange(Number(attackConfig.criticalProbability), 0, 100)
      ? Number(attackConfig.criticalProbability) || 0
      : 0,
    criticalMultiplier: isInRange(Number(attackConfig.criticalMultiplier), 1.0, 10.0)
      ? Number(attackConfig.criticalMultiplier) || 2.0
      : 2.0,
  }

  // 回復設定の検証
  const healConfig = (c.heal as Record<string, unknown> | undefined) || {}
  const heal = {
    rewardId: typeof healConfig.rewardId === 'string' ? healConfig.rewardId : '',
    customText: typeof healConfig.customText === 'string' ? healConfig.customText : '',
    enabled: typeof healConfig.enabled === 'boolean' ? healConfig.enabled : true,
    effectEnabled: typeof healConfig.effectEnabled === 'boolean' ? healConfig.effectEnabled : true,
    healType: (healConfig.healType === 'random' ? 'random' : 'fixed') as 'fixed' | 'random',
    healAmount: isInRange(Number(healConfig.healAmount), 1, 1000)
      ? Number(healConfig.healAmount) || 20
      : 20,
    healMin: isInRange(Number(healConfig.healMin), 1, 1000)
      ? Number(healConfig.healMin) || 10
      : 10,
    healMax: isInRange(Number(healConfig.healMax), 1, 1000)
      ? Number(healConfig.healMax) || 30
      : 30,
  }

  // リトライ設定の検証
  const retryConfig = (c.retry as Record<string, unknown> | undefined) || {}
  const retry = {
    command:
      typeof retryConfig.command === 'string' && isValidLength(retryConfig.command, 1, 50)
        ? retryConfig.command.replace(/[<>"']/g, '') // 危険な文字を削除
        : '!retry',
    enabled: typeof retryConfig.enabled === 'boolean' ? retryConfig.enabled : true,
  }

  // アニメーション設定の検証
  const animationConfig = (c.animation as Record<string, unknown> | undefined) || {}
  const animation = {
    duration: isInRange(Number(animationConfig.duration), 0, 10000)
      ? Number(animationConfig.duration) || 500
      : 500,
    easing: typeof animationConfig.easing === 'string' ? animationConfig.easing : 'ease-out',
  }

  // 表示設定の検証
  const displayConfig = (c.display as Record<string, unknown> | undefined) || {}
  const display = {
    showMaxHp: typeof displayConfig.showMaxHp === 'boolean' ? displayConfig.showMaxHp : true,
    fontSize: isInRange(Number(displayConfig.fontSize), 8, 200)
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
    duration: isInRange(Number(zeroHpEffectConfig.duration), 100, 60000)
      ? Number(zeroHpEffectConfig.duration) || 2000
      : 2000,
  }

  // テスト設定の検証
  const testConfig = (c.test as Record<string, unknown> | undefined) || {}
  const test = {
    enabled: typeof testConfig.enabled === 'boolean' ? testConfig.enabled : false,
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
  }
}

/**
 * デフォルト設定を取得
 */
export function getDefaultConfig(): OverlayConfig {
  return { ...DEFAULT_CONFIG }
}

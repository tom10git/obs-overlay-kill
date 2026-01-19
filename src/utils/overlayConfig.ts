/**
 * オーバーレイ設定ファイルの読み込みと保存
 */

import type { OverlayConfig } from '../types/overlay'

const DEFAULT_CONFIG: OverlayConfig = {
  hp: {
    max: 100,
    current: 100,
    gaugeCount: 3,
  },
  attack: {
    rewardId: '',
    enabled: true,
    damage: 10,
    missEnabled: false,
    missProbability: 0,
  },
  heal: {
    rewardId: '',
    enabled: true,
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
    // デフォルト値でマージ（不足している項目を補完）
    return {
      ...DEFAULT_CONFIG,
      ...config,
      hp: { ...DEFAULT_CONFIG.hp, ...config.hp },
      attack: { ...DEFAULT_CONFIG.attack, ...config.attack },
      heal: { ...DEFAULT_CONFIG.heal, ...config.heal },
      retry: { ...DEFAULT_CONFIG.retry, ...config.retry },
      animation: { ...DEFAULT_CONFIG.animation, ...config.animation },
      display: { ...DEFAULT_CONFIG.display, ...config.display },
      zeroHpImage: { ...DEFAULT_CONFIG.zeroHpImage, ...config.zeroHpImage },
      zeroHpSound: { ...DEFAULT_CONFIG.zeroHpSound, ...config.zeroHpSound },
      test: { ...DEFAULT_CONFIG.test, ...config.test },
    }
  } catch (error) {
    console.error('設定ファイルの読み込みに失敗しました:', error)
    return DEFAULT_CONFIG
  }
}

/**
 * 設定ファイルを保存する（開発環境のみ）
 * 注意: 本番環境では別の方法（API経由など）を推奨
 */
export async function saveOverlayConfig(config: OverlayConfig): Promise<boolean> {
  try {
    // 開発環境でのみ動作（本番環境ではAPI経由で保存することを推奨）
    if (import.meta.env.PROD) {
      console.warn('本番環境では設定ファイルの直接保存はできません。')
      return false
    }

    // 実際のファイル保存はサーバー側で行う必要があるため、
    // ここではローカルストレージに保存する代替手段を提供
    localStorage.setItem('overlay-config', JSON.stringify(config))
    console.log('設定をローカルストレージに保存しました。')
    return true
  } catch (error) {
    console.error('設定の保存に失敗しました:', error)
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
    return JSON.parse(stored) as OverlayConfig
  } catch (error) {
    console.error('ローカルストレージからの設定読み込みに失敗しました:', error)
    return null
  }
}

/**
 * デフォルト設定を取得
 */
export function getDefaultConfig(): OverlayConfig {
  return { ...DEFAULT_CONFIG }
}

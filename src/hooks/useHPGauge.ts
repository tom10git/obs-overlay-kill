/**
 * HPゲージの状態管理フック
 */

import { useState, useEffect, useCallback } from 'react'
import { loadOverlayConfig, saveOverlayConfig } from '../utils/overlayConfig'
import type { OverlayConfig } from '../types/overlay'

interface UseHPGaugeOptions {
  broadcasterId: string
  channel: string
  config?: OverlayConfig
}

interface UseHPGaugeResult {
  currentHP: number
  maxHP: number
  gaugeCount: number
  config: OverlayConfig | null
  loading: boolean
  error: Error | null
  reduceHP: (amount: number) => void
  increaseHP: (amount: number) => void
  resetHP: () => void
  updateConfig: (newConfig: Partial<OverlayConfig>) => Promise<void>
}

/**
 * HPゲージの状態管理
 */
export function useHPGauge({
  config: initialConfig,
}: UseHPGaugeOptions): UseHPGaugeResult {
  const [config, setConfig] = useState<OverlayConfig | null>(initialConfig || null)
  const [loading, setLoading] = useState(!initialConfig)
  const [error, setError] = useState<Error | null>(null)

  // 設定を読み込む
  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig)
      setLoading(false)
      return
    }

    const loadConfig = async () => {
      try {
        setLoading(true)
        const loadedConfig = await loadOverlayConfig()
        setConfig(loadedConfig)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load config'))
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [initialConfig])

  // HPを減らす
  const reduceHP = useCallback(
    (amount: number) => {
      if (!config) return

      setConfig((prev) => {
        if (!prev) return prev
        const newHP = Math.max(0, prev.hp.current - amount)
        return {
          ...prev,
          hp: {
            ...prev.hp,
            current: newHP,
          },
        }
      })
    },
    [config]
  )

  // HPを増やす
  const increaseHP = useCallback(
    (amount: number) => {
      if (!config) return

      setConfig((prev) => {
        if (!prev) return prev
        const newHP = Math.min(prev.hp.max, prev.hp.current + amount)
        return {
          ...prev,
          hp: {
            ...prev.hp,
            current: newHP,
          },
        }
      })
    },
    [config]
  )

  // HPをリセット
  const resetHP = useCallback(() => {
    if (!config) return

    setConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        hp: {
          ...prev.hp,
          current: prev.hp.max,
        },
      }
    })
  }, [config])

  // 設定を更新
  const updateConfig = useCallback(
    async (newConfig: Partial<OverlayConfig>) => {
      if (!config) return

      const updatedConfig = {
        ...config,
        ...newConfig,
        hp: { ...config.hp, ...newConfig.hp },
        attack: { ...config.attack, ...newConfig.attack },
        heal: { ...config.heal, ...newConfig.heal },
        retry: { ...config.retry, ...newConfig.retry },
        animation: { ...config.animation, ...newConfig.animation },
        display: { ...config.display, ...newConfig.display },
        zeroHpImage: { ...config.zeroHpImage, ...newConfig.zeroHpImage },
        zeroHpSound: { ...config.zeroHpSound, ...newConfig.zeroHpSound },
        zeroHpEffect: { ...config.zeroHpEffect, ...newConfig.zeroHpEffect },
        test: { ...config.test, ...newConfig.test },
      }

      setConfig(updatedConfig)
      await saveOverlayConfig(updatedConfig)
    },
    [config]
  )

  // 注意: HPの変更（攻撃、回復、全回復）では自動保存しない
  // 設定画面からの明示的な保存（updateConfig）のみが保存される

  return {
    currentHP: config?.hp.current ?? 0,
    maxHP: config?.hp.max ?? 100,
    gaugeCount: config?.hp.gaugeCount ?? 3,
    config,
    loading,
    error,
    reduceHP,
    increaseHP,
    resetHP,
    updateConfig,
  }
}

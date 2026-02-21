/**
 * HPゲージの状態管理フック
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { loadOverlayConfig, saveOverlayConfig, getDefaultConfig } from '../utils/overlayConfig'
import type { OverlayConfig } from '../types/overlay'

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K]
}

interface UseHPGaugeOptions {
  broadcasterId: string
  channel: string
  config?: OverlayConfig
  onSurvivalHp1?: (message: string) => void // 食いしばり発動時に呼ばれるコールバック
  onStreamerZeroHp?: (message: string) => void // 配信者HPが0になったときに呼ばれるコールバック（自動返信用）
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
  updateConfig: (newConfig: DeepPartial<OverlayConfig>) => Promise<void>
  updateConfigLocal: (newConfig: DeepPartial<OverlayConfig>) => void
  saveConfig: () => Promise<void>
  reloadConfig: () => Promise<void>
}

/**
 * HPゲージの状態管理
 */
export function useHPGauge({
  config: initialConfig,
  onSurvivalHp1,
  onStreamerZeroHp,
}: UseHPGaugeOptions): UseHPGaugeResult {
  const [config, setConfig] = useState<OverlayConfig | null>(initialConfig || null)
  const [loading, setLoading] = useState(!initialConfig)
  const [error, setError] = useState<Error | null>(null)
  const onSurvivalHp1Ref = useRef(onSurvivalHp1)
  onSurvivalHp1Ref.current = onSurvivalHp1
  const onStreamerZeroHpRef = useRef(onStreamerZeroHp)
  onStreamerZeroHpRef.current = onStreamerZeroHp

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
      console.log(`[reduceHP呼び出し] ダメージ: ${amount}`)
      setConfig((prev) => {
        if (!prev) {
          console.warn('[reduceHP] configがnullです')
          return prev
        }
        // HPが0以下の場合は何もしない（HPが上昇するバグを防ぐ）
        if (prev.hp.current <= 0) {
          console.log(`[reduceHP] HPが0以下のため、ダメージを適用しません（現在HP: ${prev.hp.current}）`)
          return prev
        }
        let newHP = prev.hp.current - amount
        // 攻撃でHPが0以下になる場合、攻撃前HPが2以上のときだけ一定確率で1残す（HP1の状態では発動しない）
        if (
          newHP <= 0 &&
          prev.hp.current >= 2 &&
          prev.attack.survivalHp1Enabled &&
          prev.attack.survivalHp1Probability > 0
        ) {
          const roll = Math.random() * 100
          if (roll < prev.attack.survivalHp1Probability) {
            newHP = 1
            const message = (prev.attack.survivalHp1Message || '食いしばり!').trim() || '食いしばり!'
            onSurvivalHp1Ref.current?.(message)
            console.log(`[reduceHP] HP1残り発動 (確率${prev.attack.survivalHp1Probability}%、roll=${roll.toFixed(1)})`)
          }
        }
        newHP = Math.max(0, newHP)
        console.log(`[reduceHP] HP更新: ${prev.hp.current} -> ${newHP}`)
        return {
          ...prev,
          hp: {
            ...prev.hp,
            current: newHP,
          },
        }
      })
    },
    []
  )

  // 配信者HPが0になったタイミングでコールバックを呼ぶ（useEffectで検知し、再レンダー後に呼ぶことで最新の config/送信状態が使える）
  const prevStreamerHPRef = useRef<number | null>(null)
  useEffect(() => {
    const current = config?.hp.current ?? null
    if (current === null) return
    const prev = prevStreamerHPRef.current
    prevStreamerHPRef.current = current
    if (current === 0 && prev !== null && prev > 0 && config) {
      const msg = (config.hp.messageWhenZeroHp ?? '配信者のHPが0になりました。').trim()
      if (msg) onStreamerZeroHpRef.current?.(msg)
    }
  }, [config?.hp.current, config?.hp.messageWhenZeroHp])

  // HPを増やす
  const increaseHP = useCallback(
    (amount: number) => {
      setConfig((prev) => {
        if (!prev) return prev
        // HPが0のときは「HP0でも通常回復を許可」がオフなら回復しない
        if (prev.hp.current === 0 && !prev.heal.healWhenZeroEnabled) {
          return prev
        }
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
    [] // configへの依存を削除（setConfigの関数形式を使うため）
  )

  // HPをリセット
  const resetHP = useCallback(() => {
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
  }, []) // configへの依存を削除（setConfigの関数形式を使うため）

  // 設定を更新（リアルタイム反映用、保存は行わない）
  const updateConfigLocal = useCallback(
    (newConfig: DeepPartial<OverlayConfig>) => {
      setConfig((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          ...newConfig,
          hp: (() => {
            const merged = { ...prev.hp, ...newConfig.hp }
            if (newConfig.hp?.max != null && newConfig.hp?.current === undefined) {
              merged.current = Math.min(prev.hp.current, merged.max)
            }
            return merged
          })(),
          attack: { ...prev.attack, ...newConfig.attack },
          heal: { ...prev.heal, ...newConfig.heal },
          retry: { ...prev.retry, ...newConfig.retry },
          animation: { ...prev.animation, ...newConfig.animation },
          display: { ...prev.display, ...newConfig.display },
          zeroHpImage: { ...prev.zeroHpImage, ...newConfig.zeroHpImage },
          zeroHpSound: { ...prev.zeroHpSound, ...newConfig.zeroHpSound },
          zeroHpEffect: { ...prev.zeroHpEffect, ...newConfig.zeroHpEffect },
          test: { ...prev.test, ...newConfig.test },
          externalWindow: { ...prev.externalWindow, ...newConfig.externalWindow },
          webmLoop: { ...prev.webmLoop, ...newConfig.webmLoop },
          damageEffectFilter: { ...prev.damageEffectFilter, ...newConfig.damageEffectFilter },
          healEffectFilter: { ...prev.healEffectFilter, ...newConfig.healEffectFilter },
          gaugeColors: { ...prev.gaugeColors, ...newConfig.gaugeColors },
          damageColors: { ...prev.damageColors, ...newConfig.damageColors },
          pvp: newConfig.pvp
            ? (() => {
              const basePvp = prev.pvp ?? getDefaultConfig().pvp
              const baseStreamer = basePvp.streamerAttack ?? getDefaultConfig().pvp.streamerAttack
              const baseVva = basePvp.viewerVsViewerAttack ?? getDefaultConfig().pvp.viewerVsViewerAttack
              return {
                ...basePvp,
                ...newConfig.pvp,
                streamerAttack: { ...baseStreamer, ...newConfig.pvp?.streamerAttack },
                viewerVsViewerAttack: { ...baseVva, ...newConfig.pvp?.viewerVsViewerAttack },
              }
            })()
            : prev.pvp,
        }
      })
    },
    []
  )

  // 設定を保存
  const saveConfig = useCallback(
    async () => {
      setConfig((prev) => {
        if (!prev) return prev
        saveOverlayConfig(prev)
          .then(() => {
            console.log('✅ 設定を保存しました')
          })
          .catch((error) => {
            console.error('❌ 設定の保存に失敗しました:', error)
          })
        return prev
      })
    },
    []
  )

  // 設定を更新（後方互換性のため残す）
  const updateConfig = useCallback(
    async (newConfig: DeepPartial<OverlayConfig>) => {
      updateConfigLocal(newConfig)
      setConfig((prev) => {
        if (!prev) return prev
        saveOverlayConfig(prev).catch((error) => {
          console.error('設定の保存に失敗しました:', error)
        })
        return prev
      })
    },
    [updateConfigLocal]
  )

  // 設定を再読み込み（JSONファイルから）
  const reloadConfig = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const loadedConfig = await loadOverlayConfig()
      setConfig(loadedConfig)
      console.log('✅ 設定を再読み込みしました')
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to reload config')
      setError(error)
      console.error('❌ 設定の再読み込みに失敗しました:', error)
    } finally {
      setLoading(false)
    }
  }, [])

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
    updateConfigLocal,
    saveConfig,
    reloadConfig,
  }
}

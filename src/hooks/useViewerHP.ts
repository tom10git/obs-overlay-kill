/**
 * PvPモード用: 視聴者ごとのHP管理
 * ゲージは表示せず、数値のみ保持。攻撃時にチャットで残りHPを通知する想定。
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { OverlayConfig, AttackConfig } from '../types/overlay'

export interface ViewerHPState {
  current: number
  max: number
}

export interface ApplyViewerDamageResult {
  newHP: number
  appliedDamage: number
  miss: boolean
  critical: boolean
  survivalHp1: boolean
}

/**
 * 攻撃設定に基づいてダメージを計算（ミス・クリティカル・食いしばり）
 */
function resolveAttackDamage(
  currentHP: number,
  baseDamage: number,
  attack: AttackConfig
): ApplyViewerDamageResult {
  let appliedDamage = baseDamage
  let miss = false
  let critical = false
  let survivalHp1 = false

  // ミス判定
  if (attack.missEnabled && attack.missProbability > 0) {
    const roll = Math.random() * 100
    if (roll < attack.missProbability) {
      return { newHP: currentHP, appliedDamage: 0, miss: true, critical: false, survivalHp1: false }
    }
  }

  // クリティカル判定
  if (attack.criticalEnabled && attack.criticalProbability > 0) {
    const roll = Math.random() * 100
    if (roll < attack.criticalProbability) {
      critical = true
      appliedDamage = Math.floor(baseDamage * attack.criticalMultiplier)
    }
  }

  let newHP = currentHP - appliedDamage

  // 食いしばり（HPが0以下になる場合、攻撃前HPが2以上のときだけ確率で1残す。HP1の状態では発動しない）
  if (
    newHP <= 0 &&
    currentHP >= 2 &&
    attack.survivalHp1Enabled &&
    attack.survivalHp1Probability > 0
  ) {
    const roll = Math.random() * 100
    if (roll < attack.survivalHp1Probability) {
      newHP = 1
      survivalHp1 = true
    }
  }

  newHP = Math.max(0, newHP)
  return { newHP, appliedDamage, miss, critical, survivalHp1 }
}

export function useViewerHP(config: OverlayConfig | null) {
  const maxHP = config?.pvp?.viewerMaxHp ?? config?.hp?.max ?? 100
  const [viewerHpMap, setViewerHpMap] = useState<Record<string, ViewerHPState>>({})
  // 自動返信で「直後のHP」を正しく読むため、setState と同期して更新する ref
  const viewerHpMapRef = useRef<Record<string, ViewerHPState>>({})

  useEffect(() => {
    viewerHpMapRef.current = viewerHpMap
  }, [viewerHpMap])

  const getViewerHP = useCallback(
    (userId: string): ViewerHPState | undefined => {
      return viewerHpMap[userId]
    },
    [viewerHpMap]
  )

  /** コールバック内で即座に最新のHPを読む用（自動返信で使用・setState 直後も正しく読める） */
  const getViewerHPCurrent = useCallback((userId: string): ViewerHPState | undefined => {
    return viewerHpMapRef.current[userId]
  }, [])

  /** HP管理されている視聴者の userId 一覧（ランダムカウンター用） */
  const getViewerUserIds = useCallback((): string[] => {
    return Object.keys(viewerHpMapRef.current)
  }, [])

  const ensureViewerHP = useCallback(
    (userId: string): void => {
      setViewerHpMap((prev) => {
        if (prev[userId]) return prev
        const next = { ...prev, [userId]: { current: maxHP, max: maxHP } }
        viewerHpMapRef.current = next
        return next
      })
    },
    [maxHP]
  )

  const applyViewerDamage = useCallback(
    (userId: string, baseDamage: number, attack: AttackConfig): ApplyViewerDamageResult => {
      // ref から現在HPを読んで同期的に計算（setState の updater は非同期のため return が undefined になるのを防ぐ）
      const state = viewerHpMapRef.current[userId] ?? { current: maxHP, max: maxHP }
      const result = resolveAttackDamage(state.current, baseDamage, attack)
      setViewerHpMap((prev) => {
        const next = {
          ...prev,
          [userId]: { current: result.newHP, max: maxHP },
        }
        viewerHpMapRef.current = next
        return next
      })
      return result
    },
    [maxHP]
  )

  const setViewerHP = useCallback((userId: string, current: number) => {
    const clamped = Math.max(0, Math.min(current, maxHP))
    setViewerHpMap((prev) => {
      const existing = prev[userId]
      const next = {
        ...prev,
        [userId]: { current: clamped, max: existing?.max ?? maxHP },
      }
      viewerHpMapRef.current = next
      return next
    })
  }, [maxHP])

  const initViewerHP = useCallback(
    (userId: string) => {
      ensureViewerHP(userId)
    },
    [ensureViewerHP]
  )

  return {
    viewerHpMap,
    getViewerHP,
    getViewerHPCurrent,
    getViewerUserIds,
    ensureViewerHP,
    applyViewerDamage,
    setViewerHP,
    initViewerHP,
    maxHP,
  }
}

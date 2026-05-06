/**
 * テストモード用のイベントシミュレーションフック
 */

import { useCallback } from 'react'
import { logger } from '../lib/logger'

interface UseTestEventsOptions {
  enabled: boolean
  onAttackEvent?: () => void
  onHealEvent?: () => void
  onReset?: () => void
  attackEnabled?: boolean
  healEnabled?: boolean
}

interface UseTestEventsResult {
  triggerAttack: () => void
  triggerHeal: () => void
  triggerReset: () => void
}

/**
 * テストモード用のイベントシミュレーション（オーバーレイのテストボタンからハンドラを直接呼ぶ）
 */
export function useTestEvents({
  enabled,
  onAttackEvent,
  onHealEvent,
  onReset,
  attackEnabled = true,
  healEnabled = true,
}: UseTestEventsOptions): UseTestEventsResult {
  const triggerAttack = useCallback(() => {
    if (!enabled || !attackEnabled || !onAttackEvent) return
    logger.debug('🧪 テストモード: 攻撃をトリガー')
    onAttackEvent()
  }, [enabled, attackEnabled, onAttackEvent])

  const triggerHeal = useCallback(() => {
    if (!enabled || !healEnabled || !onHealEvent) return
    logger.debug('🧪 テストモード: 回復をトリガー')
    onHealEvent()
  }, [enabled, healEnabled, onHealEvent])

  const triggerReset = useCallback(() => {
    if (!enabled || !onReset) return
    logger.debug('🧪 テストモード: 全回復（リセット）をトリガー')
    onReset()
  }, [enabled, onReset])

  return {
    triggerAttack,
    triggerHeal,
    triggerReset,
  }
}

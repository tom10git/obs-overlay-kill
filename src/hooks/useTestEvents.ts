/**
 * テストモード用のイベントシミュレーションフック
 */

import { useCallback } from 'react'
import { logger } from '../lib/logger'
import type { ChannelPointEvent } from '../types/overlay'

interface UseTestEventsOptions {
  enabled: boolean
  attackRewardId: string
  healRewardId: string
  onAttackEvent?: (event: ChannelPointEvent) => void
  onHealEvent?: (event: ChannelPointEvent) => void
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
 * テストモード用のイベントシミュレーション
 */
export function useTestEvents({
  enabled,
  attackRewardId,
  healRewardId,
  onAttackEvent,
  onHealEvent,
  onReset,
  attackEnabled = true,
  healEnabled = true,
}: UseTestEventsOptions): UseTestEventsResult {
  // 攻撃イベントをトリガー
  const triggerAttack = useCallback(() => {
    if (!enabled || !attackEnabled || !onAttackEvent) return

    // テストモードでは、ダミーイベントを作成してハンドラを呼び出す
    // ハンドラ側でテストモード専用の処理を行う
    const testEvent: ChannelPointEvent = {
      id: `test-attack-${Date.now()}`,
      rewardId: attackRewardId,
      userId: 'test-user',
      userName: 'TestUser',
      redeemedAt: new Date().toISOString(),
      status: 'UNFULFILLED',
    }

    logger.debug('🧪 テストモード: 攻撃イベントをトリガー', testEvent)
    onAttackEvent(testEvent)
  }, [enabled, attackEnabled, attackRewardId, onAttackEvent])

  // 回復イベントをトリガー
  const triggerHeal = useCallback(() => {
    if (!enabled || !healEnabled || !onHealEvent) return

    // テストモードでは、ダミーイベントを作成してハンドラを呼び出す
    // ハンドラ側でテストモード専用の処理を行う
    const testEvent: ChannelPointEvent = {
      id: `test-heal-${Date.now()}`,
      rewardId: healRewardId,
      userId: 'test-user',
      userName: 'TestUser',
      redeemedAt: new Date().toISOString(),
      status: 'UNFULFILLED',
    }

    logger.debug('🧪 テストモード: 回復イベントをトリガー', testEvent)
    onHealEvent(testEvent)
  }, [enabled, healEnabled, healRewardId, onHealEvent])

  // 全回復（リセット）をトリガー
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

/**
 * OBS Overlay ページ
 * OBSブラウザソースとして使用するHPゲージ表示ページ
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import { useHPGauge } from '../hooks/useHPGauge'
import { useChannelPointEvents } from '../hooks/useChannelPointEvents'
import { useRetryCommand } from '../hooks/useRetryCommand'
import { useTestEvents } from '../hooks/useTestEvents'
import { HPGauge } from '../components/overlay/HPGauge'
import { getAdminUsername } from '../config/admin'
import { useTwitchUser } from '../hooks/useTwitchUser'
import './OverlayPage.css'

export function OverlayPage() {
  const username = getAdminUsername() || ''
  const { user, loading: userLoading } = useTwitchUser(username)

  // MISS表示（短時間だけ表示してCSSアニメーションさせる）
  const [missVisible, setMissVisible] = useState(false)
  const missTimerRef = useRef<number | null>(null)
  const showMiss = useCallback(
    (durationMs: number) => {
      setMissVisible(false) // 連続発火でもアニメーションをリスタートさせる
      // 次フレームでtrueに戻す
      requestAnimationFrame(() => setMissVisible(true))

      if (missTimerRef.current) {
        window.clearTimeout(missTimerRef.current)
      }
      missTimerRef.current = window.setTimeout(() => {
        setMissVisible(false)
        missTimerRef.current = null
      }, Math.max(200, durationMs))
    },
    []
  )

  useEffect(() => {
    return () => {
      if (missTimerRef.current) window.clearTimeout(missTimerRef.current)
    }
  }, [])

  const {
    currentHP,
    maxHP,
    gaugeCount,
    config,
    loading: configLoading,
    reduceHP,
    increaseHP,
    resetHP,
  } = useHPGauge({
    broadcasterId: user?.id || '',
    channel: username,
  })

  // 攻撃イベントハンドラ
  const handleAttackEvent = useCallback(
    (event: { rewardId: string }) => {
      if (!config) return

      // 条件チェック（シンプルな実装：リワードIDが一致すれば実行）
      if (event.rewardId === config.attack.rewardId) {
        // ミス判定
        let shouldDamage = true
        if (config.attack.missEnabled) {
          const missRoll = Math.random() * 100
          if (missRoll < config.attack.missProbability) {
            shouldDamage = false
          }
        }

        if (shouldDamage) {
          reduceHP(config.attack.damage)
        } else {
          // MISSアニメーション表示
          showMiss(config.animation.duration)
        }
      }
    },
    [config, reduceHP, showMiss]
  )

  // 回復イベントハンドラ
  const handleHealEvent = useCallback(
    (event: { rewardId: string }) => {
      if (!config) return

      // 条件チェック
      if (event.rewardId === config.heal.rewardId) {
        let healAmount = 0
        if (config.heal.healType === 'fixed') {
          healAmount = config.heal.healAmount
        } else {
          // ランダム回復
          const min = config.heal.healMin
          const max = config.heal.healMax
          healAmount = Math.floor(Math.random() * (max - min + 1)) + min
        }

        increaseHP(healAmount)
      }
    },
    [config, increaseHP]
  )

  // テストモードかどうか
  const isTestMode = config?.test.enabled ?? false

  // 攻撃イベントを監視（テストモードでない場合のみ）
  useChannelPointEvents({
    broadcasterId: user?.id || '',
    rewardId: config?.attack.rewardId || '',
    enabled:
      !isTestMode &&
      (config?.attack.enabled ?? false) &&
      !!user?.id &&
      !!config?.attack.rewardId,
    pollingInterval: 5000,
    onEvent: handleAttackEvent,
  })

  // 回復イベントを監視（テストモードでない場合のみ）
  useChannelPointEvents({
    broadcasterId: user?.id || '',
    rewardId: config?.heal.rewardId || '',
    enabled:
      !isTestMode &&
      (config?.heal.enabled ?? false) &&
      !!user?.id &&
      !!config?.heal.rewardId,
    pollingInterval: 5000,
    onEvent: handleHealEvent,
  })

  // テストモード用のイベントシミュレーション
  const { triggerAttack, triggerHeal, triggerReset } = useTestEvents({
    enabled: isTestMode,
    attackRewardId: config?.attack.rewardId || '',
    healRewardId: config?.heal.rewardId || '',
    onAttackEvent: handleAttackEvent,
    onHealEvent: handleHealEvent,
    onReset: () => resetHP(),
    attackEnabled: currentHP > 0,
  })

  const repeatTimerRef = useRef<number | null>(null)
  const startRepeat = useCallback((action: () => void, intervalMs: number) => {
    action()
    if (repeatTimerRef.current) {
      window.clearInterval(repeatTimerRef.current)
    }
    repeatTimerRef.current = window.setInterval(action, intervalMs)
  }, [])

  const stopRepeat = useCallback(() => {
    if (repeatTimerRef.current) {
      window.clearInterval(repeatTimerRef.current)
      repeatTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => stopRepeat()
  }, [stopRepeat])

  // リトライコマンドを監視
  useRetryCommand({
    channel: username,
    command: config?.retry.command || '!retry',
    enabled: (config?.retry.enabled ?? false) && currentHP === 0 && !!username,
    onRetry: () => {
      resetHP()
    },
  })

  // NOTE:
  // - OBS側では `.env` / `VITE_TWITCH_USERNAME` が未設定のまま表示されるケースがある
  // - Twitchユーザー取得に失敗しても、HPゲージ自体は表示できる（特にテストモード）
  // そのため「設定が読み込めたか」を最優先にして表示を進める
  if (configLoading || !config || userLoading) {
    return (
      <div className="overlay-loading">
        <p>読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="overlay-page">
      {/* Twitchユーザーが取得できない場合のヒント（表示は継続する） */}
      {!isTestMode && (!username || !user) && (
        <div className="overlay-warning">
          <p>注意: Twitchユーザー情報を取得できません。</p>
          <p>
            `VITE_TWITCH_USERNAME` を設定するか、設定画面でテストモードを有効にしてください。
          </p>
        </div>
      )}

      {/* MISS表示（ミス判定が発生したときのみ） */}
      {missVisible && <div className="overlay-miss">MISS</div>}
      <HPGauge
        currentHP={currentHP}
        maxHP={maxHP}
        gaugeCount={gaugeCount}
        config={config}
      />
      {/* テストモード時のみテストボタンを表示（開発環境） */}
      {isTestMode && import.meta.env.DEV && (
        <div className="test-controls">
          <div className="test-controls-info">
            <p>テストモード: ボタン長押しで連打</p>
          </div>
          <div className="test-controls-buttons">
            <button
              className="test-button test-attack"
              disabled={currentHP <= 0}
              onPointerDown={(e) => {
                e.preventDefault()
                if (currentHP > 0) startRepeat(triggerAttack, 200)
              }}
              onPointerUp={stopRepeat}
              onPointerLeave={stopRepeat}
              onPointerCancel={stopRepeat}
            >
              攻撃テスト
            </button>
            <button
              className="test-button test-heal"
              onPointerDown={(e) => {
                e.preventDefault()
                startRepeat(triggerHeal, 200)
              }}
              onPointerUp={stopRepeat}
              onPointerLeave={stopRepeat}
              onPointerCancel={stopRepeat}
            >
              回復テスト
            </button>
            <button onClick={triggerReset} className="test-button test-reset">
              全回復
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

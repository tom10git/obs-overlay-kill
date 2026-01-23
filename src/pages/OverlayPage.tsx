/**
 * OBS Overlay ページ
 * ブラウザウィンドウをキャプチャーして使用するHPゲージ表示ページ
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import { useHPGauge } from '../hooks/useHPGauge'
import { useChannelPointEvents } from '../hooks/useChannelPointEvents'
import { useEventSubRedemptions } from '../hooks/useEventSubRedemptions'
// import { useRetryCommand } from '../hooks/useRetryCommand' // リトライコマンドはメインのチャット監視処理に統合
import { useTestEvents } from '../hooks/useTestEvents'
import { useTwitchChat } from '../hooks/useTwitchChat'
import { HPGauge } from '../components/overlay/HPGauge'
import { getAdminUsername } from '../config/admin'
import { useTwitchUser } from '../hooks/useTwitchUser'
import type { TwitchChatMessage } from '../types/twitch'
import './OverlayPage.css'

export function OverlayPage() {
  const username = getAdminUsername() || ''
  const { user, loading: userLoading } = useTwitchUser(username)

  // MISS表示（短時間だけ表示してCSSアニメーションさせる）
  const [missVisible, setMissVisible] = useState(false)
  const missTimerRef = useRef<number | null>(null)

  // クリティカル表示（短時間だけ表示してCSSアニメーションさせる）
  const [criticalVisible, setCriticalVisible] = useState(false)
  const criticalTimerRef = useRef<number | null>(null)

  // 回復エフェクト（キラキラパーティクル）
  const [healParticles, setHealParticles] = useState<Array<{ id: number; angle: number; delay: number; distance: number; createdAt: number; size: number; color: string }>>([])
  const particleIdRef = useRef(0)
  const particleTimersRef = useRef<Map<number, number>>(new Map())

  // 背景色の管理
  const [backgroundColor, setBackgroundColor] = useState<'green' | 'dark-gray'>('green')
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

  const showCritical = useCallback(
    (durationMs: number) => {
      setCriticalVisible(false) // 連続発火でもアニメーションをリスタートさせる
      // 次フレームでtrueに戻す
      requestAnimationFrame(() => setCriticalVisible(true))

      if (criticalTimerRef.current) {
        window.clearTimeout(criticalTimerRef.current)
      }
      criticalTimerRef.current = window.setTimeout(() => {
        setCriticalVisible(false)
        criticalTimerRef.current = null
      }, Math.max(200, durationMs))
    },
    []
  )

  const showHealEffect = useCallback(() => {
    // パーティクルを生成（60-80個のキラキラ - より派手に）
    const particleCount = 60 + Math.floor(Math.random() * 20)
    const newParticles: Array<{ id: number; angle: number; delay: number; distance: number; createdAt: number; size: number; color: string }> = []
    const now = Date.now()

    // 明るい青色のパレット
    const brightBlueColors = [
      '#00ffff', // シアン
      '#00ccff', // 明るい水色
      '#0099ff', // 明るい青
      '#00bfff', // 明るい青
      '#33ccff', // 明るい水色
      '#66ccff', // 明るい水色
      '#00d4ff', // 明るい水色
      '#00e5ff', // 明るい水色
      '#1ad1ff', // 明るい水色
      '#4dd0ff', // 明るい水色
      '#5ce1ff', // 明るい水色
      '#7deeff', // 明るい水色
    ]

    // ゲージ中央から放射状に配置（360度を均等に分割）
    for (let i = 0; i < particleCount; i++) {
      particleIdRef.current += 1
      const particleId = particleIdRef.current
      // 角度をランダムに少しずらして自然な見た目に
      const baseAngle = (360 / particleCount) * i
      const angle = baseAngle + (Math.random() - 0.5) * 10 // ±5度のランダム
      // 距離も少しランダムに（80-130px - ウィンドウ内に収まる範囲）
      const distance = 80 + Math.random() * 50
      // サイズもランダムに（20-36px - 大小様々に）
      const size = 20 + Math.random() * 16
      // ランダムな明るい青色を選択
      const color = brightBlueColors[Math.floor(Math.random() * brightBlueColors.length)]
      newParticles.push({
        id: particleId,
        angle: angle,
        delay: Math.random() * 200, // 0-80msの遅延
        distance: distance,
        createdAt: now,
        size: size,
        color: color,
      })

      // 各パーティクルに個別のタイマーを設定（1秒後に削除）
      const timerId = window.setTimeout(() => {
        setHealParticles((prev) => prev.filter((p) => p.id !== particleId))
        particleTimersRef.current.delete(particleId)
      }, 2000)

      particleTimersRef.current.set(particleId, timerId)
    }

    // 既存のパーティクルに新しいパーティクルを追加（重ねる）
    setHealParticles((prev) => [...prev, ...newParticles])
  }, [])

  useEffect(() => {
    return () => {
      if (missTimerRef.current) window.clearTimeout(missTimerRef.current)
      if (criticalTimerRef.current) window.clearTimeout(criticalTimerRef.current)
      // すべてのパーティクルタイマーをクリア
      particleTimersRef.current.forEach((timerId) => {
        window.clearTimeout(timerId)
      })
      particleTimersRef.current.clear()
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

      // 条件チェック（リワードIDが一致するか、カスタムテキストで判定された場合）
      const isRewardIdMatch = event.rewardId === config.attack.rewardId && config.attack.rewardId.length > 0
      const isCustomTextMatch = event.rewardId === 'custom-text' && !!config.attack.customText && config.attack.customText.length > 0

      if (isRewardIdMatch || isCustomTextMatch) {
        // ミス判定
        let shouldDamage = true
        if (config.attack.missEnabled) {
          const missRoll = Math.random() * 100
          if (missRoll < config.attack.missProbability) {
            shouldDamage = false
          }
        }

        if (shouldDamage) {
          // クリティカル判定
          let finalDamage = config.attack.damage
          let isCritical = false
          if (config.attack.criticalEnabled) {
            const criticalRoll = Math.random() * 100
            if (criticalRoll < config.attack.criticalProbability) {
              finalDamage = Math.floor(config.attack.damage * config.attack.criticalMultiplier)
              isCritical = true
            }
          }
          reduceHP(finalDamage)
          // クリティカルアニメーション表示
          if (isCritical) {
            showCritical(config.animation.duration)
          }
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

      // 条件チェック（リワードIDが一致するか、カスタムテキストで判定された場合）
      const isRewardIdMatch = event.rewardId === config.heal.rewardId && config.heal.rewardId.length > 0
      const isCustomTextMatch = event.rewardId === 'custom-text' && !!config.heal.customText && config.heal.customText.length > 0

      if (isRewardIdMatch || isCustomTextMatch) {
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
        // 回復エフェクトを表示（設定で有効な場合のみ）
        if (config.heal.effectEnabled) {
          showHealEffect()
        }
      }
    },
    [config, increaseHP, showHealEffect]
  )

  // テストモードかどうか
  const isTestMode = config?.test.enabled ?? false

  // EventSubを使用するかどうか（推奨: リアルタイムで効率的）
  // フォールバックとしてポーリング方式も使用可能
  const useEventSub = !isTestMode && !!user?.id

  // EventSubを使用してすべての引き換えイベントを監視
  const { isConnected: eventSubConnected, error: eventSubError } = useEventSubRedemptions({
    broadcasterId: user?.id || '',
    enabled: useEventSub,
    onEvent: (event) => {
      // リワードIDでフィルタリング
      if (config?.attack.enabled && event.rewardId === config.attack.rewardId && config.attack.rewardId.length > 0) {
        handleAttackEvent(event)
      } else if (config?.heal.enabled && event.rewardId === config.heal.rewardId && config.heal.rewardId.length > 0) {
        handleHealEvent(event)
      }
    },
  })

  // フォールバック: EventSubが使用できない場合や接続に失敗した場合はポーリング方式を使用
  const usePolling = !isTestMode && (!useEventSub || !eventSubConnected)

  // 攻撃イベントを監視（ポーリング方式 - フォールバック）
  const attackEventsEnabled =
    usePolling &&
    (config?.attack.enabled ?? false) &&
    !!user?.id &&
    !!config?.attack.rewardId

  const { error: attackError } = useChannelPointEvents({
    broadcasterId: user?.id || '',
    rewardId: config?.attack.rewardId || '',
    enabled: attackEventsEnabled,
    pollingInterval: 5000,
    onEvent: (event) => {
      handleAttackEvent(event)
    },
  })

  // 回復イベントを監視（ポーリング方式 - フォールバック）
  const healEventsEnabled =
    usePolling &&
    (config?.heal.enabled ?? false) &&
    !!user?.id &&
    !!config?.heal.rewardId

  const { error: healError } = useChannelPointEvents({
    broadcasterId: user?.id || '',
    rewardId: config?.heal.rewardId || '',
    enabled: healEventsEnabled,
    pollingInterval: 5000,
    onEvent: (event) => {
      handleHealEvent(event)
    },
  })

  // エラー表示
  useEffect(() => {
    if (eventSubError) {
      console.error(
        '❌ EventSub接続エラー\n' +
        'EventSub WebSocketへの接続に失敗しました。\n' +
        'ポーリング方式にフォールバックしますが、イベント検出に遅延が発生する可能性があります。\n' +
        'エラー詳細:', eventSubError
      )
    }
    if (attackError) {
      console.error(
        '❌ 攻撃イベント取得エラー（ポーリング方式）\n' +
        'チャンネルポイントの攻撃イベントを取得できませんでした。\n' +
        'エラー詳細:', attackError
      )
    }
    if (healError) {
      console.error(
        '❌ 回復イベント取得エラー（ポーリング方式）\n' +
        'チャンネルポイントの回復イベントを取得できませんでした。\n' +
        'エラー詳細:', healError
      )
    }
  }, [eventSubError, attackError, healError])

  // テストモード用の専用ハンドラ（チャンネルポイントイベントとは別処理）
  // useTestEventsからChannelPointEventを受け取るが、テストモードでは無視して直接処理
  const handleTestAttack = useCallback(() => {
    if (!config || !isTestMode) return

    // ミス判定
    let shouldDamage = true
    if (config.attack.missEnabled) {
      const missRoll = Math.random() * 100
      if (missRoll < config.attack.missProbability) {
        shouldDamage = false
      }
    }

    if (shouldDamage) {
      // クリティカル判定
      let finalDamage = config.attack.damage
      let isCritical = false
      if (config.attack.criticalEnabled) {
        const criticalRoll = Math.random() * 100
        if (criticalRoll < config.attack.criticalProbability) {
          finalDamage = Math.floor(config.attack.damage * config.attack.criticalMultiplier)
          isCritical = true
        }
      }
      reduceHP(finalDamage)
      // クリティカルアニメーション表示
      if (isCritical) {
        showCritical(config.animation.duration)
      }
    } else {
      // MISSアニメーション表示
      showMiss(config.animation.duration)
    }
  }, [config, isTestMode, reduceHP, showMiss, showCritical])

  const handleTestHeal = useCallback(() => {
    if (!config || !isTestMode) return

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
    // 回復エフェクトを表示（設定で有効な場合のみ）
    if (config.heal.effectEnabled) {
      showHealEffect()
    }
  }, [config, isTestMode, increaseHP, showHealEffect])

  const handleTestReset = useCallback(() => {
    if (!isTestMode) return
    resetHP()
  }, [isTestMode, resetHP])

  // テストモード用のイベントシミュレーション（専用ハンドラを使用）
  const { triggerAttack, triggerHeal, triggerReset } = useTestEvents({
    enabled: isTestMode,
    attackRewardId: config?.attack.rewardId || '',
    healRewardId: config?.heal.rewardId || '',
    onAttackEvent: handleTestAttack,
    onHealEvent: handleTestHeal,
    onReset: handleTestReset,
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

  // リトライコマンドはメインのチャット監視処理に統合されているため、useRetryCommandは使用しない
  // （重複処理を避けるため）

  // チャットメッセージを監視してカスタムテキストで判定（App Access Token用）
  const { messages: chatMessages, isConnected: chatConnected } = useTwitchChat(username, 100)
  const processedChatMessagesRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    // カスタムテキストのチャット監視（テストモードでも有効）
    if (!config || !username) {
      return
    }

    chatMessages.forEach((message: TwitchChatMessage) => {
      // 既に処理済みのメッセージはスキップ
      if (processedChatMessagesRef.current.has(message.id)) {
        return
      }

      const messageText = message.message.trim()
      const attackCustomText = config.attack.customText?.trim()
      const healCustomText = config.heal.customText?.trim()

      // 1つのメッセージで1つのコマンドのみを実行する（攻撃を優先）
      let commandMatched = false

      // 攻撃カスタムテキストの判定（大文字小文字を区別しない）
      if (
        !commandMatched &&
        config.attack.enabled &&
        attackCustomText &&
        attackCustomText.length > 0
      ) {
        const messageLower = messageText.toLowerCase()
        const attackTextLower = attackCustomText.toLowerCase()

        // 完全一致、またはメッセージの開始、または単語として一致
        const isMatch =
          messageLower === attackTextLower ||
          messageLower.startsWith(attackTextLower + ' ') ||
          messageLower.startsWith(attackTextLower + '\n') ||
          messageLower.startsWith(attackTextLower + '\t') ||
          messageLower.endsWith(' ' + attackTextLower) ||
          messageLower.includes(' ' + attackTextLower + ' ') ||
          messageLower.includes('\n' + attackTextLower + ' ') ||
          messageLower.includes(' ' + attackTextLower + '\n')

        if (isMatch) {
          processedChatMessagesRef.current.add(message.id)
          commandMatched = true
          // ダミーイベントを作成して攻撃イベントを発火
          handleAttackEvent({ rewardId: 'custom-text' })
        }
      }

      // 回復カスタムテキストの判定（大文字小文字を区別しない）
      // 攻撃がマッチしなかった場合のみチェック
      if (
        !commandMatched &&
        config.heal.enabled &&
        healCustomText &&
        healCustomText.length > 0
      ) {
        const messageLower = messageText.toLowerCase()
        const healTextLower = healCustomText.toLowerCase()

        // 完全一致、またはメッセージの開始、または単語として一致
        const isMatch =
          messageLower === healTextLower ||
          messageLower.startsWith(healTextLower + ' ') ||
          messageLower.startsWith(healTextLower + '\n') ||
          messageLower.startsWith(healTextLower + '\t') ||
          messageLower.endsWith(' ' + healTextLower) ||
          messageLower.includes(' ' + healTextLower + ' ') ||
          messageLower.includes('\n' + healTextLower + ' ') ||
          messageLower.includes(' ' + healTextLower + '\n')

        if (isMatch) {
          processedChatMessagesRef.current.add(message.id)
          commandMatched = true
          // ダミーイベントを作成して回復イベントを発火
          handleHealEvent({ rewardId: 'custom-text' })
        }
      }

      // リトライコマンドの判定（HPが最大値未満の場合）
      if (
        !commandMatched &&
        config.retry.enabled &&
        currentHP < maxHP &&
        config.retry.command &&
        config.retry.command.length > 0
      ) {
        const messageLower = messageText.toLowerCase()
        const retryCommandLower = config.retry.command.toLowerCase()

        // 完全一致、またはメッセージの開始
        const isRetryMatch =
          messageLower === retryCommandLower ||
          messageLower.startsWith(retryCommandLower + ' ') ||
          messageLower.startsWith(retryCommandLower + '\n') ||
          messageLower.startsWith(retryCommandLower + '\t')

        if (isRetryMatch) {
          processedChatMessagesRef.current.add(message.id)
          commandMatched = true
          // リトライコマンドを実行（回復コマンドと同じロジックで最大HPまで回復）
          // 現在のHPと最大HPの差分を計算して回復
          const healAmount = maxHP - currentHP

          if (healAmount > 0) {
            increaseHP(healAmount)
            // 回復エフェクトを表示（設定で有効な場合のみ）
            if (config.heal.effectEnabled) {
              showHealEffect()
            }
          }
        }
      }

      // メモリ最適化: 処理済みメッセージのセットが大きくなりすぎないように制限
      if (processedChatMessagesRef.current.size > 500) {
        const idsArray = Array.from(processedChatMessagesRef.current)
        idsArray.slice(0, 250).forEach((id) => processedChatMessagesRef.current.delete(id))
      }
    })
  }, [chatMessages, config, isTestMode, username, handleAttackEvent, handleHealEvent, chatConnected, currentHP, resetHP, maxHP, increaseHP, showHealEffect])

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

  const backgroundStyle = backgroundColor === 'green' ? '#00ff00' : '#1a1a1a'

  return (
    <div className="overlay-page" style={{ background: backgroundStyle }}>
      {/* 背景色切り替えボタン */}
      <div className="background-controls">
        <button
          className={`bg-button ${backgroundColor === 'green' ? 'active' : ''}`}
          onClick={() => setBackgroundColor('green')}
          title="グリーンバック（クロマキー用）"
        >
          <span className="bg-button-icon">🎬</span>
          <span className="bg-button-label">グリーン</span>
        </button>
        <button
          className={`bg-button ${backgroundColor === 'dark-gray' ? 'active' : ''}`}
          onClick={() => setBackgroundColor('dark-gray')}
          title="濃いグレー"
        >
          <span className="bg-button-icon">◼</span>
          <span className="bg-button-label">グレー</span>
        </button>
      </div>

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
      {/* クリティカル表示（クリティカル判定が発生したときのみ） */}
      {criticalVisible && <div className="overlay-critical">CRITICAL!</div>}
      {/* 回復エフェクト（キラキラパーティクル - ゲージ中央から放射状） */}
      {healParticles.map((particle) => {
        // 角度からx, y座標を計算（ラジアンに変換）
        const angleRad = (particle.angle * Math.PI) / 180
        // 移動距離を1.7倍に調整（ウィンドウ内に収まるように）
        const endX = Math.cos(angleRad) * particle.distance * 1.7
        const endY = Math.sin(angleRad) * particle.distance * 1.7

        return (
          <div
            key={particle.id}
            className="heal-particle"
            style={{
              '--end-x': `${endX}px`,
              '--end-y': `${endY}px`,
              '--particle-size': `${particle.size}px`,
              '--particle-color': particle.color,
              animationDelay: `${particle.delay}ms`,
            } as React.CSSProperties & { '--end-x': string; '--end-y': string; '--particle-size': string; '--particle-color': string }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="heal-particle-svg"
            >
              {/* メインのアスタリスク（ランダムな明るい青色） */}
              <path
                d="M16 4L16 12M16 20L16 28M4 16L12 16M20 16L28 16M6.343 6.343L11.314 11.314M20.686 20.686L25.657 25.657M25.657 6.343L20.686 11.314M11.314 20.686L6.343 25.657"
                stroke={particle.color}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* 中央の円（ランダムな明るい青色） */}
              <circle cx="16" cy="16" r="3.5" fill={particle.color} />
              {/* 外側の小さなキラキラ（4方向 - 同じ色） */}
              <circle cx="16" cy="4" r="2.5" fill={particle.color} />
              <circle cx="16" cy="28" r="2.5" fill={particle.color} />
              <circle cx="4" cy="16" r="2.5" fill={particle.color} />
              <circle cx="28" cy="16" r="2.5" fill={particle.color} />
              {/* 対角線の小さなキラキラ（同じ色） */}
              <circle cx="8" cy="8" r="2" fill={particle.color} />
              <circle cx="24" cy="8" r="2" fill={particle.color} />
              <circle cx="8" cy="24" r="2" fill={particle.color} />
              <circle cx="24" cy="24" r="2" fill={particle.color} />
            </svg>
          </div>
        )
      })}
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

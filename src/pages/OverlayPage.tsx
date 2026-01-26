/**
 * OBS Overlay ページ
 * ブラウザウィンドウをキャプチャーして使用するHPゲージ表示ページ
 */

import { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { useHPGauge } from '../hooks/useHPGauge'
import { useChannelPointEvents } from '../hooks/useChannelPointEvents'
import { useEventSubRedemptions } from '../hooks/useEventSubRedemptions'
// import { useRetryCommand } from '../hooks/useRetryCommand' // リトライコマンドはメインのチャット監視処理に統合
import { useTestEvents } from '../hooks/useTestEvents'
import { useTwitchChat } from '../hooks/useTwitchChat'
import { HPGauge } from '../components/overlay/HPGauge'
import { DamageNumber } from '../components/overlay/DamageNumber'
import { useSound } from '../hooks/useSound'
import { getAdminUsername } from '../config/admin'
import { useTwitchUser } from '../hooks/useTwitchUser'
import type { TwitchChatMessage } from '../types/twitch'
import { saveOverlayConfig } from '../utils/overlayConfig'
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

  // 出血ダメージ管理（別枠として計算）
  const bleedIdRef = useRef(0)
  const bleedTimersRef = useRef<Map<number, { intervalTimer: number; durationTimer: number }>>(new Map())
  const reduceHPRef = useRef<(amount: number) => void>(() => { })

  // ダメージ表示管理（HPゲージの外側に表示）
  const [damageNumbers, setDamageNumbers] = useState<Array<{
    id: number
    amount: number
    isCritical: boolean
    isBleed?: boolean
    angle?: number
    distance?: number
  }>>([])
  const damageIdRef = useRef(0)

  // 背景色の管理
  const [backgroundColor, setBackgroundColor] = useState<'green' | 'dark-gray'>('green')

  // UI表示の管理
  const [showTestControls, setShowTestControls] = useState(true)
  const [showTestSettings, setShowTestSettings] = useState(false) // 設定パネルの表示/非表示
  const [testInputValues, setTestInputValues] = useState<Record<string, string>>({}) // 入力中の値を保持
  const [showSaveDialog, setShowSaveDialog] = useState(false) // 保存成功ダイアログの表示/非表示

  // 外部ウィンドウキャプチャの管理
  const [externalStream, setExternalStream] = useState<MediaStream | null>(null)
  const externalVideoRef = useRef<HTMLVideoElement>(null)
  const externalStreamRef = useRef<MediaStream | null>(null)

  // ダメージエフェクト管理（WebMループ画像と外部ウィンドウキャプチャ用）
  const [damageEffectActive, setDamageEffectActive] = useState(false)
  const [healEffectActive, setHealEffectActive] = useState(false)
  const prevHPRef = useRef<number | null>(null)
  const damageEffectStartTimerRef = useRef<number | null>(null)
  const damageEffectEndTimerRef = useRef<number | null>(null)
  const healEffectStartTimerRef = useRef<number | null>(null)
  const healEffectEndTimerRef = useRef<number | null>(null)

  // 外部ウィンドウの再キャプチャ
  const recaptureExternalWindow = useCallback(async () => {
    // 既存のストリームを停止
    if (externalStreamRef.current) {
      externalStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop())
      externalStreamRef.current = null
      setExternalStream(null)
    }

    // 少し待ってから新しいキャプチャを開始
    await new Promise((resolve) => setTimeout(resolve, 100))

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'window',
        } as MediaTrackConstraints,
        audio: false,
      })

      externalStreamRef.current = stream
      setExternalStream(stream)

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        externalStreamRef.current = null
        setExternalStream(null)
      })
    } catch (error) {
      console.error('外部ウィンドウキャプチャの開始に失敗しました:', error)
    }
  }, [])
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
      // すべての出血ダメージタイマーをクリア
      bleedTimersRef.current.forEach((timers) => {
        window.clearInterval(timers.intervalTimer)
        window.clearTimeout(timers.durationTimer)
      })
      bleedTimersRef.current.clear()
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
    updateConfigLocal,
    reloadConfig,
  } = useHPGauge({
    broadcasterId: user?.id || '',
    channel: username,
  })

  // reduceHPを常に最新の状態で参照できるようにする
  useEffect(() => {
    reduceHPRef.current = reduceHP
    console.log('[reduceHPRef更新] reduceHP関数を更新しました', reduceHP)
  }, [reduceHP])

  // HPが変化したときにエフェクトを適用
  useEffect(() => {
    if (prevHPRef.current === null) {
      prevHPRef.current = currentHP
      return
    }

    // 既存のタイマーをクリア（ダメージエフェクト）
    if (damageEffectStartTimerRef.current !== null) {
      window.clearTimeout(damageEffectStartTimerRef.current)
      damageEffectStartTimerRef.current = null
    }
    if (damageEffectEndTimerRef.current !== null) {
      window.clearTimeout(damageEffectEndTimerRef.current)
      damageEffectEndTimerRef.current = null
    }
    // 既存のタイマーをクリア（回復エフェクト）
    if (healEffectStartTimerRef.current !== null) {
      window.clearTimeout(healEffectStartTimerRef.current)
      healEffectStartTimerRef.current = null
    }
    if (healEffectEndTimerRef.current !== null) {
      window.clearTimeout(healEffectEndTimerRef.current)
      healEffectEndTimerRef.current = null
    }

    if (currentHP < prevHPRef.current) {
      // HPが減った場合、ダメージエフェクトを有効化
      // 既存の回復エフェクトを即座にクリア
      setHealEffectActive(false)
      // 短い遅延後にダメージエフェクトを開始（回復エフェクトが完全にクリアされるまで待つ）
      damageEffectStartTimerRef.current = window.setTimeout(() => {
        setDamageEffectActive(true)
        damageEffectEndTimerRef.current = window.setTimeout(() => {
          setDamageEffectActive(false)
          damageEffectEndTimerRef.current = null
        }, 500)
        damageEffectStartTimerRef.current = null
      }, 10)
    } else if (currentHP > prevHPRef.current) {
      // HPが増えた場合、回復エフェクトを有効化
      // 既存のダメージエフェクトを即座にクリア
      setDamageEffectActive(false)
      // 短い遅延後に回復エフェクトを開始（ダメージエフェクトが完全にクリアされるまで待つ）
      healEffectStartTimerRef.current = window.setTimeout(() => {
        setHealEffectActive(true)
        healEffectEndTimerRef.current = window.setTimeout(() => {
          setHealEffectActive(false)
          healEffectEndTimerRef.current = null
        }, 500)
        healEffectStartTimerRef.current = null
      }, 10)
    }

    prevHPRef.current = currentHP

    return () => {
      // クリーンアップ：ダメージエフェクトタイマー
      if (damageEffectStartTimerRef.current !== null) {
        window.clearTimeout(damageEffectStartTimerRef.current)
        damageEffectStartTimerRef.current = null
      }
      if (damageEffectEndTimerRef.current !== null) {
        window.clearTimeout(damageEffectEndTimerRef.current)
        damageEffectEndTimerRef.current = null
      }
      // クリーンアップ：回復エフェクトタイマー
      if (healEffectStartTimerRef.current !== null) {
        window.clearTimeout(healEffectStartTimerRef.current)
        healEffectStartTimerRef.current = null
      }
      if (healEffectEndTimerRef.current !== null) {
        window.clearTimeout(healEffectEndTimerRef.current)
        healEffectEndTimerRef.current = null
      }
    }
  }, [currentHP])

  // テストモード用の連打タイマー管理
  const repeatTimerRef = useRef<number | null>(null)
  const stopRepeat = useCallback(() => {
    if (repeatTimerRef.current) {
      window.clearInterval(repeatTimerRef.current)
      repeatTimerRef.current = null
    }
  }, [])

  const startRepeat = useCallback((action: () => void, intervalMs: number) => {
    action()
    if (repeatTimerRef.current) {
      window.clearInterval(repeatTimerRef.current)
    }
    repeatTimerRef.current = window.setInterval(action, intervalMs)
  }, [])

  useEffect(() => {
    return () => stopRepeat()
  }, [stopRepeat])

  // 効果音の設定（攻撃、ミス、出血ダメージ、回復、蘇生）
  const attackSoundUrl = useMemo(
    () => (config?.attack.soundUrl?.trim() || ''),
    [config?.attack.soundUrl]
  )
  const missSoundUrl = useMemo(
    () => (config?.attack.missSoundUrl?.trim() || ''),
    [config?.attack.missSoundUrl]
  )
  const bleedSoundUrl = useMemo(
    () => (config?.attack.bleedSoundUrl?.trim() || ''),
    [config?.attack.bleedSoundUrl]
  )
  const healSoundUrl = useMemo(
    () => (config?.heal.soundUrl?.trim() || ''),
    [config?.heal.soundUrl]
  )
  const retrySoundUrl = useMemo(
    () => (config?.retry.soundUrl?.trim() || ''),
    [config?.retry.soundUrl]
  )

  const { play: playAttackSound } = useSound({
    src: attackSoundUrl,
    enabled: config?.attack.soundEnabled && !!attackSoundUrl,
    volume: config?.attack.soundVolume || 0.7,
  })

  const { play: playMissSound } = useSound({
    src: missSoundUrl,
    enabled: config?.attack.missSoundEnabled && !!missSoundUrl,
    volume: config?.attack.missSoundVolume || 0.7,
  })

  const { play: playBleedSound } = useSound({
    src: bleedSoundUrl,
    enabled: config?.attack.bleedSoundEnabled && !!bleedSoundUrl,
    volume: config?.attack.bleedSoundVolume || 0.7,
  })

  const { play: playHealSound } = useSound({
    src: healSoundUrl,
    enabled: config?.heal.soundEnabled && !!healSoundUrl,
    volume: config?.heal.soundVolume || 0.7,
  })

  const { play: playRetrySound } = useSound({
    src: retrySoundUrl,
    enabled: config?.retry.soundEnabled && !!retrySoundUrl,
    volume: config?.retry.soundVolume || 0.7,
  })

  // HPが0になったときにすべての出血ダメージタイマーを停止
  useEffect(() => {
    if (currentHP <= 0) {
      console.log('[出血ダメージ停止] HPが0になったため、すべての出血ダメージタイマーを停止します')
      bleedTimersRef.current.forEach((timers) => {
        window.clearInterval(timers.intervalTimer)
        window.clearTimeout(timers.durationTimer)
      })
      bleedTimersRef.current.clear()
      // テストモードの連打も停止
      stopRepeat()
    }
  }, [currentHP, stopRepeat])


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
          // ダメージ数値を表示
          damageIdRef.current += 1
          const damageId = damageIdRef.current
          setDamageNumbers((prev) => [...prev, { id: damageId, amount: finalDamage, isCritical }])
          // 1.5秒後に削除（アニメーション終了後）
          setTimeout(() => {
            setDamageNumbers((prev) => prev.filter((d) => d.id !== damageId))
          }, isCritical ? 1800 : 1500)
          // クリティカルアニメーション表示
          if (isCritical) {
            showCritical(config.animation.duration)
          }
          // 攻撃効果音を再生
          if (config.attack.soundEnabled) {
            playAttackSound()
          }

          // 出血ダメージ判定（別枠として計算）
          if (config.attack.bleedEnabled) {
            console.log(`[出血ダメージ判定] bleedEnabled: true, bleedProbability: ${config.attack.bleedProbability}`)
            const bleedRoll = Math.random() * 100
            console.log(`[出血ダメージ判定] ダイスロール: ${bleedRoll.toFixed(2)}`)
            if (bleedRoll < config.attack.bleedProbability) {
              // 出血ダメージを開始
              bleedIdRef.current += 1
              const bleedId = bleedIdRef.current
              const bleedDamage = config.attack.bleedDamage
              const bleedInterval = config.attack.bleedInterval * 1000 // ミリ秒に変換
              const bleedDuration = config.attack.bleedDuration * 1000 // ミリ秒に変換

              console.log(`[出血ダメージ開始] ID: ${bleedId}, ダメージ: ${bleedDamage}, 間隔: ${bleedInterval}ms, 持続時間: ${bleedDuration}ms`)
              console.log(`[出血ダメージ開始] reduceHPRef.current:`, reduceHPRef.current)
              console.log(`[出血ダメージ開始] reduceHP:`, reduceHP)

              // 一定間隔でダメージを与えるタイマー
              // reduceHPはuseCallbackで[]依存配列なので、関数自体は変わらない
              // また、setConfig((prev) => ...)を使っているので、常に最新の状態を参照できる
              const intervalTimer = window.setInterval(() => {
                console.log(`[出血ダメージ適用] ID: ${bleedId}, ダメージ: ${bleedDamage}`)
                console.log(`[出血ダメージ適用] reduceHPRef.current:`, reduceHPRef.current)
                const currentReduceHP = reduceHPRef.current
                if (currentReduceHP && typeof currentReduceHP === 'function') {
                  console.log(`[出血ダメージ適用] reduceHPRef.currentを呼び出します`)
                  currentReduceHP(bleedDamage)
                  // 出血ダメージ効果音を再生
                  if (config.attack.bleedSoundEnabled) {
                    playBleedSound()
                  }
                  // 出血ダメージも表示（ランダムな方向に放射状に）
                  damageIdRef.current += 1
                  const bleedDamageId = damageIdRef.current
                  const bleedAngle = Math.random() * 360 // 0-360度のランダムな角度
                  const bleedDistance = 80 + Math.random() * 60 // 80-140pxのランダムな距離
                  setDamageNumbers((prev) => [...prev, {
                    id: bleedDamageId,
                    amount: bleedDamage,
                    isCritical: false,
                    isBleed: true,
                    angle: bleedAngle,
                    distance: bleedDistance,
                  }])
                  setTimeout(() => {
                    setDamageNumbers((prev) => prev.filter((d) => d.id !== bleedDamageId))
                  }, 1200)
                } else {
                  console.error('[出血ダメージエラー] reduceHPRef.currentが関数ではありません', currentReduceHP)
                  // フォールバック: reduceHPを直接使用
                  if (reduceHP && typeof reduceHP === 'function') {
                    console.log('[出血ダメージ] フォールバック: reduceHPを直接使用')
                    reduceHP(bleedDamage)
                    // 出血ダメージ効果音を再生
                    if (config.attack.bleedSoundEnabled) {
                      playBleedSound()
                    }
                    // 出血ダメージも表示（ランダムな方向に放射状に）
                    damageIdRef.current += 1
                    const bleedDamageId2 = damageIdRef.current
                    const bleedAngle2 = Math.random() * 360
                    const bleedDistance2 = 80 + Math.random() * 60
                    setDamageNumbers((prev) => [...prev, {
                      id: bleedDamageId2,
                      amount: bleedDamage,
                      isCritical: false,
                      isBleed: true,
                      angle: bleedAngle2,
                      distance: bleedDistance2,
                    }])
                    setTimeout(() => {
                      setDamageNumbers((prev) => prev.filter((d) => d.id !== bleedDamageId2))
                    }, 1200)
                  } else {
                    console.error('[出血ダメージエラー] reduceHPも関数ではありません', reduceHP)
                  }
                }
              }, bleedInterval)

              // 持続時間が終了したらタイマーをクリア
              const durationTimer = window.setTimeout(() => {
                console.log(`[出血ダメージ終了] ID: ${bleedId}`)
                window.clearInterval(intervalTimer)
                bleedTimersRef.current.delete(bleedId)
              }, bleedDuration)

              bleedTimersRef.current.set(bleedId, { intervalTimer, durationTimer })
              console.log(`[出血ダメージ開始] タイマーを設定しました。intervalTimer: ${intervalTimer}, durationTimer: ${durationTimer}`)
            } else {
              console.log(`[出血ダメージ判定] 失敗: ${bleedRoll.toFixed(2)} >= ${config.attack.bleedProbability}`)
            }
          } else {
            console.log(`[出血ダメージ判定] bleedEnabled: false`)
          }
        } else {
          // MISSアニメーション表示
          showMiss(config.animation.duration)
          // ミス効果音を再生
          if (config.attack.missSoundEnabled) {
            playMissSound()
          }
        }
      }
    },
    [config, reduceHP, showMiss, playMissSound]
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
        // 回復効果音を再生
        if (config.heal.soundEnabled) {
          playHealSound()
        }
      }
    },
    [config, increaseHP, showHealEffect, playHealSound]
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
    // HPが0以下の場合は何もしない
    if (currentHP <= 0) {
      stopRepeat()
      return
    }

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
      // ダメージ数値を表示
      damageIdRef.current += 1
      const damageId = damageIdRef.current
      setDamageNumbers((prev) => [...prev, { id: damageId, amount: finalDamage, isCritical }])
      // 1.5秒後に削除（アニメーション終了後）
      setTimeout(() => {
        setDamageNumbers((prev) => prev.filter((d) => d.id !== damageId))
      }, isCritical ? 1800 : 1500)
      // クリティカルアニメーション表示
      if (isCritical) {
        showCritical(config.animation.duration)
      }
      // 攻撃効果音を再生
      if (config.attack.soundEnabled) {
        playAttackSound()
      }

      // 出血ダメージ判定（別枠として計算）
      if (config.attack.bleedEnabled) {
        console.log(`[テストモード 出血ダメージ判定] bleedEnabled: true, bleedProbability: ${config.attack.bleedProbability}`)
        const bleedRoll = Math.random() * 100
        console.log(`[テストモード 出血ダメージ判定] ダイスロール: ${bleedRoll.toFixed(2)}`)
        if (bleedRoll < config.attack.bleedProbability) {
          // 出血ダメージを開始
          bleedIdRef.current += 1
          const bleedId = bleedIdRef.current
          const bleedDamage = config.attack.bleedDamage
          const bleedInterval = config.attack.bleedInterval * 1000 // ミリ秒に変換
          const bleedDuration = config.attack.bleedDuration * 1000 // ミリ秒に変換

          console.log(`[テストモード 出血ダメージ開始] ID: ${bleedId}, ダメージ: ${bleedDamage}, 間隔: ${bleedInterval}ms, 持続時間: ${bleedDuration}ms`)
          console.log(`[テストモード 出血ダメージ開始] reduceHPRef.current:`, reduceHPRef.current)
          console.log(`[テストモード 出血ダメージ開始] reduceHP:`, reduceHP)

          // 一定間隔でダメージを与えるタイマー
          const intervalTimer = window.setInterval(() => {
            console.log(`[テストモード 出血ダメージ適用] ID: ${bleedId}, ダメージ: ${bleedDamage}`)
            console.log(`[テストモード 出血ダメージ適用] reduceHPRef.current:`, reduceHPRef.current)
            const currentReduceHP = reduceHPRef.current
            if (currentReduceHP && typeof currentReduceHP === 'function') {
              console.log(`[テストモード 出血ダメージ適用] reduceHPRef.currentを呼び出します`)
              currentReduceHP(bleedDamage)
              // 出血ダメージ効果音を再生
              if (config.attack.bleedSoundEnabled) {
                playBleedSound()
              }
              // 出血ダメージも表示（ランダムな方向に放射状に）
              damageIdRef.current += 1
              const testBleedDamageId = damageIdRef.current
              const testBleedAngle = Math.random() * 360
              const testBleedDistance = 80 + Math.random() * 60
              setDamageNumbers((prev) => [...prev, {
                id: testBleedDamageId,
                amount: bleedDamage,
                isCritical: false,
                isBleed: true,
                angle: testBleedAngle,
                distance: testBleedDistance,
              }])
              setTimeout(() => {
                setDamageNumbers((prev) => prev.filter((d) => d.id !== testBleedDamageId))
              }, 1200)
            } else {
              console.error('[テストモード 出血ダメージエラー] reduceHPRef.currentが関数ではありません', currentReduceHP)
              // フォールバック: reduceHPを直接使用
              if (reduceHP && typeof reduceHP === 'function') {
                console.log('[テストモード 出血ダメージ] フォールバック: reduceHPを直接使用')
                reduceHP(bleedDamage)
                // 出血ダメージ効果音を再生
                if (config.attack.bleedSoundEnabled) {
                  playBleedSound()
                }
                // 出血ダメージも表示（ランダムな方向に放射状に）
                damageIdRef.current += 1
                const testBleedDamageId2 = damageIdRef.current
                const testBleedAngle2 = Math.random() * 360
                const testBleedDistance2 = 80 + Math.random() * 60
                setDamageNumbers((prev) => [...prev, {
                  id: testBleedDamageId2,
                  amount: bleedDamage,
                  isCritical: false,
                  isBleed: true,
                  angle: testBleedAngle2,
                  distance: testBleedDistance2,
                }])
                setTimeout(() => {
                  setDamageNumbers((prev) => prev.filter((d) => d.id !== testBleedDamageId2))
                }, 1200)
              } else {
                console.error('[テストモード 出血ダメージエラー] reduceHPも関数ではありません', reduceHP)
              }
            }
          }, bleedInterval)

          // 持続時間が終了したらタイマーをクリア
          const durationTimer = window.setTimeout(() => {
            console.log(`[テストモード 出血ダメージ終了] ID: ${bleedId}`)
            window.clearInterval(intervalTimer)
            bleedTimersRef.current.delete(bleedId)
          }, bleedDuration)

          bleedTimersRef.current.set(bleedId, { intervalTimer, durationTimer })
          console.log(`[テストモード 出血ダメージ開始] タイマーを設定しました。intervalTimer: ${intervalTimer}, durationTimer: ${durationTimer}`)
        } else {
          console.log(`[テストモード 出血ダメージ判定] 失敗: ${bleedRoll.toFixed(2)} >= ${config.attack.bleedProbability}`)
        }
      } else {
        console.log(`[テストモード 出血ダメージ判定] bleedEnabled: false`)
      }
    } else {
      // ミス時
      showMiss(config.animation.duration)
      // ミス効果音を再生
      if (config.attack.missSoundEnabled) {
        playMissSound()
      }
    }
  }, [config, isTestMode, currentHP, reduceHP, showMiss, showCritical, playMissSound, playAttackSound, playBleedSound, stopRepeat])

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
    // 回復効果音を再生
    if (config.heal.soundEnabled) {
      playHealSound()
    }
  }, [config, isTestMode, increaseHP, showHealEffect, playHealSound, playAttackSound, playMissSound, playBleedSound, reduceHP, showCritical, showMiss])

  const handleTestReset = useCallback(() => {
    if (!isTestMode || !config) return
    // 現在のHPが最大HPの場合は何もしない
    if (currentHP >= maxHP) return
    resetHP()
    // 蘇生効果音を再生
    if (config.retry.soundEnabled) {
      playRetrySound()
    }
  }, [isTestMode, config, currentHP, maxHP, resetHP, playRetrySound])

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
            // 蘇生効果音を再生
            if (config.retry.soundEnabled) {
              playRetrySound()
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
  }, [chatMessages, config, isTestMode, username, handleAttackEvent, handleHealEvent, chatConnected, currentHP, resetHP, maxHP, increaseHP, showHealEffect, playRetrySound])

  // body要素にoverflow:hiddenを適用
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  // 外部ウィンドウキャプチャの初期化
  useEffect(() => {
    if (!config?.externalWindow.enabled) {
      // 無効な場合はストリームを停止
      if (externalStreamRef.current) {
        externalStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop())
        externalStreamRef.current = null
        setExternalStream(null)
      }
      return
    }

    // 既にストリームがある場合は何もしない（手動で再キャプチャする場合はrecaptureExternalWindowを使用）
    if (externalStreamRef.current) {
      return
    }

    // WebRTC Screen Capture APIを使用してウィンドウをキャプチャ
    const startCapture = async () => {
      try {
        // getDisplayMediaを使用（ウィンドウ、画面、タブを選択可能）
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'window', // ウィンドウのみを選択可能にする
          } as MediaTrackConstraints,
          audio: false,
        })

        externalStreamRef.current = stream
        setExternalStream(stream)

        // ストリームが終了したときの処理
        stream.getVideoTracks()[0].addEventListener('ended', () => {
          externalStreamRef.current = null
          setExternalStream(null)
        })
      } catch (error) {
        console.error('外部ウィンドウキャプチャの開始に失敗しました:', error)
      }
    }

    startCapture()

    return () => {
      // クリーンアップ（設定が無効になった場合のみ）
      if (externalStreamRef.current && !config?.externalWindow.enabled) {
        externalStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop())
        externalStreamRef.current = null
        setExternalStream(null)
      }
    }
  }, [config?.externalWindow.enabled])

  // 外部ウィンドウのvideo要素にストリームを設定
  useEffect(() => {
    if (externalVideoRef.current && externalStream) {
      externalVideoRef.current.srcObject = externalStream
    }
  }, [externalStream])

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
    <div className="overlay-page" style={{ background: backgroundStyle, backgroundColor: backgroundStyle }}>

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
      {/* 外部ウィンドウキャプチャ（HPゲージの後ろに配置） */}
      {config.externalWindow.enabled && (
        <div
          className={`external-window-container ${damageEffectActive && config.attack.filterEffectEnabled ? 'damage-effect' : ''} ${healEffectActive && config.heal.filterEffectEnabled ? 'heal-effect' : ''}`}
          style={{
            position: 'fixed',
            left: `calc(50% + ${config.externalWindow.x}px)`,
            top: `calc(50% + ${config.externalWindow.y}px)`,
            width: `${config.externalWindow.width}px`,
            height: `${config.externalWindow.height}px`,
            opacity: config.externalWindow.opacity,
            pointerEvents: 'none',
            overflow: 'hidden',
            transform: 'translate(-50%, -50%)',
            filter: damageEffectActive && config.attack.filterEffectEnabled
              ? `sepia(${config.damageEffectFilter.sepia}) hue-rotate(${config.damageEffectFilter.hueRotate}deg) saturate(${config.damageEffectFilter.saturate}) brightness(${config.damageEffectFilter.brightness}) contrast(${config.damageEffectFilter.contrast})`
              : healEffectActive && config.heal.filterEffectEnabled
                ? `sepia(${config.healEffectFilter.sepia}) hue-rotate(${config.healEffectFilter.hueRotate}deg) saturate(${config.healEffectFilter.saturate}) brightness(${config.healEffectFilter.brightness}) contrast(${config.healEffectFilter.contrast})`
                : undefined,
            ...(healEffectActive && config.heal.filterEffectEnabled ? {
              '--heal-base-filter': `sepia(${config.healEffectFilter.sepia}) hue-rotate(${config.healEffectFilter.hueRotate}deg) saturate(${config.healEffectFilter.saturate}) brightness(${config.healEffectFilter.brightness}) contrast(${config.healEffectFilter.contrast})`,
            } as React.CSSProperties : {}),
          }}
        >
          {externalStream ? (
            <video
              ref={externalVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: damageEffectActive && config.attack.filterEffectEnabled
                  ? `sepia(${config.damageEffectFilter.sepia}) hue-rotate(${config.damageEffectFilter.hueRotate}deg) saturate(${config.damageEffectFilter.saturate}) brightness(${config.damageEffectFilter.brightness}) contrast(${config.damageEffectFilter.contrast})`
                  : healEffectActive && config.heal.filterEffectEnabled
                    ? `sepia(${config.healEffectFilter.sepia}) hue-rotate(${config.healEffectFilter.hueRotate}deg) saturate(${config.healEffectFilter.saturate}) brightness(${config.healEffectFilter.brightness}) contrast(${config.healEffectFilter.contrast})`
                    : undefined,
                ...(healEffectActive && config.heal.filterEffectEnabled ? {
                  '--heal-base-filter': `sepia(${config.healEffectFilter.sepia}) hue-rotate(${config.healEffectFilter.hueRotate}deg) saturate(${config.healEffectFilter.saturate}) brightness(${config.healEffectFilter.brightness}) contrast(${config.healEffectFilter.contrast})`,
                } as React.CSSProperties : {}),
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '14px',
                textAlign: 'center',
                padding: '10px',
              }}
            >
              ウィンドウを選択してください
            </div>
          )}
        </div>
      )}
      {/* WebMループ画像 */}
      {config.webmLoop.enabled && config.webmLoop.videoUrl && (
        <div
          className={`webm-loop-container ${damageEffectActive && config.attack.filterEffectEnabled ? 'damage-effect' : ''} ${healEffectActive && config.heal.filterEffectEnabled ? 'heal-effect' : ''}`}
          style={{
            position: 'fixed',
            left: `calc(50% + ${config.webmLoop.x}px)`,
            top: `calc(50% + ${config.webmLoop.y}px)`,
            width: `${config.webmLoop.width}px`,
            height: `${config.webmLoop.height}px`,
            opacity: config.webmLoop.opacity,
            zIndex: config.webmLoop.zIndex,
            pointerEvents: 'none',
            overflow: 'hidden',
            transform: 'translate(-50%, -50%)',
            filter: damageEffectActive && config.attack.filterEffectEnabled
              ? `sepia(${config.damageEffectFilter.sepia}) hue-rotate(${config.damageEffectFilter.hueRotate}deg) saturate(${config.damageEffectFilter.saturate}) brightness(${config.damageEffectFilter.brightness}) contrast(${config.damageEffectFilter.contrast})`
              : healEffectActive && config.heal.filterEffectEnabled
                ? `sepia(${config.healEffectFilter.sepia}) hue-rotate(${config.healEffectFilter.hueRotate}deg) saturate(${config.healEffectFilter.saturate}) brightness(${config.healEffectFilter.brightness}) contrast(${config.healEffectFilter.contrast})`
                : undefined,
            ...(healEffectActive && config.heal.filterEffectEnabled ? {
              '--heal-base-filter': `sepia(${config.healEffectFilter.sepia}) hue-rotate(${config.healEffectFilter.hueRotate}deg) saturate(${config.healEffectFilter.saturate}) brightness(${config.healEffectFilter.brightness}) contrast(${config.healEffectFilter.contrast})`,
            } as React.CSSProperties : {}),
          }}
        >
          <video
            src={config.webmLoop.videoUrl}
            autoPlay
            playsInline
            muted
            loop={config.webmLoop.loop}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: damageEffectActive && config.attack.filterEffectEnabled
                ? `sepia(${config.damageEffectFilter.sepia}) hue-rotate(${config.damageEffectFilter.hueRotate}deg) saturate(${config.damageEffectFilter.saturate}) brightness(${config.damageEffectFilter.brightness}) contrast(${config.damageEffectFilter.contrast})`
                : healEffectActive && config.heal.filterEffectEnabled
                  ? `sepia(${config.healEffectFilter.sepia}) hue-rotate(${config.healEffectFilter.hueRotate}deg) saturate(${config.healEffectFilter.saturate}) brightness(${config.healEffectFilter.brightness}) contrast(${config.healEffectFilter.contrast})`
                  : undefined,
              ...(healEffectActive && config.heal.filterEffectEnabled ? {
                '--heal-base-filter': `sepia(${config.healEffectFilter.sepia}) hue-rotate(${config.healEffectFilter.hueRotate}deg) saturate(${config.healEffectFilter.saturate}) brightness(${config.healEffectFilter.brightness}) contrast(${config.healEffectFilter.contrast})`,
              } as React.CSSProperties : {}),
            }}
          />
        </div>
      )}
      <HPGauge
        currentHP={currentHP}
        maxHP={maxHP}
        gaugeCount={gaugeCount}
        config={config}
      />
      {/* ダメージ数値表示（HPゲージの外側に表示） */}
      {damageNumbers.map((damage) => (
        <DamageNumber
          key={damage.id}
          id={damage.id}
          amount={damage.amount}
          isCritical={damage.isCritical}
          isBleed={damage.isBleed}
          angle={damage.angle}
          distance={damage.distance}
          damageColors={config.damageColors}
        />
      ))}
      {/* テストモード時のみテストボタンを表示（開発環境） */}
      {isTestMode && import.meta.env.DEV && (
        <div className={`test-controls-wrapper ${showTestControls ? 'visible' : 'hidden'}`}>
          <button
            className="control-tab control-tab-top-left"
            onClick={() => setShowTestControls(!showTestControls)}
            title={showTestControls ? 'テストモードボタンを隠す' : 'テストモードボタンを表示'}
          >
            テスト
          </button>
          <div className="test-controls">
            <div className="test-controls-header">
              <button
                className="test-settings-toggle"
                onClick={() => setShowTestSettings(!showTestSettings)}
                title={showTestSettings ? '設定を隠す' : '設定を表示'}
              >
                {showTestSettings ? '▼' : '▶'} 設定
              </button>
            </div>
            {showTestSettings && config && (
              <div className="test-settings-panel">
                <div className="test-settings-section">
                  <label className="test-settings-label">背景色</label>
                  <select
                    className="test-settings-select"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value as 'green' | 'dark-gray')}
                  >
                    <option value="green">グリーン（クロマキー用）</option>
                    <option value="dark-gray">濃いグレー</option>
                  </select>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">最大HP</label>
                  <input
                    type="number"
                    className="test-settings-input"
                    value={testInputValues.maxHP ?? config.hp.max}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, maxHP: e.target.value }))
                      const value = Number(e.target.value)
                      if (!isNaN(value) && value > 0) {
                        updateConfigLocal({ hp: { ...config.hp, max: value, current: Math.min(config.hp.current, value) } })
                      }
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.maxHP
                        return newValues
                      }))
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">現在のHP</label>
                  <input
                    type="number"
                    className="test-settings-input"
                    value={testInputValues.currentHP ?? config.hp.current}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, currentHP: e.target.value }))
                      const value = Number(e.target.value)
                      if (!isNaN(value) && value >= 0 && value <= config.hp.max) {
                        updateConfigLocal({ hp: { ...config.hp, current: value } })
                      }
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.currentHP
                        return newValues
                      }))
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">ゲージ数</label>
                  <input
                    type="number"
                    className="test-settings-input"
                    min="1"
                    max="100"
                    value={testInputValues.gaugeCount ?? config.hp.gaugeCount}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, gaugeCount: e.target.value }))
                      const value = Number(e.target.value)
                      if (!isNaN(value) && value >= 1 && value <= 100) {
                        updateConfigLocal({ hp: { ...config.hp, gaugeCount: value } })
                      }
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.gaugeCount
                        return newValues
                      }))
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">HPゲージ位置 X (px)</label>
                  <input
                    type="number"
                    className="test-settings-input"
                    value={testInputValues.hpGaugeX ?? config.hp.x}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, hpGaugeX: e.target.value }))
                      const value = Number(e.target.value)
                      if (!isNaN(value)) {
                        updateConfigLocal({ hp: { ...config.hp, x: value } })
                      }
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.hpGaugeX
                        return newValues
                      }))
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">HPゲージ位置 Y (px)</label>
                  <input
                    type="number"
                    className="test-settings-input"
                    value={testInputValues.hpGaugeY ?? config.hp.y}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, hpGaugeY: e.target.value }))
                      const value = Number(e.target.value)
                      if (!isNaN(value)) {
                        updateConfigLocal({ hp: { ...config.hp, y: value } })
                      }
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.hpGaugeY
                        return newValues
                      }))
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">HPゲージ幅 (px)</label>
                  <input
                    type="number"
                    className="test-settings-input"
                    min="100"
                    max="5000"
                    value={testInputValues.hpGaugeWidth ?? config.hp.width}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, hpGaugeWidth: e.target.value }))
                      const value = Number(e.target.value)
                      if (!isNaN(value) && value >= 100 && value <= 5000) {
                        updateConfigLocal({ hp: { ...config.hp, width: value } })
                      }
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.hpGaugeWidth
                        return newValues
                      }))
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">HPゲージ高さ (px)</label>
                  <input
                    type="number"
                    className="test-settings-input"
                    min="20"
                    max="500"
                    value={testInputValues.hpGaugeHeight ?? config.hp.height}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, hpGaugeHeight: e.target.value }))
                      const value = Number(e.target.value)
                      if (!isNaN(value) && value >= 20 && value <= 500) {
                        updateConfigLocal({ hp: { ...config.hp, height: value } })
                      }
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.hpGaugeHeight
                        return newValues
                      }))
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">攻撃ダメージ</label>
                  <input
                    type="number"
                    className="test-settings-input"
                    value={testInputValues.attackDamage ?? config.attack.damage}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, attackDamage: e.target.value }))
                      const value = Number(e.target.value)
                      if (!isNaN(value) && value > 0) {
                        updateConfigLocal({ attack: { ...config.attack, damage: value } })
                      }
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.attackDamage
                        return newValues
                      }))
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">ミス確率 (%)</label>
                  <input
                    type="number"
                    className="test-settings-input"
                    min="0"
                    max="100"
                    value={testInputValues.missProbability ?? config.attack.missProbability}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, missProbability: e.target.value }))
                      const value = Number(e.target.value)
                      if (!isNaN(value) && value >= 0 && value <= 100) {
                        updateConfigLocal({ attack: { ...config.attack, missProbability: value } })
                      }
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.missProbability
                        return newValues
                      }))
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">クリティカル確率 (%)</label>
                  <input
                    type="number"
                    className="test-settings-input"
                    min="0"
                    max="100"
                    value={testInputValues.criticalProbability ?? config.attack.criticalProbability}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, criticalProbability: e.target.value }))
                      const value = Number(e.target.value)
                      if (!isNaN(value) && value >= 0 && value <= 100) {
                        updateConfigLocal({ attack: { ...config.attack, criticalProbability: value } })
                      }
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.criticalProbability
                        return newValues
                      }))
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">クリティカル倍率</label>
                  <input
                    type="number"
                    className="test-settings-input"
                    step="0.1"
                    min="1"
                    value={testInputValues.criticalMultiplier ?? config.attack.criticalMultiplier}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, criticalMultiplier: e.target.value }))
                      const value = Number(e.target.value)
                      if (!isNaN(value) && value >= 1) {
                        updateConfigLocal({ attack: { ...config.attack, criticalMultiplier: value } })
                      }
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.criticalMultiplier
                        return newValues
                      }))
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">出血確率 (%)</label>
                  <input
                    type="number"
                    className="test-settings-input"
                    min="0"
                    max="100"
                    value={testInputValues.bleedProbability ?? config.attack.bleedProbability}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, bleedProbability: e.target.value }))
                      const value = Number(e.target.value)
                      if (!isNaN(value) && value >= 0 && value <= 100) {
                        updateConfigLocal({ attack: { ...config.attack, bleedProbability: value } })
                      }
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.bleedProbability
                        return newValues
                      }))
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">出血ダメージ</label>
                  <input
                    type="number"
                    className="test-settings-input"
                    value={testInputValues.bleedDamage ?? config.attack.bleedDamage}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, bleedDamage: e.target.value }))
                      const value = Number(e.target.value)
                      if (!isNaN(value) && value > 0) {
                        updateConfigLocal({ attack: { ...config.attack, bleedDamage: value } })
                      }
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.bleedDamage
                        return newValues
                      }))
                    }}
                  />
                </div>
                {config.heal.healType === 'fixed' ? (
                  <div className="test-settings-section">
                    <label className="test-settings-label">回復量 (固定)</label>
                    <input
                      type="number"
                      className="test-settings-input"
                      value={testInputValues.healAmount ?? config.heal.healAmount}
                      onChange={(e) => {
                        setTestInputValues((prev) => ({ ...prev, healAmount: e.target.value }))
                        const value = Number(e.target.value)
                        if (!isNaN(value) && value > 0) {
                          updateConfigLocal({ heal: { ...config.heal, healAmount: value } })
                        }
                      }}
                      onBlur={() => {
                        setTestInputValues((prev => {
                          const newValues = { ...prev }
                          delete newValues.healAmount
                          return newValues
                        }))
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <div className="test-settings-section">
                      <label className="test-settings-label">回復量 (最小)</label>
                      <input
                        type="number"
                        className="test-settings-input"
                        value={testInputValues.healMin ?? config.heal.healMin}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, healMin: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value) && value > 0) {
                            updateConfigLocal({ heal: { ...config.heal, healMin: value } })
                          }
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.healMin
                            return newValues
                          }))
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">回復量 (最大)</label>
                      <input
                        type="number"
                        className="test-settings-input"
                        value={testInputValues.healMax ?? config.heal.healMax}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, healMax: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value) && value > 0) {
                            updateConfigLocal({ heal: { ...config.heal, healMax: value } })
                          }
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.healMax
                            return newValues
                          }))
                        }}
                      />
                    </div>
                  </>
                )}
                <div className="test-settings-section">
                  <label className="test-settings-label">最大HPを表示</label>
                  <input
                    type="checkbox"
                    checked={config.display.showMaxHp}
                    onChange={(e) => {
                      updateConfigLocal({ display: { ...config.display, showMaxHp: e.target.checked } })
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">フォントサイズ</label>
                  <input
                    type="number"
                    className="test-settings-input"
                    min="8"
                    max="200"
                    value={testInputValues.fontSize ?? config.display.fontSize}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, fontSize: e.target.value }))
                      const value = Number(e.target.value)
                      if (!isNaN(value) && value >= 8 && value <= 200) {
                        updateConfigLocal({ display: { ...config.display, fontSize: value } })
                      }
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.fontSize
                        return newValues
                      }))
                    }}
                  />
                </div>
                <div className="test-settings-divider"></div>
                <div className="test-settings-section">
                  <label className="test-settings-label" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>アニメーション設定</label>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">アニメーション時間 (ms)</label>
                  <input
                    type="number"
                    className="test-settings-input"
                    min="0"
                    max="10000"
                    value={testInputValues.animationDuration ?? config.animation.duration}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, animationDuration: e.target.value }))
                      const value = Number(e.target.value)
                      if (!isNaN(value) && value >= 0 && value <= 10000) {
                        updateConfigLocal({ animation: { ...config.animation, duration: value } })
                      }
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.animationDuration
                        return newValues
                      }))
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">イージング</label>
                  <select
                    className="test-settings-select"
                    value={config.animation.easing}
                    onChange={(e) => {
                      updateConfigLocal({ animation: { ...config.animation, easing: e.target.value } })
                    }}
                  >
                    <option value="linear">linear</option>
                    <option value="ease-in">ease-in</option>
                    <option value="ease-out">ease-out</option>
                    <option value="ease-in-out">ease-in-out</option>
                    <option value="cubic-bezier">cubic-bezier</option>
                  </select>
                </div>
                <div className="test-settings-divider"></div>
                <div className="test-settings-section">
                  <label className="test-settings-label" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>攻撃設定（詳細）</label>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">ミス判定を有効にする</label>
                  <input
                    type="checkbox"
                    checked={config.attack.missEnabled}
                    onChange={(e) => {
                      updateConfigLocal({ attack: { ...config.attack, missEnabled: e.target.checked } })
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">クリティカル判定を有効にする</label>
                  <input
                    type="checkbox"
                    checked={config.attack.criticalEnabled}
                    onChange={(e) => {
                      updateConfigLocal({ attack: { ...config.attack, criticalEnabled: e.target.checked } })
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">出血ダメージを有効にする</label>
                  <input
                    type="checkbox"
                    checked={config.attack.bleedEnabled}
                    onChange={(e) => {
                      updateConfigLocal({ attack: { ...config.attack, bleedEnabled: e.target.checked } })
                    }}
                  />
                </div>
                {config.attack.bleedEnabled && (
                  <>
                    <div className="test-settings-section">
                      <label className="test-settings-label">出血持続時間 (秒)</label>
                      <input
                        type="number"
                        className="test-settings-input"
                        min="1"
                        max="300"
                        value={testInputValues.bleedDuration ?? config.attack.bleedDuration}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, bleedDuration: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value) && value >= 1 && value <= 300) {
                            updateConfigLocal({ attack: { ...config.attack, bleedDuration: value } })
                          }
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.bleedDuration
                            return newValues
                          }))
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">出血間隔 (秒)</label>
                      <input
                        type="number"
                        className="test-settings-input"
                        step="0.1"
                        min="0.1"
                        max="60"
                        value={testInputValues.bleedInterval ?? config.attack.bleedInterval}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, bleedInterval: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value) && value >= 0.1 && value <= 60) {
                            updateConfigLocal({ attack: { ...config.attack, bleedInterval: value } })
                          }
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.bleedInterval
                            return newValues
                          }))
                        }}
                      />
                    </div>
                  </>
                )}
                <div className="test-settings-section">
                  <label className="test-settings-label">攻撃効果音を有効にする</label>
                  <input
                    type="checkbox"
                    checked={config.attack.soundEnabled}
                    onChange={(e) => {
                      updateConfigLocal({ attack: { ...config.attack, soundEnabled: e.target.checked } })
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">攻撃時のフィルターエフェクトを有効にする</label>
                  <input
                    type="checkbox"
                    checked={config.attack.filterEffectEnabled}
                    onChange={(e) => {
                      updateConfigLocal({ attack: { ...config.attack, filterEffectEnabled: e.target.checked } })
                    }}
                  />
                </div>
                <div className="test-settings-divider"></div>
                <div className="test-settings-section">
                  <label className="test-settings-label" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>回復設定（詳細）</label>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">回復エフェクトを表示</label>
                  <input
                    type="checkbox"
                    checked={config.heal.effectEnabled}
                    onChange={(e) => {
                      updateConfigLocal({ heal: { ...config.heal, effectEnabled: e.target.checked } })
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">回復効果音を有効にする</label>
                  <input
                    type="checkbox"
                    checked={config.heal.soundEnabled}
                    onChange={(e) => {
                      updateConfigLocal({ heal: { ...config.heal, soundEnabled: e.target.checked } })
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">回復時のフィルターエフェクトを有効にする</label>
                  <input
                    type="checkbox"
                    checked={config.heal.filterEffectEnabled}
                    onChange={(e) => {
                      updateConfigLocal({ heal: { ...config.heal, filterEffectEnabled: e.target.checked } })
                    }}
                  />
                </div>
                <div className="test-settings-divider"></div>
                <div className="test-settings-section">
                  <label className="test-settings-label" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>リトライ設定</label>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">コマンド</label>
                  <input
                    type="text"
                    className="test-settings-input"
                    value={testInputValues.retryCommand ?? config.retry.command}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, retryCommand: e.target.value }))
                      updateConfigLocal({ retry: { ...config.retry, command: e.target.value } })
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.retryCommand
                        return newValues
                      }))
                    }}
                    placeholder="!retry"
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">有効</label>
                  <input
                    type="checkbox"
                    checked={config.retry.enabled}
                    onChange={(e) => {
                      updateConfigLocal({ retry: { ...config.retry, enabled: e.target.checked } })
                    }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">蘇生効果音を有効にする</label>
                  <input
                    type="checkbox"
                    checked={config.retry.soundEnabled}
                    onChange={(e) => {
                      updateConfigLocal({ retry: { ...config.retry, soundEnabled: e.target.checked } })
                    }}
                  />
                </div>
                <div className="test-settings-divider"></div>
                <div className="test-settings-section">
                  <label className="test-settings-label" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>HP0画像設定</label>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">HPが0になったら画像を表示</label>
                  <input
                    type="checkbox"
                    checked={config.zeroHpImage.enabled}
                    onChange={(e) => {
                      updateConfigLocal({ zeroHpImage: { ...config.zeroHpImage, enabled: e.target.checked } })
                    }}
                  />
                </div>
                {config.zeroHpImage.enabled && (
                  <div className="test-settings-section">
                    <label className="test-settings-label">画像URL</label>
                    <input
                      type="text"
                      className="test-settings-input"
                      value={testInputValues.zeroHpImageUrl ?? config.zeroHpImage.imageUrl}
                      onChange={(e) => {
                        setTestInputValues((prev) => ({ ...prev, zeroHpImageUrl: e.target.value }))
                        updateConfigLocal({ zeroHpImage: { ...config.zeroHpImage, imageUrl: e.target.value } })
                      }}
                      onBlur={() => {
                        setTestInputValues((prev => {
                          const newValues = { ...prev }
                          delete newValues.zeroHpImageUrl
                          return newValues
                        }))
                      }}
                      placeholder="src/images/adelaide_otsu.png"
                    />
                  </div>
                )}
                <div className="test-settings-divider"></div>
                <div className="test-settings-section">
                  <label className="test-settings-label" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>HP0効果音設定</label>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">HPが0になったら効果音を再生</label>
                  <input
                    type="checkbox"
                    checked={config.zeroHpSound.enabled}
                    onChange={(e) => {
                      updateConfigLocal({ zeroHpSound: { ...config.zeroHpSound, enabled: e.target.checked } })
                    }}
                  />
                </div>
                {config.zeroHpSound.enabled && (
                  <>
                    <div className="test-settings-section">
                      <label className="test-settings-label">効果音URL</label>
                      <input
                        type="text"
                        className="test-settings-input"
                        value={testInputValues.zeroHpSoundUrl ?? config.zeroHpSound.soundUrl}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, zeroHpSoundUrl: e.target.value }))
                          updateConfigLocal({ zeroHpSound: { ...config.zeroHpSound, soundUrl: e.target.value } })
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.zeroHpSoundUrl
                            return newValues
                          }))
                        }}
                        placeholder="効果音のURLを入力"
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">音量 (0-1)</label>
                      <input
                        type="number"
                        className="test-settings-input"
                        step="0.1"
                        min="0"
                        max="1"
                        value={testInputValues.zeroHpSoundVolume ?? config.zeroHpSound.volume}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, zeroHpSoundVolume: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value) && value >= 0 && value <= 1) {
                            updateConfigLocal({ zeroHpSound: { ...config.zeroHpSound, volume: value } })
                          }
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.zeroHpSoundVolume
                            return newValues
                          }))
                        }}
                      />
                    </div>
                  </>
                )}
                <div className="test-settings-divider"></div>
                <div className="test-settings-section">
                  <label className="test-settings-label" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>HP0エフェクト設定（WebM）</label>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">HPが0になったら動画エフェクトを表示</label>
                  <input
                    type="checkbox"
                    checked={config.zeroHpEffect.enabled}
                    onChange={(e) => {
                      updateConfigLocal({ zeroHpEffect: { ...config.zeroHpEffect, enabled: e.target.checked } })
                    }}
                  />
                </div>
                {config.zeroHpEffect.enabled && (
                  <>
                    <div className="test-settings-section">
                      <label className="test-settings-label">動画URL（透過WebM推奨）</label>
                      <input
                        type="text"
                        className="test-settings-input"
                        value={testInputValues.zeroHpEffectVideoUrl ?? config.zeroHpEffect.videoUrl}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, zeroHpEffectVideoUrl: e.target.value }))
                          updateConfigLocal({ zeroHpEffect: { ...config.zeroHpEffect, videoUrl: e.target.value } })
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.zeroHpEffectVideoUrl
                            return newValues
                          }))
                        }}
                        placeholder="src/images/bakuhatsu.webm"
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">表示時間（ミリ秒）</label>
                      <input
                        type="number"
                        className="test-settings-input"
                        min="100"
                        max="60000"
                        value={testInputValues.zeroHpEffectDuration ?? config.zeroHpEffect.duration}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, zeroHpEffectDuration: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value) && value >= 100 && value <= 60000) {
                            updateConfigLocal({ zeroHpEffect: { ...config.zeroHpEffect, duration: value } })
                          }
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.zeroHpEffectDuration
                            return newValues
                          }))
                        }}
                      />
                    </div>
                  </>
                )}
                <div className="test-settings-divider"></div>
                <div className="test-settings-section">
                  <label className="test-settings-label">WebMループ画像</label>
                  <input
                    type="checkbox"
                    checked={config.webmLoop.enabled}
                    onChange={(e) => {
                      updateConfigLocal({ webmLoop: { ...config.webmLoop, enabled: e.target.checked } })
                    }}
                  />
                </div>
                {config.webmLoop.enabled && (
                  <>
                    <div className="test-settings-section">
                      <label className="test-settings-label">動画URL</label>
                      <input
                        type="text"
                        className="test-settings-input"
                        value={testInputValues.webmLoopVideoUrl ?? config.webmLoop.videoUrl}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, webmLoopVideoUrl: e.target.value }))
                          updateConfigLocal({ webmLoop: { ...config.webmLoop, videoUrl: e.target.value } })
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.webmLoopVideoUrl
                            return newValues
                          }))
                        }}
                        placeholder="WebM動画のURL"
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">ループ再生</label>
                      <input
                        type="checkbox"
                        checked={config.webmLoop.loop}
                        onChange={(e) => {
                          updateConfigLocal({ webmLoop: { ...config.webmLoop, loop: e.target.checked } })
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">位置 X (px)</label>
                      <input
                        type="number"
                        className="test-settings-input"
                        value={testInputValues.webmLoopX ?? config.webmLoop.x}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, webmLoopX: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value)) {
                            updateConfigLocal({ webmLoop: { ...config.webmLoop, x: value } })
                          }
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.webmLoopX
                            return newValues
                          }))
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">位置 Y (px)</label>
                      <input
                        type="number"
                        className="test-settings-input"
                        value={testInputValues.webmLoopY ?? config.webmLoop.y}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, webmLoopY: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value)) {
                            updateConfigLocal({ webmLoop: { ...config.webmLoop, y: value } })
                          }
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.webmLoopY
                            return newValues
                          }))
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">幅 (px)</label>
                      <input
                        type="number"
                        className="test-settings-input"
                        value={testInputValues.webmLoopWidth ?? config.webmLoop.width}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, webmLoopWidth: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value) && value > 0) {
                            updateConfigLocal({ webmLoop: { ...config.webmLoop, width: value } })
                          }
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.webmLoopWidth
                            return newValues
                          }))
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">高さ (px)</label>
                      <input
                        type="number"
                        className="test-settings-input"
                        value={testInputValues.webmLoopHeight ?? config.webmLoop.height}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, webmLoopHeight: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value) && value > 0) {
                            updateConfigLocal({ webmLoop: { ...config.webmLoop, height: value } })
                          }
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.webmLoopHeight
                            return newValues
                          }))
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">透明度 (0-1)</label>
                      <input
                        type="number"
                        className="test-settings-input"
                        step="0.1"
                        min="0"
                        max="1"
                        value={testInputValues.webmLoopOpacity ?? config.webmLoop.opacity}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, webmLoopOpacity: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value) && value >= 0 && value <= 1) {
                            updateConfigLocal({ webmLoop: { ...config.webmLoop, opacity: value } })
                          }
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.webmLoopOpacity
                            return newValues
                          }))
                        }}
                      />
                    </div>
                  </>
                )}
                <div className="test-settings-divider"></div>
                <div className="test-settings-section">
                  <label className="test-settings-label">外部ウィンドウキャプチャ</label>
                  <input
                    type="checkbox"
                    checked={config.externalWindow.enabled}
                    onChange={(e) => {
                      updateConfigLocal({ externalWindow: { ...config.externalWindow, enabled: e.target.checked } })
                    }}
                  />
                </div>
                {config.externalWindow.enabled && (
                  <>
                    <div className="test-settings-section">
                      <label className="test-settings-label">位置 X (px)</label>
                      <input
                        type="number"
                        className="test-settings-input"
                        value={testInputValues.externalWindowX ?? config.externalWindow.x}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, externalWindowX: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value)) {
                            updateConfigLocal({ externalWindow: { ...config.externalWindow, x: value } })
                          }
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.externalWindowX
                            return newValues
                          }))
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">位置 Y (px)</label>
                      <input
                        type="number"
                        className="test-settings-input"
                        value={testInputValues.externalWindowY ?? config.externalWindow.y}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, externalWindowY: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value)) {
                            updateConfigLocal({ externalWindow: { ...config.externalWindow, y: value } })
                          }
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.externalWindowY
                            return newValues
                          }))
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">幅 (px)</label>
                      <input
                        type="number"
                        className="test-settings-input"
                        value={testInputValues.externalWindowWidth ?? config.externalWindow.width}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, externalWindowWidth: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value) && value > 0) {
                            updateConfigLocal({ externalWindow: { ...config.externalWindow, width: value } })
                          }
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.externalWindowWidth
                            return newValues
                          }))
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">高さ (px)</label>
                      <input
                        type="number"
                        className="test-settings-input"
                        value={testInputValues.externalWindowHeight ?? config.externalWindow.height}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, externalWindowHeight: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value) && value > 0) {
                            updateConfigLocal({ externalWindow: { ...config.externalWindow, height: value } })
                          }
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.externalWindowHeight
                            return newValues
                          }))
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">透明度 (0-1)</label>
                      <input
                        type="number"
                        className="test-settings-input"
                        step="0.1"
                        min="0"
                        max="1"
                        value={testInputValues.externalWindowOpacity ?? config.externalWindow.opacity}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, externalWindowOpacity: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value) && value >= 0 && value <= 1) {
                            updateConfigLocal({ externalWindow: { ...config.externalWindow, opacity: value } })
                          }
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.externalWindowOpacity
                            return newValues
                          }))
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">Z-Index</label>
                      <input
                        type="number"
                        className="test-settings-input"
                        value={testInputValues.externalWindowZIndex ?? config.externalWindow.zIndex}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, externalWindowZIndex: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value)) {
                            updateConfigLocal({ externalWindow: { ...config.externalWindow, zIndex: value } })
                          }
                        }}
                        onBlur={() => {
                          setTestInputValues((prev => {
                            const newValues = { ...prev }
                            delete newValues.externalWindowZIndex
                            return newValues
                          }))
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <button
                        className="test-button test-recapture"
                        onClick={recaptureExternalWindow}
                        title="外部ウィンドウを再キャプチャ"
                      >
                        再キャプチャ
                      </button>
                    </div>
                  </>
                )}
                <div className="test-settings-divider"></div>
                <div className="test-settings-section">
                  <label className="test-settings-label" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>ダメージエフェクトフィルター</label>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">ダメージエフェクトフィルターを有効にする</label>
                  <input
                    type="checkbox"
                    checked={config.attack.filterEffectEnabled}
                    onChange={(e) => {
                      updateConfigLocal({ attack: { ...config.attack, filterEffectEnabled: e.target.checked } })
                    }}
                  />
                </div>
                {config.attack.filterEffectEnabled && (
                  <>
                    <div className="test-settings-section">
                      <label className="test-settings-label">セピア (0-1)</label>
                  <input
                    type="range"
                    className="test-settings-range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.damageEffectFilter.sepia}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      updateConfigLocal({
                        damageEffectFilter: { ...config.damageEffectFilter, sepia: value },
                      })
                    }}
                  />
                  <span className="test-settings-range-value">{config.damageEffectFilter.sepia.toFixed(2)}</span>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">色相 (-360-360)</label>
                  <input
                    type="range"
                    className="test-settings-range"
                    min="-360"
                    max="360"
                    step="1"
                    value={config.damageEffectFilter.hueRotate}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      updateConfigLocal({
                        damageEffectFilter: { ...config.damageEffectFilter, hueRotate: value },
                      })
                    }}
                  />
                  <span className="test-settings-range-value">{config.damageEffectFilter.hueRotate}°</span>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">彩度 (0-2)</label>
                  <input
                    type="range"
                    className="test-settings-range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={config.damageEffectFilter.saturate}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      updateConfigLocal({
                        damageEffectFilter: { ...config.damageEffectFilter, saturate: value },
                      })
                    }}
                  />
                  <span className="test-settings-range-value">{config.damageEffectFilter.saturate.toFixed(2)}</span>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">明度 (0-2)</label>
                  <input
                    type="range"
                    className="test-settings-range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={config.damageEffectFilter.brightness}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      updateConfigLocal({
                        damageEffectFilter: { ...config.damageEffectFilter, brightness: value },
                      })
                    }}
                  />
                  <span className="test-settings-range-value">{config.damageEffectFilter.brightness.toFixed(2)}</span>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">コントラスト (0-2)</label>
                  <input
                    type="range"
                    className="test-settings-range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={config.damageEffectFilter.contrast}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      updateConfigLocal({
                        damageEffectFilter: { ...config.damageEffectFilter, contrast: value },
                      })
                    }}
                  />
                  <span className="test-settings-range-value">{config.damageEffectFilter.contrast.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="test-settings-divider"></div>
                <div className="test-settings-section">
                  <label className="test-settings-label" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>回復エフェクトフィルター</label>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">回復エフェクトフィルターを有効にする</label>
                  <input
                    type="checkbox"
                    checked={config.heal.filterEffectEnabled}
                    onChange={(e) => {
                      updateConfigLocal({ heal: { ...config.heal, filterEffectEnabled: e.target.checked } })
                    }}
                  />
                </div>
                {config.heal.filterEffectEnabled && (
                  <>
                    <div className="test-settings-section">
                      <label className="test-settings-label">セピア (0-1)</label>
                  <input
                    type="range"
                    className="test-settings-range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.healEffectFilter.sepia}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      updateConfigLocal({
                        healEffectFilter: { ...config.healEffectFilter, sepia: value },
                      })
                    }}
                  />
                  <span className="test-settings-range-value">{config.healEffectFilter.sepia.toFixed(2)}</span>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">色相 (-360-360)</label>
                  <input
                    type="range"
                    className="test-settings-range"
                    min="-360"
                    max="360"
                    step="1"
                    value={config.healEffectFilter.hueRotate}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      updateConfigLocal({
                        healEffectFilter: { ...config.healEffectFilter, hueRotate: value },
                      })
                    }}
                  />
                  <span className="test-settings-range-value">{config.healEffectFilter.hueRotate}°</span>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">彩度 (0-2)</label>
                  <input
                    type="range"
                    className="test-settings-range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={config.healEffectFilter.saturate}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      updateConfigLocal({
                        healEffectFilter: { ...config.healEffectFilter, saturate: value },
                      })
                    }}
                  />
                  <span className="test-settings-range-value">{config.healEffectFilter.saturate.toFixed(2)}</span>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">明度 (0-2)</label>
                  <input
                    type="range"
                    className="test-settings-range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={config.healEffectFilter.brightness}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      updateConfigLocal({
                        healEffectFilter: { ...config.healEffectFilter, brightness: value },
                      })
                    }}
                  />
                  <span className="test-settings-range-value">{config.healEffectFilter.brightness.toFixed(2)}</span>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">コントラスト (0-2)</label>
                  <input
                    type="range"
                    className="test-settings-range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={config.healEffectFilter.contrast}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      updateConfigLocal({
                        healEffectFilter: { ...config.healEffectFilter, contrast: value },
                      })
                    }}
                  />
                  <span className="test-settings-range-value">{config.healEffectFilter.contrast.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="test-settings-divider"></div>
                <div className="test-settings-section">
                  <label className="test-settings-label" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>HPゲージ色設定</label>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">最後の1ゲージ</label>
                  <input
                    type="color"
                    value={config.gaugeColors.lastGauge}
                    onChange={(e) => {
                      updateConfigLocal({ gaugeColors: { ...config.gaugeColors, lastGauge: e.target.value } })
                    }}
                    style={{ width: '60px', height: '30px', marginLeft: '0.5rem' }}
                  />
                  <input
                    type="text"
                    className="test-settings-input"
                    value={testInputValues.gaugeColorLast ?? config.gaugeColors.lastGauge}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, gaugeColorLast: e.target.value }))
                      updateConfigLocal({ gaugeColors: { ...config.gaugeColors, lastGauge: e.target.value } })
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.gaugeColorLast
                        return newValues
                      }))
                    }}
                    placeholder="#FF0000"
                    style={{ width: '100px', marginLeft: '0.5rem' }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">2ゲージ目</label>
                  <input
                    type="color"
                    value={config.gaugeColors.secondGauge}
                    onChange={(e) => {
                      updateConfigLocal({ gaugeColors: { ...config.gaugeColors, secondGauge: e.target.value } })
                    }}
                    style={{ width: '60px', height: '30px', marginLeft: '0.5rem' }}
                  />
                  <input
                    type="text"
                    className="test-settings-input"
                    value={testInputValues.gaugeColorSecond ?? config.gaugeColors.secondGauge}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, gaugeColorSecond: e.target.value }))
                      updateConfigLocal({ gaugeColors: { ...config.gaugeColors, secondGauge: e.target.value } })
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.gaugeColorSecond
                        return newValues
                      }))
                    }}
                    placeholder="#FFA500"
                    style={{ width: '100px', marginLeft: '0.5rem' }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">交互パターン1（3, 5, 7, 9...ゲージ目）</label>
                  <input
                    type="color"
                    value={config.gaugeColors.patternColor1}
                    onChange={(e) => {
                      updateConfigLocal({ gaugeColors: { ...config.gaugeColors, patternColor1: e.target.value } })
                    }}
                    style={{ width: '60px', height: '30px', marginLeft: '0.5rem' }}
                  />
                  <input
                    type="text"
                    className="test-settings-input"
                    value={testInputValues.gaugeColorPattern1 ?? config.gaugeColors.patternColor1}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, gaugeColorPattern1: e.target.value }))
                      updateConfigLocal({ gaugeColors: { ...config.gaugeColors, patternColor1: e.target.value } })
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.gaugeColorPattern1
                        return newValues
                      }))
                    }}
                    placeholder="#8000FF"
                    style={{ width: '100px', marginLeft: '0.5rem' }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">交互パターン2（4, 6, 8, 10...ゲージ目）</label>
                  <input
                    type="color"
                    value={config.gaugeColors.patternColor2}
                    onChange={(e) => {
                      updateConfigLocal({ gaugeColors: { ...config.gaugeColors, patternColor2: e.target.value } })
                    }}
                    style={{ width: '60px', height: '30px', marginLeft: '0.5rem' }}
                  />
                  <input
                    type="text"
                    className="test-settings-input"
                    value={testInputValues.gaugeColorPattern2 ?? config.gaugeColors.patternColor2}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, gaugeColorPattern2: e.target.value }))
                      updateConfigLocal({ gaugeColors: { ...config.gaugeColors, patternColor2: e.target.value } })
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.gaugeColorPattern2
                        return newValues
                      }))
                    }}
                    placeholder="#4aa3ff"
                    style={{ width: '100px', marginLeft: '0.5rem' }}
                  />
                </div>
                <div className="test-settings-divider"></div>
                <div className="test-settings-section">
                  <label className="test-settings-label" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>ダメージ値色設定</label>
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">通常ダメージ</label>
                  <input
                    type="color"
                    value={config.damageColors.normal}
                    onChange={(e) => {
                      updateConfigLocal({ damageColors: { ...config.damageColors, normal: e.target.value } })
                    }}
                    style={{ width: '60px', height: '30px', marginLeft: '0.5rem' }}
                  />
                  <input
                    type="text"
                    className="test-settings-input"
                    value={testInputValues.damageColorNormal ?? config.damageColors.normal}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, damageColorNormal: e.target.value }))
                      updateConfigLocal({ damageColors: { ...config.damageColors, normal: e.target.value } })
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.damageColorNormal
                        return newValues
                      }))
                    }}
                    placeholder="#cc0000"
                    style={{ width: '100px', marginLeft: '0.5rem' }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">クリティカルダメージ</label>
                  <input
                    type="color"
                    value={config.damageColors.critical}
                    onChange={(e) => {
                      updateConfigLocal({ damageColors: { ...config.damageColors, critical: e.target.value } })
                    }}
                    style={{ width: '60px', height: '30px', marginLeft: '0.5rem' }}
                  />
                  <input
                    type="text"
                    className="test-settings-input"
                    value={testInputValues.damageColorCritical ?? config.damageColors.critical}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, damageColorCritical: e.target.value }))
                      updateConfigLocal({ damageColors: { ...config.damageColors, critical: e.target.value } })
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.damageColorCritical
                        return newValues
                      }))
                    }}
                    placeholder="#cc8800"
                    style={{ width: '100px', marginLeft: '0.5rem' }}
                  />
                </div>
                <div className="test-settings-section">
                  <label className="test-settings-label">出血ダメージ</label>
                  <input
                    type="color"
                    value={config.damageColors.bleed}
                    onChange={(e) => {
                      updateConfigLocal({ damageColors: { ...config.damageColors, bleed: e.target.value } })
                    }}
                    style={{ width: '60px', height: '30px', marginLeft: '0.5rem' }}
                  />
                  <input
                    type="text"
                    className="test-settings-input"
                    value={testInputValues.damageColorBleed ?? config.damageColors.bleed}
                    onChange={(e) => {
                      setTestInputValues((prev) => ({ ...prev, damageColorBleed: e.target.value }))
                      updateConfigLocal({ damageColors: { ...config.damageColors, bleed: e.target.value } })
                    }}
                    onBlur={() => {
                      setTestInputValues((prev => {
                        const newValues = { ...prev }
                        delete newValues.damageColorBleed
                        return newValues
                      }))
                    }}
                    placeholder="#ff6666"
                    style={{ width: '100px', marginLeft: '0.5rem' }}
                  />
                </div>
                <div className="test-settings-divider"></div>
                <div className="test-settings-section">
                  <button
                    className="test-button test-save"
                    onClick={async () => {
                      if (config) {
                        const success = await saveOverlayConfig(config)
                        if (success) {
                          setShowSaveDialog(true)
                          // 3秒後に自動的に閉じる
                          setTimeout(() => {
                            setShowSaveDialog(false)
                          }, 3000)
                        } else {
                          alert('設定の保存に失敗しました。')
                        }
                      }
                    }}
                    title="設定を保存"
                  >
                    設定を保存
                  </button>
                </div>
                <div className="test-settings-section">
                  <button
                    className="test-button test-reload"
                    onClick={reloadConfig}
                    title="overlay-config.jsonから設定を再読み込み"
                    disabled={configLoading}
                  >
                    {configLoading ? '読み込み中...' : '設定を再読み込み'}
                  </button>
                </div>
              </div>
            )}
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
              <button
                onClick={triggerReset}
                className="test-button test-reset"
                disabled={currentHP >= maxHP}
              >
                全回復
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 保存成功ダイアログ */}
      {showSaveDialog && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#2d2d2d',
            color: '#fff',
            padding: '20px 30px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
            zIndex: 10000,
            border: '2px solid #4CAF50',
            minWidth: '300px',
            textAlign: 'center',
          }}
        >
          <div style={{ marginBottom: '15px', fontSize: '18px', fontWeight: 'bold', color: '#4CAF50' }}>
            ✅ 保存完了
          </div>
          <div style={{ marginBottom: '15px', fontSize: '14px' }}>
            設定を正常に保存しました。
          </div>
          <button
            onClick={() => setShowSaveDialog(false)}
            style={{
              backgroundColor: '#4CAF50',
              color: '#fff',
              border: 'none',
              padding: '8px 20px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#45a049'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#4CAF50'
            }}
          >
            OK
          </button>
        </div>
      )}
    </div>
  )
}

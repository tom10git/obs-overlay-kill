/**
 * OBS Overlay ページ
 * ブラウザウィンドウをキャプチャーして使用するHPゲージ表示ページ
 */

import { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { useHPGauge } from '../hooks/useHPGauge'
import { useViewerHP } from '../hooks/useViewerHP'
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
import { twitchChat } from '../utils/twitchChat'
import { stripEmotesFromMessage } from '../utils/chatMessage'
import type { TwitchChatMessage } from '../types/twitch'
import { saveOverlayConfig, validateAndSanitizeConfig, getDefaultConfig } from '../utils/overlayConfig'
import { twitchApi } from '../utils/twitchApi'
import type { OverlayConfig, AttackConfig } from '../types/overlay'
import type { ChannelPointEvent } from '../types/overlay'
import './OverlayPage.css'

/** ランダム回復量を計算（step が 1 のときは min～max の連続値、>1 のときは min, min+step, min+2*step... のいずれか） */
function getRandomHealAmount(min: number, max: number, step: number): number {
  if (step <= 1) return Math.floor(Math.random() * (max - min + 1)) + min
  const steps = Math.floor((max - min) / step) + 1
  if (steps < 1) return min
  const index = Math.floor(Math.random() * steps)
  return min + index * step
}

/** ランダムダメージを計算（getRandomHealAmount と同じ仕様） */
function getRandomDamageAmount(min: number, max: number, step: number): number {
  return getRandomHealAmount(min, max, step)
}

/** AttackConfig から今回の攻撃で使うダメージ1つを決定（固定 or ランダム） */
function getAttackDamage(ac: AttackConfig): number {
  if (ac.damageType === 'random' && ac.damageMin != null && ac.damageMax != null && ac.damageRandomStep != null) {
    return getRandomDamageAmount(ac.damageMin, ac.damageMax, ac.damageRandomStep)
  }
  return ac.damage
}

/** 反転回復の回復量を決定（固定 or ランダム） */
function getStreamerHealOnAttackAmount(pvp: {
  streamerHealOnAttackType?: 'fixed' | 'random'
  streamerHealOnAttackAmount: number
  streamerHealOnAttackMin?: number
  streamerHealOnAttackMax?: number
  streamerHealOnAttackRandomStep?: number
}): number {
  if (pvp.streamerHealOnAttackType === 'random' && pvp.streamerHealOnAttackMin != null && pvp.streamerHealOnAttackMax != null && pvp.streamerHealOnAttackRandomStep != null) {
    return getRandomHealAmount(pvp.streamerHealOnAttackMin, pvp.streamerHealOnAttackMax, pvp.streamerHealOnAttackRandomStep)
  }
  return pvp.streamerHealOnAttackAmount ?? 10
}

export function OverlayPage() {
  const username = getAdminUsername() || ''
  const { user, loading: userLoading } = useTwitchUser(username)

  // MISS表示（短時間だけ表示してCSSアニメーションさせる）
  const [missVisible, setMissVisible] = useState(false)
  const missTimerRef = useRef<number | null>(null)

  // クリティカル表示（短時間だけ表示してCSSアニメーションさせる）
  const [criticalVisible, setCriticalVisible] = useState(false)
  const criticalTimerRef = useRef<number | null>(null)

  // 食いしばり（HP1残り）メッセージ表示
  const [survivalMessageVisible, setSurvivalMessageVisible] = useState(false)
  const [survivalMessageText, setSurvivalMessageText] = useState('')
  const survivalMessageTimerRef = useRef<number | null>(null)

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
  const [showTestSettings, setShowTestSettings] = useState(false)
  const [testSettingsTab, setTestSettingsTab] = useState<'streamer' | 'user' | 'autoReply'>('streamer')
  const [testAutoReplySubTab, setTestAutoReplySubTab] = useState<'streamer' | 'viewer'>('streamer')
  const [testInputValues, setTestInputValues] = useState<Record<string, string>>({}) // 入力中の値を保持
  const [showSaveDialog, setShowSaveDialog] = useState(false) // 保存成功ダイアログの表示/非表示
  const fileInputRef = useRef<HTMLInputElement>(null) // ファイル選択用のinput要素の参照

  // テストモード設定ウィンドウのサイズ・位置（上下左右の端でリサイズ）
  const [testPanelSize, setTestPanelSize] = useState({ right: 20, bottom: 20, width: 420, height: 400 })
  const [testPanelResize, setTestPanelResize] = useState<{
    edge: 'n' | 's' | 'e' | 'w'
    startX: number
    startY: number
    startW: number
    startH: number
    startRight: number
    startBottom: number
  } | null>(null)

  useEffect(() => {
    if (!testPanelResize) return
    const minW = 320
    const minH = 280
    const onMove = (e: MouseEvent) => {
      const maxW = Math.floor(window.innerWidth * 0.95)
      const maxH = Math.floor(window.innerHeight * 0.85)
      const dx = e.clientX - testPanelResize.startX
      const dy = e.clientY - testPanelResize.startY
      setTestPanelSize((prev) => {
        let { width, height, right, bottom } = prev
        switch (testPanelResize.edge) {
          case 'e':
            width = Math.min(maxW, Math.max(minW, testPanelResize.startW + dx))
            break
          case 'w':
            width = Math.min(maxW, Math.max(minW, testPanelResize.startW - dx))
            right = testPanelResize.startRight + (testPanelResize.startW - width)
            break
          case 's':
            height = Math.min(maxH, Math.max(minH, testPanelResize.startH + dy))
            break
          case 'n':
            height = Math.min(maxH, Math.max(minH, testPanelResize.startH - dy))
            bottom = testPanelResize.startBottom + (testPanelResize.startH - height)
            break
        }
        return { width, height, right, bottom }
      })
    }
    const onUp = () => setTestPanelResize(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [testPanelResize])

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
  /** 反転回復を攻撃モーション終了後に実行するためのタイマー */
  const streamerHealOnAttackTimerRef = useRef<number | null>(null)
  // 回避（ミス）時の外部ウィンドウ・WebMの左右にずれて戻るエフェクト
  const [dodgeEffectActive, setDodgeEffectActive] = useState(false)
  const dodgeEffectTimerRef = useRef<number | null>(null)

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

  /** 回避（ミス）時: 外部ウィンドウキャプチャとWebMループを左右に少し動かして元に戻す */
  const triggerDodgeEffect = useCallback((durationMs: number = 450) => {
    if (dodgeEffectTimerRef.current) {
      window.clearTimeout(dodgeEffectTimerRef.current)
    }
    setDodgeEffectActive(true)
    dodgeEffectTimerRef.current = window.setTimeout(() => {
      setDodgeEffectActive(false)
      dodgeEffectTimerRef.current = null
    }, durationMs)
  }, [])

  const showSurvivalMessage = useCallback(
    (message: string, durationMs: number = 1500) => {
      setSurvivalMessageText(message)
      setSurvivalMessageVisible(false)
      requestAnimationFrame(() => setSurvivalMessageVisible(true))

      if (survivalMessageTimerRef.current) {
        window.clearTimeout(survivalMessageTimerRef.current)
      }
      survivalMessageTimerRef.current = window.setTimeout(() => {
        setSurvivalMessageVisible(false)
        survivalMessageTimerRef.current = null
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
      if (dodgeEffectTimerRef.current) window.clearTimeout(dodgeEffectTimerRef.current)
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
  } = useHPGauge({
    broadcasterId: user?.id || '',
    channel: username,
    onSurvivalHp1: (message) => showSurvivalMessage(message),
    onStreamerZeroHp: (message) => {
      const raw = message?.trim()
      if (!raw || config?.test.enabled || !config?.retry.streamerAutoReplyEnabled) return
      const attackerName = lastStreamerAttackerRef.current?.userName ?? ''
      const msg = raw.replace(/\{attacker\}/g, attackerName).trim()
      if (!msg) return
      if (twitchChat.canSend()) twitchChat.say(username, msg)
      else if (user?.id) twitchApi.sendChatMessage(user.id, msg).catch((err) => console.error('[PvP] 配信者HP0自動返信の送信失敗', err))
    },
  })

  // PvP: 視聴者ごとのHP（ゲージなし・数値のみ）
  const {
    getViewerHP,
    getViewerHPCurrent,
    getViewerUserIds,
    ensureViewerHP,
    applyViewerDamage,
    setViewerHP,
    maxHP: viewerMaxHP,
  } = useViewerHP(config)
  const lastAttackerRef = useRef<{ userId: string; userName: string } | null>(null)
  /** 配信者HPを0にした攻撃者（視聴者）。HP0自動返信で「倒した」表示に使用 */
  const lastStreamerAttackerRef = useRef<{ userId: string; userName: string } | null>(null)
  /** ユーザー名（ログイン/表示名）→ userId, displayName（カウンターコマンドでユーザー名指定用） */
  const userLookupRef = useRef<Map<string, { userId: string; displayName: string }>>(new Map())
  /** userId → 表示名（ランダムカウンター時の返信用） */
  const userIdToDisplayNameRef = useRef<Map<string, string>>(new Map())

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
      // 反転回復タイマーは currentHP 変更時にクリアしない（攻撃→減る→遅延で回復の流れを維持。アンマウント時のみクリア）
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

  // アンマウント時のみ：反転回復タイマーをクリア（currentHP の effect ではクリアしない）
  useEffect(() => {
    return () => {
      if (streamerHealOnAttackTimerRef.current !== null) {
        window.clearTimeout(streamerHealOnAttackTimerRef.current)
        streamerHealOnAttackTimerRef.current = null
      }
    }
  }, [])

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


  // 攻撃イベントハンドラ（PvP時は発動者を lastAttacker に保存）
  const handleAttackEvent = useCallback(
    (event: ChannelPointEvent | { rewardId: string; userId?: string; userName?: string }) => {
      if (!config) return

      // PvP時: 攻撃者を記録（カウンター攻撃の対象にする）
      if (config.pvp?.enabled && event.userId) {
        lastAttackerRef.current = {
          userId: event.userId,
          userName: event.userName ?? event.userId,
        }
      }

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
          // 反転回復の判定（この攻撃で「HPが減ったあとに回復」するか。0なら通常ダメージのみ）
          let reverseHealAmount = 0
          if (config.pvp?.streamerHealOnAttackEnabled && (config.pvp.streamerHealOnAttackProbability ?? 0) > 0) {
            const roll = Math.random() * 100
            if (roll < (config.pvp.streamerHealOnAttackProbability ?? 0)) {
              reverseHealAmount = getStreamerHealOnAttackAmount(config.pvp)
            }
          }
          // 配信者HPを0にした「倒した」表示用：視聴者が攻撃したときだけ攻撃者を記録
          if (event.userId && user?.id && event.userId !== user.id) {
            lastStreamerAttackerRef.current = {
              userId: event.userId,
              userName: event.userName ?? event.userId,
            }
          } else if (!event.userId || event.userId === user?.id) {
            lastStreamerAttackerRef.current = null
          }
          // クリティカル判定（今回の攻撃のベースダメージは getAttackDamage で決定）
          const baseDamage = getAttackDamage(config.attack)
          let finalDamage = baseDamage
          let isCritical = false
          if (config.attack.criticalEnabled) {
            const criticalRoll = Math.random() * 100
            if (criticalRoll < config.attack.criticalProbability) {
              finalDamage = Math.floor(baseDamage * config.attack.criticalMultiplier)
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
          // 反転回復: この攻撃のモーション後（durationMs後）に回復（1回の攻撃フローで「減る→回復」を完結）
          if (reverseHealAmount > 0) {
            const durationMs = config.animation?.duration ?? 500
            streamerHealOnAttackTimerRef.current = window.setTimeout(() => {
              streamerHealOnAttackTimerRef.current = null
              setDamageEffectActive(false)
              increaseHP(reverseHealAmount)
              if (config.heal?.effectEnabled) showHealEffect()
              if (config.heal?.soundEnabled) playHealSound()
            }, durationMs)
          }
        } else {
          // MISSアニメーション表示
          showMiss(config.animation.duration)
          // 回避時: 外部ウィンドウ・WebMを左右に少し動かして戻す
          triggerDodgeEffect(600)
          // ミス効果音を再生
          if (config.attack.missSoundEnabled) {
            playMissSound()
          }
        }

        // PvP時: 視聴者が攻撃した時点で自動カウンター（配信者攻撃を視聴者に適用）し、残りHPを自動返信
        // 対象: 攻撃者にカウンター / ランダムなユーザーにカウンター（設定で切り替え）
        if (
          config.pvp?.enabled &&
          event.userId &&
          username &&
          (config.pvp.counterOnAttackTargetAttacker || config.pvp.counterOnAttackTargetRandom)
        ) {
          ensureViewerHP(event.userId)
          let targetUserId: string
          let targetUserName: string
          if (config.pvp.counterOnAttackTargetAttacker) {
            targetUserId = event.userId
            targetUserName = event.userName ?? event.userId
          } else {
            const ids = getViewerUserIds()
            const idsWithAttacker = ids.includes(event.userId) ? ids : [event.userId, ...ids]
            const picked = idsWithAttacker.length > 0 ? idsWithAttacker[Math.floor(Math.random() * idsWithAttacker.length)]! : event.userId
            targetUserId = picked
            targetUserName = userIdToDisplayNameRef.current.get(picked) ?? (picked === event.userId ? (event.userName ?? event.userId) : picked)
          }
          const sa = config.pvp.streamerAttack
          const result = applyViewerDamage(targetUserId, getAttackDamage(sa), sa)
          const hp = result.newHP
          const max = viewerMaxHP
          const tpl = config.pvp.autoReplyMessageTemplate || '{username} の残りHP: {hp}/{max}'
          const reply = tpl
            .replace(/\{username\}/g, targetUserName)
            .replace(/\{hp\}/g, String(hp))
            .replace(/\{max\}/g, String(max))
          if (config.pvp.autoReplyAttackCounter) {
            if (twitchChat.canSend()) {
              twitchChat.say(username, reply)
            } else if (user?.id) {
              twitchApi.sendChatMessage(user.id, reply).catch((err) => console.error('[PvP] 攻撃時自動返信の送信失敗', err))
            }
          }
          if (result.newHP === 0 && config.pvp.messageWhenViewerZeroHp?.trim() && config.pvp.autoReplyWhenViewerZeroHp) {
            const zeroMsg = config.pvp.messageWhenViewerZeroHp.replace(/\{username\}/g, targetUserName).trim()
            if (zeroMsg) {
              if (twitchChat.canSend()) twitchChat.say(username, zeroMsg)
              else if (user?.id) twitchApi.sendChatMessage(user.id, zeroMsg).catch((err) => console.error('[PvP] 視聴者HP0自動返信の送信失敗', err))
            }
          }
        }
      }
    },
    [config, reduceHP, increaseHP, showHealEffect, showMiss, triggerDodgeEffect, playMissSound, playHealSound, user?.id, applyViewerDamage, ensureViewerHP, getViewerUserIds, viewerMaxHP]
  )

  // 回復イベントハンドラ（チャンネルポイント・カスタムテキスト用。event に userId/userName があれば {username} に使用）
  const handleHealEvent = useCallback(
    (event: { rewardId: string; userId?: string; userName?: string }) => {
      if (!config) return

      // 条件チェック（リワードIDが一致するか、カスタムテキストで判定された場合）
      const isRewardIdMatch = event.rewardId === config.heal.rewardId && config.heal.rewardId.length > 0
      const isCustomTextMatch = event.rewardId === 'custom-text' && !!config.heal.customText && config.heal.customText.length > 0

      if (isRewardIdMatch || isCustomTextMatch) {
        let healAmount = 0
        if (config.heal.healType === 'fixed') {
          healAmount = config.heal.healAmount
        } else {
          // ランダム回復（刻み対応）
          const min = config.heal.healMin
          const max = config.heal.healMax
          const step = config.heal.healRandomStep ?? 1
          healAmount = getRandomHealAmount(min, max, step)
        }

        const newHP = Math.min(maxHP, currentHP + healAmount)
        increaseHP(healAmount)
        // 回復エフェクトを表示（設定で有効な場合のみ）
        if (config.heal.effectEnabled) {
          showHealEffect()
        }
        // 回復効果音を再生
        if (config.heal.soundEnabled) {
          playHealSound()
        }
        // 回復時自動返信（攻撃コマンドと同様）。{username} は引き換え者が配信者なら「配信者」、それ以外は userName
        if (config.heal.autoReplyEnabled && config.heal.autoReplyMessageTemplate?.trim()) {
          const tpl = config.heal.autoReplyMessageTemplate.trim()
          const nameForUsername = event.userId && user?.id && event.userId === user.id ? '配信者' : (event.userName ?? event.userId ?? '視聴者')
          const reply = tpl.replace(/\{username\}/g, nameForUsername).replace(/\{hp\}/g, String(newHP)).replace(/\{max\}/g, String(maxHP))
          if (twitchChat.canSend()) {
            twitchChat.say(username, reply)
          } else if (user?.id) {
            twitchApi.sendChatMessage(user.id, reply).catch((err) => console.error('[回復] 自動返信の送信失敗', err))
          }
        }
      }
    },
    [config, currentHP, maxHP, increaseHP, showHealEffect, playHealSound, user?.id, username, twitchChat, twitchApi]
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
      // PvP時: 視聴者がHP0のときは攻撃/回復をブロックして自動返信
      if (config?.pvp?.enabled && event.userId && username) {
        const state = getViewerHPCurrent(event.userId) ?? getViewerHP(event.userId)
        const current = state?.current ?? viewerMaxHP
        if (current <= 0) {
          const isHeal = config?.heal.enabled && event.rewardId === config.heal.rewardId && config.heal.rewardId.length > 0
          const msg = isHeal ? (config.pvp.messageWhenHealBlockedByZeroHp ?? 'HPが0なので回復できません。') : (config.pvp.messageWhenAttackBlockedByZeroHp ?? 'HPが0なので攻撃できません。')
          if (config.pvp.autoReplyBlockedByZeroHp) {
            if (twitchChat.canSend()) twitchChat.say(username, msg)
            else if (user?.id) twitchApi.sendChatMessage(user.id, msg).catch(() => { })
          }
          return
        }
      }
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
      if (config?.pvp?.enabled && event.userId && username) {
        const state = getViewerHPCurrent(event.userId) ?? getViewerHP(event.userId)
        const current = state?.current ?? viewerMaxHP
        if (current <= 0) {
          const msg = config.pvp.messageWhenAttackBlockedByZeroHp ?? 'HPが0なので攻撃できません。'
          if (config.pvp.autoReplyBlockedByZeroHp) {
            if (twitchChat.canSend()) twitchChat.say(username, msg)
            else if (user?.id) twitchApi.sendChatMessage(user.id, msg).catch(() => { })
          }
          return
        }
      }
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
      if (config?.pvp?.enabled && event.userId && username) {
        const state = getViewerHPCurrent(event.userId) ?? getViewerHP(event.userId)
        const current = state?.current ?? viewerMaxHP
        if (current <= 0) {
          const msg = config.pvp.messageWhenHealBlockedByZeroHp ?? 'HPが0なので回復できません。'
          if (config.pvp.autoReplyBlockedByZeroHp) {
            if (twitchChat.canSend()) twitchChat.say(username, msg)
            else if (user?.id) twitchApi.sendChatMessage(user.id, msg).catch(() => { })
          }
          return
        }
      }
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
      // 反転回復の判定（この攻撃で「HPが減ったあとに回復」するか。0なら通常ダメージのみ）
      let reverseHealAmount = 0
      if (config.pvp?.streamerHealOnAttackEnabled && (config.pvp.streamerHealOnAttackProbability ?? 0) > 0) {
        const roll = Math.random() * 100
        if (roll < (config.pvp.streamerHealOnAttackProbability ?? 0)) {
          reverseHealAmount = getStreamerHealOnAttackAmount(config.pvp)
        }
      }
      // クリティカル判定（今回の攻撃のベースダメージは getAttackDamage で決定）
      const baseDamage = getAttackDamage(config.attack)
      let finalDamage = baseDamage
      let isCritical = false
      if (config.attack.criticalEnabled) {
        const criticalRoll = Math.random() * 100
        if (criticalRoll < config.attack.criticalProbability) {
          finalDamage = Math.floor(baseDamage * config.attack.criticalMultiplier)
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
      // 反転回復: この攻撃のモーション後（durationMs後）に回復（1回の攻撃フローで「減る→回復」を完結）
      if (reverseHealAmount > 0) {
        const durationMs = config.animation?.duration ?? 500
        streamerHealOnAttackTimerRef.current = window.setTimeout(() => {
          streamerHealOnAttackTimerRef.current = null
          setDamageEffectActive(false)
          increaseHP(reverseHealAmount)
          if (config.heal?.effectEnabled) showHealEffect()
          if (config.heal?.soundEnabled) playHealSound()
        }, durationMs)
      }
    } else {
      // ミス時
      showMiss(config.animation.duration)
      // 回避時: 外部ウィンドウ・WebMを左右に少し動かして戻す
      triggerDodgeEffect(600)
      // ミス効果音を再生
      if (config.attack.missSoundEnabled) {
        playMissSound()
      }
    }
  }, [config, isTestMode, currentHP, reduceHP, increaseHP, showHealEffect, showMiss, showCritical, triggerDodgeEffect, playMissSound, playHealSound, playAttackSound, playBleedSound, stopRepeat])

  const handleTestHeal = useCallback(() => {
    if (!config || !isTestMode) return

    let healAmount = 0
    if (config.heal.healType === 'fixed') {
      healAmount = config.heal.healAmount
    } else {
      // ランダム回復（刻み対応）
      const min = config.heal.healMin
      const max = config.heal.healMax
      const step = config.heal.healRandomStep ?? 1
      healAmount = getRandomHealAmount(min, max, step)
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

  // 有効なユーザートークン（リフレッシュ済みの可能性あり）を非同期取得してチャット接続に使用
  const [chatToken, setChatToken] = useState<string | null>(null)
  useEffect(() => {
    if (!username) {
      setChatToken(null)
      return
    }
    twitchApi
      .getValidUserToken()
      .then((token) => setChatToken(token ?? null))
      .catch(() => setChatToken(null))
  }, [username])

  // チャットメッセージを監視（token ありなら identity で接続し、tmi.js の say で自動返信可能・channel-point アプリと同じ方式）
  const chatConnectOptions = username && chatToken ? { token: chatToken, username } : undefined
  const { messages: chatMessages, isConnected: chatConnected } = useTwitchChat(username, 100, chatConnectOptions)
  const processedChatMessagesRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    // カスタムテキストのチャット監視（テストモードでも有効）
    if (!config || !username) {
      return
    }

    // メッセージを古い順で処理（PvPでカウンター攻撃→視聴者攻撃の順にしないと残りHPが正しく反映されない）
    const sortedMessages = [...chatMessages].sort((a, b) => a.timestamp - b.timestamp)
    sortedMessages.forEach((message: TwitchChatMessage) => {
      // PvP: ユーザー名→userId のルックアップ用に送信者を登録（カウンターコマンド・ランダム時の表示名用）
      const u = message.user
      const loginKey = (u.login || u.id).toLowerCase()
      const displayName = u.displayName || u.login || u.id
      userLookupRef.current.set(loginKey, { userId: u.id, displayName })
      const displayKey = displayName.toLowerCase()
      if (displayKey !== loginKey) userLookupRef.current.set(displayKey, { userId: u.id, displayName })
      userIdToDisplayNameRef.current.set(u.id, displayName)

      // 既に処理済みのメッセージはスキップ
      if (processedChatMessagesRef.current.has(message.id)) {
        return
      }

      // スタンプ（emote）を除去した文字列でコマンド判定（「!attack Kappa」などでも実行される）
      const normalizedMessage = stripEmotesFromMessage(message.message, message.emotes)
      const messageText = normalizedMessage.trim()
      const messageLower = messageText.toLowerCase()
      const attackCustomText = config.attack.customText?.trim()
      const healCustomText = config.heal.customText?.trim()

      // 1つのメッセージで1つのコマンドのみを実行する（攻撃を優先）
      let commandMatched = false

      // PvP: 配信者のカウンター攻撃コマンド（配信者のみ実行可能）
      if (
        !commandMatched &&
        config.pvp?.enabled &&
        config.pvp.counterCommand &&
        user?.id &&
        message.user.id === user.id
      ) {
        const cmdLower = config.pvp.counterCommand.toLowerCase().trim()
        const isCounterMatch =
          messageLower === cmdLower ||
          messageLower.startsWith(cmdLower + ' ') ||
          messageLower.startsWith(cmdLower + '\n') ||
          messageLower.startsWith(cmdLower + '\t')
        if (isCounterMatch) {
          let targetUserId: string | null = null
          let targetDisplayName: string = ''
          if (config.pvp.counterCommandAcceptsUsername) {
            const parts = messageText.trim().split(/\s+/)
            if (parts.length >= 2) {
              const namePart = parts.slice(1).join(' ').trim().toLowerCase()
              if (namePart) {
                const looked = userLookupRef.current.get(namePart)
                if (looked) {
                  targetUserId = looked.userId
                  targetDisplayName = looked.displayName
                }
              }
            }
          }
          if (!targetUserId && lastAttackerRef.current) {
            targetUserId = lastAttackerRef.current.userId
            targetDisplayName = lastAttackerRef.current.userName
          }
          if (targetUserId) {
            processedChatMessagesRef.current.add(message.id)
            commandMatched = true
            ensureViewerHP(targetUserId)
            const sa = config.pvp.streamerAttack
            const result = applyViewerDamage(targetUserId, getAttackDamage(sa), sa)
            const tpl = config.pvp.autoReplyMessageTemplate || '{username} の残りHP: {hp}/{max}'
            const reply = tpl
              .replace(/\{username\}/g, targetDisplayName)
              .replace(/\{hp\}/g, String(result.newHP))
              .replace(/\{max\}/g, String(viewerMaxHP))
            if (config.pvp.autoReplyAttackCounter) {
              if (twitchChat.canSend()) {
                twitchChat.say(username, reply)
              } else {
                twitchApi.sendChatMessage(user.id, reply).catch((err) => console.error('[PvP] チャット送信失敗', err))
              }
            }
            if (result.newHP === 0 && config.pvp.messageWhenViewerZeroHp?.trim() && config.pvp.autoReplyWhenViewerZeroHp) {
              const zeroMsg = config.pvp.messageWhenViewerZeroHp.replace(/\{username\}/g, targetDisplayName).trim()
              if (zeroMsg) {
                if (twitchChat.canSend()) twitchChat.say(username, zeroMsg)
                else twitchApi.sendChatMessage(user.id, zeroMsg).catch((err) => console.error('[PvP] 視聴者HP0自動返信の送信失敗', err))
              }
            }
          }
        }
      }

      // PvP: 視聴者同士の攻撃コマンド（例: !attack ユーザー名）。attackMode が both のときのみ有効。
      const pvpAttackMode = config.pvp?.attackMode ?? 'both'
      const viewerAttackViewerCmd = (config.pvp?.viewerAttackViewerCommand ?? '!attack').trim()
      if (
        !commandMatched &&
        config.pvp?.enabled &&
        pvpAttackMode === 'both' &&
        viewerAttackViewerCmd.length > 0 &&
        user?.id &&
        message.user.id !== user.id
      ) {
        const cmdLower = viewerAttackViewerCmd.toLowerCase()
        const isViewerAttackViewerMatch =
          messageLower === cmdLower ||
          messageLower.startsWith(cmdLower + ' ') ||
          messageLower.startsWith(cmdLower + '\n') ||
          messageLower.startsWith(cmdLower + '\t')
        if (isViewerAttackViewerMatch) {
          const parts = messageText.trim().split(/\s+/)
          const targetNamePart = parts.length >= 2 ? parts.slice(1).join(' ').trim().toLowerCase() : ''
          if (!targetNamePart) {
            // ユーザー名未指定は無視（または返信で案内）
          } else {
            const attackerId = message.user.id
            const attackerState = getViewerHPCurrent(attackerId) ?? getViewerHP(attackerId)
            const attackerCurrent = attackerState?.current ?? viewerMaxHP
            if (attackerCurrent <= 0) {
              processedChatMessagesRef.current.add(message.id)
              commandMatched = true
              if (config.pvp.autoReplyBlockedByZeroHp) {
                const msg = config.pvp.messageWhenAttackBlockedByZeroHp ?? 'HPが0なので攻撃できません。'
                if (twitchChat.canSend()) twitchChat.say(username, msg)
                else twitchApi.sendChatMessage(user.id, msg).catch((err) => console.error('[PvP] 視聴者同士攻撃ブロック送信失敗', err))
              }
            } else {
              const looked = userLookupRef.current.get(targetNamePart)
              if (!looked) {
                // 対象がチャットにいない or 未登録
                processedChatMessagesRef.current.add(message.id)
                commandMatched = true
              } else {
                const targetUserId = looked.userId
                const targetDisplayName = looked.displayName
                if (targetUserId === attackerId) {
                  processedChatMessagesRef.current.add(message.id)
                  commandMatched = true
                  // 自分自身は攻撃不可（オプションで返信）
                } else if (targetUserId === user.id) {
                  processedChatMessagesRef.current.add(message.id)
                  commandMatched = true
                  // 配信者への攻撃は別コマンド（攻撃カスタムテキスト）で行う
                } else {
                  processedChatMessagesRef.current.add(message.id)
                  commandMatched = true
                  ensureViewerHP(targetUserId)
                  const vva = config.pvp.viewerVsViewerAttack
                  const result = applyViewerDamage(targetUserId, getAttackDamage(vva), vva)
                  const tpl = config.pvp.autoReplyMessageTemplate || '{username} の残りHP: {hp}/{max}'
                  const reply = tpl
                    .replace(/\{username\}/g, targetDisplayName)
                    .replace(/\{hp\}/g, String(result.newHP))
                    .replace(/\{max\}/g, String(viewerMaxHP))
                  if (config.pvp.autoReplyAttackCounter) {
                    if (twitchChat.canSend()) twitchChat.say(username, reply)
                    else twitchApi.sendChatMessage(user.id, reply).catch((err) => console.error('[PvP] 視聴者同士攻撃返信の送信失敗', err))
                  }
                  if (result.newHP === 0 && config.pvp.messageWhenViewerZeroHp?.trim() && config.pvp.autoReplyWhenViewerZeroHp) {
                    const zeroMsg = config.pvp.messageWhenViewerZeroHp.replace(/\{username\}/g, targetDisplayName).trim()
                    if (zeroMsg) {
                      if (twitchChat.canSend()) twitchChat.say(username, zeroMsg)
                      else twitchApi.sendChatMessage(user.id, zeroMsg).catch((err) => console.error('[PvP] 視聴者HP0自動返信の送信失敗', err))
                    }
                  }
                }
              }
            }
          }
        }
      }

      // PvP: 視聴者のHP確認コマンド（配信者以外が実行）
      if (
        !commandMatched &&
        config.pvp?.enabled &&
        config.pvp.hpCheckCommand &&
        user?.id &&
        message.user.id !== user.id
      ) {
        const cmdLower = config.pvp.hpCheckCommand.toLowerCase().trim()
        const isHpCheckMatch =
          messageLower === cmdLower ||
          messageLower.startsWith(cmdLower + ' ') ||
          messageLower.startsWith(cmdLower + '\n') ||
          messageLower.startsWith(cmdLower + '\t')
        if (isHpCheckMatch) {
          processedChatMessagesRef.current.add(message.id)
          commandMatched = true
          ensureViewerHP(message.user.id)
          const state = getViewerHPCurrent(message.user.id) ?? getViewerHP(message.user.id)
          const hp = state?.current ?? viewerMaxHP
          const max = state?.max ?? viewerMaxHP
          const tpl = config.pvp.autoReplyMessageTemplate || '{username} の残りHP: {hp}/{max}'
          const displayName = message.user.displayName || message.user.login
          const reply = tpl
            .replace(/\{username\}/g, displayName)
            .replace(/\{hp\}/g, String(hp))
            .replace(/\{max\}/g, String(max))
          if (config.pvp.autoReplyHpCheck) {
            if (twitchChat.canSend()) {
              twitchChat.say(username, reply)
            } else {
              twitchApi.sendChatMessage(user.id, reply).catch((err) => console.error('[PvP] HP確認チャット送信失敗', err))
            }
          }
        }
      }

      // PvP: 視聴者側の全回復コマンド（実行した視聴者のHPを最大まで回復）
      if (
        !commandMatched &&
        config.pvp?.enabled &&
        config.pvp.viewerFullHealCommand &&
        config.pvp.viewerFullHealCommand.length > 0 &&
        user?.id &&
        message.user.id !== user.id
      ) {
        const viewerFullHealLower = config.pvp.viewerFullHealCommand.toLowerCase().trim()
        const isViewerFullHealMatch =
          messageLower === viewerFullHealLower ||
          messageLower.startsWith(viewerFullHealLower + ' ') ||
          messageLower.startsWith(viewerFullHealLower + '\n') ||
          messageLower.startsWith(viewerFullHealLower + '\t')
        if (isViewerFullHealMatch) {
          processedChatMessagesRef.current.add(message.id)
          commandMatched = true
          ensureViewerHP(message.user.id)
          setViewerHP(message.user.id, viewerMaxHP)
          const displayName = message.user.displayName || message.user.login
          const tpl = config.pvp.autoReplyMessageTemplate || '{username} の残りHP: {hp}/{max}'
          const reply = tpl
            .replace(/\{username\}/g, displayName)
            .replace(/\{hp\}/g, String(viewerMaxHP))
            .replace(/\{max\}/g, String(viewerMaxHP))
          if (config.pvp.autoReplyFullHeal) {
            if (twitchChat.canSend()) {
              twitchChat.say(username, reply)
            } else {
              twitchApi.sendChatMessage(user.id, reply).catch((err) => console.error('[PvP] 全回復返信の送信失敗', err))
            }
          }
        }
      }

      // PvP: 視聴者側の通常回復コマンド（設定量だけ回復）
      const viewerHealCmd = (config.pvp?.viewerHealCommand ?? '!heal').trim()
      if (
        !commandMatched &&
        config.pvp?.enabled &&
        viewerHealCmd.length > 0 &&
        user?.id &&
        message.user.id !== user.id
      ) {
        const viewerHealLower = viewerHealCmd.toLowerCase()
        const isViewerHealMatch =
          messageLower === viewerHealLower ||
          messageLower.startsWith(viewerHealLower + ' ') ||
          messageLower.startsWith(viewerHealLower + '\n') ||
          messageLower.startsWith(viewerHealLower + '\t')
        if (isViewerHealMatch) {
          processedChatMessagesRef.current.add(message.id)
          commandMatched = true
          ensureViewerHP(message.user.id)
          // ref から現在HPを読む（ensureViewerHP 直後でも setState の updater 内で ref が更新されている）
          const state = getViewerHPCurrent(message.user.id) ?? getViewerHP(message.user.id)
          const current = state?.current ?? viewerMaxHP
          if (current <= 0 && !config.pvp.viewerHealWhenZeroEnabled) {
            if (config.pvp.autoReplyBlockedByZeroHp) {
              const msg = config.pvp.messageWhenHealBlockedByZeroHp ?? 'HPが0なので回復できません。'
              if (twitchChat.canSend()) twitchChat.say(username, msg)
              else twitchApi.sendChatMessage(user.id, msg).catch((err) => console.error('[PvP] HP0ブロックメッセージ送信失敗', err))
            }
          } else {
            let healAmount: number
            if ((config.pvp.viewerHealType ?? 'fixed') === 'random') {
              const min = config.pvp.viewerHealMin ?? 10
              const max = config.pvp.viewerHealMax ?? 30
              const step = config.pvp.viewerHealRandomStep ?? 1
              healAmount = getRandomHealAmount(min, max, step)
            } else {
              healAmount = config.pvp.viewerHealAmount ?? 20
            }
            const newHP = Math.min(viewerMaxHP, current + healAmount)
            setViewerHP(message.user.id, newHP)
            const displayName = message.user.displayName || message.user.login
            // ユーザー側 !heal の自動返信: 回復設定を優先、なければ PvP 視聴者コマンド設定
            const useHealReply = config.heal.autoReplyEnabled && config.heal.autoReplyMessageTemplate?.trim()
            const usePvpReply = !useHealReply && config.pvp.autoReplyHeal
            if (useHealReply) {
              const tpl = config.heal.autoReplyMessageTemplate!.trim()
              const reply = tpl
                .replace(/\{username\}/g, displayName)
                .replace(/\{hp\}/g, String(newHP))
                .replace(/\{max\}/g, String(viewerMaxHP))
              if (twitchChat.canSend()) twitchChat.say(username, reply)
              else twitchApi.sendChatMessage(user.id, reply).catch((err) => console.error('[回復] 視聴者!heal 自動返信の送信失敗', err))
            } else if (usePvpReply) {
              const tpl = config.pvp.autoReplyMessageTemplate || '{username} の残りHP: {hp}/{max}'
              const reply = tpl
                .replace(/\{username\}/g, displayName)
                .replace(/\{hp\}/g, String(newHP))
                .replace(/\{max\}/g, String(viewerMaxHP))
              if (twitchChat.canSend()) twitchChat.say(username, reply)
              else twitchApi.sendChatMessage(user.id, reply).catch((err) => console.error('[PvP] 回復返信の送信失敗', err))
            }
          }
        }
      }

      // 攻撃カスタムテキストの判定（大文字小文字を区別しない）
      if (
        !commandMatched &&
        config.attack.enabled &&
        attackCustomText &&
        attackCustomText.length > 0
      ) {
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
          // PvP時: 視聴者がHP0のときは攻撃をブロックして自動返信
          if (config.pvp?.enabled && user?.id && message.user.id !== user.id) {
            const state = getViewerHPCurrent(message.user.id) ?? getViewerHP(message.user.id)
            const current = state?.current ?? viewerMaxHP
            if (current <= 0) {
              if (config.pvp.autoReplyBlockedByZeroHp) {
                const msg = config.pvp.messageWhenAttackBlockedByZeroHp ?? 'HPが0なので攻撃できません。'
                if (twitchChat.canSend()) twitchChat.say(username, msg)
                else twitchApi.sendChatMessage(user.id, msg).catch((err) => console.error('[PvP] HP0ブロックメッセージ送信失敗', err))
              }
            } else {
              handleAttackEvent({
                rewardId: 'custom-text',
                userId: message.user.id,
                userName: message.user.displayName || message.user.login,
              })
            }
          } else {
            handleAttackEvent({
              rewardId: 'custom-text',
              userId: message.user.id,
              userName: message.user.displayName || message.user.login,
            })
          }
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
          // PvP時: 視聴者がHP0のときは回復をブロックして自動返信
          if (config.pvp?.enabled && user?.id && message.user.id !== user.id) {
            const state = getViewerHPCurrent(message.user.id) ?? getViewerHP(message.user.id)
            const current = state?.current ?? viewerMaxHP
            if (current <= 0) {
              if (config.pvp.autoReplyBlockedByZeroHp) {
                const msg = config.pvp.messageWhenHealBlockedByZeroHp ?? 'HPが0なので回復できません。'
                if (twitchChat.canSend()) twitchChat.say(username, msg)
                else twitchApi.sendChatMessage(user.id, msg).catch((err) => console.error('[PvP] HP0ブロックメッセージ送信失敗', err))
              }
            } else {
              handleHealEvent({ rewardId: 'custom-text' })
            }
          } else {
            handleHealEvent({ rewardId: 'custom-text' })
          }
        }
      }

      // 配信者・全員を全回復するコマンド（配信者のみ実行可能・配信者HPと全視聴者HPを最大まで回復）
      if (
        !commandMatched &&
        config.retry.enabled &&
        config.retry.fullResetAllCommand &&
        config.retry.fullResetAllCommand.length > 0 &&
        user?.id &&
        message.user.id === user.id
      ) {
        const resetAllLower = config.retry.fullResetAllCommand.toLowerCase().trim()
        const isResetAllMatch =
          messageLower === resetAllLower ||
          messageLower.startsWith(resetAllLower + ' ') ||
          messageLower.startsWith(resetAllLower + '\n') ||
          messageLower.startsWith(resetAllLower + '\t')
        if (isResetAllMatch) {
          processedChatMessagesRef.current.add(message.id)
          commandMatched = true
          resetHP()
          getViewerUserIds().forEach((id) => setViewerHP(id, viewerMaxHP))
          if (config.heal.effectEnabled) showHealEffect()
          if (config.retry.soundEnabled) playRetrySound()
        }
      }

      // 配信者側の全回復コマンド（配信者のみ実行可能・HPを最大まで回復）
      if (
        !commandMatched &&
        config.retry.enabled &&
        config.retry.fullHealCommand &&
        config.retry.fullHealCommand.length > 0 &&
        user?.id &&
        message.user.id === user.id
      ) {
        const fullHealLower = config.retry.fullHealCommand.toLowerCase().trim()
        const isFullHealMatch =
          messageLower === fullHealLower ||
          messageLower.startsWith(fullHealLower + ' ') ||
          messageLower.startsWith(fullHealLower + '\n') ||
          messageLower.startsWith(fullHealLower + '\t')
        if (isFullHealMatch) {
          processedChatMessagesRef.current.add(message.id)
          commandMatched = true
          resetHP()
          if (config.heal.effectEnabled) showHealEffect()
          if (config.retry.soundEnabled) playRetrySound()
        }
      }

      // 配信者側の通常回復コマンド（設定量だけ回復）
      if (
        !commandMatched &&
        config.retry.enabled &&
        config.retry.streamerHealCommand &&
        config.retry.streamerHealCommand.length > 0 &&
        user?.id &&
        message.user.id === user.id
      ) {
        const streamerHealLower = config.retry.streamerHealCommand.toLowerCase().trim()
        const isStreamerHealMatch =
          messageLower === streamerHealLower ||
          messageLower.startsWith(streamerHealLower + ' ') ||
          messageLower.startsWith(streamerHealLower + '\n') ||
          messageLower.startsWith(streamerHealLower + '\t')
        if (isStreamerHealMatch) {
          processedChatMessagesRef.current.add(message.id)
          commandMatched = true
          if (currentHP === 0 && !config.retry.streamerHealWhenZeroEnabled) {
            // HP0のときは許可されていなければ何もしない
          } else {
            let healAmount: number
            if (config.retry.streamerHealType === 'random') {
              const min = config.retry.streamerHealMin
              const max = config.retry.streamerHealMax
              const step = config.retry.streamerHealRandomStep ?? 1
              healAmount = getRandomHealAmount(min, max, step)
            } else {
              healAmount = config.retry.streamerHealAmount
            }
            if (healAmount > 0) {
              const newHP = Math.min(maxHP, currentHP + healAmount)
              increaseHP(healAmount)
              if (config.heal.effectEnabled) showHealEffect()
              if (config.retry.soundEnabled) playRetrySound()
              // 回復時自動返信（攻撃コマンドと同様）。{username} は配信者なので「配信者」に置換
              if (config.heal.autoReplyEnabled && config.heal.autoReplyMessageTemplate?.trim()) {
                const tpl = config.heal.autoReplyMessageTemplate.trim()
                const reply = tpl.replace(/\{username\}/g, '配信者').replace(/\{hp\}/g, String(newHP)).replace(/\{max\}/g, String(maxHP))
                if (twitchChat.canSend()) twitchChat.say(username, reply)
                else twitchApi.sendChatMessage(user.id, reply).catch((err) => console.error('[回復] !heal 自動返信の送信失敗', err))
              }
            }
          }
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
  }, [chatMessages, config, isTestMode, username, user?.id, handleAttackEvent, handleHealEvent, chatConnected, currentHP, resetHP, maxHP, increaseHP, showHealEffect, playRetrySound, applyViewerDamage, getViewerHP, getViewerHPCurrent, getViewerUserIds, ensureViewerHP, setViewerHP, viewerMaxHP])

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
      {/* 食いしばり（HP1残り）メッセージ表示 */}
      {survivalMessageVisible && (
        <div className="overlay-survival">{survivalMessageText}</div>
      )}
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
          className={`external-window-container ${damageEffectActive && config.attack.filterEffectEnabled ? 'damage-effect' : ''} ${healEffectActive && config.heal.filterEffectEnabled ? 'heal-effect' : ''} ${dodgeEffectActive ? 'dodge-effect' : ''}`}
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
          className={`webm-loop-container ${damageEffectActive && config.attack.filterEffectEnabled ? 'damage-effect' : ''} ${healEffectActive && config.heal.filterEffectEnabled ? 'heal-effect' : ''} ${dodgeEffectActive ? 'dodge-effect' : ''}`}
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
          <div
            className="test-controls"
            style={{
              right: testPanelSize.right,
              bottom: testPanelSize.bottom,
              width: testPanelSize.width,
              height: testPanelSize.height,
            }}
          >
            <div className="test-controls-scroll">
              <div className="test-controls-inner">
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
                <div className="test-settings-tabs">
                  <button
                    type="button"
                    className={`test-settings-tab ${testSettingsTab === 'streamer' ? 'test-settings-tab-active' : ''}`}
                    onClick={() => setTestSettingsTab('streamer')}
                  >
                    配信者側
                  </button>
                  <button
                    type="button"
                    className={`test-settings-tab ${testSettingsTab === 'user' ? 'test-settings-tab-active' : ''}`}
                    onClick={() => setTestSettingsTab('user')}
                  >
                    ユーザー側
                  </button>
                  <button
                    type="button"
                    className={`test-settings-tab ${testSettingsTab === 'autoReply' ? 'test-settings-tab-active' : ''}`}
                    onClick={() => setTestSettingsTab('autoReply')}
                  >
                    自動返信設定
                  </button>
                </div>
                {testSettingsTab === 'streamer' && (
                  <>
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
                            updateConfigLocal({ hp: { max: value } })
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
                            updateConfigLocal({ hp: { current: value } })
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
                        value={testInputValues.gaugeCount ?? config.hp.gaugeCount}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, gaugeCount: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value) && value >= 1) {
                            updateConfigLocal({ hp: { gaugeCount: value } })
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
                            updateConfigLocal({ hp: { x: value } })
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
                            updateConfigLocal({ hp: { y: value } })
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
                        value={testInputValues.hpGaugeWidth ?? config.hp.width}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, hpGaugeWidth: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value) && value >= 1) {
                            updateConfigLocal({ hp: { width: value } })
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
                        value={testInputValues.hpGaugeHeight ?? config.hp.height}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, hpGaugeHeight: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value) && value >= 1) {
                            updateConfigLocal({ hp: { height: value } })
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
                      <label className="test-settings-label">ダメージタイプ</label>
                      <select
                        className="test-settings-select"
                        value={config.attack.damageType ?? 'fixed'}
                        onChange={(e) => updateConfigLocal({ attack: { damageType: e.target.value as 'fixed' | 'random' } })}
                      >
                        <option value="fixed">固定</option>
                        <option value="random">ランダム</option>
                      </select>
                    </div>
                    {(config.attack.damageType ?? 'fixed') === 'random' ? (
                      <>
                        <div className="test-settings-section">
                          <label className="test-settings-label">ダメージ（最小）</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="test-settings-input"
                            value={testInputValues.attackDamageMin ?? config.attack.damageMin ?? 5}
                            onChange={(e) => setTestInputValues((prev) => ({ ...prev, attackDamageMin: e.target.value }))}
                            onBlur={(e) => {
                              const value = Number(e.target.value.trim())
                              if (!isNaN(value) && value >= 1) updateConfigLocal({ attack: { damageMin: value } })
                              setTestInputValues((prev) => { const next = { ...prev }; delete next.attackDamageMin; return next })
                            }}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">ダメージ（最大）</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="test-settings-input"
                            value={testInputValues.attackDamageMax ?? config.attack.damageMax ?? 15}
                            onChange={(e) => setTestInputValues((prev) => ({ ...prev, attackDamageMax: e.target.value }))}
                            onBlur={(e) => {
                              const value = Number(e.target.value.trim())
                              if (!isNaN(value) && value >= 1) updateConfigLocal({ attack: { damageMax: value } })
                              setTestInputValues((prev) => { const next = { ...prev }; delete next.attackDamageMax; return next })
                            }}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">刻み（1で連続値）</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="test-settings-input"
                            value={testInputValues.attackDamageRandomStep ?? config.attack.damageRandomStep ?? 1}
                            onChange={(e) => setTestInputValues((prev) => ({ ...prev, attackDamageRandomStep: e.target.value }))}
                            onBlur={(e) => {
                              const value = Number(e.target.value.trim())
                              if (!isNaN(value) && value >= 1) updateConfigLocal({ attack: { damageRandomStep: value } })
                              setTestInputValues((prev) => { const next = { ...prev }; delete next.attackDamageRandomStep; return next })
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="test-settings-section">
                        <label className="test-settings-label">攻撃ダメージ</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="test-settings-input"
                          value={testInputValues.attackDamage ?? config.attack.damage}
                          onChange={(e) => setTestInputValues((prev) => ({ ...prev, attackDamage: e.target.value }))}
                          onBlur={(e) => {
                            const value = Number(e.target.value.trim())
                            if (!isNaN(value) && value >= 1) updateConfigLocal({ attack: { damage: value } })
                            setTestInputValues((prev) => { const next = { ...prev }; delete next.attackDamage; return next })
                          }}
                        />
                      </div>
                    )}
                    <div className="test-settings-section">
                      <label className="test-settings-label">ミス確率 (%)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="test-settings-input"
                        value={testInputValues.missProbability ?? config.attack.missProbability}
                        onChange={(e) => setTestInputValues((prev) => ({ ...prev, missProbability: e.target.value }))}
                        onBlur={(e) => {
                          const value = Number(e.target.value.trim())
                          if (!isNaN(value) && value >= 0 && value <= 100) updateConfigLocal({ attack: { missProbability: value } })
                          setTestInputValues((prev) => { const next = { ...prev }; delete next.missProbability; return next })
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">クリティカル確率 (%)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="test-settings-input"
                        value={testInputValues.criticalProbability ?? config.attack.criticalProbability}
                        onChange={(e) => setTestInputValues((prev) => ({ ...prev, criticalProbability: e.target.value }))}
                        onBlur={(e) => {
                          const value = Number(e.target.value.trim())
                          if (!isNaN(value) && value >= 0 && value <= 100) updateConfigLocal({ attack: { criticalProbability: value } })
                          setTestInputValues((prev) => { const next = { ...prev }; delete next.criticalProbability; return next })
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">クリティカル倍率</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="test-settings-input"
                        value={testInputValues.criticalMultiplier ?? config.attack.criticalMultiplier}
                        onChange={(e) => setTestInputValues((prev) => ({ ...prev, criticalMultiplier: e.target.value }))}
                        onBlur={(e) => {
                          const value = Number(e.target.value.trim())
                          if (!isNaN(value) && value >= 1) updateConfigLocal({ attack: { criticalMultiplier: value } })
                          setTestInputValues((prev) => { const next = { ...prev }; delete next.criticalMultiplier; return next })
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">出血確率 (%)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="test-settings-input"
                        value={testInputValues.bleedProbability ?? config.attack.bleedProbability}
                        onChange={(e) => setTestInputValues((prev) => ({ ...prev, bleedProbability: e.target.value }))}
                        onBlur={(e) => {
                          const value = Number(e.target.value.trim())
                          if (!isNaN(value) && value >= 0 && value <= 100) updateConfigLocal({ attack: { bleedProbability: value } })
                          setTestInputValues((prev) => { const next = { ...prev }; delete next.bleedProbability; return next })
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">出血ダメージ</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="test-settings-input"
                        value={testInputValues.bleedDamage ?? config.attack.bleedDamage}
                        onChange={(e) => setTestInputValues((prev) => ({ ...prev, bleedDamage: e.target.value }))}
                        onBlur={(e) => {
                          const value = Number(e.target.value.trim())
                          if (!isNaN(value) && value > 0) updateConfigLocal({ attack: { bleedDamage: value } })
                          setTestInputValues((prev) => { const next = { ...prev }; delete next.bleedDamage; return next })
                        }}
                      />
                    </div>
                    {config.heal.healType === 'fixed' ? (
                      <div className="test-settings-section">
                        <label className="test-settings-label">回復量 (固定)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="test-settings-input"
                          value={testInputValues.healAmount ?? config.heal.healAmount}
                          onChange={(e) => setTestInputValues((prev) => ({ ...prev, healAmount: e.target.value }))}
                          onBlur={(e) => {
                            const value = Number(e.target.value.trim())
                            if (!isNaN(value) && value > 0) updateConfigLocal({ heal: { healAmount: value } })
                            setTestInputValues((prev) => { const next = { ...prev }; delete next.healAmount; return next })
                          }}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="test-settings-section">
                          <label className="test-settings-label">回復量 (最小)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="test-settings-input"
                            value={testInputValues.healMin ?? config.heal.healMin}
                            onChange={(e) => setTestInputValues((prev) => ({ ...prev, healMin: e.target.value }))}
                            onBlur={(e) => {
                              const value = Number(e.target.value.trim())
                              if (!isNaN(value) && value > 0) updateConfigLocal({ heal: { healMin: value } })
                              setTestInputValues((prev) => { const next = { ...prev }; delete next.healMin; return next })
                            }}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">回復量 (最大)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="test-settings-input"
                            value={testInputValues.healMax ?? config.heal.healMax}
                            onChange={(e) => setTestInputValues((prev) => ({ ...prev, healMax: e.target.value }))}
                            onBlur={(e) => {
                              const value = Number(e.target.value.trim())
                              if (!isNaN(value) && value > 0) updateConfigLocal({ heal: { healMax: value } })
                              setTestInputValues((prev) => { const next = { ...prev }; delete next.healMax; return next })
                            }}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">刻み（50・100など。1のときは最小～最大の連続値）</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="test-settings-input"
                            value={testInputValues.healRandomStep ?? config.heal.healRandomStep ?? 1}
                            onChange={(e) => setTestInputValues((prev) => ({ ...prev, healRandomStep: e.target.value }))}
                            onBlur={(e) => {
                              const num = Number(e.target.value.trim())
                              if (!isNaN(num) && num >= 1) updateConfigLocal({ heal: { healRandomStep: num } })
                              setTestInputValues((prev) => { const next = { ...prev }; delete next.healRandomStep; return next })
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
                          updateConfigLocal({ display: { showMaxHp: e.target.checked } })
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">フォントサイズ</label>
                      <input
                        type="number"
                        className="test-settings-input"
                        min="8"
                        value={testInputValues.fontSize ?? config.display.fontSize}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, fontSize: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value) && value >= 1) {
                            updateConfigLocal({ display: { fontSize: value } })
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
                        value={testInputValues.animationDuration ?? config.animation.duration}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, animationDuration: e.target.value }))
                          const value = Number(e.target.value)
                          if (!isNaN(value) && value >= 0) {
                            updateConfigLocal({ animation: { duration: value } })
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
                          updateConfigLocal({ animation: { easing: e.target.value } })
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
                          updateConfigLocal({ attack: { missEnabled: e.target.checked } })
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">クリティカル判定を有効にする</label>
                      <input
                        type="checkbox"
                        checked={config.attack.criticalEnabled}
                        onChange={(e) => {
                          updateConfigLocal({ attack: { criticalEnabled: e.target.checked } })
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">出血ダメージを有効にする</label>
                      <input
                        type="checkbox"
                        checked={config.attack.bleedEnabled}
                        onChange={(e) => {
                          updateConfigLocal({ attack: { bleedEnabled: e.target.checked } })
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
                            value={testInputValues.bleedDuration ?? config.attack.bleedDuration}
                            onChange={(e) => {
                              setTestInputValues((prev) => ({ ...prev, bleedDuration: e.target.value }))
                              const value = Number(e.target.value)
                              if (!isNaN(value) && value >= 1) {
                                updateConfigLocal({ attack: { bleedDuration: value } })
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
                            value={testInputValues.bleedInterval ?? config.attack.bleedInterval}
                            onChange={(e) => {
                              setTestInputValues((prev) => ({ ...prev, bleedInterval: e.target.value }))
                              const value = Number(e.target.value)
                              if (!isNaN(value) && value >= 0.1) {
                                updateConfigLocal({ attack: { bleedInterval: value } })
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
                          updateConfigLocal({ attack: { soundEnabled: e.target.checked } })
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">攻撃時のフィルターエフェクトを有効にする</label>
                      <input
                        type="checkbox"
                        checked={config.attack.filterEffectEnabled}
                        onChange={(e) => {
                          updateConfigLocal({ attack: { filterEffectEnabled: e.target.checked } })
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">攻撃でHPが0になる場合に一定確率で1残す</label>
                      <input
                        type="checkbox"
                        checked={config.attack.survivalHp1Enabled}
                        onChange={(e) => {
                          updateConfigLocal({ attack: { survivalHp1Enabled: e.target.checked } })
                        }}
                      />
                    </div>
                    {config.attack.survivalHp1Enabled && (
                      <>
                        <div className="test-settings-section">
                          <label className="test-settings-label">HPが1残る確率（0-100）</label>
                          <input
                            type="number"
                            className="test-settings-input"
                            min={0}
                            max={100}
                            value={testInputValues.survivalHp1Probability ?? config.attack.survivalHp1Probability}
                            onChange={(e) => {
                              setTestInputValues((prev) => ({ ...prev, survivalHp1Probability: e.target.value }))
                              const value = Number(e.target.value)
                              if (!isNaN(value) && value >= 0 && value <= 100) {
                                updateConfigLocal({ attack: { survivalHp1Probability: value } })
                              }
                            }}
                            onBlur={() => {
                              setTestInputValues((prev => {
                                const newValues = { ...prev }
                                delete newValues.survivalHp1Probability
                                return newValues
                              }))
                            }}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">食いしばり発動時のメッセージ</label>
                          <input
                            type="text"
                            className="test-settings-input"
                            placeholder="食いしばり!"
                            value={config.attack.survivalHp1Message}
                            onChange={(e) => {
                              updateConfigLocal({ attack: { survivalHp1Message: e.target.value } })
                            }}
                          />
                        </div>
                      </>
                    )}
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
                          updateConfigLocal({ heal: { effectEnabled: e.target.checked } })
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">HPが0のときも通常回復を許可する</label>
                      <input
                        type="checkbox"
                        checked={config.heal.healWhenZeroEnabled}
                        onChange={(e) => {
                          updateConfigLocal({ heal: { healWhenZeroEnabled: e.target.checked } })
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">回復効果音を有効にする</label>
                      <input
                        type="checkbox"
                        checked={config.heal.soundEnabled}
                        onChange={(e) => {
                          updateConfigLocal({ heal: { soundEnabled: e.target.checked } })
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">回復時のフィルターエフェクトを有効にする</label>
                      <input
                        type="checkbox"
                        checked={config.heal.filterEffectEnabled}
                        onChange={(e) => {
                          updateConfigLocal({ heal: { filterEffectEnabled: e.target.checked } })
                        }}
                      />
                    </div>
                  </>
                )}
                {testSettingsTab === 'user' && (
                  <>
                    <div className="test-settings-section">
                      <label className="test-settings-label" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>PvPモード（配信者 vs 視聴者、配信者 vs 視聴者同士の攻撃）</label>
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">PvPモードを有効にする</label>
                      <input
                        type="checkbox"
                        checked={config.pvp.enabled}
                        onChange={(e) => {
                          updateConfigLocal({ pvp: { enabled: e.target.checked } })
                        }}
                      />
                    </div>
                    {config.pvp.enabled && (
                      <>
                        <div className="test-settings-section">
                          <label className="test-settings-label">攻撃したユーザーにカウンター</label>
                          <input
                            type="checkbox"
                            checked={config.pvp.counterOnAttackTargetAttacker ?? true}
                            onChange={(e) => updateConfigLocal({ pvp: { counterOnAttackTargetAttacker: e.target.checked } })}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">ランダムなユーザーにカウンター</label>
                          <input
                            type="checkbox"
                            checked={config.pvp.counterOnAttackTargetRandom ?? false}
                            onChange={(e) => updateConfigLocal({ pvp: { counterOnAttackTargetRandom: e.target.checked } })}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">視聴者攻撃時に配信者回復（反転回復）</label>
                          <input
                            type="checkbox"
                            checked={config.pvp.streamerHealOnAttackEnabled ?? false}
                            onChange={(e) => updateConfigLocal({ pvp: { streamerHealOnAttackEnabled: e.target.checked } })}
                          />
                        </div>
                        {(config.pvp.streamerHealOnAttackEnabled ?? false) && (
                          <>
                            <div className="test-settings-section">
                              <label className="test-settings-label">反転回復の確率 (%)</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                className="test-settings-input"
                                value={testInputValues.pvpStreamerHealOnAttackProb ?? config.pvp.streamerHealOnAttackProbability ?? 10}
                                onChange={(e) => setTestInputValues((prev) => ({ ...prev, pvpStreamerHealOnAttackProb: e.target.value }))}
                                onBlur={(e) => {
                                  const num = Number(e.target.value.trim())
                                  if (!isNaN(num) && num >= 0 && num <= 100) {
                                    updateConfigLocal({ pvp: { streamerHealOnAttackProbability: num } })
                                  }
                                  setTestInputValues((prev) => { const next = { ...prev }; delete next.pvpStreamerHealOnAttackProb; return next })
                                }}
                              />
                            </div>
                            <div className="test-settings-section">
                              <label className="test-settings-label">反転回復の回復量タイプ</label>
                              <select
                                className="test-settings-select"
                                value={config.pvp.streamerHealOnAttackType ?? 'fixed'}
                                onChange={(e) => updateConfigLocal({ pvp: { streamerHealOnAttackType: e.target.value as 'fixed' | 'random' } })}
                              >
                                <option value="fixed">固定</option>
                                <option value="random">ランダム</option>
                              </select>
                            </div>
                            {(config.pvp.streamerHealOnAttackType ?? 'fixed') === 'random' ? (
                              <>
                                <div className="test-settings-section">
                                  <label className="test-settings-label">反転回復（最小）</label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    className="test-settings-input"
                                    value={testInputValues.pvpStreamerHealOnAttackMin ?? config.pvp.streamerHealOnAttackMin ?? 5}
                                    onChange={(e) => setTestInputValues((prev) => ({ ...prev, pvpStreamerHealOnAttackMin: e.target.value }))}
                                    onBlur={(e) => {
                                      const num = Number(e.target.value.trim())
                                      if (!isNaN(num) && num >= 1) {
                                        updateConfigLocal({ pvp: { streamerHealOnAttackMin: num } })
                                      }
                                      setTestInputValues((prev) => { const next = { ...prev }; delete next.pvpStreamerHealOnAttackMin; return next })
                                    }}
                                  />
                                </div>
                                <div className="test-settings-section">
                                  <label className="test-settings-label">反転回復（最大）</label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    className="test-settings-input"
                                    value={testInputValues.pvpStreamerHealOnAttackMax ?? config.pvp.streamerHealOnAttackMax ?? 20}
                                    onChange={(e) => setTestInputValues((prev) => ({ ...prev, pvpStreamerHealOnAttackMax: e.target.value }))}
                                    onBlur={(e) => {
                                      const num = Number(e.target.value.trim())
                                      if (!isNaN(num) && num >= 1) {
                                        updateConfigLocal({ pvp: { streamerHealOnAttackMax: num } })
                                      }
                                      setTestInputValues((prev) => { const next = { ...prev }; delete next.pvpStreamerHealOnAttackMax; return next })
                                    }}
                                  />
                                </div>
                                <div className="test-settings-section">
                                  <label className="test-settings-label">刻み（1で連続値）</label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    className="test-settings-input"
                                    value={testInputValues.pvpStreamerHealOnAttackStep ?? config.pvp.streamerHealOnAttackRandomStep ?? 1}
                                    onChange={(e) => setTestInputValues((prev) => ({ ...prev, pvpStreamerHealOnAttackStep: e.target.value }))}
                                    onBlur={(e) => {
                                      const num = Number(e.target.value.trim())
                                      if (!isNaN(num) && num >= 1) {
                                        updateConfigLocal({ pvp: { streamerHealOnAttackRandomStep: num } })
                                      }
                                      setTestInputValues((prev) => { const next = { ...prev }; delete next.pvpStreamerHealOnAttackStep; return next })
                                    }}
                                  />
                                </div>
                              </>
                            ) : (
                              <div className="test-settings-section">
                                <label className="test-settings-label">反転回復の回復量</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  className="test-settings-input"
                                  value={testInputValues.pvpStreamerHealOnAttackAmount ?? config.pvp.streamerHealOnAttackAmount ?? 10}
                                  onChange={(e) => setTestInputValues((prev) => ({ ...prev, pvpStreamerHealOnAttackAmount: e.target.value }))}
                                  onBlur={(e) => {
                                    const num = Number(e.target.value.trim())
                                    if (!isNaN(num) && num >= 1) {
                                      updateConfigLocal({ pvp: { streamerHealOnAttackAmount: num } })
                                    }
                                    setTestInputValues((prev) => { const next = { ...prev }; delete next.pvpStreamerHealOnAttackAmount; return next })
                                  }}
                                />
                              </div>
                            )}
                          </>
                        )}
                        <div className="test-settings-section">
                          <label className="test-settings-label">コマンドでユーザー名指定</label>
                          <input
                            type="checkbox"
                            checked={config.pvp.counterCommandAcceptsUsername ?? false}
                            onChange={(e) => updateConfigLocal({ pvp: { counterCommandAcceptsUsername: e.target.checked } })}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">ユーザー側の最大HP</label>
                          <input
                            type="number"
                            className="test-settings-input"
                            min={1}
                            value={testInputValues.pvpViewerMaxHp ?? config.pvp.viewerMaxHp ?? 100}
                            onChange={(e) => {
                              setTestInputValues((prev) => ({ ...prev, pvpViewerMaxHp: e.target.value }))
                              const num = Number(e.target.value)
                              if (!isNaN(num) && num >= 1) {
                                updateConfigLocal({ pvp: { viewerMaxHp: num } })
                              }
                            }}
                            onBlur={() => {
                              setTestInputValues((prev) => {
                                const next = { ...prev }
                                delete next.pvpViewerMaxHp
                                return next
                              })
                            }}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">追加カウンターコマンド</label>
                          <input
                            type="text"
                            className="test-settings-input"
                            value={config.pvp.counterCommand}
                            onChange={(e) => updateConfigLocal({ pvp: { counterCommand: e.target.value } })}
                            placeholder="!counter"
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">攻撃モード（誰と攻撃し合うか）</label>
                          <select
                            className="test-settings-select"
                            value={config.pvp.attackMode ?? 'both'}
                            onChange={(e) => updateConfigLocal({ pvp: { attackMode: e.target.value as 'streamer_only' | 'both' } })}
                          >
                            <option value="streamer_only">配信者 vs 視聴者のみ</option>
                            <option value="both">両方（視聴者同士の攻撃も有効）</option>
                          </select>
                        </div>
                        {(config.pvp.attackMode ?? 'both') === 'both' && (
                          <>
                            <div className="test-settings-section">
                              <label className="test-settings-label">視聴者同士攻撃コマンド</label>
                              <input
                                type="text"
                                className="test-settings-input"
                                value={config.pvp.viewerAttackViewerCommand ?? '!attack'}
                                onChange={(e) => updateConfigLocal({ pvp: { viewerAttackViewerCommand: e.target.value } })}
                                placeholder="!attack"
                              />
                            </div>
                            <div className="test-settings-section">
                              <label className="test-settings-label">視聴者同士攻撃のダメージタイプ</label>
                              <select
                                className="test-settings-select"
                                value={config.pvp.viewerVsViewerAttack?.damageType ?? 'fixed'}
                                onChange={(e) => updateConfigLocal({ pvp: { viewerVsViewerAttack: { damageType: e.target.value as 'fixed' | 'random' } } })}
                              >
                                <option value="fixed">固定</option>
                                <option value="random">ランダム</option>
                              </select>
                            </div>
                            {(config.pvp.viewerVsViewerAttack?.damageType ?? 'fixed') === 'random' ? (
                              <>
                                <div className="test-settings-section">
                                  <label className="test-settings-label">ダメージ（最小）</label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    className="test-settings-input"
                                    value={testInputValues['pvp.viewerVsViewerAttack.damageMin'] ?? config.pvp.viewerVsViewerAttack?.damageMin ?? 5}
                                    onChange={(e) => setTestInputValues((prev) => ({ ...prev, 'pvp.viewerVsViewerAttack.damageMin': e.target.value }))}
                                    onBlur={(e) => {
                                      const num = Number(e.target.value.trim())
                                      if (!isNaN(num) && num >= 1) {
                                        updateConfigLocal({ pvp: { viewerVsViewerAttack: { damageMin: num } } })
                                      }
                                      setTestInputValues((prev) => { const next = { ...prev }; delete next['pvp.viewerVsViewerAttack.damageMin']; return next })
                                    }}
                                  />
                                </div>
                                <div className="test-settings-section">
                                  <label className="test-settings-label">ダメージ（最大）</label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    className="test-settings-input"
                                    value={testInputValues['pvp.viewerVsViewerAttack.damageMax'] ?? config.pvp.viewerVsViewerAttack?.damageMax ?? 15}
                                    onChange={(e) => setTestInputValues((prev) => ({ ...prev, 'pvp.viewerVsViewerAttack.damageMax': e.target.value }))}
                                    onBlur={(e) => {
                                      const num = Number(e.target.value.trim())
                                      if (!isNaN(num) && num >= 1) {
                                        updateConfigLocal({ pvp: { viewerVsViewerAttack: { damageMax: num } } })
                                      }
                                      setTestInputValues((prev) => { const next = { ...prev }; delete next['pvp.viewerVsViewerAttack.damageMax']; return next })
                                    }}
                                  />
                                </div>
                                <div className="test-settings-section">
                                  <label className="test-settings-label">刻み（1で連続値）</label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    className="test-settings-input"
                                    value={testInputValues['pvp.viewerVsViewerAttack.damageRandomStep'] ?? config.pvp.viewerVsViewerAttack?.damageRandomStep ?? 1}
                                    onChange={(e) => setTestInputValues((prev) => ({ ...prev, 'pvp.viewerVsViewerAttack.damageRandomStep': e.target.value }))}
                                    onBlur={(e) => {
                                      const num = Number(e.target.value.trim())
                                      if (!isNaN(num) && num >= 1) {
                                        updateConfigLocal({ pvp: { viewerVsViewerAttack: { damageRandomStep: num } } })
                                      }
                                      setTestInputValues((prev) => { const next = { ...prev }; delete next['pvp.viewerVsViewerAttack.damageRandomStep']; return next })
                                    }}
                                  />
                                </div>
                              </>
                            ) : (
                              <div className="test-settings-section">
                                <label className="test-settings-label">視聴者同士攻撃のダメージ（下限1）</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  className="test-settings-input"
                                  value={testInputValues['pvp.viewerVsViewerAttack.damage'] ?? String(config.pvp.viewerVsViewerAttack?.damage ?? 10)}
                                  onChange={(e) => setTestInputValues((prev) => ({ ...prev, 'pvp.viewerVsViewerAttack.damage': e.target.value }))}
                                  onBlur={(e) => {
                                    const num = Number(e.target.value.trim())
                                    if (!isNaN(num) && num >= 1) {
                                      updateConfigLocal({ pvp: { viewerVsViewerAttack: { damage: num } } })
                                    }
                                    setTestInputValues((prev) => { const next = { ...prev }; delete next['pvp.viewerVsViewerAttack.damage']; return next })
                                  }}
                                />
                              </div>
                            )}
                          </>
                        )}
                        <div className="test-settings-section">
                          <label className="test-settings-label">HP確認コマンド</label>
                          <input
                            type="text"
                            className="test-settings-input"
                            value={config.pvp.hpCheckCommand}
                            onChange={(e) => updateConfigLocal({ pvp: { hpCheckCommand: e.target.value } })}
                            placeholder="!hp"
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">全回復コマンド（視聴者側）</label>
                          <input
                            type="text"
                            className="test-settings-input"
                            value={config.pvp.viewerFullHealCommand ?? '!fullheal'}
                            onChange={(e) => updateConfigLocal({ pvp: { viewerFullHealCommand: e.target.value } })}
                            placeholder="!fullheal"
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">通常回復コマンド（視聴者側）</label>
                          <input
                            type="text"
                            className="test-settings-input"
                            value={config.pvp.viewerHealCommand ?? '!heal'}
                            onChange={(e) => updateConfigLocal({ pvp: { viewerHealCommand: e.target.value } })}
                            placeholder="!heal"
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">回復量タイプ</label>
                          <select
                            className="test-settings-select"
                            value={config.pvp.viewerHealType ?? 'fixed'}
                            onChange={(e) => updateConfigLocal({ pvp: { viewerHealType: e.target.value as 'fixed' | 'random' } })}
                          >
                            <option value="fixed">固定</option>
                            <option value="random">ランダム</option>
                          </select>
                        </div>
                        {config.pvp.viewerHealType === 'fixed' ? (
                          <div className="test-settings-section">
                            <label className="test-settings-label">回復量</label>
                            <input
                              type="number"
                              className="test-settings-input"
                              min={1}
                              value={config.pvp.viewerHealAmount ?? 20}
                              onChange={(e) => {
                                const num = Number(e.target.value)
                                if (!isNaN(num) && num >= 1) {
                                  updateConfigLocal({ pvp: { viewerHealAmount: num } })
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <>
                            <div className="test-settings-section">
                              <label className="test-settings-label">回復量（最小）</label>
                              <input
                                type="number"
                                className="test-settings-input"
                                min={1}
                                value={config.pvp.viewerHealMin ?? 10}
                                onChange={(e) => {
                                  const num = Number(e.target.value)
                                  if (!isNaN(num) && num >= 1) {
                                    updateConfigLocal({ pvp: { viewerHealMin: num } })
                                  }
                                }}
                              />
                            </div>
                            <div className="test-settings-section">
                              <label className="test-settings-label">回復量（最大）</label>
                              <input
                                type="number"
                                className="test-settings-input"
                                min={1}
                                value={config.pvp.viewerHealMax ?? 30}
                                onChange={(e) => {
                                  const num = Number(e.target.value)
                                  if (!isNaN(num) && num >= 1) {
                                    updateConfigLocal({ pvp: { viewerHealMax: num } })
                                  }
                                }}
                              />
                            </div>
                            <div className="test-settings-section">
                              <label className="test-settings-label">刻み（50・100など。1のときは最小～最大の連続値）</label>
                              <input
                                type="number"
                                className="test-settings-input"
                                min={1}
                                value={config.pvp.viewerHealRandomStep ?? 1}
                                onChange={(e) => {
                                  const num = Number(e.target.value)
                                  if (!isNaN(num) && num >= 1) {
                                    updateConfigLocal({ pvp: { viewerHealRandomStep: num } })
                                  }
                                }}
                              />
                            </div>
                          </>
                        )}
                        <div className="test-settings-section">
                          <label className="test-settings-label">HP0のときも通常回復を許可</label>
                          <input
                            type="checkbox"
                            checked={config.pvp.viewerHealWhenZeroEnabled ?? true}
                            onChange={(e) => updateConfigLocal({ pvp: { viewerHealWhenZeroEnabled: e.target.checked } })}
                          />
                        </div>
                        <div className="test-settings-divider"></div>
                        <div className="test-settings-section">
                          <label className="test-settings-label" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>配信者（カウンター）攻撃</label>
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">ダメージタイプ</label>
                          <select
                            className="test-settings-select"
                            value={config.pvp.streamerAttack.damageType ?? 'fixed'}
                            onChange={(e) =>
                              updateConfigLocal({
                                pvp: { streamerAttack: { damageType: e.target.value as 'fixed' | 'random' } },
                              })
                            }
                          >
                            <option value="fixed">固定</option>
                            <option value="random">ランダム</option>
                          </select>
                        </div>
                        {(config.pvp.streamerAttack.damageType ?? 'fixed') === 'random' ? (
                          <>
                            <div className="test-settings-section">
                              <label className="test-settings-label">ダメージ（最小）</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                className="test-settings-input"
                                value={testInputValues.pvpStreamerDamageMin ?? config.pvp.streamerAttack.damageMin ?? 10}
                                onChange={(e) => setTestInputValues((prev) => ({ ...prev, pvpStreamerDamageMin: e.target.value }))}
                                onBlur={(e) => {
                                  const num = Number(e.target.value.trim())
                                  if (!isNaN(num) && num >= 1) {
                                    updateConfigLocal({ pvp: { streamerAttack: { damageMin: num } } })
                                  }
                                  setTestInputValues((prev) => { const next = { ...prev }; delete next.pvpStreamerDamageMin; return next })
                                }}
                              />
                            </div>
                            <div className="test-settings-section">
                              <label className="test-settings-label">ダメージ（最大）</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                className="test-settings-input"
                                value={testInputValues.pvpStreamerDamageMax ?? config.pvp.streamerAttack.damageMax ?? 25}
                                onChange={(e) => setTestInputValues((prev) => ({ ...prev, pvpStreamerDamageMax: e.target.value }))}
                                onBlur={(e) => {
                                  const num = Number(e.target.value.trim())
                                  if (!isNaN(num) && num >= 1) {
                                    updateConfigLocal({ pvp: { streamerAttack: { damageMax: num } } })
                                  }
                                  // 次フレームでクリアし、setConfig 反映後の config を表示させる
                                  setTimeout(() => {
                                    setTestInputValues((prev) => { const next = { ...prev }; delete next.pvpStreamerDamageMax; return next })
                                  }, 0)
                                }}
                              />
                            </div>
                            <div className="test-settings-section">
                              <label className="test-settings-label">刻み（1で連続値）</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                className="test-settings-input"
                                value={testInputValues.pvpStreamerDamageRandomStep ?? config.pvp.streamerAttack.damageRandomStep ?? 1}
                                onChange={(e) => setTestInputValues((prev) => ({ ...prev, pvpStreamerDamageRandomStep: e.target.value }))}
                                onBlur={(e) => {
                                  const num = Number(e.target.value.trim())
                                  if (!isNaN(num) && num >= 1) {
                                    updateConfigLocal({ pvp: { streamerAttack: { damageRandomStep: num } } })
                                  }
                                  setTestInputValues((prev) => { const next = { ...prev }; delete next.pvpStreamerDamageRandomStep; return next })
                                }}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="test-settings-section">
                            <label className="test-settings-label">受けるダメージ</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="test-settings-input"
                              value={testInputValues.pvpStreamerDamage ?? config.pvp.streamerAttack.damage}
                              onChange={(e) => setTestInputValues((prev) => ({ ...prev, pvpStreamerDamage: e.target.value }))}
                              onBlur={(e) => {
                                const num = Number(e.target.value.trim())
                                if (!isNaN(num) && num >= 1) {
                                  updateConfigLocal({ pvp: { streamerAttack: { damage: num } } })
                                }
                                setTestInputValues((prev) => { const next = { ...prev }; delete next.pvpStreamerDamage; return next })
                              }}
                            />
                          </div>
                        )}
                        <div className="test-settings-section">
                          <label className="test-settings-label">ミスあり</label>
                          <input
                            type="checkbox"
                            checked={config.pvp.streamerAttack.missEnabled}
                            onChange={(e) => updateConfigLocal({ pvp: { streamerAttack: { missEnabled: e.target.checked } } })}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">ミス確率 (%)</label>
                          <input
                            type="number"
                            className="test-settings-input"
                            min={0}
                            max={100}
                            value={testInputValues.pvpStreamerMissProb ?? config.pvp.streamerAttack.missProbability}
                            onChange={(e) => {
                              setTestInputValues((prev) => ({ ...prev, pvpStreamerMissProb: e.target.value }))
                              const num = Number(e.target.value)
                              if (!isNaN(num) && num >= 0 && num <= 100) {
                                updateConfigLocal({ pvp: { streamerAttack: { missProbability: num } } })
                              }
                            }}
                            onBlur={() => {
                              setTestInputValues((prev) => {
                                const next = { ...prev }
                                delete next.pvpStreamerMissProb
                                return next
                              })
                            }}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">クリティカルあり</label>
                          <input
                            type="checkbox"
                            checked={config.pvp.streamerAttack.criticalEnabled}
                            onChange={(e) => updateConfigLocal({ pvp: { streamerAttack: { criticalEnabled: e.target.checked } } })}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">クリティカル確率 (%)</label>
                          <input
                            type="number"
                            className="test-settings-input"
                            min={0}
                            max={100}
                            value={testInputValues.pvpStreamerCritProb ?? config.pvp.streamerAttack.criticalProbability}
                            onChange={(e) => {
                              setTestInputValues((prev) => ({ ...prev, pvpStreamerCritProb: e.target.value }))
                              const num = Number(e.target.value)
                              if (!isNaN(num) && num >= 0 && num <= 100) {
                                updateConfigLocal({ pvp: { streamerAttack: { criticalProbability: num } } })
                              }
                            }}
                            onBlur={() => {
                              setTestInputValues((prev) => {
                                const next = { ...prev }
                                delete next.pvpStreamerCritProb
                                return next
                              })
                            }}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">クリティカル倍率</label>
                          <input
                            type="number"
                            className="test-settings-input"
                            step="0.1"
                            min={1}
                            value={testInputValues.pvpStreamerCritMult ?? config.pvp.streamerAttack.criticalMultiplier}
                            onChange={(e) => {
                              setTestInputValues((prev) => ({ ...prev, pvpStreamerCritMult: e.target.value }))
                              const num = Number(e.target.value)
                              if (!isNaN(num) && num >= 1) {
                                updateConfigLocal({ pvp: { streamerAttack: { criticalMultiplier: num } } })
                              }
                            }}
                            onBlur={() => {
                              setTestInputValues((prev) => {
                                const next = { ...prev }
                                delete next.pvpStreamerCritMult
                                return next
                              })
                            }}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">食いしばり（HP1残り）</label>
                          <input
                            type="checkbox"
                            checked={config.pvp.streamerAttack.survivalHp1Enabled}
                            onChange={(e) => updateConfigLocal({ pvp: { streamerAttack: { survivalHp1Enabled: e.target.checked } } })}
                          />
                        </div>
                        {config.pvp.streamerAttack.survivalHp1Enabled && (
                          <div className="test-settings-section">
                            <label className="test-settings-label">食いしばり確率 (%)</label>
                            <input
                              type="number"
                              className="test-settings-input"
                              min={0}
                              max={100}
                              value={testInputValues.pvpStreamerSurvProb ?? config.pvp.streamerAttack.survivalHp1Probability}
                              onChange={(e) => {
                                setTestInputValues((prev) => ({ ...prev, pvpStreamerSurvProb: e.target.value }))
                                const num = Number(e.target.value)
                                if (!isNaN(num) && num >= 0 && num <= 100) {
                                  updateConfigLocal({ pvp: { streamerAttack: { survivalHp1Probability: num } } })
                                }
                              }}
                              onBlur={() => {
                                setTestInputValues((prev) => {
                                  const next = { ...prev }
                                  delete next.pvpStreamerSurvProb
                                  return next
                                })
                              }}
                            />
                          </div>
                        )}
                      </>
                    )}
                    <div className="test-settings-divider"></div>
                  </>
                )}
                {testSettingsTab === 'autoReply' && (
                  <>
                    <div className="test-settings-tabs test-settings-tabs--sub">
                      <button
                        type="button"
                        className={`test-settings-tab ${testAutoReplySubTab === 'streamer' ? 'test-settings-tab-active' : ''}`}
                        onClick={() => setTestAutoReplySubTab('streamer')}
                      >
                        配信者側
                      </button>
                      <button
                        type="button"
                        className={`test-settings-tab ${testAutoReplySubTab === 'viewer' ? 'test-settings-tab-active' : ''}`}
                        onClick={() => setTestAutoReplySubTab('viewer')}
                      >
                        ユーザー側
                      </button>
                    </div>
                    {testAutoReplySubTab === 'streamer' && (
                      <>
                        <div className="test-settings-section">
                          <label className="test-settings-label">配信者側の自動返信（配信者HP0時などにチャットへメッセージを送る）</label>
                          <input
                            type="checkbox"
                            checked={config.retry.streamerAutoReplyEnabled ?? true}
                            onChange={(e) => updateConfigLocal({ retry: { streamerAutoReplyEnabled: e.target.checked } })}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">配信者HPが0になったときの自動返信（{'{attacker}'} で攻撃者名に置換）</label>
                          <input
                            type="text"
                            className="test-settings-input"
                            value={config.hp.messageWhenZeroHp ?? '配信者を {attacker} が倒しました！'}
                            onChange={(e) => updateConfigLocal({ hp: { messageWhenZeroHp: e.target.value } })}
                            placeholder="配信者を {attacker} が倒しました！"
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">回復コマンド使用時にチャットへ自動返信（攻撃時と同様）</label>
                          <input
                            type="checkbox"
                            checked={config.heal.autoReplyEnabled ?? false}
                            onChange={(e) => updateConfigLocal({ heal: { autoReplyEnabled: e.target.checked } })}
                          />
                        </div>
                        {config.heal.autoReplyEnabled && (
                          <div className="test-settings-section">
                            <label className="test-settings-label">回復時自動返信メッセージ（{'{hp}'} {'{max}'}。視聴者!healは {'{username}'} で視聴者名）</label>
                            <input
                              type="text"
                              value={config.heal.autoReplyMessageTemplate ?? '配信者の残りHP: {hp}/{max}'}
                              onChange={(e) => updateConfigLocal({ heal: { autoReplyMessageTemplate: e.target.value } })}
                              placeholder="配信者の残りHP: {hp}/{max} または {username} の残りHP: {hp}/{max}"
                              className="test-settings-input"
                              style={{ width: '100%', marginTop: '0.25rem' }}
                            />
                          </div>
                        )}
                      </>
                    )}
                    {testAutoReplySubTab === 'viewer' && (
                      <>
                        <div className="test-settings-section">
                          <label className="test-settings-label">攻撃・カウンター時の自動返信（HP表示）</label>
                          <input
                            type="checkbox"
                            checked={config.pvp.autoReplyAttackCounter ?? true}
                            onChange={(e) => updateConfigLocal({ pvp: { autoReplyAttackCounter: e.target.checked } })}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">視聴者HPが0になったときの自動返信</label>
                          <input
                            type="checkbox"
                            checked={config.pvp.autoReplyWhenViewerZeroHp ?? true}
                            onChange={(e) => updateConfigLocal({ pvp: { autoReplyWhenViewerZeroHp: e.target.checked } })}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">HP確認コマンドの自動返信</label>
                          <input
                            type="checkbox"
                            checked={config.pvp.autoReplyHpCheck ?? true}
                            onChange={(e) => updateConfigLocal({ pvp: { autoReplyHpCheck: e.target.checked } })}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">全回復コマンドの自動返信</label>
                          <input
                            type="checkbox"
                            checked={config.pvp.autoReplyFullHeal ?? true}
                            onChange={(e) => updateConfigLocal({ pvp: { autoReplyFullHeal: e.target.checked } })}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">通常回復コマンドの自動返信</label>
                          <input
                            type="checkbox"
                            checked={config.pvp.autoReplyHeal ?? true}
                            onChange={(e) => updateConfigLocal({ pvp: { autoReplyHeal: e.target.checked } })}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">HP0ブロック時の自動返信（「攻撃できません」「回復できません」）</label>
                          <input
                            type="checkbox"
                            checked={config.pvp.autoReplyBlockedByZeroHp ?? true}
                            onChange={(e) => updateConfigLocal({ pvp: { autoReplyBlockedByZeroHp: e.target.checked } })}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">攻撃時自動返信メッセージ（{'{username}'} {'{hp}'} {'{max}'} で置換）</label>
                          <input
                            type="text"
                            className="test-settings-input"
                            value={config.pvp.autoReplyMessageTemplate}
                            onChange={(e) => updateConfigLocal({ pvp: { autoReplyMessageTemplate: e.target.value } })}
                            placeholder="{username} の残りHP: {hp}/{max}"
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">攻撃ブロック時メッセージ</label>
                          <input
                            type="text"
                            className="test-settings-input"
                            value={config.pvp.messageWhenAttackBlockedByZeroHp ?? 'HPが0なので攻撃できません。'}
                            onChange={(e) => updateConfigLocal({ pvp: { messageWhenAttackBlockedByZeroHp: e.target.value } })}
                            placeholder="HPが0なので攻撃できません。"
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">回復ブロック時メッセージ</label>
                          <input
                            type="text"
                            className="test-settings-input"
                            value={config.pvp.messageWhenHealBlockedByZeroHp ?? 'HPが0なので回復できません。'}
                            onChange={(e) => updateConfigLocal({ pvp: { messageWhenHealBlockedByZeroHp: e.target.value } })}
                            placeholder="HPが0なので回復できません。"
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">視聴者HPが0になったときの自動返信メッセージ（{'{username}'} で対象の表示名に置換）</label>
                          <input
                            type="text"
                            className="test-settings-input"
                            value={config.pvp.messageWhenViewerZeroHp ?? '視聴者 {username} のHPが0になりました。'}
                            onChange={(e) => updateConfigLocal({ pvp: { messageWhenViewerZeroHp: e.target.value } })}
                            placeholder="視聴者 {username} のHPが0になりました。"
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
                {testSettingsTab === 'streamer' && (
                  <>
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
                          updateConfigLocal({ retry: { command: e.target.value } })
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
                      <label className="test-settings-label">全回復コマンド（配信者側）</label>
                      <input
                        type="text"
                        className="test-settings-input"
                        value={testInputValues.retryFullHealCommand ?? config.retry.fullHealCommand ?? '!fullheal'}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, retryFullHealCommand: e.target.value }))
                          updateConfigLocal({ retry: { fullHealCommand: e.target.value } })
                        }}
                        onBlur={() => {
                          setTestInputValues((prev) => {
                            const next = { ...prev }
                            delete next.retryFullHealCommand
                            return next
                          })
                        }}
                        placeholder="!fullheal"
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">全員全回復コマンド（配信者・全視聴者を最大HPに）</label>
                      <input
                        type="text"
                        className="test-settings-input"
                        value={testInputValues.fullResetAllCommand ?? config.retry.fullResetAllCommand ?? '!resetall'}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, fullResetAllCommand: e.target.value }))
                          updateConfigLocal({ retry: { fullResetAllCommand: e.target.value } })
                        }}
                        onBlur={() => {
                          setTestInputValues((prev) => {
                            const next = { ...prev }
                            delete next.fullResetAllCommand
                            return next
                          })
                        }}
                        placeholder="!resetall"
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">通常回復コマンド（配信者側）</label>
                      <input
                        type="text"
                        className="test-settings-input"
                        value={testInputValues.streamerHealCommand ?? config.retry.streamerHealCommand ?? '!heal'}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, streamerHealCommand: e.target.value }))
                          updateConfigLocal({ retry: { streamerHealCommand: e.target.value } })
                        }}
                        onBlur={() => {
                          setTestInputValues((prev) => {
                            const next = { ...prev }
                            delete next.streamerHealCommand
                            return next
                          })
                        }}
                        placeholder="!heal"
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">回復量タイプ（配信者）</label>
                      <select
                        className="test-settings-select"
                        value={config.retry.streamerHealType ?? 'fixed'}
                        onChange={(e) => updateConfigLocal({ retry: { streamerHealType: e.target.value as 'fixed' | 'random' } })}
                      >
                        <option value="fixed">固定</option>
                        <option value="random">ランダム</option>
                      </select>
                    </div>
                    {config.retry.streamerHealType === 'fixed' ? (
                      <div className="test-settings-section">
                        <label className="test-settings-label">回復量（配信者）</label>
                        <input
                          type="number"
                          className="test-settings-input"
                          min={1}
                          value={config.retry.streamerHealAmount ?? 20}
                          onChange={(e) => {
                            const num = Number(e.target.value)
                            if (!isNaN(num) && num >= 1) {
                              updateConfigLocal({ retry: { streamerHealAmount: num } })
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="test-settings-section">
                          <label className="test-settings-label">回復量（最小・配信者）</label>
                          <input
                            type="number"
                            className="test-settings-input"
                            min={1}
                            value={config.retry.streamerHealMin ?? 10}
                            onChange={(e) => {
                              const num = Number(e.target.value)
                              if (!isNaN(num) && num >= 1) {
                                updateConfigLocal({ retry: { streamerHealMin: num } })
                              }
                            }}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">回復量（最大・配信者）</label>
                          <input
                            type="number"
                            className="test-settings-input"
                            min={1}
                            value={config.retry.streamerHealMax ?? 30}
                            onChange={(e) => {
                              const num = Number(e.target.value)
                              if (!isNaN(num) && num >= 1) {
                                updateConfigLocal({ retry: { streamerHealMax: num } })
                              }
                            }}
                          />
                        </div>
                        <div className="test-settings-section">
                          <label className="test-settings-label">刻み（50・100など。1のときは最小～最大の連続値）</label>
                          <input
                            type="number"
                            className="test-settings-input"
                            min={1}
                            value={config.retry.streamerHealRandomStep ?? 1}
                            onChange={(e) => {
                              const num = Number(e.target.value)
                              if (!isNaN(num) && num >= 1) {
                                updateConfigLocal({ retry: { streamerHealRandomStep: num } })
                              }
                            }}
                          />
                        </div>
                      </>
                    )}
                    <div className="test-settings-section">
                      <label className="test-settings-label">HP0のときも通常回復を許可（配信者）</label>
                      <input
                        type="checkbox"
                        checked={config.retry.streamerHealWhenZeroEnabled ?? true}
                        onChange={(e) => updateConfigLocal({ retry: { streamerHealWhenZeroEnabled: e.target.checked } })}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">有効</label>
                      <input
                        type="checkbox"
                        checked={config.retry.enabled}
                        onChange={(e) => {
                          updateConfigLocal({ retry: { enabled: e.target.checked } })
                        }}
                      />
                    </div>
                    <div className="test-settings-section">
                      <label className="test-settings-label">蘇生効果音を有効にする</label>
                      <input
                        type="checkbox"
                        checked={config.retry.soundEnabled}
                        onChange={(e) => {
                          updateConfigLocal({ retry: { soundEnabled: e.target.checked } })
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
                          updateConfigLocal({ zeroHpImage: { enabled: e.target.checked } })
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
                            updateConfigLocal({ zeroHpImage: { imageUrl: e.target.value } })
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
                          updateConfigLocal({ zeroHpSound: { enabled: e.target.checked } })
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
                              updateConfigLocal({ zeroHpSound: { soundUrl: e.target.value } })
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
                                updateConfigLocal({ zeroHpSound: { volume: value } })
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
                          updateConfigLocal({ zeroHpEffect: { enabled: e.target.checked } })
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
                              updateConfigLocal({ zeroHpEffect: { videoUrl: e.target.value } })
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
                            value={testInputValues.zeroHpEffectDuration ?? config.zeroHpEffect.duration}
                            onChange={(e) => {
                              setTestInputValues((prev) => ({ ...prev, zeroHpEffectDuration: e.target.value }))
                              const value = Number(e.target.value)
                              if (!isNaN(value) && value >= 1) {
                                updateConfigLocal({ zeroHpEffect: { duration: value } })
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
                          updateConfigLocal({ webmLoop: { enabled: e.target.checked } })
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
                              updateConfigLocal({ webmLoop: { videoUrl: e.target.value } })
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
                              updateConfigLocal({ webmLoop: { loop: e.target.checked } })
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
                                updateConfigLocal({ webmLoop: { x: value } })
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
                                updateConfigLocal({ webmLoop: { y: value } })
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
                                updateConfigLocal({ webmLoop: { width: value } })
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
                                updateConfigLocal({ webmLoop: { height: value } })
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
                                updateConfigLocal({ webmLoop: { opacity: value } })
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
                          updateConfigLocal({ externalWindow: { enabled: e.target.checked } })
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
                                updateConfigLocal({ externalWindow: { x: value } })
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
                                updateConfigLocal({ externalWindow: { y: value } })
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
                                updateConfigLocal({ externalWindow: { width: value } })
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
                                updateConfigLocal({ externalWindow: { height: value } })
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
                                updateConfigLocal({ externalWindow: { opacity: value } })
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
                                updateConfigLocal({ externalWindow: { zIndex: value } })
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
                          updateConfigLocal({ attack: { filterEffectEnabled: e.target.checked } })
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
                                damageEffectFilter: { sepia: value },
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
                                damageEffectFilter: { hueRotate: value },
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
                                damageEffectFilter: { saturate: value },
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
                                damageEffectFilter: { brightness: value },
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
                                damageEffectFilter: { contrast: value },
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
                          updateConfigLocal({ heal: { filterEffectEnabled: e.target.checked } })
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
                                healEffectFilter: { sepia: value },
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
                                healEffectFilter: { hueRotate: value },
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
                                healEffectFilter: { saturate: value },
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
                                healEffectFilter: { brightness: value },
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
                                healEffectFilter: { contrast: value },
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
                          updateConfigLocal({ gaugeColors: { lastGauge: e.target.value } })
                        }}
                        style={{ width: '60px', height: '30px', marginLeft: '0.5rem' }}
                      />
                      <input
                        type="text"
                        className="test-settings-input"
                        value={testInputValues.gaugeColorLast ?? config.gaugeColors.lastGauge}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, gaugeColorLast: e.target.value }))
                          updateConfigLocal({ gaugeColors: { lastGauge: e.target.value } })
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
                          updateConfigLocal({ gaugeColors: { secondGauge: e.target.value } })
                        }}
                        style={{ width: '60px', height: '30px', marginLeft: '0.5rem' }}
                      />
                      <input
                        type="text"
                        className="test-settings-input"
                        value={testInputValues.gaugeColorSecond ?? config.gaugeColors.secondGauge}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, gaugeColorSecond: e.target.value }))
                          updateConfigLocal({ gaugeColors: { secondGauge: e.target.value } })
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
                          updateConfigLocal({ gaugeColors: { patternColor1: e.target.value } })
                        }}
                        style={{ width: '60px', height: '30px', marginLeft: '0.5rem' }}
                      />
                      <input
                        type="text"
                        className="test-settings-input"
                        value={testInputValues.gaugeColorPattern1 ?? config.gaugeColors.patternColor1}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, gaugeColorPattern1: e.target.value }))
                          updateConfigLocal({ gaugeColors: { patternColor1: e.target.value } })
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
                          updateConfigLocal({ gaugeColors: { patternColor2: e.target.value } })
                        }}
                        style={{ width: '60px', height: '30px', marginLeft: '0.5rem' }}
                      />
                      <input
                        type="text"
                        className="test-settings-input"
                        value={testInputValues.gaugeColorPattern2 ?? config.gaugeColors.patternColor2}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, gaugeColorPattern2: e.target.value }))
                          updateConfigLocal({ gaugeColors: { patternColor2: e.target.value } })
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
                          updateConfigLocal({ damageColors: { normal: e.target.value } })
                        }}
                        style={{ width: '60px', height: '30px', marginLeft: '0.5rem' }}
                      />
                      <input
                        type="text"
                        className="test-settings-input"
                        value={testInputValues.damageColorNormal ?? config.damageColors.normal}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, damageColorNormal: e.target.value }))
                          updateConfigLocal({ damageColors: { normal: e.target.value } })
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
                          updateConfigLocal({ damageColors: { critical: e.target.value } })
                        }}
                        style={{ width: '60px', height: '30px', marginLeft: '0.5rem' }}
                      />
                      <input
                        type="text"
                        className="test-settings-input"
                        value={testInputValues.damageColorCritical ?? config.damageColors.critical}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, damageColorCritical: e.target.value }))
                          updateConfigLocal({ damageColors: { critical: e.target.value } })
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
                          updateConfigLocal({ damageColors: { bleed: e.target.value } })
                        }}
                        style={{ width: '60px', height: '30px', marginLeft: '0.5rem' }}
                      />
                      <input
                        type="text"
                        className="test-settings-input"
                        value={testInputValues.damageColorBleed ?? config.damageColors.bleed}
                        onChange={(e) => {
                          setTestInputValues((prev) => ({ ...prev, damageColorBleed: e.target.value }))
                          updateConfigLocal({ damageColors: { bleed: e.target.value } })
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
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".json"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return

                          try {
                            const text = await file.text()
                            const jsonConfig = JSON.parse(text)
                            const validated = validateAndSanitizeConfig(jsonConfig)

                            // 設定を更新（完全な設定を適用）。保存するには「設定を保存」を押す
                            updateConfigLocal(validated as Partial<OverlayConfig>)
                            console.log('✅ 設定ファイルを読み込みました')
                          } catch (error) {
                            console.error('❌ 設定ファイルの読み込みに失敗しました:', error)
                            alert('設定ファイルの読み込みに失敗しました。JSON形式が正しいか確認してください。')
                          } finally {
                            // ファイル入力をリセット（同じファイルを再度選択できるように）
                            if (fileInputRef.current) {
                              fileInputRef.current.value = ''
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="test-button test-reload"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          fileInputRef.current?.click()
                        }}
                        title="ローカルファイルから設定を読み込み"
                        disabled={configLoading}
                      >
                        {configLoading ? '読み込み中...' : '設定を再読み込み'}
                      </button>
                    </div>
                  </>
                )}
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
              <button
                className="test-button test-reset"
                onPointerDown={(e) => {
                  e.preventDefault()
                  const triggerResetAll = () => {
                    if (!config) return
                    resetHP()
                    getViewerUserIds().forEach((id) => setViewerHP(id, viewerMaxHP))
                    if (config.heal.effectEnabled) showHealEffect()
                    if (config.retry.soundEnabled) playRetrySound()
                  }
                  startRepeat(triggerResetAll, 200)
                }}
                onPointerUp={stopRepeat}
                onPointerLeave={stopRepeat}
                onPointerCancel={stopRepeat}
              >
                全員全回復
              </button>
            </div>
            </div>
            </div>
            <div
              className="test-settings-resize-handle test-settings-resize-handle--n"
              title="上端でドラッグしてリサイズ"
              onMouseDown={(e) => {
                e.preventDefault()
                setTestPanelResize({
                  edge: 'n',
                  startX: e.clientX,
                  startY: e.clientY,
                  startW: testPanelSize.width,
                  startH: testPanelSize.height,
                  startRight: testPanelSize.right,
                  startBottom: testPanelSize.bottom,
                })
              }}
            />
            <div
              className="test-settings-resize-handle test-settings-resize-handle--s"
              title="下端でドラッグしてリサイズ"
              onMouseDown={(e) => {
                e.preventDefault()
                setTestPanelResize({
                  edge: 's',
                  startX: e.clientX,
                  startY: e.clientY,
                  startW: testPanelSize.width,
                  startH: testPanelSize.height,
                  startRight: testPanelSize.right,
                  startBottom: testPanelSize.bottom,
                })
              }}
            />
            <div
              className="test-settings-resize-handle test-settings-resize-handle--e"
              title="右端でドラッグしてリサイズ"
              onMouseDown={(e) => {
                e.preventDefault()
                setTestPanelResize({
                  edge: 'e',
                  startX: e.clientX,
                  startY: e.clientY,
                  startW: testPanelSize.width,
                  startH: testPanelSize.height,
                  startRight: testPanelSize.right,
                  startBottom: testPanelSize.bottom,
                })
              }}
            />
            <div
              className="test-settings-resize-handle test-settings-resize-handle--w"
              title="左端でドラッグしてリサイズ"
              onMouseDown={(e) => {
                e.preventDefault()
                setTestPanelResize({
                  edge: 'w',
                  startX: e.clientX,
                  startY: e.clientY,
                  startW: testPanelSize.width,
                  startH: testPanelSize.height,
                  startRight: testPanelSize.right,
                  startBottom: testPanelSize.bottom,
                })
              }}
            />
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

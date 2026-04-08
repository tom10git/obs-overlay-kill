/**
 * OBS Overlay ページ
 * ブラウザウィンドウをキャプチャーして使用するHPゲージ表示ページ
 */

import { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { useHPGauge } from '../hooks/useHPGauge'
import { useSicknessDebuff } from '../hooks/useSicknessDebuff'
import { useViewerHP } from '../hooks/useViewerHP'
import { useChannelPointEvents } from '../hooks/useChannelPointEvents'
import { useEventSubRedemptions } from '../hooks/useEventSubRedemptions'
import { useTestEvents } from '../hooks/useTestEvents'
import { useTwitchChat } from '../hooks/useTwitchChat'
import { useAutoReply } from '../hooks/useAutoReply'
import { useStrengthBuffState } from '../hooks/useStrengthBuffState'
import { HPGauge } from '../components/overlay/HPGauge'
import { DamageNumber } from '../components/overlay/DamageNumber'
import { HealNumber } from '../components/overlay/HealNumber'
import { useSound } from '../hooks/useSound'
import { getAdminUsername } from '../config/admin'
import { useTwitchUser } from '../hooks/useTwitchUser'
import { twitchChat } from '../utils/twitchChat'
import { stripEmotesFromMessage } from '../utils/chatMessage'
import { isCommandMatch } from '../utils/commandMatch'
import {
  fillTemplate,
  formatStrengthBuffDurationHumanJa,
  sanitizeStrengthBuffChatTemplates,
} from '../utils/messageTemplate'
import type { TwitchChatMessage } from '../types/twitch'
import { getDefaultConfig, saveOverlayConfig, validateAndSanitizeConfig } from '../utils/overlayConfig'
import { OverlaySettings, type OverlaySettingsHandle } from '../components/settings/OverlaySettings'
import { twitchApi } from '../utils/twitchApi'
import type { OverlayConfig, AttackConfig, AttackDebuffKind } from '../types/overlay'
import type { ChannelPointEvent } from '../types/overlay'
import { logger } from '../lib/logger'
import { glowTextStyleFromHex } from '../utils/glowTextStyle'
import { pickBleedVariantParams } from '../utils/pickBleedVariantParams'
import { playDotDebuffTickSound } from '../utils/playDotDebuffTickSound'
import { obsGlowSource, obsMoveSource, obsShakeSource } from '../utils/obsWebSocketEffects'
import './OverlayPage.css'

/** テストパネル既定の上端（.test-drawer-toggle: top 16px + 高さ 46px + 下余白 12px） */
const TEST_PANEL_TOP_DEFAULT = 74

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
function getAttackDamage(
  ac: AttackConfig,
  userId?: string,
  strengthBuffStartTimeRef?: React.MutableRefObject<Map<string, number>>,
  strengthBuffDuration?: number,
  strengthBuffAllStartTimeRef?: React.MutableRefObject<number | null>,
  strengthBuffTarget?: 'individual' | 'all'
): number {
  // バフが有効かどうかをチェック（個人用と全員用の両方をチェック）
  let hasBuff = false
  if (strengthBuffDuration) {
    // 全員用バフをチェック
    if (strengthBuffTarget === 'all' && strengthBuffAllStartTimeRef?.current) {
      const elapsed = (Date.now() - strengthBuffAllStartTimeRef.current) / 1000 // 経過時間（秒）
      if (elapsed < strengthBuffDuration) {
        hasBuff = true
      }
    }
    // 個人用バフをチェック（全員用バフが無効な場合のみ）
    if (!hasBuff && userId && strengthBuffStartTimeRef && strengthBuffTarget === 'individual') {
      const startTime = strengthBuffStartTimeRef.current.get(userId)
      if (startTime) {
        const elapsed = (Date.now() - startTime) / 1000 // 経過時間（秒）
        if (elapsed < strengthBuffDuration) {
          hasBuff = true
        }
      }
    }
  }

  if (ac.damageType === 'random' && ac.damageMin != null && ac.damageMax != null && ac.damageRandomStep != null) {
    // ランダムダメージの場合、バフが有効な場合は最小値のみを2倍にする
    const effectiveMin = hasBuff ? ac.damageMin * 2 : ac.damageMin
    return getRandomDamageAmount(effectiveMin, ac.damageMax, ac.damageRandomStep)
  }
  // 固定ダメージの場合、バフが有効な場合はダメージを2倍にする
  return hasBuff ? ac.damage * 2 : ac.damage
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
  const sendAutoReply = useAutoReply(username, user?.id)
  // MISS表示（短時間だけ表示してCSSアニメーションさせる）
  const [missVisible, setMissVisible] = useState(false)
  const missTimerRef = useRef<number | null>(null)

  // クリティカル表示（短時間だけ表示してCSSアニメーションさせる）
  const [criticalVisible, setCriticalVisible] = useState(false)
  const criticalTimerRef = useRef<number | null>(null)

  // #region agent log (critical freeze debug)
  useEffect(() => {
    fetch('http://127.0.0.1:7398/ingest/b7518fcf-b6ac-4bec-8052-ae2fa3ead10d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b3c271' }, body: JSON.stringify({ sessionId: 'b3c271', runId: 'pre-fix', hypothesisId: 'A|B|C|D', location: 'OverlayPage.tsx:criticalVisibleEffect', message: 'criticalVisible changed', data: { criticalVisible }, timestamp: Date.now() }) }).catch(() => { })
  }, [criticalVisible])
  // #endregion agent log (critical freeze debug)

  // 必殺技エフェクト表示
  const [finishingMoveFlashVisible, setFinishingMoveFlashVisible] = useState(false)
  const [finishingMoveShakeActive, setFinishingMoveShakeActive] = useState(false)
  const [finishingMoveFilterActive, setFinishingMoveFilterActive] = useState(false)
  const [finishingMoveTextVisible, setFinishingMoveTextVisible] = useState(false)
  const finishingMoveTimerRef = useRef<number | null>(null)
  const finishingMoveShakeTimerRef = useRef<number | null>(null)
  const finishingMoveFilterTimerRef = useRef<number | null>(null)
  const finishingMoveTextTimerRef = useRef<number | null>(null)
  const playFinishingMoveSoundRef = useRef<() => void>(() => { })

  const obsConsoleDebugEnabled = useMemo(() => {
    try {
      return localStorage.getItem('obs-overlay-debug') === '1'
    } catch {
      return false
    }
  }, [])

  const tryObsEffect = useCallback(async (label: string, fn: () => Promise<void>) => {
    try {
      if (obsConsoleDebugEnabled) {
        console.log(`[OBS WebSocket] start: ${label}`)
      }
      await fn()
      if (obsConsoleDebugEnabled) {
        console.log(`[OBS WebSocket] ok: ${label}`)
      }
    } catch (e) {
      logger.warn('[OBS WebSocket] effect failed', e)
      if (obsConsoleDebugEnabled) {
        console.warn(`[OBS WebSocket] failed: ${label}`, e)
      }
    }
  }, [obsConsoleDebugEnabled])

  // 食いしばり（HP1残り）メッセージ表示
  const [survivalMessageVisible, setSurvivalMessageVisible] = useState(false)
  const [survivalMessageText, setSurvivalMessageText] = useState('')
  const survivalMessageTimerRef = useRef<number | null>(null)

  // 回復エフェクト（キラキラパーティクル）
  const [healParticles, setHealParticles] = useState<Array<{ id: number; angle: number; delay: number; distance: number; createdAt: number; size: number; color: string }>>([])
  const particleIdRef = useRef(0)
  const particleTimersRef = useRef<Map<number, number>>(new Map())

  // 必殺技エフェクト（爆発的な火花・破片パーティクル）
  const [finishingMoveParticles, setFinishingMoveParticles] = useState<Array<{ id: number; angle: number; delay: number; distance: number; createdAt: number; size: number; color: string; type: 'spark' | 'fragment' | 'shockwave' }>>([])
  const finishingMoveParticleIdRef = useRef(0)
  const finishingMoveParticleTimersRef = useRef<Map<number, number>>(new Map())

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
    dotDebuffKind?: AttackDebuffKind
    bleedColor?: string
    angle?: number
    distance?: number
  }>>([])
  const damageIdRef = useRef(0)

  // 回復数値表示管理（HPゲージの外側に表示）
  const [healNumbers, setHealNumbers] = useState<Array<{
    id: number
    amount: number,
  }>>([])
  const healIdRef = useRef(0)

  // テストタブの「展開/折りたたみ」状態（タブ自体は常に表示する）
  // - 開発: 既定で開く
  // - 本番: 既定で閉じる（ただし openSettings/testPanel 指定時は開く）
  const [showTestControls, setShowTestControls] = useState(() => {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search)
      const openSettings = q.get('openSettings')
      const testPanel = q.get('testPanel')
      if (openSettings === '1' || openSettings === 'true') return true
      if (testPanel === '1' || testPanel === 'true') return true
    }
    return import.meta.env.DEV
  })
  /** 埋め込みテストパネル（設定・ボタン）。開発・本番ビルドのどちらでも表示。従来の上書き用: VITE_OVERLAY_EMBEDDED_SETTINGS_IN_PROD */
  const showEmbeddedTestUi =
    import.meta.env.DEV ||
    import.meta.env.PROD ||
    import.meta.env.VITE_OVERLAY_EMBEDDED_SETTINGS_IN_PROD === 'true'
  const [showTestSettings, setShowTestSettings] = useState(() => {
    if (typeof window !== 'undefined') {
      const v = new URLSearchParams(window.location.search).get('openSettings')
      if (v === '1' || v === 'true') return true
      if (v === '0' || v === 'false') return false
    }
    return import.meta.env.VITE_OVERLAY_SETTINGS_DEFAULT_EXPANDED === 'true'
  })
  const [showSaveDialog, setShowSaveDialog] = useState(false) // 保存成功ダイアログの表示/非表示
  const fileInputRef = useRef<HTMLInputElement>(null) // ファイル選択用のinput要素の参照
  const overlaySettingsRef = useRef<OverlaySettingsHandle>(null)

  // テストモード設定ウィンドウのサイズ・位置（top/bottom で縦いっぱい、上下左右の端でリサイズ）
  const [testPanelSize, setTestPanelSize] = useState({
    right: 0,
    top: TEST_PANEL_TOP_DEFAULT,
    bottom: 12,
    width: 420,
  })
  const [testPanelResize, setTestPanelResize] = useState<{
    edge: 'n' | 's' | 'e' | 'w'
    startX: number
    startY: number
    startW: number
    startTop: number
    startRight: number
    startBottom: number
  } | null>(null)

  useEffect(() => {
    if (!testPanelResize) return
    const minW = 300
    const minH = 220
    const minTop = TEST_PANEL_TOP_DEFAULT
    const minBottom = 8
    const onMove = (e: MouseEvent) => {
      const maxW = Math.floor(window.innerWidth * 0.95)
      const vh = window.innerHeight
      const dx = e.clientX - testPanelResize.startX
      const dy = e.clientY - testPanelResize.startY
      setTestPanelSize((prev) => {
        let { width, top, right, bottom } = prev
        switch (testPanelResize.edge) {
          case 'e':
            width = Math.min(maxW, Math.max(minW, testPanelResize.startW + dx))
            break
          case 'w':
            width = Math.min(maxW, Math.max(minW, testPanelResize.startW - dx))
            right = 0
            break
          case 's': {
            let nextBottom = testPanelResize.startBottom - dy
            nextBottom = Math.max(minBottom, Math.min(vh - top - minH, nextBottom))
            bottom = nextBottom
            break
          }
          case 'n': {
            let nextTop = testPanelResize.startTop + dy
            nextTop = Math.max(minTop, Math.min(vh - bottom - minH, nextTop))
            top = nextTop
            break
          }
        }
        return { width, top, bottom, right }
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

  // ダメージエフェクト管理（WebMループ画像用）
  const [damageEffectActive, setDamageEffectActive] = useState(false)
  const [healEffectActive, setHealEffectActive] = useState(false)
  const prevHPRef = useRef<number | null>(null)
  const damageEffectStartTimerRef = useRef<number | null>(null)
  const damageEffectEndTimerRef = useRef<number | null>(null)
  const healEffectStartTimerRef = useRef<number | null>(null)
  const healEffectEndTimerRef = useRef<number | null>(null)
  /** 反転回復を攻撃モーション終了後に実行するためのタイマー */
  const streamerHealOnAttackTimerRef = useRef<number | null>(null)
  // 回避（ミス）時のWebMの左右にずれて戻るエフェクト
  const [dodgeEffectActive, setDodgeEffectActive] = useState(false)
  const dodgeEffectTimerRef = useRef<number | null>(null)
  /** HPゲージ本体の「回避」スライド（左右どちらかにずれて戻る） */
  const [gaugeDodgeActive, setGaugeDodgeActive] = useState(false)
  const [gaugeDodgeDirection, setGaugeDodgeDirection] = useState<'left' | 'right'>('left')
  const gaugeDodgeTimerRef = useRef<number | null>(null)

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

  /** 回避（ミス）時: WebMループを左右に少し動かして元に戻す＋HPゲージも同様にスライド */
  const triggerDodgeEffect = useCallback((durationMs: number = 450) => {
    if (dodgeEffectTimerRef.current) {
      window.clearTimeout(dodgeEffectTimerRef.current)
    }
    setDodgeEffectActive(true)
    dodgeEffectTimerRef.current = window.setTimeout(() => {
      setDodgeEffectActive(false)
      dodgeEffectTimerRef.current = null
    }, durationMs)

    if (gaugeDodgeTimerRef.current) {
      window.clearTimeout(gaugeDodgeTimerRef.current)
    }
    setGaugeDodgeDirection(Math.random() < 0.5 ? 'left' : 'right')
    setGaugeDodgeActive(true)
    gaugeDodgeTimerRef.current = window.setTimeout(() => {
      setGaugeDodgeActive(false)
      gaugeDodgeTimerRef.current = null
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
      // #region agent log (critical freeze debug)
      fetch('http://127.0.0.1:7398/ingest/b7518fcf-b6ac-4bec-8052-ae2fa3ead10d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b3c271' }, body: JSON.stringify({ sessionId: 'b3c271', runId: 'pre-fix', hypothesisId: 'A|B|C', location: 'OverlayPage.tsx:showCritical(entry)', message: 'showCritical called', data: { durationMs, durationMsType: typeof durationMs, computedTimeoutMs: Math.max(200, durationMs), hadExistingTimer: criticalTimerRef.current != null }, timestamp: Date.now() }) }).catch(() => { })
      // #endregion agent log (critical freeze debug)

      setCriticalVisible(false) // 連続発火でもアニメーションをリスタートさせる
      // 次フレームでtrueに戻す
      requestAnimationFrame(() => {
        // #region agent log (critical freeze debug)
        fetch('http://127.0.0.1:7398/ingest/b7518fcf-b6ac-4bec-8052-ae2fa3ead10d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b3c271' }, body: JSON.stringify({ sessionId: 'b3c271', runId: 'pre-fix', hypothesisId: 'B|C', location: 'OverlayPage.tsx:showCritical(raf)', message: 'requestAnimationFrame fired (about to setCriticalVisible true)', data: {}, timestamp: Date.now() }) }).catch(() => { })
        // #endregion agent log (critical freeze debug)
        setCriticalVisible(true)
      })

      if (criticalTimerRef.current) {
        window.clearTimeout(criticalTimerRef.current)
      }
      criticalTimerRef.current = window.setTimeout(() => {
        // #region agent log (critical freeze debug)
        fetch('http://127.0.0.1:7398/ingest/b7518fcf-b6ac-4bec-8052-ae2fa3ead10d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b3c271' }, body: JSON.stringify({ sessionId: 'b3c271', runId: 'pre-fix', hypothesisId: 'A|B|D', location: 'OverlayPage.tsx:showCritical(timeout)', message: 'critical timeout fired (about to hide)', data: {}, timestamp: Date.now() }) }).catch(() => { })
        // #endregion agent log (critical freeze debug)
        setCriticalVisible(false)
        criticalTimerRef.current = null
      }, Math.max(200, durationMs))
    },
    []
  )

  // 必殺技エフェクト（派手な演出）
  const showFinishingMoveEffect = useCallback(() => {
    playFinishingMoveSoundRef.current()
    // 0. 「必殺技！」テキスト表示
    setFinishingMoveTextVisible(false)
    requestAnimationFrame(() => setFinishingMoveTextVisible(true))

    if (finishingMoveTextTimerRef.current) {
      window.clearTimeout(finishingMoveTextTimerRef.current)
    }
    finishingMoveTextTimerRef.current = window.setTimeout(() => {
      setFinishingMoveTextVisible(false)
      finishingMoveTextTimerRef.current = null
    }, 2000) // 2秒間表示

    // 1. 画面フラッシュ（白→赤の閃光）
    setFinishingMoveFlashVisible(false)
    requestAnimationFrame(() => setFinishingMoveFlashVisible(true))

    if (finishingMoveTimerRef.current) {
      window.clearTimeout(finishingMoveTimerRef.current)
    }
    finishingMoveTimerRef.current = window.setTimeout(() => {
      setFinishingMoveFlashVisible(false)
      finishingMoveTimerRef.current = null
    }, 800) // 0.8秒間フラッシュ

    // 2. 強力な画面シェイク（複数回）
    setFinishingMoveShakeActive(false)
    requestAnimationFrame(() => setFinishingMoveShakeActive(true))

    if (finishingMoveShakeTimerRef.current) {
      window.clearTimeout(finishingMoveShakeTimerRef.current)
    }
    finishingMoveShakeTimerRef.current = window.setTimeout(() => {
      setFinishingMoveShakeActive(false)
      finishingMoveShakeTimerRef.current = null
    }, 1200) // 1.2秒間シェイク

    // 3. 画面全体の色変化（赤みがかったフィルター）
    setFinishingMoveFilterActive(false)
    requestAnimationFrame(() => setFinishingMoveFilterActive(true))

    if (finishingMoveFilterTimerRef.current) {
      window.clearTimeout(finishingMoveFilterTimerRef.current)
    }
    finishingMoveFilterTimerRef.current = window.setTimeout(() => {
      setFinishingMoveFilterActive(false)
      finishingMoveFilterTimerRef.current = null
    }, 1000) // 1秒間フィルター

    // 4. 必殺技専用パーティクルエフェクト（爆発的な火花・破片・衝撃波）
    const sparkCount = 80 + Math.floor(Math.random() * 40) // 80-120個の火花
    const fragmentCount = 30 + Math.floor(Math.random() * 20) // 30-50個の破片
    const shockwaveCount = 3 // 3つの衝撃波
    const newParticles: Array<{ id: number; angle: number; delay: number; distance: number; createdAt: number; size: number; color: string; type: 'spark' | 'fragment' | 'shockwave' }> = []
    const now = Date.now()

    // 赤・オレンジ・黄色のパレット（派手な色）
    const finishingMoveColors = [
      '#ff0000', // 赤
      '#ff3300', // 明るい赤
      '#ff6600', // オレンジ
      '#ff9900', // 明るいオレンジ
      '#ffcc00', // 黄色
      '#ffff00', // 明るい黄色
      '#ff3333', // ピンクがかった赤
      '#ff6666', // 明るいピンク
      '#ffaa00', // ゴールド
      '#ffdd00', // 明るいゴールド
      '#ff4400', // 深いオレンジ
      '#ff7700', // オレンジ
    ]

    // 火花パーティクル（細長い線状、高速で飛び散る）
    for (let i = 0; i < sparkCount; i++) {
      finishingMoveParticleIdRef.current += 1
      const particleId = finishingMoveParticleIdRef.current
      const angle = Math.random() * 360 // 全方向ランダム
      const distance = 200 + Math.random() * 300 // 200-500px（高速で飛び散る）
      const size = 3 + Math.random() * 8 // 3-11px（細長い）
      const color = finishingMoveColors[Math.floor(Math.random() * finishingMoveColors.length)]

      newParticles.push({
        id: particleId,
        angle: angle,
        delay: Math.random() * 100, // 0-100msの遅延（即座に発動）
        distance: distance,
        createdAt: now,
        size: size,
        color: color,
        type: 'spark',
      })

      // 各パーティクルに個別のタイマーを設定（1.5秒後に削除）
      const timerId = window.setTimeout(() => {
        setFinishingMoveParticles((prev) => prev.filter((p) => p.id !== particleId))
        finishingMoveParticleTimersRef.current.delete(particleId)
      }, 1500)

      finishingMoveParticleTimersRef.current.set(particleId, timerId)
    }

    // 破片パーティクル（不規則な形状、回転しながら飛び散る）
    for (let i = 0; i < fragmentCount; i++) {
      finishingMoveParticleIdRef.current += 1
      const particleId = finishingMoveParticleIdRef.current
      const angle = Math.random() * 360
      const distance = 100 + Math.random() * 200 // 100-300px（中距離）
      const size = 8 + Math.random() * 15 // 8-23px（不規則な大きさ）
      const color = finishingMoveColors[Math.floor(Math.random() * finishingMoveColors.length)]

      newParticles.push({
        id: particleId,
        angle: angle,
        delay: Math.random() * 150, // 0-150msの遅延
        distance: distance,
        createdAt: now,
        size: size,
        color: color,
        type: 'fragment',
      })

      const timerId = window.setTimeout(() => {
        setFinishingMoveParticles((prev) => prev.filter((p) => p.id !== particleId))
        finishingMoveParticleTimersRef.current.delete(particleId)
      }, 2000)

      finishingMoveParticleTimersRef.current.set(particleId, timerId)
    }

    // 衝撃波パーティクル（大きな円形の波、段階的に拡大）
    for (let i = 0; i < shockwaveCount; i++) {
      finishingMoveParticleIdRef.current += 1
      const particleId = finishingMoveParticleIdRef.current
      const angle = 0 // 角度は関係ない（円形なので）
      const distance = 0 // 距離も関係ない（中心から拡大）
      const size = 50 + i * 30 // 50, 80, 110px（段階的に大きい）
      const color = finishingMoveColors[Math.floor(Math.random() * finishingMoveColors.length)]

      newParticles.push({
        id: particleId,
        angle: angle,
        delay: i * 100, // 100msずつずらして発動
        distance: distance,
        createdAt: now,
        size: size,
        color: color,
        type: 'shockwave',
      })

      const timerId = window.setTimeout(() => {
        setFinishingMoveParticles((prev) => prev.filter((p) => p.id !== particleId))
        finishingMoveParticleTimersRef.current.delete(particleId)
      }, 1200)

      finishingMoveParticleTimersRef.current.set(particleId, timerId)
    }

    // 既存のパーティクルに新しいパーティクルを追加
    setFinishingMoveParticles((prev) => [...prev, ...newParticles])
  }, [])

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
      if (gaugeDodgeTimerRef.current) window.clearTimeout(gaugeDodgeTimerRef.current)
      if (finishingMoveTimerRef.current) window.clearTimeout(finishingMoveTimerRef.current)
      if (finishingMoveShakeTimerRef.current) window.clearTimeout(finishingMoveShakeTimerRef.current)
      if (finishingMoveFilterTimerRef.current) window.clearTimeout(finishingMoveFilterTimerRef.current)
      if (finishingMoveTextTimerRef.current) window.clearTimeout(finishingMoveTextTimerRef.current)
      // すべてのパーティクルタイマーをクリア
      particleTimersRef.current.forEach((timerId) => {
        window.clearTimeout(timerId)
      })
      particleTimersRef.current.clear()
      // 必殺技パーティクルタイマーもクリア
      finishingMoveParticleTimersRef.current.forEach((timerId) => {
        window.clearTimeout(timerId)
      })
      finishingMoveParticleTimersRef.current.clear()
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
    hpCurrentSyncRef,
    reduceHP,
    increaseHP,
    resetHP,
    updateConfigLocal,
    replaceConfig,
  } = useHPGauge({
    broadcasterId: user?.id || '',
    channel: username,
    onSurvivalHp1: (message) => showSurvivalMessage(message),
    onStreamerZeroHp: (message) => {
      const raw = message?.trim()
      if (!raw || !config?.retry.streamerAutoReplyEnabled) return
      const attackerName = lastStreamerAttackerRef.current?.userName ?? ''
      const msg = raw.replace(/\{attacker\}/g, attackerName).trim()
      if (!msg) return
      sendAutoReply(msg, '[PvP] 配信者HP0自動返信の送信失敗')
    },
  })

  const {
    dialogueVisible: sicknessDialogueVisible,
    registerHealStreak,
    notifyStreamerDamageDuringSickness,
    cancelSickness,
  } = useSicknessDebuff({
    updateConfigLocal,
    streamerHpSyncRef: hpCurrentSyncRef,
    currentHP,
  })

  const reduceHPTracked = useCallback(
    (amount: number) => {
      if (amount > 0) notifyStreamerDamageDuringSickness(amount)
      reduceHP(amount)
    },
    [reduceHP, notifyStreamerDamageDuringSickness]
  )

  const resetStreamerHp = useCallback(() => {
    cancelSickness()
    resetHP()
  }, [cancelSickness, resetHP])

  const sendPvpBlockedMessage = useCallback((type: 'attack' | 'heal', errorLabel: string) => {
    if (!config?.pvp?.autoReplyBlockedByZeroHp) return
    const msg = type === 'heal'
      ? (config.pvp.messageWhenHealBlockedByZeroHp ?? 'HPが0なので回復できません。')
      : (config.pvp.messageWhenAttackBlockedByZeroHp ?? 'HPが0なので攻撃できません。')
    sendAutoReply(msg, errorLabel)
  }, [config?.pvp?.autoReplyBlockedByZeroHp, config?.pvp?.messageWhenAttackBlockedByZeroHp, config?.pvp?.messageWhenHealBlockedByZeroHp, sendAutoReply])
  const applyTestPreset = useCallback((preset: 'safe' | 'allOn') => {
    if (preset === 'safe') {
      updateConfigLocal({
        pvp: {
          enabled: true,
          attackMode: 'streamer_only',
          viewerFinishingMoveEnabled: false,
          autoReplyAttackCounter: true,
          autoReplyWhenViewerZeroHp: true,
          autoReplyHpCheck: true,
          autoReplyFullHeal: true,
          autoReplyHeal: true,
          autoReplyBlockedByZeroHp: true,
          autoReplyStrengthBuff: true,
          autoReplyStrengthBuffCheck: true,
          autoReplyViewerFinishingMove: false,
          strengthBuffSoundEnabled: false,
        },
        heal: { autoReplyEnabled: true },
        retry: {
          enabled: true,
          streamerAutoReplyEnabled: true,
          soundEnabled: false,
        },
        // 配信向け（安全）: OBS WebSocket 演出はOFFのまま
        obsWebSocket: {
          enabled: false,
          effects: {
            damageShakeEnabled: false,
            healGlowEnabled: false,
            dodgeMoveEnabled: false,
            finishingMoveEnabled: false,
          },
        },
      })
      return
    }

    updateConfigLocal({
      pvp: {
        enabled: true,
        attackMode: 'both',
        viewerFinishingMoveEnabled: true,
        autoReplyAttackCounter: true,
        autoReplyWhenViewerZeroHp: true,
        autoReplyHpCheck: true,
        autoReplyFullHeal: true,
        autoReplyHeal: true,
        autoReplyBlockedByZeroHp: true,
        autoReplyStrengthBuff: true,
        autoReplyStrengthBuffCheck: true,
        autoReplyViewerFinishingMove: true,
        strengthBuffSoundEnabled: true,
      },
      heal: { autoReplyEnabled: true, soundEnabled: true },
      retry: {
        enabled: true,
        streamerAutoReplyEnabled: true,
        soundEnabled: true,
      },
      zeroHpSound: { enabled: true },
      zeroHpEffect: { enabled: true },
      // 検証向け（全部ON）: OBS WebSocket 演出もON（接続先/シーン/ソース名は既存設定を使用）
      obsWebSocket: {
        enabled: true,
        effects: {
          damageShakeEnabled: true,
          healGlowEnabled: true,
          dodgeMoveEnabled: true,
          finishingMoveEnabled: true,
        },
      },
    })
  }, [updateConfigLocal])

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
  /** userId → ストレングスバフの開始時刻（ミリ秒） */
  const strengthBuffStartTimeRef = useRef<Map<string, number>>(new Map())
  /** 全員用ストレングスバフの開始時刻（ミリ秒） */
  const strengthBuffAllStartTimeRef = useRef<number | null>(null)
  /** バフ表示用の状態（リアルタイム更新のため） */
  const {
    buffedUserIds: buffedUserIdsState,
    isAllBuffed: isAllBuffedState,
    allBuffRemainingSeconds: allBuffRemainingSecondsState,
    buffRemainingSecondsMap: buffRemainingSecondsMapState,
  } = useStrengthBuffState({
    enabled: !!config?.pvp?.enabled,
    durationSeconds: config?.pvp?.strengthBuffDuration ?? 300,
    target: config?.pvp?.strengthBuffTarget ?? 'individual',
    strengthBuffStartTimeRef,
    strengthBuffAllStartTimeRef,
  })

  // reduceHPを常に最新の状態で参照できるようにする（体調不良デバフのダメージ通知を含む）
  useEffect(() => {
    reduceHPRef.current = reduceHPTracked
    logger.debug('[reduceHPRef更新] reduceHP関数を更新しました', reduceHPTracked)
  }, [reduceHPTracked])

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
  const dotPoisonSoundUrl = useMemo(
    () => (config?.attack.dotPoisonSoundUrl?.trim() || ''),
    [config?.attack.dotPoisonSoundUrl]
  )
  const dotBurnSoundUrl = useMemo(
    () => (config?.attack.dotBurnSoundUrl?.trim() || ''),
    [config?.attack.dotBurnSoundUrl]
  )
  const dotPoisonAttackSoundUrl = useMemo(
    () => (config?.attack.dotPoisonAttackSoundUrl?.trim() || ''),
    [config?.attack.dotPoisonAttackSoundUrl]
  )
  const dotBurnAttackSoundUrl = useMemo(
    () => (config?.attack.dotBurnAttackSoundUrl?.trim() || ''),
    [config?.attack.dotBurnAttackSoundUrl]
  )
  const healSoundUrl = useMemo(
    () => (config?.heal.soundUrl?.trim() || ''),
    [config?.heal.soundUrl]
  )
  const retrySoundUrl = useMemo(
    () => (config?.retry.soundUrl?.trim() || ''),
    [config?.retry.soundUrl]
  )
  const strengthBuffSoundUrl = useMemo(
    () => (config?.pvp?.strengthBuffSoundUrl?.trim() || ''),
    [config?.pvp?.strengthBuffSoundUrl]
  )
  const finishingMoveSoundUrl = useMemo(
    () => (config?.pvp?.finishingMoveSoundUrl?.trim() || ''),
    [config?.pvp?.finishingMoveSoundUrl]
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

  const { play: playDotPoisonSound } = useSound({
    src: dotPoisonSoundUrl,
    enabled: config?.attack.dotPoisonSoundEnabled && !!dotPoisonSoundUrl,
    volume: config?.attack.dotPoisonSoundVolume || 0.7,
  })

  const { play: playDotBurnSound } = useSound({
    src: dotBurnSoundUrl,
    enabled: config?.attack.dotBurnSoundEnabled && !!dotBurnSoundUrl,
    volume: config?.attack.dotBurnSoundVolume || 0.7,
  })

  const { play: playDotPoisonAttackSound } = useSound({
    src: dotPoisonAttackSoundUrl,
    enabled: config?.attack.dotPoisonAttackSoundEnabled && !!dotPoisonAttackSoundUrl,
    volume: config?.attack.dotPoisonAttackSoundVolume || 0.7,
  })

  const { play: playDotBurnAttackSound } = useSound({
    src: dotBurnAttackSoundUrl,
    enabled: config?.attack.dotBurnAttackSoundEnabled && !!dotBurnAttackSoundUrl,
    volume: config?.attack.dotBurnAttackSoundVolume || 0.7,
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

  const { play: playStrengthBuffSound } = useSound({
    src: strengthBuffSoundUrl,
    enabled: config?.pvp?.strengthBuffSoundEnabled && !!strengthBuffSoundUrl,
    volume: config?.pvp?.strengthBuffSoundVolume || 0.7,
  })
  const { play: playFinishingMoveSound } = useSound({
    src: finishingMoveSoundUrl,
    enabled: config?.pvp?.finishingMoveSoundEnabled && !!finishingMoveSoundUrl,
    volume: config?.pvp?.finishingMoveSoundVolume || 0.7,
  })
  useEffect(() => {
    playFinishingMoveSoundRef.current = playFinishingMoveSound
  }, [playFinishingMoveSound])

  // HPが0になったときにすべての出血ダメージタイマーを停止
  useEffect(() => {
    if (currentHP <= 0) {
      logger.debug('[出血ダメージ停止] HPが0になったため、すべての出血ダメージタイマーを停止します')
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

      // HPが0以下の場合は攻撃をブロック（HPが上昇するバグを防ぐ）
      if (currentHP <= 0) {
        return
      }

      // PvP時: 攻撃者を記録（カウンター攻撃の対象にする）
      if (config.pvp?.enabled && event.userId) {
        lastAttackerRef.current = {
          userId: event.userId,
          userName: event.userName ?? event.userId,
        }
      }

      // 条件チェック（リワードIDが一致するか、カスタムテキスト/コマンドで判定された場合）
      const isRewardIdMatch = event.rewardId === config.attack.rewardId && config.attack.rewardId.length > 0
      const isCustomTextMatch = event.rewardId === 'custom-text' && !!config.attack.customText && config.attack.customText.length > 0
      const isViewerAttackCommandMatch = event.rewardId === 'viewer-attack-command'

      if (isRewardIdMatch || isCustomTextMatch || isViewerAttackCommandMatch) {
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
          // 視聴者が攻撃する場合、バフを考慮する
          const attackerUserId = event.userId && user?.id && event.userId !== user.id ? event.userId : undefined
          let baseDamage = getAttackDamage(
            config.attack,
            attackerUserId,
            strengthBuffStartTimeRef,
            config.pvp?.strengthBuffDuration,
            strengthBuffAllStartTimeRef,
            config.pvp?.strengthBuffTarget
          )

          // 必殺技判定（視聴者側の攻撃のみ、確率は0-100%で小数点第2位まで設定可能）
          let isFinishingMove = false
          if (attackerUserId && config.pvp?.viewerFinishingMoveEnabled) {
            const probability = config.pvp.viewerFinishingMoveProbability ?? 0.01
            const finishingMoveRoll = Math.random() * 10000 // 0-10000の範囲
            const threshold = probability * 100 // 0.01% → 1, 1% → 100, 100% → 10000
            if (finishingMoveRoll < threshold) {
              isFinishingMove = true
              // 必殺技ダメージ: 現在のHPの1/2（最低1）
              const finishingDamage = Math.max(1, Math.floor(currentHP / 2))
              baseDamage = finishingDamage
              // 必殺技エフェクトを発動
              showFinishingMoveEffect()
              // 必殺技発動時のメッセージ
              if (config.pvp.autoReplyViewerFinishingMove && config.pvp.messageWhenViewerFinishingMove?.trim()) {
                const attackerName = event.userName ?? event.userId ?? '視聴者'
                const msg = fillTemplate(config.pvp.messageWhenViewerFinishingMove, {
                  username: attackerName,
                  damage: finishingDamage,
                })
                sendAutoReply(msg, '[PvP] 必殺技メッセージ送信失敗')
              }
            }
          }

          let finalDamage = baseDamage
          let isCritical = false
          // 必殺技時はクリティカル判定を行わず、固定で「現在HPの1/2ダメージ」
          if (config.attack.criticalEnabled && !isFinishingMove) {
            const criticalRoll = Math.random() * 100
            if (criticalRoll < config.attack.criticalProbability) {
              finalDamage = Math.floor(baseDamage * config.attack.criticalMultiplier)
              isCritical = true
            }
          }
          // ダメージ適用後のHPを計算（反転回復を判定するため）
          const hpAfterDamage = Math.max(0, currentHP - finalDamage)
          reduceHPTracked(finalDamage)
          // OBS WebSocket: ダメージ演出（ソースレイヤー操作）
          if (config.obsWebSocket.enabled && config.obsWebSocket.sourceName.trim()) {
            const eff = config.obsWebSocket.effects
            if (isFinishingMove && eff.finishingMoveEnabled) {
              void tryObsEffect('finishingMove: shake', () =>
                obsShakeSource(config.obsWebSocket, eff.finishingMoveShakeStrengthPx, eff.finishingMoveShakeDurationMs)
              )
              void tryObsEffect('finishingMove: glow', () =>
                obsGlowSource(config.obsWebSocket, eff.finishingMoveGlowScale, eff.finishingMoveGlowDurationMs)
              )
            } else if (eff.damageShakeEnabled) {
              void tryObsEffect('damage: shake', () =>
                obsShakeSource(config.obsWebSocket, eff.damageShakeStrengthPx, eff.damageShakeDurationMs)
              )
            }
          }
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

          // 出血ダメージ判定（別枠として計算）
          // 必殺技時は確定で出血デバフを付与する（bleedEnabled=false でも発動）
          if (config.attack.bleedEnabled || isFinishingMove) {
            logger.debug(`[出血ダメージ判定] bleedEnabled: true, bleedProbability: ${config.attack.bleedProbability}`)
            const bleedRoll = Math.random() * 100
            logger.debug(`[出血ダメージ判定] ダイスロール: ${bleedRoll.toFixed(2)}`)
            const bleedSuccess = isFinishingMove || bleedRoll < config.attack.bleedProbability
            if (bleedSuccess) {
              // 出血ダメージを開始（バリエーションがあればウェイト抽選）
              bleedIdRef.current += 1
              const bleedId = bleedIdRef.current
              const bleedParams = pickBleedVariantParams(config.attack)
              const bleedDamage = bleedParams.damage
              const bleedInterval = bleedParams.intervalSec * 1000
              const bleedDuration = bleedParams.durationSec * 1000
              const bleedTickColor = bleedParams.damageColor
              const dotDebuffKind = bleedParams.debuffKind

              // DOTが付与された攻撃では、攻撃SEを種別で置き換える（設定があれば）
              if (!isFinishingMove) {
                if (dotDebuffKind === 'poison') {
                  const played = config.attack.dotPoisonAttackSoundEnabled && !!config.attack.dotPoisonAttackSoundUrl?.trim()
                  if (played) playDotPoisonAttackSound()
                  else if (config.attack.soundEnabled) playAttackSound()
                } else if (dotDebuffKind === 'burn') {
                  const played = config.attack.dotBurnAttackSoundEnabled && !!config.attack.dotBurnAttackSoundUrl?.trim()
                  if (played) playDotBurnAttackSound()
                  else if (config.attack.soundEnabled) playAttackSound()
                } else {
                  if (config.attack.soundEnabled) playAttackSound()
                }
              }

              logger.debug(`[出血ダメージ開始] ID: ${bleedId}, ダメージ: ${bleedDamage}, 間隔: ${bleedInterval}ms, 持続時間: ${bleedDuration}ms`)
              logger.debug(`[出血ダメージ開始] reduceHPRef.current:`, reduceHPRef.current)
              logger.debug(`[出血ダメージ開始] reduceHP:`, reduceHP)

              // 一定間隔でダメージを与えるタイマー
              // reduceHPはuseCallbackで[]依存配列なので、関数自体は変わらない
              // また、setConfig((prev) => ...)を使っているので、常に最新の状態を参照できる
              const intervalTimer = window.setInterval(() => {
                logger.debug(`[出血ダメージ適用] ID: ${bleedId}, ダメージ: ${bleedDamage}`)
                logger.debug(`[出血ダメージ適用] reduceHPRef.current:`, reduceHPRef.current)
                const currentReduceHP = reduceHPRef.current
                if (currentReduceHP && typeof currentReduceHP === 'function') {
                  logger.debug(`[出血ダメージ適用] reduceHPRef.currentを呼び出します`)
                  currentReduceHP(bleedDamage)
                  playDotDebuffTickSound(config.attack, dotDebuffKind, {
                    playBleed: playBleedSound,
                    playPoison: playDotPoisonSound,
                    playBurn: playDotBurnSound,
                  })
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
                    dotDebuffKind,
                    bleedColor: bleedTickColor,
                    angle: bleedAngle,
                    distance: bleedDistance,
                  }])
                  setTimeout(() => {
                    setDamageNumbers((prev) => prev.filter((d) => d.id !== bleedDamageId))
                  }, 1200)
                } else {
                  logger.error('[出血ダメージエラー] reduceHPRef.currentが関数ではありません', currentReduceHP)
                  // フォールバック: reduceHPを直接使用
                  if (reduceHPTracked && typeof reduceHPTracked === 'function') {
                    logger.debug('[出血ダメージ] フォールバック: reduceHPTrackedを直接使用')
                    reduceHPTracked(bleedDamage)
                    playDotDebuffTickSound(config.attack, dotDebuffKind, {
                      playBleed: playBleedSound,
                      playPoison: playDotPoisonSound,
                      playBurn: playDotBurnSound,
                    })
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
                      dotDebuffKind,
                      bleedColor: bleedTickColor,
                      angle: bleedAngle2,
                      distance: bleedDistance2,
                    }])
                    setTimeout(() => {
                      setDamageNumbers((prev) => prev.filter((d) => d.id !== bleedDamageId2))
                    }, 1200)
                  } else {
                    logger.error('[出血ダメージエラー] reduceHPも関数ではありません', reduceHP)
                  }
                }
              }, bleedInterval)

              // 持続時間が終了したらタイマーをクリア
              const durationTimer = window.setTimeout(() => {
                logger.debug(`[出血ダメージ終了] ID: ${bleedId}`)
                window.clearInterval(intervalTimer)
                bleedTimersRef.current.delete(bleedId)
              }, bleedDuration)

              bleedTimersRef.current.set(bleedId, { intervalTimer, durationTimer })
              logger.debug(`[出血ダメージ開始] タイマーを設定しました。intervalTimer: ${intervalTimer}, durationTimer: ${durationTimer}`)
            }
            // 出血判定はしたが失敗（DOTなし）→ 通常の攻撃SE
            if (!bleedSuccess && config.attack.soundEnabled && !isFinishingMove) {
              playAttackSound()
            }
          } else {
            logger.debug(`[出血ダメージ判定] bleedEnabled: false`)
            // DOTなし攻撃は通常の攻撃SE
            if (config.attack.soundEnabled && !isFinishingMove) {
              playAttackSound()
            }
          }
          // 反転回復: この攻撃のモーション後（durationMs後）に回復（1回の攻撃フローで「減る→回復」を完結）
          // HPが0になった場合は反転回復を実行しない
          if (reverseHealAmount > 0 && hpAfterDamage > 0) {
            const durationMs = config.animation?.duration ?? 500
            streamerHealOnAttackTimerRef.current = window.setTimeout(() => {
              streamerHealOnAttackTimerRef.current = null
              // タイマー実行時にもHPが0以上かチェック（念のため）
              if (currentHP > 0) {
                setDamageEffectActive(false)
                increaseHP(reverseHealAmount)

                // 回復数値を表示（反転回復ぶん）
                healIdRef.current += 1
                const healId = healIdRef.current
                setHealNumbers((prev) => [...prev, { id: healId, amount: reverseHealAmount }])
                setTimeout(() => {
                  setHealNumbers((prev) => prev.filter((h) => h.id !== healId))
                }, 1500)

                if (config.heal?.effectEnabled) showHealEffect()
                if (config.heal?.soundEnabled) playHealSound()
              }
            }, durationMs)
          }
        } else {
          // MISSアニメーション表示
          showMiss(config.animation.duration)
          // 回避時: 外部ウィンドウ・WebMを左右に少し動かして戻す
          triggerDodgeEffect(600)
          // OBS WebSocket: 回避（ミス）演出（ソースレイヤー操作）
          if (config.obsWebSocket.enabled && config.obsWebSocket.sourceName.trim() && config.obsWebSocket.effects.dodgeMoveEnabled) {
            const eff = config.obsWebSocket.effects
            void tryObsEffect('dodge: move', () =>
              obsMoveSource(config.obsWebSocket, eff.dodgeMoveDistancePx, eff.dodgeMoveDurationMs)
            )
          }
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
          const result = applyViewerDamage(
            targetUserId,
            // カウンター攻撃（配信者→視聴者）には視聴者バフを乗せない
            getAttackDamage(sa),
            sa
          )
          const hp = result.newHP
          const max = viewerMaxHP
          const tpl = config.pvp.autoReplyMessageTemplate || '{username} の残りHP: {hp}/{max}'
          const reply = fillTemplate(tpl, { username: targetUserName, hp, max })
          if (config.pvp.autoReplyAttackCounter) {
            sendAutoReply(reply, '[PvP] 攻撃時自動返信の送信失敗')
          }
          if (result.newHP === 0 && config.pvp.messageWhenViewerZeroHp?.trim() && config.pvp.autoReplyWhenViewerZeroHp) {
            const zeroMsg = fillTemplate(config.pvp.messageWhenViewerZeroHp, { username: targetUserName }).trim()
            if (zeroMsg) {
              sendAutoReply(zeroMsg, '[PvP] 視聴者HP0自動返信の送信失敗')
            }
          }
        }
      }
    },
    [config, reduceHPTracked, increaseHP, showHealEffect, showMiss, showFinishingMoveEffect, triggerDodgeEffect, playMissSound, playHealSound, playAttackSound, playBleedSound, playDotPoisonSound, playDotBurnSound, sendAutoReply, tryObsEffect, user?.id, applyViewerDamage, ensureViewerHP, getViewerUserIds, getViewerHPCurrent, viewerMaxHP]
  )

  // 回復イベントハンドラ（チャンネルポイント・カスタムテキスト用。event に userId/userName があれば {username} に使用）
  const handleHealEvent = useCallback(
    (event: { rewardId: string; userId?: string; userName?: string }) => {
      if (!config) return

      // HPが0の場合は回復をブロック
      if (currentHP <= 0) {
        return
      }

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

        registerHealStreak(currentHP, maxHP)
        const newHP = Math.min(maxHP, currentHP + healAmount)
        increaseHP(healAmount)
        // 回復数値を表示
        healIdRef.current += 1
        const healId = healIdRef.current
        setHealNumbers((prev: Array<{ id: number; amount: number }>) => [...prev, { id: healId, amount: healAmount }])
        // 1.5秒後に削除（アニメーション終了後）
        setTimeout(() => {
          setHealNumbers((prev: Array<{ id: number; amount: number }>) => prev.filter((h) => h.id !== healId))
        }, 1500)

        // 回復エフェクトを表示（設定で有効な場合のみ）
        if (config.heal.effectEnabled) {
          showHealEffect()
        }
        // OBS WebSocket: 回復演出（ソースレイヤー操作）
        if (config.obsWebSocket.enabled && config.obsWebSocket.sourceName.trim() && config.obsWebSocket.effects.healGlowEnabled) {
          const eff = config.obsWebSocket.effects
          void tryObsEffect('heal: glow', () =>
            obsGlowSource(config.obsWebSocket, eff.healGlowScale, eff.healGlowDurationMs)
          )
        }
        // 回復効果音を再生
        if (config.heal.soundEnabled) {
          playHealSound()
        }
        // 回復時自動返信（攻撃コマンドと同様）。{username} は引き換え者が配信者なら「配信者」、それ以外は userName
        if (config.heal.autoReplyEnabled && config.heal.autoReplyMessageTemplate?.trim()) {
          const tpl = config.heal.autoReplyMessageTemplate.trim()
          const nameForUsername = event.userId && user?.id && event.userId === user.id ? '配信者' : (event.userName ?? event.userId ?? '視聴者')
          const reply = fillTemplate(tpl, { username: nameForUsername, hp: newHP, max: maxHP })
          sendAutoReply(reply, '[回復] 自動返信の送信失敗')
        }
      }
    },
    [config, currentHP, maxHP, increaseHP, registerHealStreak, showHealEffect, playHealSound, sendAutoReply, tryObsEffect, user?.id]
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
          sendPvpBlockedMessage(isHeal ? 'heal' : 'attack', '[PvP] HP0ブロックメッセージ送信失敗')
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
          sendPvpBlockedMessage('attack', '[PvP] HP0ブロックメッセージ送信失敗')
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
          sendPvpBlockedMessage('heal', '[PvP] HP0ブロックメッセージ送信失敗')
          return
        }
      }
      handleHealEvent(event)
    },
  })

  // エラー表示
  useEffect(() => {
    if (eventSubError) {
      logger.error(
        '❌ EventSub接続エラー\n' +
        'EventSub WebSocketへの接続に失敗しました。\n' +
        'ポーリング方式にフォールバックしますが、イベント検出に遅延が発生する可能性があります。\n' +
        'エラー詳細:', eventSubError
      )
    }
    if (attackError) {
      logger.error(
        '❌ 攻撃イベント取得エラー（ポーリング方式）\n' +
        'チャンネルポイントの攻撃イベントを取得できませんでした。\n' +
        'エラー詳細:', attackError
      )
    }
    if (healError) {
      logger.error(
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
    logger.info('[Test] attack trigger', {
      obsEnabled: config.obsWebSocket.enabled,
      sourceName: config.obsWebSocket.sourceName,
      effects: config.obsWebSocket.effects,
    })
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
      // 必殺技判定（確率は0-100%で小数点第2位まで設定可能）
      let isFinishingMove = false
      let baseDamage = 0
      if (config.pvp?.viewerFinishingMoveEnabled) {
        const probability = config.pvp.viewerFinishingMoveProbability ?? 0.01
        const finishingMoveRoll = Math.random() * 10000 // 0-10000の範囲
        const threshold = probability * 100 // 0.01% → 1, 1% → 100, 100% → 10000
        if (finishingMoveRoll < threshold) {
          isFinishingMove = true
          // 必殺技ダメージ: 現在のHPの1/2（最低1）
          baseDamage = Math.max(1, Math.floor(currentHP / 2))
          // 必殺技エフェクトを発動
          showFinishingMoveEffect()
        }
      }

      // 必殺技が発動しなかった場合のみ通常のダメージ計算
      if (!isFinishingMove) {
        // テストモードでは、配信者への攻撃として「test-user」のバフを反映する
        const testUserId = config.pvp?.strengthBuffTarget === 'individual' ? 'test-user' : undefined
        baseDamage = getAttackDamage(
          config.attack,
          testUserId,
          strengthBuffStartTimeRef,
          config.pvp?.strengthBuffDuration,
          strengthBuffAllStartTimeRef,
          config.pvp?.strengthBuffTarget
        )
      }

      let finalDamage = baseDamage
      let isCritical = false
      // 必殺技が発動した場合はクリティカルをスキップ
      if (!isFinishingMove && config.attack.criticalEnabled) {
        const criticalRoll = Math.random() * 100
        if (criticalRoll < config.attack.criticalProbability) {
          finalDamage = Math.floor(baseDamage * config.attack.criticalMultiplier)
          isCritical = true
        }
      }
      // ダメージ適用後のHPを計算（反転回復を判定するため）
      const hpAfterDamage = Math.max(0, currentHP - finalDamage)
      reduceHPTracked(finalDamage)
      // OBS WebSocket: ダメージ演出（本番の handleAttackEvent と同じ条件）
      if (config.obsWebSocket.enabled && config.obsWebSocket.sourceName.trim()) {
        const eff = config.obsWebSocket.effects
        if (isFinishingMove && eff.finishingMoveEnabled) {
          void tryObsEffect('test finishingMove: shake', () =>
            obsShakeSource(config.obsWebSocket, eff.finishingMoveShakeStrengthPx, eff.finishingMoveShakeDurationMs)
          )
          void tryObsEffect('test finishingMove: glow', () =>
            obsGlowSource(config.obsWebSocket, eff.finishingMoveGlowScale, eff.finishingMoveGlowDurationMs)
          )
        } else if (eff.damageShakeEnabled) {
          void tryObsEffect('test damage: shake', () =>
            obsShakeSource(config.obsWebSocket, eff.damageShakeStrengthPx, eff.damageShakeDurationMs)
          )
        }
      }
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

      // 出血ダメージ判定（別枠として計算）
      // 必殺技が発動した場合は必ず出血ダメージを適用
      let shouldApplyBleed = false
      if (isFinishingMove) {
        shouldApplyBleed = true
        logger.debug(`[テストモード 出血ダメージ判定] 必殺技発動により出血ダメージを適用`)
      } else if (config.attack.bleedEnabled) {
        logger.debug(`[テストモード 出血ダメージ判定] bleedEnabled: true, bleedProbability: ${config.attack.bleedProbability}`)
        const bleedRoll = Math.random() * 100
        logger.debug(`[テストモード 出血ダメージ判定] ダイスロール: ${bleedRoll.toFixed(2)}`)
        if (bleedRoll < config.attack.bleedProbability) {
          shouldApplyBleed = true
        } else {
          logger.debug(`[テストモード 出血ダメージ判定] 失敗: ${bleedRoll.toFixed(2)} >= ${config.attack.bleedProbability}`)
        }
      } else {
        logger.debug(`[テストモード 出血ダメージ判定] bleedEnabled: false`)
      }

      if (shouldApplyBleed) {
        bleedIdRef.current += 1
        const bleedId = bleedIdRef.current
        const testBleedParams = pickBleedVariantParams(config.attack)
        const bleedDamage = testBleedParams.damage
        const bleedInterval = testBleedParams.intervalSec * 1000
        const bleedDuration = testBleedParams.durationSec * 1000
        const bleedTickColor = testBleedParams.damageColor
        const dotDebuffKind = testBleedParams.debuffKind

        // DOTが付与された攻撃では、攻撃SEを種別で置き換える（設定があれば）
        if (!isFinishingMove) {
          if (dotDebuffKind === 'poison') {
            const played = config.attack.dotPoisonAttackSoundEnabled && !!config.attack.dotPoisonAttackSoundUrl?.trim()
            if (played) playDotPoisonAttackSound()
            else if (config.attack.soundEnabled) playAttackSound()
          } else if (dotDebuffKind === 'burn') {
            const played = config.attack.dotBurnAttackSoundEnabled && !!config.attack.dotBurnAttackSoundUrl?.trim()
            if (played) playDotBurnAttackSound()
            else if (config.attack.soundEnabled) playAttackSound()
          } else {
            if (config.attack.soundEnabled) playAttackSound()
          }
        }

        logger.debug(`[テストモード 出血ダメージ開始] ID: ${bleedId}, ダメージ: ${bleedDamage}, 間隔: ${bleedInterval}ms, 持続時間: ${bleedDuration}ms`)
        logger.debug(`[テストモード 出血ダメージ開始] reduceHPRef.current:`, reduceHPRef.current)
        logger.debug(`[テストモード 出血ダメージ開始] reduceHP:`, reduceHP)

        // 一定間隔でダメージを与えるタイマー
        const intervalTimer = window.setInterval(() => {
          logger.debug(`[テストモード 出血ダメージ適用] ID: ${bleedId}, ダメージ: ${bleedDamage}`)
          logger.debug(`[テストモード 出血ダメージ適用] reduceHPRef.current:`, reduceHPRef.current)
          const currentReduceHP = reduceHPRef.current
          if (currentReduceHP && typeof currentReduceHP === 'function') {
            logger.debug(`[テストモード 出血ダメージ適用] reduceHPRef.currentを呼び出します`)
            currentReduceHP(bleedDamage)
            playDotDebuffTickSound(config.attack, dotDebuffKind, {
              playBleed: playBleedSound,
              playPoison: playDotPoisonSound,
              playBurn: playDotBurnSound,
            })
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
              dotDebuffKind,
              bleedColor: bleedTickColor,
              angle: testBleedAngle,
              distance: testBleedDistance,
            }])
            setTimeout(() => {
              setDamageNumbers((prev) => prev.filter((d) => d.id !== testBleedDamageId))
            }, 1200)
          } else {
            logger.error('[テストモード 出血ダメージエラー] reduceHPRef.currentが関数ではありません', currentReduceHP)
            // フォールバック: reduceHPを直接使用
            if (reduceHPTracked && typeof reduceHPTracked === 'function') {
              logger.debug('[テストモード 出血ダメージ] フォールバック: reduceHPTrackedを直接使用')
              reduceHPTracked(bleedDamage)
              playDotDebuffTickSound(config.attack, dotDebuffKind, {
                playBleed: playBleedSound,
                playPoison: playDotPoisonSound,
                playBurn: playDotBurnSound,
              })
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
                dotDebuffKind,
                bleedColor: bleedTickColor,
                angle: testBleedAngle2,
                distance: testBleedDistance2,
              }])
              setTimeout(() => {
                setDamageNumbers((prev) => prev.filter((d) => d.id !== testBleedDamageId2))
              }, 1200)
            } else {
              logger.error('[テストモード 出血ダメージエラー] reduceHPも関数ではありません', reduceHP)
            }
          }
        }, bleedInterval)

        // 持続時間が終了したらタイマーをクリア
        const durationTimer = window.setTimeout(() => {
          logger.debug(`[テストモード 出血ダメージ終了] ID: ${bleedId}`)
          window.clearInterval(intervalTimer)
          bleedTimersRef.current.delete(bleedId)
        }, bleedDuration)

        bleedTimersRef.current.set(bleedId, { intervalTimer, durationTimer })
        logger.debug(`[テストモード 出血ダメージ開始] タイマーを設定しました。intervalTimer: ${intervalTimer}, durationTimer: ${durationTimer}`)
      } else {
        // DOTなし攻撃は通常の攻撃SE
        if (config.attack.soundEnabled && !isFinishingMove) {
          playAttackSound()
        }
      }
      // 反転回復: この攻撃のモーション後（durationMs後）に回復（1回の攻撃フローで「減る→回復」を完結）
      // HPが0になった場合は反転回復を実行しない
      if (reverseHealAmount > 0 && hpAfterDamage > 0) {
        const durationMs = config.animation?.duration ?? 500
        streamerHealOnAttackTimerRef.current = window.setTimeout(() => {
          streamerHealOnAttackTimerRef.current = null
          // タイマー実行時にもHPが0以上かチェック（念のため）
          if (currentHP > 0) {
            setDamageEffectActive(false)
            increaseHP(reverseHealAmount)

            // 回復数値を表示（テストモードの反転回復ぶん）
            healIdRef.current += 1
            const healId = healIdRef.current
            setHealNumbers((prev) => [...prev, { id: healId, amount: reverseHealAmount }])
            setTimeout(() => {
              setHealNumbers((prev) => prev.filter((h) => h.id !== healId))
            }, 1500)

            if (config.heal?.effectEnabled) showHealEffect()
            if (config.heal?.soundEnabled) playHealSound()
          }
        }, durationMs)
      }
    } else {
      // ミス時
      showMiss(config.animation.duration)
      // 回避時: 外部ウィンドウ・WebMを左右に少し動かして戻す
      triggerDodgeEffect(600)
      if (config.obsWebSocket.enabled && config.obsWebSocket.sourceName.trim() && config.obsWebSocket.effects.dodgeMoveEnabled) {
        const eff = config.obsWebSocket.effects
        void tryObsEffect('test dodge: move', () =>
          obsMoveSource(config.obsWebSocket, eff.dodgeMoveDistancePx, eff.dodgeMoveDurationMs)
        )
      }
      // ミス効果音を再生
      if (config.attack.missSoundEnabled) {
        playMissSound()
      }
    }
  }, [config, isTestMode, currentHP, reduceHPTracked, increaseHP, showHealEffect, showMiss, showCritical, triggerDodgeEffect, playMissSound, playHealSound, playAttackSound, playBleedSound, playDotPoisonSound, playDotBurnSound, showFinishingMoveEffect, stopRepeat, tryObsEffect])

  const handleTestFinishingMove = useCallback(() => {
    if (!config || !isTestMode) return
    logger.info('[Test] finishingMove trigger', {
      obsEnabled: config.obsWebSocket.enabled,
      sourceName: config.obsWebSocket.sourceName,
      effects: config.obsWebSocket.effects,
    })
    // HPが0以下の場合は何もしない
    if (currentHP <= 0) {
      stopRepeat()
      return
    }
    if (!config.pvp?.viewerFinishingMoveEnabled) {
      logger.debug('[テストモード] 必殺技設定が無効のため発動しません（viewerFinishingMoveEnabled を確認）')
      return
    }

    // 必殺技ダメージ: 現在のHPの1/2（最低1）
    const finishingDamage = Math.max(1, Math.floor(currentHP / 2))
    logger.debug(`[テストモード] 必殺技を確定発動しました（現在HP=${currentHP} => ダメージ=${finishingDamage}）`)

    // 必殺技エフェクトを発動
    showFinishingMoveEffect()

    // ダメージ適用
    reduceHPTracked(finishingDamage)

    if (config.obsWebSocket.enabled && config.obsWebSocket.sourceName.trim()) {
      const eff = config.obsWebSocket.effects
      if (eff.finishingMoveEnabled) {
        void tryObsEffect('test FM button: shake', () =>
          obsShakeSource(config.obsWebSocket, eff.finishingMoveShakeStrengthPx, eff.finishingMoveShakeDurationMs)
        )
        void tryObsEffect('test FM button: glow', () =>
          obsGlowSource(config.obsWebSocket, eff.finishingMoveGlowScale, eff.finishingMoveGlowDurationMs)
        )
      }
    }

    // ダメージ数値を表示
    damageIdRef.current += 1
    const damageId = damageIdRef.current
    setDamageNumbers((prev) => [...prev, { id: damageId, amount: finishingDamage, isCritical: false }])
    setTimeout(() => {
      setDamageNumbers((prev) => prev.filter((d) => d.id !== damageId))
    }, 1500)

    // 必殺技専用SEを使うため、通常の攻撃効果音は鳴らさない

    // 出血デバフを確定付与（本番ロジックと同様に、必殺技時は確定で出血）
    const bleedEnabled = config.attack.bleedEnabled || true
    if (bleedEnabled) {
      const fmBleedParams = pickBleedVariantParams(config.attack)
      const bleedDamage = fmBleedParams.damage
      const bleedInterval = fmBleedParams.intervalSec * 1000
      const bleedDuration = fmBleedParams.durationSec * 1000
      const bleedTickColor = fmBleedParams.damageColor
      const dotDebuffKind = fmBleedParams.debuffKind

      bleedIdRef.current += 1
      const bleedId = bleedIdRef.current

      logger.debug(`[テストモード 出血ダメージ開始(必殺技)] ID: ${bleedId}, ダメージ: ${bleedDamage}, 間隔: ${bleedInterval}ms, 持続時間: ${bleedDuration}ms`)
      logger.debug(`[テストモード 出血ダメージ開始(必殺技)] reduceHPRef.current:`, reduceHPRef.current)
      logger.debug(`[テストモード 出血ダメージ開始(必殺技)] reduceHP:`, reduceHP)

      const intervalTimer = window.setInterval(() => {
        logger.debug(`[テストモード 出血ダメージ適用(必殺技)] ID: ${bleedId}, ダメージ: ${bleedDamage}`)
        logger.debug(`[テストモード 出血ダメージ適用(必殺技)] reduceHPRef.current:`, reduceHPRef.current)
        const currentReduceHP = reduceHPRef.current
        if (currentReduceHP && typeof currentReduceHP === 'function') {
          currentReduceHP(bleedDamage)
          playDotDebuffTickSound(config.attack, dotDebuffKind, {
            playBleed: playBleedSound,
            playPoison: playDotPoisonSound,
            playBurn: playDotBurnSound,
          })
          damageIdRef.current += 1
          const testBleedDamageId = damageIdRef.current
          const testBleedAngle = Math.random() * 360
          const testBleedDistance = 80 + Math.random() * 60
          setDamageNumbers((prev) => [...prev, {
            id: testBleedDamageId,
            amount: bleedDamage,
            isCritical: false,
            isBleed: true,
            dotDebuffKind,
            bleedColor: bleedTickColor,
            angle: testBleedAngle,
            distance: testBleedDistance,
          }])
          setTimeout(() => {
            setDamageNumbers((prev) => prev.filter((d) => d.id !== testBleedDamageId))
          }, 1200)
        } else {
          logger.error('[テストモード 出血ダメージエラー(必殺技)] reduceHPRef.currentが関数ではありません', currentReduceHP)
        }
      }, bleedInterval)

      const durationTimer = window.setTimeout(() => {
        logger.debug(`[テストモード 出血ダメージ終了(必殺技)] ID: ${bleedId}`)
        window.clearInterval(intervalTimer)
        bleedTimersRef.current.delete(bleedId)
      }, bleedDuration)

      bleedTimersRef.current.set(bleedId, { intervalTimer, durationTimer })
    }

    // 必殺技発動時のメッセージ（チャット接続できる場合のみ送信）
    if (config.pvp.autoReplyViewerFinishingMove && config.pvp.messageWhenViewerFinishingMove?.trim() && username) {
      const msg = fillTemplate(config.pvp.messageWhenViewerFinishingMove, {
        username: 'test-user',
        damage: finishingDamage,
      })
      sendAutoReply(msg, '[PvP] 必殺技メッセージ送信失敗')
    }
  }, [config, isTestMode, currentHP, reduceHPTracked, playBleedSound, playDotPoisonSound, playDotBurnSound, showFinishingMoveEffect, sendAutoReply, stopRepeat, username, tryObsEffect])

  const handleTestHeal = useCallback(() => {
    if (!config || !isTestMode) return
    logger.info('[Test] heal trigger', {
      obsEnabled: config.obsWebSocket.enabled,
      sourceName: config.obsWebSocket.sourceName,
      effects: config.obsWebSocket.effects,
    })

    // HPが0の場合は回復をブロック
    if (currentHP <= 0) {
      return
    }

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

    registerHealStreak(currentHP, maxHP)
    // HPを回復
    increaseHP(healAmount)

    // 回復数値を表示（本番の回復ハンドラと同じ表現）
    healIdRef.current += 1
    const healId = healIdRef.current
    setHealNumbers((prev: Array<{ id: number; amount: number }>) => [...prev, { id: healId, amount: healAmount }])
    setTimeout(() => {
      setHealNumbers((prev) => prev.filter((h) => h.id !== healId))
    }, 1500)
    // 回復エフェクトを表示（設定で有効な場合のみ）
    if (config.heal.effectEnabled) {
      showHealEffect()
    }
    // 回復効果音を再生
    if (config.heal.soundEnabled) {
      playHealSound()
    }
    if (config.obsWebSocket.enabled && config.obsWebSocket.sourceName.trim() && config.obsWebSocket.effects.healGlowEnabled) {
      const eff = config.obsWebSocket.effects
      void tryObsEffect('test heal: glow', () =>
        obsGlowSource(config.obsWebSocket, eff.healGlowScale, eff.healGlowDurationMs)
      )
    }
  }, [config, isTestMode, currentHP, maxHP, increaseHP, registerHealStreak, showHealEffect, playHealSound, tryObsEffect])

  const handleTestReset = useCallback(() => {
    if (!isTestMode || !config) return
    // 現在のHPが最大HPの場合は何もしない
    if (currentHP >= maxHP) return
    resetStreamerHp()
    // 蘇生効果音を再生
    if (config.retry.soundEnabled) {
      playRetrySound()
    }
  }, [isTestMode, config, currentHP, maxHP, resetStreamerHp, playRetrySound])

  // テストモード用のバフ付与ハンドラ（即時に ref を更新し、チャット送信は任意でログ用）
  const handleTestStrengthBuff = useCallback(() => {
    if (!isTestMode || !config) return

    const target = config.pvp?.strengthBuffTarget ?? 'individual'
    const now = Date.now()
    if (target === 'all') {
      strengthBuffAllStartTimeRef.current = now
      strengthBuffStartTimeRef.current.clear()
    } else {
      strengthBuffAllStartTimeRef.current = null
      strengthBuffStartTimeRef.current.set('test-user', now)
    }
    if (config.pvp?.strengthBuffSoundEnabled) {
      playStrengthBuffSound()
    }

    const strengthBuffCommand = config.pvp?.strengthBuffCommand ?? '!strength'
    if (username && twitchChat.canSend()) {
      twitchChat.say(username, strengthBuffCommand)
      logger.debug(`[テストモード] ${strengthBuffCommand} を送信（バフは既に適用済み）`)
    } else if (user?.id) {
      twitchApi
        .sendChatMessage(user.id, strengthBuffCommand)
        .then(() => {
          logger.debug(`[テストモード] ${strengthBuffCommand} を送信（バフは既に適用済み）`)
        })
        .catch((err) => {
          logger.error(`[テストモード] ${strengthBuffCommand} の送信失敗（バフはローカルで適用済み）`, err)
        })
    } else {
      logger.debug(`[テストモード] バフをローカル適用（チャット未接続のためコマンドは送信しません）`)
    }
  }, [isTestMode, config, username, user?.id, playStrengthBuffSound])

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
        const isCounterMatch = isCommandMatch(messageLower, config.pvp.counterCommand)
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
          const result = applyViewerDamage(
            targetUserId,
            // カウンター攻撃（配信者→視聴者）には視聴者バフを乗せない
            getAttackDamage(sa),
            sa
          )
            const tpl = config.pvp.autoReplyMessageTemplate || '{username} の残りHP: {hp}/{max}'
            const reply = fillTemplate(tpl, {
              username: targetDisplayName,
              hp: result.newHP,
              max: viewerMaxHP,
            })
            if (config.pvp.autoReplyAttackCounter) {
              sendAutoReply(reply, '[PvP] チャット送信失敗')
            }
            if (result.newHP === 0 && config.pvp.messageWhenViewerZeroHp?.trim() && config.pvp.autoReplyWhenViewerZeroHp) {
              const zeroMsg = fillTemplate(config.pvp.messageWhenViewerZeroHp, { username: targetDisplayName }).trim()
              if (zeroMsg) {
                sendAutoReply(zeroMsg, '[PvP] 視聴者HP0自動返信の送信失敗')
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
        viewerAttackViewerCmd.length > 0 &&
        user?.id &&
        (message.user.id !== user.id || isTestMode)
      ) {
        const isViewerAttackViewerMatch = isCommandMatch(messageLower, viewerAttackViewerCmd)
        if (isViewerAttackViewerMatch) {
          const parts = messageText.trim().split(/\s+/)
          const targetNamePart = parts.length >= 2 ? parts.slice(1).join(' ').trim().toLowerCase() : ''
          const isBroadcasterInTestMode = isTestMode && message.user.id === user.id
          const attackerIdForCommand = isBroadcasterInTestMode ? 'test-user' : message.user.id
          const attackerNameForCommand = isBroadcasterInTestMode ? 'TestUser' : (message.user.displayName || message.user.login)
          if (!targetNamePart) {
            // ユーザー名未指定（!attack のみ）の場合は、配信者への攻撃として扱う
            processedChatMessagesRef.current.add(message.id)
            commandMatched = true
            const attackerState = getViewerHPCurrent(attackerIdForCommand) ?? getViewerHP(attackerIdForCommand)
            const attackerCurrent = attackerState?.current ?? viewerMaxHP
            if (attackerCurrent <= 0) {
              sendPvpBlockedMessage('attack', '[PvP] 視聴者攻撃ブロック送信失敗')
            } else {
              handleAttackEvent({
                rewardId: 'viewer-attack-command',
                userId: attackerIdForCommand,
                userName: attackerNameForCommand,
              })
            }
          } else {
            if (pvpAttackMode !== 'both') {
              processedChatMessagesRef.current.add(message.id)
              commandMatched = true
              return
            }
            const attackerId = attackerIdForCommand
            const attackerState = getViewerHPCurrent(attackerId) ?? getViewerHP(attackerId)
            const attackerCurrent = attackerState?.current ?? viewerMaxHP
            if (attackerCurrent <= 0) {
              processedChatMessagesRef.current.add(message.id)
              commandMatched = true
              sendPvpBlockedMessage('attack', '[PvP] 視聴者同士攻撃ブロック送信失敗')
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
                  // 視聴者同士の攻撃では、バフは配信者へのダメージにのみ影響させるため考慮しない
                  let baseDamage = getAttackDamage(vva)

                  // 必殺技判定（視聴者側の攻撃のみ、確率は0-100%で小数点第2位まで設定可能）
                  let isFinishingMove = false
                  if (config.pvp?.viewerFinishingMoveEnabled) {
                    const probability = config.pvp.viewerFinishingMoveProbability ?? 0.01
                    const finishingMoveRoll = Math.random() * 10000 // 0-10000の範囲
                    const threshold = probability * 100 // 0.01% → 1, 1% → 100, 100% → 10000
                    if (finishingMoveRoll < threshold) {
                      isFinishingMove = true
                      // 視聴者同士の攻撃では、対象の現在HPの1/2ダメージ
                      const targetHP = getViewerHPCurrent(targetUserId)?.current ?? viewerMaxHP
                      const finishingDamage = Math.max(1, Math.floor(targetHP / 2))
                      baseDamage = finishingDamage
                      // 必殺技エフェクトを発動
                      showFinishingMoveEffect()
                      // 必殺技発動時のメッセージ
                      if (config.pvp.autoReplyViewerFinishingMove && config.pvp.messageWhenViewerFinishingMove?.trim()) {
                        const attackerName = message.user.displayName || message.user.login
                        const msg = fillTemplate(config.pvp.messageWhenViewerFinishingMove, {
                          username: attackerName,
                          damage: finishingDamage,
                        })
                        sendAutoReply(msg, '[PvP] 必殺技メッセージ送信失敗')
                      }
                    }
                  }

                  const result = applyViewerDamage(
                    targetUserId,
                    baseDamage,
                    vva,
                    isFinishingMove
                  )
                  const tpl = config.pvp.autoReplyMessageTemplate || '{username} の残りHP: {hp}/{max}'
                  const reply = fillTemplate(tpl, {
                    username: targetDisplayName,
                    hp: result.newHP,
                    max: viewerMaxHP,
                  })
                  if (config.pvp.autoReplyAttackCounter) {
                    sendAutoReply(reply, '[PvP] 視聴者同士攻撃返信の送信失敗')
                  }
                  if (result.newHP === 0 && config.pvp.messageWhenViewerZeroHp?.trim() && config.pvp.autoReplyWhenViewerZeroHp) {
                    const zeroMsg = fillTemplate(config.pvp.messageWhenViewerZeroHp, { username: targetDisplayName }).trim()
                    if (zeroMsg) {
                      sendAutoReply(zeroMsg, '[PvP] 視聴者HP0自動返信の送信失敗')
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
        const isHpCheckMatch = isCommandMatch(messageLower, config.pvp.hpCheckCommand)
        if (isHpCheckMatch) {
          processedChatMessagesRef.current.add(message.id)
          commandMatched = true
          ensureViewerHP(message.user.id)
          const state = getViewerHPCurrent(message.user.id) ?? getViewerHP(message.user.id)
          const hp = state?.current ?? viewerMaxHP
          const max = state?.max ?? viewerMaxHP
          const tpl = config.pvp.autoReplyMessageTemplate || '{username} の残りHP: {hp}/{max}'
          const displayName = message.user.displayName || message.user.login
          const reply = fillTemplate(tpl, { username: displayName, hp, max })
          if (config.pvp.autoReplyHpCheck) {
            sendAutoReply(reply, '[PvP] HP確認チャット送信失敗')
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
        const isViewerFullHealMatch = isCommandMatch(messageLower, config.pvp.viewerFullHealCommand)
        if (isViewerFullHealMatch) {
          processedChatMessagesRef.current.add(message.id)
          commandMatched = true
          ensureViewerHP(message.user.id)
          setViewerHP(message.user.id, viewerMaxHP)
          const displayName = message.user.displayName || message.user.login
          const tpl = config.pvp.autoReplyMessageTemplate || '{username} の残りHP: {hp}/{max}'
          const reply = fillTemplate(tpl, { username: displayName, hp: viewerMaxHP, max: viewerMaxHP })
          if (config.pvp.autoReplyFullHeal) {
            sendAutoReply(reply, '[PvP] 全回復返信の送信失敗')
          }
        }
      }

      // ストレングスバフコマンド（視聴者が実行するとストレングス効果を付与）
      if (
        !commandMatched &&
        config.pvp?.strengthBuffCommand &&
        config.pvp.strengthBuffCommand.length > 0 &&
        user?.id &&
        (message.user.id !== user.id || isTestMode)
      ) {
        const isStrengthBuffMatch = isCommandMatch(messageLower, config.pvp.strengthBuffCommand)
        if (isStrengthBuffMatch) {
          processedChatMessagesRef.current.add(message.id)
          commandMatched = true
          const durationSeconds = Math.max(1, Math.floor(Number(config.pvp.strengthBuffDuration)) || 300)
          const durationMinutesRounded = Math.max(1, Math.round(durationSeconds / 60))
          const target = config.pvp.strengthBuffTarget ?? 'individual'
          const displayName = message.user.displayName || message.user.login
          // テストモードで配信者がコマンドした場合、個人用バフは test-user に紐づける（handleTestAttack の getAttackDamage と同じキー）
          const individualBuffUserId =
            isTestMode && user.id && message.user.id === user.id ? 'test-user' : message.user.id
          const now = Date.now()

          // 設定に応じてタイマーを上書き（対象外タイマーはクリア）
          if (target === 'all') {
            // 全員用バフを再開始し、個人用の残タイマーは無効化
            strengthBuffAllStartTimeRef.current = now
            strengthBuffStartTimeRef.current.clear()
          } else {
            // 個人用バフを再開始し、全員用の残タイマーは無効化
            strengthBuffAllStartTimeRef.current = null
            strengthBuffStartTimeRef.current.set(individualBuffUserId, now)
          }

          // 効果音を再生
          if (config.pvp.strengthBuffSoundEnabled) {
            playStrengthBuffSound()
          }
          if (config.pvp.autoReplyStrengthBuff) {
            const tpl = sanitizeStrengthBuffChatTemplates(
              config.pvp.messageWhenStrengthBuffActivated ||
                '{username} にストレングス効果を付与しました！（効果時間: {duration_human}）'
            )
            const reply = fillTemplate(tpl, {
              username: target === 'all' ? '全員' : displayName,
              duration: durationSeconds,
              duration_minutes: durationMinutesRounded,
              duration_human: formatStrengthBuffDurationHumanJa(durationSeconds),
            })
            sendAutoReply(reply, '[PvP] ストレングスバフ返信の送信失敗')
          }
        }
      }

      // バフ確認コマンド（視聴者が自分のバフ状態を確認）
      if (
        !commandMatched &&
        config.pvp?.strengthBuffCheckCommand &&
        config.pvp.strengthBuffCheckCommand.length > 0 &&
        user?.id &&
        (message.user.id !== user.id || isTestMode)
      ) {
        const isBuffCheckMatch = isCommandMatch(messageLower, config.pvp.strengthBuffCheckCommand)
        if (isBuffCheckMatch) {
          processedChatMessagesRef.current.add(message.id)
          commandMatched = true
          const durationSeconds = Math.max(1, Math.floor(Number(config.pvp.strengthBuffDuration)) || 300)
          const durationMinutesRounded = Math.max(1, Math.round(durationSeconds / 60))
          const target = config.pvp.strengthBuffTarget ?? 'individual'
          const displayName = message.user.displayName || message.user.login
          const individualBuffUserId =
            isTestMode && user.id && message.user.id === user.id ? 'test-user' : message.user.id
          if (config.pvp.autoReplyStrengthBuffCheck) {
            // 全員用バフをチェック
            let hasBuff = false
            let remainingSeconds = 0
            if (target === 'all' && strengthBuffAllStartTimeRef.current) {
              const elapsed = (Date.now() - strengthBuffAllStartTimeRef.current) / 1000
              remainingSeconds = Math.max(0, Math.floor(durationSeconds - elapsed))
              if (remainingSeconds > 0) {
                hasBuff = true
              }
            }
            // 個人用バフをチェック（全員用バフが無効な場合のみ）
            if (!hasBuff && target === 'individual') {
              const startTime = strengthBuffStartTimeRef.current.get(individualBuffUserId)
              if (startTime) {
                const elapsed = (Date.now() - startTime) / 1000
                remainingSeconds = Math.max(0, Math.floor(durationSeconds - elapsed))
                if (remainingSeconds > 0) {
                  hasBuff = true
                } else {
                  // バフが切れている場合は削除
                  strengthBuffStartTimeRef.current.delete(individualBuffUserId)
                }
              }
            }

            if (hasBuff) {
              const remainingMinutesRounded = Math.max(0, Math.round(remainingSeconds / 60))
              const tpl = sanitizeStrengthBuffChatTemplates(
                config.pvp.messageWhenStrengthBuffCheck ||
                  '{username} のストレングス効果: 残り {remaining_human} / 効果時間 {duration_human}'
              )
              const reply = fillTemplate(tpl, {
                username: target === 'all' ? '全員' : displayName,
                remaining: remainingSeconds,
                duration: durationSeconds,
                remaining_minutes: remainingMinutesRounded,
                duration_minutes: durationMinutesRounded,
                remaining_human: formatStrengthBuffDurationHumanJa(remainingSeconds),
                duration_human: formatStrengthBuffDurationHumanJa(durationSeconds),
              })
              sendAutoReply(reply, '[PvP] バフ確認返信の送信失敗')
            } else {
              const reply = `${target === 'all' ? '全員' : displayName} には現在ストレングス効果が付与されていません。`
              sendAutoReply(reply, '[PvP] バフ確認返信の送信失敗')
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
        const isViewerHealMatch = isCommandMatch(messageLower, viewerHealCmd)
        if (isViewerHealMatch) {
          processedChatMessagesRef.current.add(message.id)
          commandMatched = true
          ensureViewerHP(message.user.id)
          // ref から現在HPを読む（ensureViewerHP 直後でも setState の updater 内で ref が更新されている）
          const state = getViewerHPCurrent(message.user.id) ?? getViewerHP(message.user.id)
          const current = state?.current ?? viewerMaxHP
          if (current <= 0 && !config.pvp.viewerHealWhenZeroEnabled) {
            sendPvpBlockedMessage('heal', '[PvP] HP0ブロックメッセージ送信失敗')
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
              const reply = fillTemplate(tpl, { username: displayName, hp: newHP, max: viewerMaxHP })
              sendAutoReply(reply, '[回復] 視聴者!heal 自動返信の送信失敗')
            } else if (usePvpReply) {
              const tpl = config.pvp.autoReplyMessageTemplate || '{username} の残りHP: {hp}/{max}'
              const reply = fillTemplate(tpl, { username: displayName, hp: newHP, max: viewerMaxHP })
              sendAutoReply(reply, '[PvP] 回復返信の送信失敗')
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
              sendPvpBlockedMessage('attack', '[PvP] HP0ブロックメッセージ送信失敗')
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
              sendPvpBlockedMessage('heal', '[PvP] HP0ブロックメッセージ送信失敗')
            } else {
              // 配信者のHPが0の場合は回復をブロック
              if (currentHP <= 0) {
                return
              }
              handleHealEvent({ rewardId: 'custom-text' })
            }
          } else {
            // 配信者のHPが0の場合は回復をブロック
            if (currentHP <= 0) {
              return
            }
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
        const isResetAllMatch = isCommandMatch(messageLower, config.retry.fullResetAllCommand)
        if (isResetAllMatch) {
          processedChatMessagesRef.current.add(message.id)
          commandMatched = true
          resetStreamerHp()
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
        const isFullHealMatch = isCommandMatch(messageLower, config.retry.fullHealCommand)
        if (isFullHealMatch) {
          processedChatMessagesRef.current.add(message.id)
          commandMatched = true
          resetStreamerHp()
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
        const isStreamerHealMatch = isCommandMatch(messageLower, config.retry.streamerHealCommand)
        if (isStreamerHealMatch) {
          processedChatMessagesRef.current.add(message.id)
          commandMatched = true
          // HPが0の場合は回復をブロック
          if (currentHP <= 0) {
            return
          }
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
            registerHealStreak(currentHP, maxHP)
            const newHP = Math.min(maxHP, currentHP + healAmount)
            increaseHP(healAmount)
            if (config.heal.effectEnabled) showHealEffect()
            if (config.retry.soundEnabled) playRetrySound()
            // 回復時自動返信（攻撃コマンドと同様）。{username} は配信者なので「配信者」に置換
            if (config.heal.autoReplyEnabled && config.heal.autoReplyMessageTemplate?.trim()) {
              const tpl = config.heal.autoReplyMessageTemplate.trim()
              const reply = fillTemplate(tpl, { username: '配信者', hp: newHP, max: maxHP })
              sendAutoReply(reply, '[回復] !heal 自動返信の送信失敗')
            }
          }
        }
      }

      // リトライコマンドの判定（HP最大でも受け付ける）
      if (
        !commandMatched &&
        config.retry.enabled &&
        config.retry.command &&
        config.retry.command.length > 0
      ) {
        // 完全一致、またはメッセージの開始
        const isRetryMatch = isCommandMatch(messageLower, config.retry.command)

        if (isRetryMatch) {
          processedChatMessagesRef.current.add(message.id)
          commandMatched = true
          // リトライコマンドを実行（回復コマンドと同じロジックで最大HPまで回復）
          // 現在のHPと最大HPの差分を計算して回復
          const healAmount = maxHP - currentHP

          if (healAmount > 0) {
            increaseHP(healAmount)
          }
          // HP最大でも「コマンドは有効」にしたいので、効果音/演出は常に実行（設定ON時）
          if (config.heal.effectEnabled) showHealEffect()
          if (config.retry.soundEnabled) playRetrySound()
        }
      }

      // メモリ最適化: 処理済みメッセージのセットが大きくなりすぎないように制限
      if (processedChatMessagesRef.current.size > 500) {
        const idsArray = Array.from(processedChatMessagesRef.current)
        idsArray.slice(0, 250).forEach((id) => processedChatMessagesRef.current.delete(id))
      }
    })
  }, [chatMessages, config, isTestMode, username, user?.id, handleAttackEvent, handleHealEvent, chatConnected, currentHP, resetStreamerHp, maxHP, increaseHP, registerHealStreak, showHealEffect, showFinishingMoveEffect, playRetrySound, playStrengthBuffSound, applyViewerDamage, getViewerHP, getViewerHPCurrent, getViewerUserIds, ensureViewerHP, sendAutoReply, sendPvpBlockedMessage, setViewerHP, viewerMaxHP])

  // body要素にoverflow:hiddenを適用
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  // 背景が透明のときは html/body の黒背景も透明にする（フックは早期 return より前で呼ぶ）
  const overlayBgMode = config?.background?.mode ?? 'green'
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtmlBg = html.style.backgroundColor
    const prevBodyBg = body.style.backgroundColor
    const prevBodyClass = body.className

    body.classList.add('overlay-mode')
    if (overlayBgMode === 'transparent') {
      html.style.backgroundColor = 'transparent'
      body.style.backgroundColor = 'transparent'
    }

    return () => {
      html.style.backgroundColor = prevHtmlBg
      body.style.backgroundColor = prevBodyBg
      body.className = prevBodyClass
    }
  }, [overlayBgMode])

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

  const background = config.background
  const backgroundStyle = (() => {
    const mode = background?.mode ?? 'green'
    if (mode === 'transparent') return 'transparent'
    if (mode === 'dark-gray') return '#1a1a1a'
    if (mode === 'custom') return background?.customColor?.trim() || '#00ff00'
    return '#00ff00'
  })()

  const captureGuide = config.obsCaptureGuide

  return (
    <div
      className={`overlay-page ${finishingMoveFilterActive ? 'finishing-move-filter' : ''}`}
      style={{ background: backgroundStyle, backgroundColor: backgroundStyle }}
    >

      {captureGuide.enabled && (
        <div className="obs-capture-guide" aria-hidden>
          <div
            className="obs-capture-guide__frame"
            style={{
              top: captureGuide.insetPx,
              right: captureGuide.insetPx,
              bottom: captureGuide.insetPx,
              left: captureGuide.insetPx,
            }}
          >
            <span className="obs-capture-guide__corner obs-capture-guide__corner--tl" />
            <span className="obs-capture-guide__corner obs-capture-guide__corner--tr" />
            <span className="obs-capture-guide__corner obs-capture-guide__corner--bl" />
            <span className="obs-capture-guide__corner obs-capture-guide__corner--br" />
            <span className="obs-capture-guide__label">切り取り目安・配信前に OFF</span>
          </div>
        </div>
      )}

      {/* Twitchユーザーが取得できない場合のヒント（表示は継続する） */}
      {!isTestMode && (!username || !user) && (
        <div className="overlay-warning">
          <p>注意: Twitchユーザー情報を取得できません。</p>
          <p>
            `VITE_TWITCH_USERNAME` を設定するか、オーバーレイの「設定」からテストモードを有効にしてください。
          </p>
        </div>
      )}

      {/* 必殺技エフェクト: 画面フラッシュ */}
      {finishingMoveFlashVisible && <div className="finishing-move-flash" />}
      {/* 必殺技表示（必殺技発動時のみ） */}
      {finishingMoveTextVisible && <div className="overlay-finishing-move">{config.pvp?.finishingMoveText ?? '必殺技！'}</div>}
      {/* MISS表示（ミス判定が発生したときのみ） */}
      {missVisible && (
        <div className="overlay-miss" style={glowTextStyleFromHex(config.attack.missTextColor, 'miss')}>
          MISS
        </div>
      )}
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
      {/* 必殺技エフェクト（爆発的な火花・破片・衝撃波パーティクル） */}
      {finishingMoveParticles.map((particle) => {
        const angleRad = (particle.angle * Math.PI) / 180
        const endX = Math.cos(angleRad) * particle.distance * 1.5
        const endY = Math.sin(angleRad) * particle.distance * 1.5

        if (particle.type === 'shockwave') {
          // 衝撃波（大きな円形、中心から拡大）
          return (
            <div
              key={particle.id}
              className="finishing-move-shockwave"
              style={{
                '--shockwave-size': `${particle.size}px`,
                '--shockwave-color': particle.color,
                animationDelay: `${particle.delay}ms`,
              } as React.CSSProperties & { '--shockwave-size': string; '--shockwave-color': string }}
            />
          )
        } else if (particle.type === 'fragment') {
          // 破片（不規則な形状、回転しながら飛び散る）
          return (
            <div
              key={particle.id}
              className="finishing-move-fragment"
              style={{
                '--end-x': `${endX}px`,
                '--end-y': `${endY}px`,
                '--fragment-size': `${particle.size}px`,
                '--fragment-color': particle.color,
                animationDelay: `${particle.delay}ms`,
              } as React.CSSProperties & { '--end-x': string; '--end-y': string; '--fragment-size': string; '--fragment-color': string }}
            >
              <svg
                width={particle.size}
                height={particle.size}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* 不規則な破片形状 */}
                <path
                  d="M12 2L18 8L14 12L8 6L12 2Z M18 8L22 12L18 16L14 12L18 8Z M14 12L18 16L12 22L8 18L14 12Z M8 6L12 2L6 6L2 10L8 6Z"
                  fill={particle.color}
                  opacity="0.9"
                />
              </svg>
            </div>
          )
        } else {
          // 火花（細長い線状、高速で飛び散る）
          return (
            <div
              key={particle.id}
              className="finishing-move-spark"
              style={{
                '--end-x': `${endX}px`,
                '--end-y': `${endY}px`,
                '--spark-length': `${particle.size * 3}px`,
                '--spark-color': particle.color,
                animationDelay: `${particle.delay}ms`,
              } as React.CSSProperties & { '--end-x': string; '--end-y': string; '--spark-length': string; '--spark-color': string }}
            >
              <div className="finishing-move-spark-line" />
            </div>
          )
        }
      })}
      {/* WebMループ画像 */}
      {config.webmLoop.enabled && config.webmLoop.videoUrl && (
        <div
          className={`webm-loop-container ${damageEffectActive && config.attack.filterEffectEnabled ? 'damage-effect' : ''} ${healEffectActive && config.heal.filterEffectEnabled ? 'heal-effect' : ''} ${dodgeEffectActive ? 'dodge-effect' : ''} ${finishingMoveShakeActive ? 'finishing-move-shake' : ''}`}
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
      <div className="overlay-hp-stack">
        {sicknessDialogueVisible && (
          <p className="sickness-debuff-dialogue" aria-hidden>
            ぉぇ・・気持ち悪い・・
          </p>
        )}
        <HPGauge
          currentHP={currentHP}
          maxHP={maxHP}
          gaugeCount={gaugeCount}
          config={config}
          buffedUserIds={buffedUserIdsState}
          isAllBuffed={isAllBuffedState}
          userIdToDisplayName={userIdToDisplayNameRef.current}
          allBuffRemainingSeconds={allBuffRemainingSecondsState}
          buffRemainingSecondsMap={buffRemainingSecondsMapState}
          buffDurationSeconds={config.pvp?.strengthBuffDuration ?? 300}
          hitShakeActive={damageEffectActive}
          dodgeSlideActive={gaugeDodgeActive}
          dodgeSlideDirection={gaugeDodgeDirection}
        />
      </div>
      {/* ダメージ数値表示（HPゲージの外側に表示） */}
      {damageNumbers.map((damage) => (
        <DamageNumber
          key={damage.id}
          id={damage.id}
          amount={damage.amount}
          isCritical={damage.isCritical}
          isBleed={damage.isBleed}
          dotDebuffKind={damage.dotDebuffKind ?? 'bleed'}
          bleedColorOverride={damage.bleedColor}
          angle={damage.angle}
          distance={damage.distance}
          damageColors={config.damageColors}
        />
      ))}
      {healNumbers.map((heal) => (
        <HealNumber
          key={heal.id}
          id={heal.id}
          amount={heal.amount}
          healColors={config.healColors}
        />
      ))}
      {/* 本番ビルドでもパネルは表示（テストボタンは設定でテストモード ON のときのみ有効） */}
      {showEmbeddedTestUi && (
        <div className="test-drawer-root">
          <button
            type="button"
            className={`test-drawer-toggle${showTestControls ? ' test-drawer-toggle--open' : ''}`}
            onClick={() => setShowTestControls(!showTestControls)}
            title={showTestControls ? 'テストパネルを閉じる' : 'テストパネルを開く'}
            aria-expanded={showTestControls}
            aria-controls="overlay-test-panel"
            aria-label={showTestControls ? 'テストパネルを閉じる' : 'テストパネルを開く'}
          >
            <span className="test-drawer-toggle-inner" aria-hidden>
              <span className="test-drawer-toggle-bar" />
              <span className="test-drawer-toggle-bar" />
              <span className="test-drawer-toggle-bar" />
            </span>
          </button>
          <div
            id="overlay-test-panel"
            className={`test-controls${showTestControls ? ' test-controls--open' : ''}`}
            style={{
              right: 0,
              top: testPanelSize.top,
              bottom: testPanelSize.bottom,
              width: testPanelSize.width,
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              className="test-panel-file-input"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return

                try {
                  const text = await file.text()
                  const jsonConfig = JSON.parse(text)
                  const validated = validateAndSanitizeConfig(jsonConfig)

                  updateConfigLocal(validated as Partial<OverlayConfig>)
                  logger.debug('✅ 設定ファイルを読み込みました')
                } catch (error) {
                  logger.error('❌ 設定ファイルの読み込みに失敗しました:', error)
                  alert('設定ファイルの読み込みに失敗しました。JSON形式が正しいか確認してください。')
                } finally {
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }
              }}
            />
            <div className="test-controls-scroll">
              <div className="test-controls-inner test-panel">
                <div className="test-panel-topbar">
                  <span className="test-panel-title">テストパネル</span>
                  <div className="test-panel-topbar-actions">
                    {config && (
                      <>
                        <button
                          type="button"
                          className="test-panel-tool-btn test-panel-tool-btn--primary"
                          onClick={async () => {
                            const merged = overlaySettingsRef.current?.flushPendingFieldInputs() ?? config
                            logger.debug('[設定保存] 保存する設定:', {
                              strengthBuffSoundEnabled: merged.pvp?.strengthBuffSoundEnabled,
                              strengthBuffSoundUrl: merged.pvp?.strengthBuffSoundUrl,
                              strengthBuffSoundVolume: merged.pvp?.strengthBuffSoundVolume,
                              pvp: merged.pvp,
                            })
                            const success = await saveOverlayConfig(merged)
                            if (success) {
                              setShowSaveDialog(true)
                              setTimeout(() => {
                                setShowSaveDialog(false)
                              }, 3000)
                            } else {
                              alert('設定の保存に失敗しました。')
                            }
                          }}
                          title="現在の設定をサーバーに保存"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          className="test-panel-tool-btn"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            fileInputRef.current?.click()
                          }}
                          title="ローカルの JSON から設定を読み込み（反映後は「保存」で確定）"
                          disabled={configLoading}
                        >
                          {configLoading ? '…' : '読込'}
                        </button>
                        <button
                          type="button"
                          className="test-panel-tool-btn"
                          onClick={() => {
                            if (!confirm('設定をデフォルト値にリセットしますか？')) return
                            replaceConfig(getDefaultConfig())
                          }}
                          title="オーバーレイ設定を初期値に戻す（サーバーへ反映するには「保存」）"
                          disabled={!config}
                        >
                          リセット
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className={`test-panel-segment ${showTestSettings ? 'test-panel-segment--on' : ''}`}
                      onClick={() => setShowTestSettings(!showTestSettings)}
                      title={showTestSettings ? '詳細設定を閉じる' : '詳細設定を開く'}
                    >
                      設定
                    </button>
                  </div>
                </div>
                {showTestSettings && config && (
                  <div className="test-settings-panel test-settings-panel--embedded">
                    <div className="test-settings-embedded-toolbar test-settings-embedded-toolbar--compact">
                      <button type="button" className="test-button test-save test-panel-preset-btn" onClick={() => applyTestPreset('safe')}>
                        プリセット: 配信（安全）
                      </button>
                      <button type="button" className="test-button test-reload test-panel-preset-btn" onClick={() => applyTestPreset('allOn')}>
                        プリセット: 検証（全ON）
                      </button>
                    </div>
                    <OverlaySettings
                      ref={overlaySettingsRef}
                      embedded
                      config={config}
                      onConfigChange={replaceConfig}
                    />
                  </div>
                )}
                <div className="test-panel-status">
                  <span className="test-panel-hp-readout" title="メインゲージの現在値">
                    HP {currentHP.toLocaleString()} / {maxHP.toLocaleString()}
                  </span>
                  <span className="test-panel-hint">
                    {isTestMode
                      ? '攻撃・回復・全員全回復は長押しで連打できます。'
                      : '「設定」で「テストモードを有効にする」にチェックすると操作できます。'}
                  </span>
                </div>
                <div className="test-panel-actions">
                  <div className="test-panel-group">
                    <span className="test-panel-group-label">ダメージ・回復</span>
                    <div className="test-panel-btn-row">
                      <button
                        type="button"
                        className="test-button test-attack test-panel-action-btn"
                        disabled={!isTestMode || currentHP <= 0}
                        onPointerDown={(e) => {
                          e.preventDefault()
                          if (isTestMode && currentHP > 0) startRepeat(triggerAttack, 200)
                        }}
                        onPointerUp={stopRepeat}
                        onPointerLeave={stopRepeat}
                        onPointerCancel={stopRepeat}
                        title="長押しで連打"
                      >
                        攻撃
                      </button>
                      <button
                        type="button"
                        className="test-button test-heal test-panel-action-btn"
                        disabled={!isTestMode || currentHP <= 0}
                        onPointerDown={(e) => {
                          e.preventDefault()
                          if (isTestMode && currentHP > 0) startRepeat(triggerHeal, 200)
                        }}
                        onPointerUp={stopRepeat}
                        onPointerLeave={stopRepeat}
                        onPointerCancel={stopRepeat}
                        title="長押しで連打"
                      >
                        回復
                      </button>
                      <button
                        type="button"
                        className="test-button test-attack test-panel-action-btn"
                        disabled={!isTestMode || currentHP <= 0 || !(config?.pvp?.viewerFinishingMoveEnabled ?? true)}
                        onClick={handleTestFinishingMove}
                        title="必殺技を確定発動（隠し機能の確認用）"
                      >
                        必殺
                      </button>
                    </div>
                  </div>
                  <div className="test-panel-group">
                    <span className="test-panel-group-label">リセット・バフ</span>
                    <div className="test-panel-btn-row">
                      <button
                        type="button"
                        onClick={triggerReset}
                        className="test-button test-reset test-panel-action-btn"
                        disabled={!isTestMode || currentHP >= maxHP}
                        title="メインゲージを全回復"
                      >
                        全回復
                      </button>
                      <button
                        type="button"
                        className="test-button test-reset test-panel-action-btn"
                        disabled={!isTestMode}
                        onPointerDown={(e) => {
                          e.preventDefault()
                          if (!isTestMode) return
                          const triggerResetAll = () => {
                            if (!config) return
                            resetStreamerHp()
                            getViewerUserIds().forEach((id) => setViewerHP(id, viewerMaxHP))
                            if (config.heal.effectEnabled) showHealEffect()
                            if (config.retry.soundEnabled) playRetrySound()
                          }
                          startRepeat(triggerResetAll, 200)
                        }}
                        onPointerUp={stopRepeat}
                        onPointerLeave={stopRepeat}
                        onPointerCancel={stopRepeat}
                        title="視聴者ゲージも含め全員・長押しで連打"
                      >
                        全員回復
                      </button>
                      <button
                        type="button"
                        className="test-button test-strength test-panel-action-btn"
                        disabled={!isTestMode}
                        onClick={handleTestStrengthBuff}
                        title="ストレングスバフを付与"
                      >
                        バフ
                      </button>
                    </div>
                  </div>
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
                  startTop: testPanelSize.top,
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
                  startTop: testPanelSize.top,
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
                  startTop: testPanelSize.top,
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
                  startTop: testPanelSize.top,
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

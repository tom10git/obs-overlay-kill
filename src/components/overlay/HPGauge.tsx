/**
 * HPゲージメインコンポーネント
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { HPGaugeLayer } from './HPGaugeLayer'
import { HPDisplay } from './HPDisplay'
import { getCssEasing } from '../../utils/animation'
import type { OverlayConfig } from '../../types/overlay'
import './HPGauge.css'
import { useSound } from '../../hooks/useSound'

interface HPGaugeProps {
  currentHP: number
  maxHP: number
  gaugeCount: number
  config: OverlayConfig
  /** バフが有効なユーザーIDのリスト（個人用バフ） */
  buffedUserIds?: string[]
  /** 全員用バフが有効かどうか */
  isAllBuffed?: boolean
  /** ユーザーIDから表示名へのマッピング */
  userIdToDisplayName?: Map<string, string>
  /** 全員用バフの残り時間（秒） */
  allBuffRemainingSeconds?: number
  /** 個人用バフの残り時間（ユーザーID → 残り秒数） */
  buffRemainingSecondsMap?: Map<string, number>
}

/**
 * ゲージの色を決定
 */
function getGaugeColor(index: number, gaugeColors: OverlayConfig['gaugeColors']): string {
  // 仕様:
  // - 「最後の1ゲージ（HPが最後に残る分）」がlastGauge
  // - 2ゲージ目がsecondGauge
  // - 3ゲージ目以降はpatternColor1とpatternColor2を交互に使用
  //
  // index: 0が最下層（最後に残る分）, total-1が最上層（最初に減る分）
  if (index === 0) return gaugeColors.lastGauge // 最後に残る1ゲージ
  if (index === 1) return gaugeColors.secondGauge // 2ゲージ目
  // 3ゲージ目以降（index 2以上）は交互に色を設定
  // index 2, 4, 6, 8... → patternColor1
  // index 3, 5, 7, 9... → patternColor2
  return (index - 2) % 2 === 0 ? gaugeColors.patternColor1 : gaugeColors.patternColor2
}

/**
 * 各ゲージレイヤーの表示割合を計算
 * 現在のHPを「ゲージ単位」で表現し、下から順に満タンにしていく
 * 例：HP=100、ゲージ数=3、現在HP=70の場合
 *   - 1ゲージあたり = 33.33...
 *   - 現在HP = 70 = 2.1ゲージ分
 *   - 下から2ゲージは100%満タン、最上層のゲージは10%満タン
 */
function calculateGaugePercentage(
  currentHP: number,
  maxHP: number,
  gaugeIndex: number,
  gaugeCount: number
): number {
  if (maxHP === 0 || currentHP <= 0) return 0

  // 1ゲージあたりのHP量
  const hpPerGauge = maxHP / gaugeCount

  // 現在のHPが何ゲージ分に相当するか
  const currentHPInGauges = currentHP / hpPerGauge

  // 完全に満タンなゲージ数（下から数える）
  const fullGauges = Math.floor(currentHPInGauges)

  // 端数の割合（0.0 ～ 1.0）
  const remainder = currentHPInGauges - fullGauges

  // ゲージインデックス: 0が最下層、gaugeCount-1が最上層
  // このゲージが完全に満タンなゲージより下にある場合
  if (gaugeIndex < fullGauges) {
    return 100
  }

  // このゲージが完全に満タンなゲージと同じ位置にある場合（端数分だけ満タン）
  if (gaugeIndex === fullGauges) {
    return Math.max(0, Math.min(100, remainder * 100))
  }

  // このゲージが完全に満タンなゲージより上にある場合（空）
  return 0
}

export function HPGauge({
  currentHP,
  maxHP,
  gaugeCount,
  config,
  buffedUserIds = [],
  isAllBuffed = false,
  userIdToDisplayName = new Map(),
  allBuffRemainingSeconds,
  buffRemainingSecondsMap = new Map(),
}: HPGaugeProps) {
  // 各ゲージレイヤーを生成（上から順に減るように計算）
  const gaugeLayers = useMemo(() => {
    const layers = []
    for (let i = 0; i < gaugeCount; i++) {
      const color = getGaugeColor(i, config.gaugeColors)
      // ゲージインデックス: 0が最下層（最後に残る分）、gaugeCount-1が最上層（最初に減る分）
      // z-index: 高いほど上に表示（最上層が最前面）
      const zIndex = i + 1
      // このゲージの表示割合を計算（上から順に減る）
      const percentage = calculateGaugePercentage(
        currentHP,
        maxHP,
        i,
        gaugeCount
      )

      layers.push({
        id: `gauge-${i}`,
        color,
        zIndex,
        percentage,
      })
    }
    return layers
  }, [currentHP, maxHP, gaugeCount, config.gaugeColors])

  // メモ化: アニメーション設定とURLは頻繁に変わらないためメモ化
  const easing = useMemo(() => getCssEasing(config.animation.easing), [config.animation.easing])
  const zeroHpImageUrl = useMemo(
    () => config.zeroHpImage.imageUrl.trim(),
    [config.zeroHpImage.imageUrl]
  )
  const zeroHpSoundUrl = useMemo(
    () => config.zeroHpSound.soundUrl.trim(),
    [config.zeroHpSound.soundUrl]
  )

  const { play: playZeroHpSound } = useSound({
    src: zeroHpSoundUrl,
    enabled: config.zeroHpSound.enabled,
    volume: config.zeroHpSound.volume,
  })

  const prevHPRef = useRef(currentHP)
  const [showZeroHpImage, setShowZeroHpImage] = useState(false)
  const [showZeroHpEffect, setShowZeroHpEffect] = useState(false)
  const effectTimerRef = useRef<number | null>(null)
  const imageTimerRef = useRef<number | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // 動画URLを取得（メモ化）
  const zeroHpEffectVideoUrl = useMemo(
    () => config.zeroHpEffect.videoUrl.trim(),
    [config.zeroHpEffect.videoUrl]
  )

  // HPが0になった瞬間を検出して画像とエフェクトを表示（連打中でも確実に検出）
  useEffect(() => {
    // 検出ロジックの前に前回のHP値を保存
    const prevHP = prevHPRef.current
    const isZeroNow = currentHP <= 0
    const wasZeroBefore = prevHP <= 0
    const isFullRecovery = prevHP <= 0 && currentHP > 0 // 全回復時を検出

    // 全回復時（0から最大HPに変化）にprevHPRefを確実に更新
    // これにより、その後の攻撃でHPが0になったときに確実に検出できる
    if (isFullRecovery) {
      prevHPRef.current = currentHP
      // 全回復時は画像とエフェクトを非表示にする
      setShowZeroHpImage(false)
      setShowZeroHpEffect(false)
      // 動画を停止
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.currentTime = 0
      }
      // タイマーをクリア
      if (effectTimerRef.current) {
        window.clearTimeout(effectTimerRef.current)
        effectTimerRef.current = null
      }
      if (imageTimerRef.current) {
        window.clearTimeout(imageTimerRef.current)
        imageTimerRef.current = null
      }
      return // 早期リターンで、下の検出ロジックをスキップ
    }

    // HPが0になった瞬間を厳密に検出（前回 > 0 かつ 今回 <= 0）
    // 連続攻撃でも確実に検出するため、prevHP > 0 の条件を厳密にチェック
    // 全回復後も確実に検出できるように、prevHPが0より大きいことを確認
    if (prevHP > 0 && isZeroNow) {
      // エフェクト（透過WebM動画）を先に表示
      if (config.zeroHpEffect.enabled && zeroHpEffectVideoUrl.length > 0) {
        // 既存のタイマーをクリア（連続攻撃時の重複を防ぐ）
        if (effectTimerRef.current) {
          window.clearTimeout(effectTimerRef.current)
          effectTimerRef.current = null
        }
        // 動画を確実に最初から再生
        setShowZeroHpEffect(true)
        // 次のフレームで動画をリセットして再生（DOM更新を待つ）
        requestAnimationFrame(() => {
          if (videoRef.current) {
            const video = videoRef.current
            video.currentTime = 0 // 確実に最初に戻す

            // 動画の読み込み状態を確認してから再生
            const tryPlay = () => {
              if (video.readyState >= 2) {
                // データが読み込まれている場合は即座に再生
                video.play().catch((error) => {
                  console.warn('動画の再生に失敗しました:', error)
                  // 再生に失敗した場合、少し待ってからリトライ
                  setTimeout(() => {
                    video.load() // 動画を再読み込み
                    video.play().catch((err) => {
                      console.warn('動画の再生リトライに失敗しました:', err)
                    })
                  }, 100)
                })
              } else {
                // データがまだ読み込まれていない場合、読み込みを待つ
                const onLoadedData = () => {
                  video.play().catch((error) => {
                    console.warn('動画の再生に失敗しました:', error)
                  })
                  video.removeEventListener('loadeddata', onLoadedData)
                }
                video.addEventListener('loadeddata', onLoadedData)
                video.load() // 動画を明示的に読み込む
              }
            }

            tryPlay()
          }
          // 表示後にタイマーを設定（指定時間後に非表示）
          effectTimerRef.current = window.setTimeout(() => {
            setShowZeroHpEffect(false)
            if (videoRef.current) {
              videoRef.current.pause()
            }
            effectTimerRef.current = null
          }, Math.max(100, config.zeroHpEffect.duration))
        })
      }
      // 画像を少し遅延させて表示（エフェクトより後に表示）
      if (config.zeroHpImage.enabled && zeroHpImageUrl.length > 0) {
        // 既存のタイマーをクリア
        if (imageTimerRef.current) {
          window.clearTimeout(imageTimerRef.current)
          imageTimerRef.current = null
        }
        // エフェクトを先に表示するため、画像の表示を少し遅延させる
        imageTimerRef.current = window.setTimeout(() => {
          setShowZeroHpImage(true)
          imageTimerRef.current = null
        }, 300) // 300ms遅延
      }
      if (config.zeroHpSound.enabled) {
        playZeroHpSound()
      }
    }
    // HPが0より大きくなったら画像とエフェクトを非表示
    else if (wasZeroBefore && !isZeroNow) {
      setShowZeroHpImage(false)
      setShowZeroHpEffect(false)
      // 動画を停止
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.currentTime = 0
      }
      // タイマーをクリア
      if (effectTimerRef.current) {
        window.clearTimeout(effectTimerRef.current)
        effectTimerRef.current = null
      }
      if (imageTimerRef.current) {
        window.clearTimeout(imageTimerRef.current)
        imageTimerRef.current = null
      }
    }

    // prevHPRefを更新（検出ロジックの後に更新することで、次のレンダリングサイクルで正しく検出できる）
    // 全回復時（0から最大HPに変化）も確実に更新される
    // 全回復時は、wasZeroBefore && !isZeroNow の条件で処理されるが、
    // その後に確実にprevHPRefを更新することで、その後の攻撃でHPが0になったときに検出できる
    // デバッグ: prevHPRefの更新を確認
    const prevHPBeforeUpdate = prevHPRef.current
    prevHPRef.current = currentHP
    // HPが0になった瞬間を検出した場合、デバッグログを出力
    if (prevHPBeforeUpdate > 0 && currentHP <= 0) {
      console.log(`[HP0検出] prevHP: ${prevHPBeforeUpdate} -> currentHP: ${currentHP}, エフェクト表示: ${config.zeroHpEffect.enabled && zeroHpEffectVideoUrl.length > 0}`)
    }
  }, [
    currentHP,
    config.zeroHpImage.enabled,
    config.zeroHpEffect.enabled,
    config.zeroHpEffect.duration,
    config.zeroHpSound.enabled,
    playZeroHpSound,
    zeroHpImageUrl,
    zeroHpEffectVideoUrl,
  ])

  // クリーンアップ（コンポーネントのアンマウント時のみ実行）
  useEffect(() => {
    return () => {
      // タイマーをクリア
      if (effectTimerRef.current) {
        window.clearTimeout(effectTimerRef.current)
        effectTimerRef.current = null
      }
      if (imageTimerRef.current) {
        window.clearTimeout(imageTimerRef.current)
        imageTimerRef.current = null
      }
      // 動画を停止（srcを削除しない - ブラウザが自動的にメモリを管理する）
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.currentTime = 0
        // 注意: video.src = '' と video.load() は実行しない
        // これらを実行すると動画が削除され、再生できなくなる
      }
    }
  }, [])

  return (
    <div
      className="hp-gauge-container"
      style={{
        position: 'fixed',
        left: `calc(50% + ${config.hp.x}px)`,
        top: `calc(50% + ${config.hp.y}px)`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        className="hp-gauge-frame"
        style={{
          maxWidth: `${config.hp.width}px`,
          height: `${config.hp.height}px`,
        }}
      >
        <div className="hp-gauge-wrapper">
          {gaugeLayers.map((layer) => (
            <HPGaugeLayer
              key={layer.id}
              percentage={layer.percentage}
              color={layer.color}
              zIndex={layer.zIndex}
              animationDuration={config.animation.duration}
              easing={easing}
            />
          ))}
          <HPDisplay
            current={currentHP}
            max={maxHP}
            fontSize={config.display.fontSize}
            showMaxHp={config.display.showMaxHp}
          />
        </div>
        <div
          className="hp-gauge-zero-image"
          style={{ display: config.zeroHpImage.enabled && showZeroHpImage && zeroHpImageUrl.length > 0 ? 'flex' : 'none' }}
        >
          <img src={zeroHpImageUrl} alt="KO" />
        </div>
      </div>
      <div
        className="hp-gauge-zero-effect"
        style={{ display: config.zeroHpEffect.enabled && showZeroHpEffect && zeroHpEffectVideoUrl.length > 0 ? 'flex' : 'none' }}
      >
        <video
          ref={videoRef}
          src={zeroHpEffectVideoUrl}
          loop={false}
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
      {/* バフ表示 */}
      {(isAllBuffed || buffedUserIds.length > 0) && config.pvp?.enabled && (
        <div className="hp-gauge-buff-indicator">
          {isAllBuffed ? (
            // 全員用バフ：絵文字アイコン + カウントダウン
            <>
              <span className="hp-gauge-buff-label">ユーザーバフ：</span>
              <span className="hp-gauge-buff-emoji">💪</span>
              {allBuffRemainingSeconds !== undefined && allBuffRemainingSeconds > 0 && (
                <span className="hp-gauge-buff-timer">
                  {Math.floor(allBuffRemainingSeconds / 60)}:{(Math.floor(allBuffRemainingSeconds % 60)).toString().padStart(2, '0')}
                </span>
              )}
            </>
          ) : (
            // 個人用バフ：ラベル + アイコン + 個人名 + カウントダウン
            <>
              <span className="hp-gauge-buff-label">ユーザーバフ：</span>
              <span className="hp-gauge-buff-emoji">💪</span>
              <span className="hp-gauge-buff-users">
                {buffedUserIds
                  .map((userId) => userIdToDisplayName.get(userId) || userId)
                  .slice(0, 5)
                  .join(', ')}
                {buffedUserIds.length > 5 && ` +${buffedUserIds.length - 5}`}
              </span>
              {buffedUserIds.length > 0 && buffRemainingSecondsMap.size > 0 && (
                <span className="hp-gauge-buff-timer">
                  {(() => {
                    // 最初のユーザーの残り時間を表示
                    const firstUserId = buffedUserIds[0]
                    const remaining = buffRemainingSecondsMap.get(firstUserId)
                    if (remaining !== undefined && remaining > 0) {
                      return `${Math.floor(remaining / 60)}:${(Math.floor(remaining % 60)).toString().padStart(2, '0')}`
                    }
                    return ''
                  })()}
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

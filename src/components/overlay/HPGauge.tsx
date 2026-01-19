/**
 * HPゲージメインコンポーネント
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { HPGaugeLayer } from './HPGaugeLayer'
import { HPDisplay } from './HPDisplay'
import { getCssEasing } from '../../utils/animation'
import type { OverlayConfig } from '../../types/overlay'
import './HPGauge.css'
import defaultOtsuImage from '../../images/otsu.png'
import defaultExplosionSound from '../../sounds/爆発1.mp3'
import { useSound } from '../../hooks/useSound'

interface HPGaugeProps {
  currentHP: number
  maxHP: number
  gaugeCount: number
  config: OverlayConfig
}

/**
 * ゲージの色を決定
 */
function getGaugeColor(index: number): string {
  // 仕様:
  // - 「最後の1ゲージ（HPが最後に残る分）」が赤
  // - 2ゲージ目がオレンジ
  // - 3ゲージ目以降は緑/水色を交互（3ゲージ目=緑）
  //
  // index: 0が最下層（最後に残る分）, total-1が最上層（最初に減る分）
  if (index === 0) return '#FF0000' // 最後に残る1ゲージ = 赤
  if (index === 1) return '#FFA500' // 2ゲージ目 = オレンジ
  // 3ゲージ目以降（緑→紫、青は全回復ボタンの色に合わせる）
  return (index - 2) % 2 === 0 ? '#8000FF' : '#4aa3ff'
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
}: HPGaugeProps) {
  // 各ゲージレイヤーを生成（上から順に減るように計算）
  const gaugeLayers = useMemo(() => {
    const layers = []
    for (let i = 0; i < gaugeCount; i++) {
      const color = getGaugeColor(i)
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
  }, [currentHP, maxHP, gaugeCount])

  const easing = getCssEasing(config.animation.easing)
  const zeroHpImageUrl =
    config.zeroHpImage.imageUrl.trim().length > 0
      ? config.zeroHpImage.imageUrl
      : defaultOtsuImage
  const zeroHpSoundUrl =
    config.zeroHpSound.soundUrl.trim().length > 0
      ? config.zeroHpSound.soundUrl
      : defaultExplosionSound

  const { play: playZeroHpSound } = useSound({
    src: zeroHpSoundUrl,
    enabled: config.zeroHpSound.enabled,
    volume: config.zeroHpSound.volume,
  })

  const prevHPRef = useRef(currentHP)
  const [showZeroHpImage, setShowZeroHpImage] = useState(false)

  // HPが0になった瞬間を検出して画像を表示（連打中でも確実に検出）
  useEffect(() => {
    const prevHP = prevHPRef.current
    const isZeroNow = currentHP <= 0
    const wasZeroBefore = prevHP <= 0

    // HPが0になった瞬間（前回 > 0 で今回 <= 0）
    if (!wasZeroBefore && isZeroNow) {
      if (config.zeroHpImage.enabled) {
        setShowZeroHpImage(true)
      }
      if (config.zeroHpSound.enabled) {
        playZeroHpSound()
      }
    }
    // HPが0より大きくなったら画像を非表示
    else if (wasZeroBefore && !isZeroNow) {
      setShowZeroHpImage(false)
    }

    prevHPRef.current = currentHP
  }, [currentHP, config.zeroHpImage.enabled, config.zeroHpSound.enabled, playZeroHpSound])

  return (
    <div className="hp-gauge-container">
      <div className="hp-gauge-frame">
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
          />
        </div>
        {config.zeroHpImage.enabled && showZeroHpImage && (
          <div className="hp-gauge-zero-image">
            <img src={zeroHpImageUrl} alt="KO" />
          </div>
        )}
      </div>
    </div>
  )
}

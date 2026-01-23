/**
 * オーバーレイ設定UIコンポーネント
 */

import { useState, useEffect } from 'react'
import { loadOverlayConfig, saveOverlayConfig, getDefaultConfig } from '../../utils/overlayConfig'
import { isValidUrl } from '../../utils/security'
import type { OverlayConfig } from '../../types/overlay'
import './OverlaySettings.css'

export function OverlaySettings() {
  const [config, setConfig] = useState<OverlayConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    hp: true,
    attack: true,
    heal: true,
    retry: true,
    animation: true,
    display: true,
    zeroHpImage: true,
    zeroHpSound: true,
    zeroHpEffect: true,
    test: true,
  })
  const [showAttackRewardId, setShowAttackRewardId] = useState(false)
  const [showHealRewardId, setShowHealRewardId] = useState(false)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true)
        const loadedConfig = await loadOverlayConfig()
        setConfig(loadedConfig)
      } catch (error) {
        console.error('❌ 設定の読み込みに失敗しました', error)
        setConfig(getDefaultConfig())
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [])

  const handleSave = async () => {
    if (!config) return

    try {
      setSaving(true)
      setMessage(null)
      const success = await saveOverlayConfig(config)
      if (success) {
        if (import.meta.env.DEV) {
          const message = '✅ 設定をJSONファイルに保存しました\n\n保存先: public/config/overlay-config.json'
          setMessage('✅ 設定をJSONファイルに保存しました（public/config/overlay-config.json）')
          alert(message)
        } else {
          const message = '✅ 設定をJSONファイルとしてダウンロードしました\n\nダウンロードしたファイルを public/config/overlay-config.json に保存してください'
          setMessage('✅ 設定をJSONファイルとしてダウンロードしました。public/config/overlay-config.json に保存してください')
          alert(message)
        }
      } else {
        const errorMessage = '❌ 設定の保存に失敗しました'
        setMessage(errorMessage)
        alert(errorMessage)
      }
    } catch (error) {
      const errorMessage = '❌ 設定の保存中にエラーが発生しました'
      setMessage(errorMessage)
      console.error('❌ 設定の保存に失敗しました', error)
      alert(errorMessage)
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 5000)
    }
  }

  const handleReset = () => {
    if (confirm('設定をデフォルト値にリセットしますか？')) {
      setConfig(getDefaultConfig())
    }
  }

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }))
  }

  if (loading || !config) {
    return <div className="overlay-settings loading">読み込み中...</div>
  }

  return (
    <div className="overlay-settings">
      <h2>OBS Overlay 設定</h2>

      {message && (
        <div className={`settings-message ${saving ? 'saving' : ''}`}>
          {message}
        </div>
      )}

      <div className="settings-section">
        <h3 className="settings-section-header" onClick={() => toggleSection('hp')}>
          <span className="accordion-icon">{expandedSections.hp ? '▼' : '▶'}</span>
          HP設定
        </h3>
        {expandedSections.hp && (
          <div className="settings-section-content">
            <div className="settings-row">
              <label>
                最大HP:
                <input
                  type="text"
                  value={config.hp.max}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      hp: { ...config.hp, max: parseInt(e.target.value) || 100 },
                    })
                  }
                />
              </label>
              <label>
                現在のHP:
                <input
                  type="text"
                  value={config.hp.current}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      hp: {
                        ...config.hp,
                        current: Math.min(
                          parseInt(e.target.value) || 0,
                          config.hp.max
                        ),
                      },
                    })
                  }
                />
              </label>
              <label>
                ゲージ数:
                <input
                  type="text"
                  value={config.hp.gaugeCount}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      hp: {
                        ...config.hp,
                        gaugeCount: parseInt(e.target.value) || 3,
                      },
                    })
                  }
                />
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3 className="settings-section-header" onClick={() => toggleSection('attack')}>
          <span className="accordion-icon">{expandedSections.attack ? '▼' : '▶'}</span>
          攻撃設定
        </h3>
        {expandedSections.attack && (
          <div className="settings-section-content">
            <div className="settings-row">
              <label>
                リワードID:
                <div className="password-input-wrapper">
                  <input
                    type={showAttackRewardId ? 'text' : 'password'}
                    value={config.attack.rewardId}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        attack: { ...config.attack, rewardId: e.target.value },
                      })
                    }
                    placeholder="チャンネルポイントリワードID"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowAttackRewardId(!showAttackRewardId)}
                    title={showAttackRewardId ? '非表示' : '表示'}
                  >
                    {showAttackRewardId ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    )}
                  </button>
                </div>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.attack.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      attack: { ...config.attack, enabled: e.target.checked },
                    })
                  }
                />
                有効
              </label>
            </div>
            <div className="settings-row">
              <label>
                カスタムテキスト（App Access Token用）:
                <input
                  type="text"
                  value={config.attack.customText}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      attack: { ...config.attack, customText: e.target.value },
                    })
                  }
                  placeholder="チャットメッセージに含まれるテキスト（例: !attack）"
                />
              </label>
            </div>
            <div className="settings-hint">
              <p>
                <strong>カスタムテキストについて:</strong>
              </p>
              <ul>
                <li>App Access Tokenでも使用できるように、チャットメッセージで判定するテキストを設定できます</li>
                <li>リワードIDとカスタムテキストのどちらかが一致すれば攻撃として判定されます</li>
                <li>カスタムテキストが空欄の場合は、リワードIDのみで判定します</li>
              </ul>
            </div>
            <div className="settings-row">
              <label>
                ダメージ:
                <input
                  type="text"
                  value={config.attack.damage}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      attack: {
                        ...config.attack,
                        damage: parseInt(e.target.value) || 10,
                      },
                    })
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.attack.missEnabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      attack: { ...config.attack, missEnabled: e.target.checked },
                    })
                  }
                />
                ミス判定を有効にする
              </label>
              {config.attack.missEnabled && (
                <label>
                  ミス確率 (%):
                  <input
                    type="text"
                    value={config.attack.missProbability}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        attack: {
                          ...config.attack,
                          missProbability: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                  />
                </label>
              )}
            </div>
            <div className="settings-row">
              <label>
                <input
                  type="checkbox"
                  checked={config.attack.criticalEnabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      attack: { ...config.attack, criticalEnabled: e.target.checked },
                    })
                  }
                />
                クリティカル判定を有効にする
              </label>
              {config.attack.criticalEnabled && (
                <>
                  <label>
                    クリティカル確率 (%):
                    <input
                      type="text"
                      value={config.attack.criticalProbability}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          attack: {
                            ...config.attack,
                            criticalProbability: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    クリティカル倍率:
                    <input
                      type="text"
                      value={config.attack.criticalMultiplier}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          attack: {
                            ...config.attack,
                            criticalMultiplier: parseFloat(e.target.value) || 2.0,
                          },
                        })
                      }
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3 className="settings-section-header" onClick={() => toggleSection('heal')}>
          <span className="accordion-icon">{expandedSections.heal ? '▼' : '▶'}</span>
          回復設定
        </h3>
        {expandedSections.heal && (
          <div className="settings-section-content">
            <div className="settings-row">
              <label>
                リワードID:
                <div className="password-input-wrapper">
                  <input
                    type={showHealRewardId ? 'text' : 'password'}
                    value={config.heal.rewardId}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        heal: { ...config.heal, rewardId: e.target.value },
                      })
                    }
                    placeholder="チャンネルポイントリワードID"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowHealRewardId(!showHealRewardId)}
                    title={showHealRewardId ? '非表示' : '表示'}
                  >
                    {showHealRewardId ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    )}
                  </button>
                </div>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.heal.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      heal: { ...config.heal, enabled: e.target.checked },
                    })
                  }
                />
                有効
              </label>
            </div>
            <div className="settings-row">
              <label>
                カスタムテキスト（App Access Token用）:
                <input
                  type="text"
                  value={config.heal.customText}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      heal: { ...config.heal, customText: e.target.value },
                    })
                  }
                  placeholder="チャットメッセージに含まれるテキスト（例: !heal）"
                />
              </label>
            </div>
            <div className="settings-hint">
              <p>
                <strong>カスタムテキストについて:</strong>
              </p>
              <ul>
                <li>App Access Tokenでも使用できるように、チャットメッセージで判定するテキストを設定できます</li>
                <li>リワードIDとカスタムテキストのどちらかが一致すれば回復として判定されます</li>
                <li>カスタムテキストが空欄の場合は、リワードIDのみで判定します</li>
              </ul>
            </div>
            <div className="settings-row">
              <label>
                回復タイプ:
                <select
                  value={config.heal.healType}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      heal: {
                        ...config.heal,
                        healType: e.target.value as 'fixed' | 'random',
                      },
                    })
                  }
                >
                  <option value="fixed">固定</option>
                  <option value="random">ランダム</option>
                </select>
              </label>
              {config.heal.healType === 'fixed' ? (
                <label>
                  回復量:
                  <input
                    type="text"
                    value={config.heal.healAmount}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        heal: {
                          ...config.heal,
                          healAmount: parseInt(e.target.value) || 20,
                        },
                      })
                    }
                  />
                </label>
              ) : (
                <>
                  <label>
                    最小回復量:
                    <input
                      type="text"
                      value={config.heal.healMin}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          heal: {
                            ...config.heal,
                            healMin: parseInt(e.target.value) || 10,
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    最大回復量:
                    <input
                      type="text"
                      value={config.heal.healMax}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          heal: {
                            ...config.heal,
                            healMax: parseInt(e.target.value) || 30,
                          },
                        })
                      }
                    />
                  </label>
                </>
              )}
            </div>
            <div className="settings-row">
              <label>
                <input
                  type="checkbox"
                  checked={config.heal.effectEnabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      heal: { ...config.heal, effectEnabled: e.target.checked },
                    })
                  }
                />
                回復エフェクトを表示
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3 className="settings-section-header" onClick={() => toggleSection('retry')}>
          <span className="accordion-icon">{expandedSections.retry ? '▼' : '▶'}</span>
          リトライ設定
        </h3>
        {expandedSections.retry && (
          <div className="settings-section-content">
            <div className="settings-row">
              <label>
                コマンド:
                <input
                  type="text"
                  value={config.retry.command}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      retry: { ...config.retry, command: e.target.value },
                    })
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.retry.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      retry: { ...config.retry, enabled: e.target.checked },
                    })
                  }
                />
                有効
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3 className="settings-section-header" onClick={() => toggleSection('animation')}>
          <span className="accordion-icon">{expandedSections.animation ? '▼' : '▶'}</span>
          HPゲージ アニメーション設定
        </h3>
        {expandedSections.animation && (
          <div className="settings-section-content">
            <div className="settings-row">
              <label>
                アニメーション時間 (ms):
                <input
                  type="text"
                  value={config.animation.duration}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      animation: {
                        ...config.animation,
                        duration: parseInt(e.target.value) || 500,
                      },
                    })
                  }
                />
              </label>
              <label>
                イージング:
                <select
                  value={config.animation.easing}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      animation: {
                        ...config.animation,
                        easing: e.target.value,
                      },
                    })
                  }
                >
                  <option value="linear">linear</option>
                  <option value="ease-in">ease-in</option>
                  <option value="ease-out">ease-out</option>
                  <option value="ease-in-out">ease-in-out</option>
                  <option value="cubic-bezier">cubic-bezier</option>
                </select>
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3 className="settings-section-header" onClick={() => toggleSection('display')}>
          <span className="accordion-icon">{expandedSections.display ? '▼' : '▶'}</span>
          HP表示設定
        </h3>
        {expandedSections.display && (
          <div className="settings-section-content">
            <div className="settings-row">
              <label>
                <input
                  type="checkbox"
                  checked={config.display.showMaxHp}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      display: {
                        ...config.display,
                        showMaxHp: e.target.checked,
                      },
                    })
                  }
                />
                最大HPを表示
              </label>
              <label>
                フォントサイズ:
                <input
                  type="text"
                  value={config.display.fontSize}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      display: {
                        ...config.display,
                        fontSize: parseInt(e.target.value) || 24,
                      },
                    })
                  }
                />
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3 className="settings-section-header" onClick={() => toggleSection('zeroHpImage')}>
          <span className="accordion-icon">{expandedSections.zeroHpImage ? '▼' : '▶'}</span>
          HP0画像設定
        </h3>
        {expandedSections.zeroHpImage && (
          <div className="settings-section-content">
            <div className="settings-row">
              <label>
                <input
                  type="checkbox"
                  checked={config.zeroHpImage.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      zeroHpImage: { ...config.zeroHpImage, enabled: e.target.checked },
                    })
                  }
                />
                HPが0になったら画像を表示
              </label>
            </div>
            <div className="settings-row">
              <label>
                画像URL:
                <input
                  type="text"
                  value={config.zeroHpImage.imageUrl}
                  onChange={(e) => {
                    const url = e.target.value
                    if (isValidUrl(url)) {
                      setConfig({
                        ...config,
                        zeroHpImage: { ...config.zeroHpImage, imageUrl: url },
                      })
                    } else {
                      setMessage('無効なURLです。http://、https://、または相対パスを入力してください。')
                      setTimeout(() => setMessage(null), 3000)
                    }
                  }}
                  placeholder="空欄の場合は otsu.png を使用"
                />
              </label>
            </div>
            <p className="settings-hint">
              例: <code>src/images/custom.png</code>（public/images に配置）または{' '}
              <code>https://...</code>
            </p>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3 className="settings-section-header" onClick={() => toggleSection('zeroHpSound')}>
          <span className="accordion-icon">{expandedSections.zeroHpSound ? '▼' : '▶'}</span>
          HP0効果音設定
        </h3>
        {expandedSections.zeroHpSound && (
          <div className="settings-section-content">
            <div className="settings-row">
              <label>
                <input
                  type="checkbox"
                  checked={config.zeroHpSound.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      zeroHpSound: { ...config.zeroHpSound, enabled: e.target.checked },
                    })
                  }
                />
                HPが0になったら効果音を再生
              </label>
            </div>
            <div className="settings-row">
              <label>
                効果音URL:
                <input
                  type="text"
                  value={config.zeroHpSound.soundUrl}
                  onChange={(e) => {
                    const url = e.target.value
                    if (isValidUrl(url)) {
                      setConfig({
                        ...config,
                        zeroHpSound: { ...config.zeroHpSound, soundUrl: url },
                      })
                    } else {
                      setMessage('無効なURLです。http://、https://、または相対パスを入力してください。')
                      setTimeout(() => setMessage(null), 3000)
                    }
                  }}
                  placeholder="空欄の場合は 爆発1.mp3 を使用"
                />
              </label>
            </div>
            <div className="settings-row">
              <label>
                音量:
                <input
                  type="text"
                  value={config.zeroHpSound.volume}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      zeroHpSound: {
                        ...config.zeroHpSound,
                        volume: Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)),
                      },
                    })
                  }
                />
              </label>
            </div>
            <p className="settings-hint">
              例: <code>src/sounds/custom.mp3</code>（public/sounds に配置）または{' '}
              <code>https://...</code>
            </p>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3 className="settings-section-header" onClick={() => toggleSection('zeroHpEffect')}>
          <span className="accordion-icon">{expandedSections.zeroHpEffect ? '▼' : '▶'}</span>
          HP0エフェクト設定（WebM）
        </h3>
        {expandedSections.zeroHpEffect && (
          <div className="settings-section-content">
            <div className="settings-row">
              <label>
                <input
                  type="checkbox"
                  checked={config.zeroHpEffect.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      zeroHpEffect: { ...config.zeroHpEffect, enabled: e.target.checked },
                    })
                  }
                />
                HPが0になったら動画エフェクトを表示
              </label>
            </div>
            <div className="settings-row">
              <label>
                動画 URL（透過WebM推奨）:
                <input
                  type="text"
                  value={config.zeroHpEffect.videoUrl}
                  onChange={(e) => {
                    const url = e.target.value
                    if (isValidUrl(url)) {
                      setConfig({
                        ...config,
                        zeroHpEffect: { ...config.zeroHpEffect, videoUrl: url },
                      })
                    } else {
                      setMessage('無効なURLです。http://、https://、または相対パスを入力してください。')
                      setTimeout(() => setMessage(null), 3000)
                    }
                  }}
                  placeholder="空欄の場合は src/images/bakuhatsu.webm を使用"
                />
              </label>
            </div>
            <div className="settings-row">
              <label>
                表示時間（ミリ秒）:
                <input
                  type="text"
                  value={config.zeroHpEffect.duration}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      zeroHpEffect: {
                        ...config.zeroHpEffect,
                        duration: Math.max(100, parseInt(e.target.value) || 2000),
                      },
                    })
                  }
                />
              </label>
            </div>
            <p className="settings-hint">
              例: <code>src/images/bakuhatsu.gif</code>（public/images に配置）または{' '}
              <code>https://...</code>
            </p>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3 className="settings-section-header" onClick={() => toggleSection('test')}>
          <span className="accordion-icon">{expandedSections.test ? '▼' : '▶'}</span>
          テストモード設定
        </h3>
        {expandedSections.test && (
          <div className="settings-section-content">
            <div className="settings-row">
              <label>
                <input
                  type="checkbox"
                  checked={config.test.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      test: { ...config.test, enabled: e.target.checked },
                    })
                  }
                />
                テストモードを有効にする
              </label>
              {config.test.enabled && (
                <label>長押しで連打できます（ショートカットは廃止）</label>
              )}
            </div>
            {config.test.enabled && (
              <div className="settings-hint">
                <p>
                  <strong>テストモードについて:</strong>
                </p>
                <ul>
                  <li>
                    テストモードでは、実際のTwitchチャンネルポイントAPIを使用せずに動作を確認できます
                  </li>
                  <li>
                    アフィリエイト未参加の配信者でも、このモードでテストできます
                  </li>
                  <li>
                    ボタンは長押しで連打できます
                  </li>
                  <li>
                    開発環境では、画面右下にテストボタンが表示されます
                  </li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="settings-actions">
        <button onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '設定を保存'}
        </button>
        <button onClick={handleReset}>リセット</button>
      </div>

      <div className="settings-info">
        <p>
          <strong>設定の保存方法:</strong>
        </p>
        <ul>
          <li>
            <strong>開発環境:</strong> 「設定を保存」ボタンをクリックすると、自動的に <code>public/config/overlay-config.json</code> に保存されます
          </li>
          <li>
            <strong>本番環境:</strong> 「設定を保存」ボタンをクリックすると、JSONファイルがダウンロードされます。ダウンロードしたファイルを <code>public/config/overlay-config.json</code> に配置してください
          </li>
          <li>
            <strong>設定の読み込み優先順位:</strong> ローカルストレージ → JSONファイル → デフォルト設定
          </li>
        </ul>
        <p>
          <strong>ブラウザウィンドウキャプチャーの設定:</strong>
        </p>
        <ul>
          <li>URL: <code>http://localhost:5173/overlay</code>（開発環境）をブラウザで開く</li>
          <li>OBSで「ウィンドウキャプチャー」ソースを追加</li>
          <li>キャプチャーするウィンドウ: 上記URLを開いたブラウザウィンドウを選択</li>
          <li>幅: 1920px（推奨）</li>
          <li>高さ: 1080px（推奨）</li>
        </ul>
      </div>
    </div>
  )
}

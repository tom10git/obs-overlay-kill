/**
 * オーバーレイ設定UIコンポーネント
 */

import { useState, useEffect, useRef } from 'react'
import { loadOverlayConfig, loadOverlayConfigFromFile, saveOverlayConfig, getDefaultConfig, validateAndSanitizeConfig } from '../../utils/overlayConfig'
import { isValidUrl } from '../../utils/security'
import type { OverlayConfig } from '../../types/overlay'
import './OverlaySettings.css'

export function OverlaySettings() {
  const [config, setConfig] = useState<OverlayConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    hp: false,
    attack: false,
    heal: false,
    retry: false,
    pvp: false,
    animation: false,
    display: false,
    zeroHpImage: false,
    zeroHpSound: false,
    zeroHpEffect: false,
    test: false,
    externalWindow: false,
    gaugeColors: false,
    damageColors: false,
  })
  const [activeTab, setActiveTab] = useState<'streamer' | 'user' | 'autoReply'>('streamer')
  const [autoReplySubTab, setAutoReplySubTab] = useState<'streamer' | 'viewer'>('streamer')
  const [showAttackRewardId, setShowAttackRewardId] = useState(false)
  const [showHealRewardId, setShowHealRewardId] = useState(false)
  // 入力中の値を文字列として保持（空文字列を許可するため）
  const [inputValues, setInputValues] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null) // ファイル選択用のinput要素の参照

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true)
        const loadedConfig = await loadOverlayConfig()
        setConfig(loadedConfig)
        // 設定が読み込まれたら、入力値を初期化
        setInputValues({})
      } catch (error) {
        console.error('❌ 設定の読み込みに失敗しました', error)
        setConfig(getDefaultConfig())
        setInputValues({})
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

  const [loadingFromFile, setLoadingFromFile] = useState(false)
  /** JSONファイルから設定を再読み込み（ローカルストレージを無視） */
  const handleLoadFromFile = async () => {
    try {
      setLoadingFromFile(true)
      setMessage(null)
      const loadedConfig = await loadOverlayConfigFromFile()
      setConfig(loadedConfig)
      setInputValues({})
      setMessage('JSONファイルから設定を読み込みました')
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('JSONファイルの読み込みに失敗しました', error)
      setMessage('❌ JSONファイルの読み込みに失敗しました')
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setLoadingFromFile(false)
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
      <header className="overlay-settings-header">
        <h2>OBS Overlay 設定</h2>
        <p className="overlay-settings-desc">HPゲージ・攻撃・回復・PvP・アニメーションなど、オーバーレイの動作を設定します。</p>
      </header>

      {message && (
        <div className={`settings-message ${saving ? 'saving' : ''}`}>
          {message}
        </div>
      )}

      <div className="settings-tabs">
        <button
          type="button"
          className={`settings-tab ${activeTab === 'streamer' ? 'settings-tab-active' : ''}`}
          onClick={() => setActiveTab('streamer')}
        >
          配信者側
        </button>
        <button
          type="button"
          className={`settings-tab ${activeTab === 'user' ? 'settings-tab-active' : ''}`}
          onClick={() => setActiveTab('user')}
        >
          ユーザー側
        </button>
        <button
          type="button"
          className={`settings-tab ${activeTab === 'autoReply' ? 'settings-tab-active' : ''}`}
          onClick={() => setActiveTab('autoReply')}
        >
          自動返信設定
        </button>
      </div>

      {activeTab === 'streamer' && (
        <div className="settings-tab-panel">
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
                      value={inputValues['hp.max'] ?? String(config.hp.max)}
                      onChange={(e) => {
                        const value = e.target.value
                        setInputValues((prev) => ({ ...prev, 'hp.max': value }))
                      }}
                      onBlur={(e) => {
                        const value = e.target.value.trim()
                        if (value === '' || isNaN(parseInt(value))) {
                          setConfig({
                            ...config,
                            hp: { ...config.hp, max: 100 },
                          })
                          setInputValues((prev) => {
                            const next = { ...prev }
                            delete next['hp.max']
                            return next
                          })
                        } else {
                          const num = parseInt(value)
                          if (!isNaN(num)) {
                            setConfig({
                              ...config,
                              hp: { ...config.hp, max: num },
                            })
                            setInputValues((prev) => {
                              const next = { ...prev }
                              delete next['hp.max']
                              return next
                            })
                          }
                        }
                      }}
                    />
                  </label>
                  <label>
                    現在のHP:
                    <input
                      type="text"
                      value={inputValues['hp.current'] ?? String(config.hp.current)}
                      onChange={(e) => {
                        const value = e.target.value
                        setInputValues((prev) => ({ ...prev, 'hp.current': value }))
                      }}
                      onBlur={(e) => {
                        const value = e.target.value.trim()
                        if (value === '' || isNaN(parseInt(value))) {
                          setConfig({
                            ...config,
                            hp: { ...config.hp, current: 0 },
                          })
                          setInputValues((prev) => {
                            const next = { ...prev }
                            delete next['hp.current']
                            return next
                          })
                        } else {
                          const num = parseInt(value)
                          if (!isNaN(num)) {
                            setConfig({
                              ...config,
                              hp: {
                                ...config.hp,
                                current: Math.min(num, config.hp.max),
                              },
                            })
                            setInputValues((prev) => {
                              const next = { ...prev }
                              delete next['hp.current']
                              return next
                            })
                          }
                        }
                      }}
                    />
                  </label>
                  <label>
                    ゲージ数:
                    <input
                      type="text"
                      value={inputValues['hp.gaugeCount'] ?? String(config.hp.gaugeCount)}
                      onChange={(e) => {
                        const value = e.target.value
                        setInputValues((prev) => ({ ...prev, 'hp.gaugeCount': value }))
                      }}
                      onBlur={(e) => {
                        const value = e.target.value.trim()
                        if (value === '' || isNaN(parseInt(value))) {
                          setConfig({
                            ...config,
                            hp: { ...config.hp, gaugeCount: 3 },
                          })
                          setInputValues((prev) => {
                            const next = { ...prev }
                            delete next['hp.gaugeCount']
                            return next
                          })
                        } else {
                          const num = parseInt(value)
                          if (!isNaN(num)) {
                            setConfig({
                              ...config,
                              hp: { ...config.hp, gaugeCount: num },
                            })
                            setInputValues((prev) => {
                              const next = { ...prev }
                              delete next['hp.gaugeCount']
                              return next
                            })
                          }
                        }
                      }}
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
                    ダメージタイプ:
                    <select
                      value={config.attack.damageType ?? 'fixed'}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          attack: { ...config.attack, damageType: e.target.value as 'fixed' | 'random' },
                        })
                      }
                    >
                      <option value="fixed">固定</option>
                      <option value="random">ランダム</option>
                    </select>
                  </label>
                  {config.attack.damageType === 'random' ? (
                    <>
                      <label>
                        ダメージ（最小）:
                        <input
                          type="text"
                          inputMode="numeric"
                          value={inputValues['attack.damageMin'] ?? String(config.attack.damageMin ?? 5)}
                          onChange={(e) => setInputValues((prev) => ({ ...prev, 'attack.damageMin': e.target.value }))}
                          onBlur={(e) => {
                            const value = e.target.value.trim()
                            const num = value === '' ? 5 : parseInt(value, 10)
                            if (!isNaN(num) && num >= 1) {
                              setConfig((prev) => prev ? { ...prev, attack: { ...prev.attack, damageMin: num } } : prev)
                              setInputValues((prev) => { const next = { ...prev }; delete next['attack.damageMin']; return next })
                            }
                          }}
                        />
                      </label>
                      <label>
                        ダメージ（最大）:
                        <input
                          type="text"
                          inputMode="numeric"
                          value={inputValues['attack.damageMax'] ?? String(config.attack.damageMax ?? 15)}
                          onChange={(e) => setInputValues((prev) => ({ ...prev, 'attack.damageMax': e.target.value }))}
                          onBlur={(e) => {
                            const value = e.target.value.trim()
                            const num = value === '' ? 15 : parseInt(value, 10)
                            if (!isNaN(num) && num >= 1) {
                              setConfig((prev) => prev ? { ...prev, attack: { ...prev.attack, damageMax: num } } : prev)
                              setInputValues((prev) => { const next = { ...prev }; delete next['attack.damageMax']; return next })
                            }
                          }}
                        />
                      </label>
                      <label>
                        刻み（50・100など。1のときは最小～最大の連続値）:
                        <input
                          type="text"
                          inputMode="numeric"
                          value={inputValues['attack.damageRandomStep'] ?? String(config.attack.damageRandomStep ?? 1)}
                          onChange={(e) => setInputValues((prev) => ({ ...prev, 'attack.damageRandomStep': e.target.value }))}
                          onBlur={(e) => {
                            const value = e.target.value.trim()
                            const num = value === '' ? 1 : parseInt(value, 10)
                            if (!isNaN(num) && num >= 1) {
                              setConfig((prev) => prev ? { ...prev, attack: { ...prev.attack, damageRandomStep: num } } : prev)
                              setInputValues((prev) => { const next = { ...prev }; delete next['attack.damageRandomStep']; return next })
                            }
                          }}
                        />
                      </label>
                    </>
                  ) : (
                    <label>
                      ダメージ:
                      <input
                        type="text"
                        inputMode="numeric"
                        value={inputValues['attack.damage'] ?? String(config.attack.damage)}
                        onChange={(e) => setInputValues((prev) => ({ ...prev, 'attack.damage': e.target.value }))}
                        onBlur={(e) => {
                          const value = e.target.value.trim()
                          if (value === '' || isNaN(parseInt(value))) {
                            setConfig({ ...config, attack: { ...config.attack, damage: 10 } })
                            setInputValues((prev) => { const next = { ...prev }; delete next['attack.damage']; return next })
                          } else {
                            const num = parseInt(value, 10)
                            if (!isNaN(num) && num >= 1) {
                              setConfig((prev) => prev ? { ...prev, attack: { ...prev.attack, damage: num } } : prev)
                              setInputValues((prev) => { const next = { ...prev }; delete next['attack.damage']; return next })
                            }
                          }
                        }}
                      />
                    </label>
                  )}
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
                        value={inputValues['attack.missProbability'] ?? String(config.attack.missProbability)}
                        onChange={(e) => {
                          setInputValues((prev) => ({ ...prev, 'attack.missProbability': e.target.value }))
                        }}
                        onBlur={(e) => {
                          const value = e.target.value.trim()
                          if (value === '' || isNaN(parseFloat(value))) {
                            setConfig({
                              ...config,
                              attack: { ...config.attack, missProbability: 0 },
                            })
                            setInputValues((prev) => {
                              const next = { ...prev }
                              delete next['attack.missProbability']
                              return next
                            })
                          } else {
                            const num = parseFloat(value)
                            if (!isNaN(num)) {
                              setConfig({
                                ...config,
                                attack: { ...config.attack, missProbability: num },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['attack.missProbability']
                                return next
                              })
                            }
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
                {config.attack.missEnabled && (
                  <div className="settings-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={config.attack.missSoundEnabled}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            attack: { ...config.attack, missSoundEnabled: e.target.checked },
                          })
                        }
                      />
                      ミス効果音を有効にする
                    </label>
                  </div>
                )}
                {config.attack.missEnabled && config.attack.missSoundEnabled && (
                  <div className="settings-row">
                    <label>
                      効果音URL:
                      <input
                        type="text"
                        value={config.attack.missSoundUrl}
                        onChange={(e) => {
                          const url = e.target.value
                          if (isValidUrl(url)) {
                            setConfig({
                              ...config,
                              attack: { ...config.attack, missSoundUrl: url },
                            })
                          } else {
                            setMessage('無効なURLです。http://、https://、または相対パスを入力してください。')
                            setTimeout(() => setMessage(null), 3000)
                          }
                        }}
                        placeholder="空欄の場合は効果音なし"
                      />
                    </label>
                    <label>
                      音量:
                      <input
                        type="text"
                        value={inputValues['attack.missSoundVolume'] ?? String(config.attack.missSoundVolume)}
                        onChange={(e) => {
                          setInputValues((prev) => ({ ...prev, 'attack.missSoundVolume': e.target.value }))
                        }}
                        onBlur={(e) => {
                          const value = e.target.value.trim()
                          if (value === '' || isNaN(parseFloat(value))) {
                            setConfig({
                              ...config,
                              attack: { ...config.attack, missSoundVolume: 0.7 },
                            })
                            setInputValues((prev) => {
                              const next = { ...prev }
                              delete next['attack.missSoundVolume']
                              return next
                            })
                          } else {
                            const num = parseFloat(value)
                            if (!isNaN(num)) {
                              setConfig({
                                ...config,
                                attack: { ...config.attack, missSoundVolume: Math.min(1, Math.max(0, num)) },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['attack.missSoundVolume']
                                return next
                              })
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
                {config.attack.missEnabled && config.attack.missSoundEnabled && (
                  <p className="settings-hint">
                    例: <code>src/sounds/miss.mp3</code>（public/sounds に配置）または{' '}
                    <code>https://...</code>
                  </p>
                )}
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
                          value={inputValues['attack.criticalProbability'] ?? String(config.attack.criticalProbability)}
                          onChange={(e) => {
                            setInputValues((prev) => ({ ...prev, 'attack.criticalProbability': e.target.value }))
                          }}
                          onBlur={(e) => {
                            const value = e.target.value.trim()
                            if (value === '' || isNaN(parseFloat(value))) {
                              setConfig({
                                ...config,
                                attack: { ...config.attack, criticalProbability: 0 },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['attack.criticalProbability']
                                return next
                              })
                            } else {
                              const num = parseFloat(value)
                              if (!isNaN(num)) {
                                setConfig({
                                  ...config,
                                  attack: { ...config.attack, criticalProbability: num },
                                })
                                setInputValues((prev) => {
                                  const next = { ...prev }
                                  delete next['attack.criticalProbability']
                                  return next
                                })
                              }
                            }
                          }}
                        />
                      </label>
                      <label>
                        クリティカル倍率:
                        <input
                          type="text"
                          value={inputValues['attack.criticalMultiplier'] ?? String(config.attack.criticalMultiplier)}
                          onChange={(e) => {
                            setInputValues((prev) => ({ ...prev, 'attack.criticalMultiplier': e.target.value }))
                          }}
                          onBlur={(e) => {
                            const value = e.target.value.trim()
                            if (value === '' || isNaN(parseFloat(value))) {
                              setConfig({
                                ...config,
                                attack: { ...config.attack, criticalMultiplier: 2.0 },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['attack.criticalMultiplier']
                                return next
                              })
                            } else {
                              const num = parseFloat(value)
                              if (!isNaN(num)) {
                                setConfig({
                                  ...config,
                                  attack: { ...config.attack, criticalMultiplier: num },
                                })
                                setInputValues((prev) => {
                                  const next = { ...prev }
                                  delete next['attack.criticalMultiplier']
                                  return next
                                })
                              }
                            }
                          }}
                        />
                      </label>
                    </>
                  )}
                </div>
                <div className="settings-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={config.attack.bleedEnabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          attack: { ...config.attack, bleedEnabled: e.target.checked },
                        })
                      }
                    />
                    出血ダメージを有効にする
                  </label>
                  {config.attack.bleedEnabled && (
                    <>
                      <label>
                        出血確率 (%):
                        <input
                          type="text"
                          value={inputValues['attack.bleedProbability'] ?? String(config.attack.bleedProbability)}
                          onChange={(e) => {
                            setInputValues((prev) => ({ ...prev, 'attack.bleedProbability': e.target.value }))
                          }}
                          onBlur={(e) => {
                            const value = e.target.value.trim()
                            if (value === '' || isNaN(parseFloat(value))) {
                              setConfig({
                                ...config,
                                attack: { ...config.attack, bleedProbability: 0 },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['attack.bleedProbability']
                                return next
                              })
                            } else {
                              const num = parseFloat(value)
                              if (!isNaN(num)) {
                                setConfig({
                                  ...config,
                                  attack: { ...config.attack, bleedProbability: Math.min(100, Math.max(0, num)) },
                                })
                                setInputValues((prev) => {
                                  const next = { ...prev }
                                  delete next['attack.bleedProbability']
                                  return next
                                })
                              }
                            }
                          }}
                        />
                      </label>
                      <label>
                        出血ダメージ:
                        <input
                          type="text"
                          value={inputValues['attack.bleedDamage'] ?? String(config.attack.bleedDamage)}
                          onChange={(e) => {
                            setInputValues((prev) => ({ ...prev, 'attack.bleedDamage': e.target.value }))
                          }}
                          onBlur={(e) => {
                            const value = e.target.value.trim()
                            if (value === '' || isNaN(parseInt(value))) {
                              setConfig({
                                ...config,
                                attack: { ...config.attack, bleedDamage: 5 },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['attack.bleedDamage']
                                return next
                              })
                            } else {
                              const num = parseInt(value)
                              if (!isNaN(num)) {
                                setConfig({
                                  ...config,
                                  attack: { ...config.attack, bleedDamage: num },
                                })
                                setInputValues((prev) => {
                                  const next = { ...prev }
                                  delete next['attack.bleedDamage']
                                  return next
                                })
                              }
                            }
                          }}
                        />
                      </label>
                      <label>
                        持続時間 (秒):
                        <input
                          type="text"
                          value={inputValues['attack.bleedDuration'] ?? String(config.attack.bleedDuration)}
                          onChange={(e) => {
                            setInputValues((prev) => ({ ...prev, 'attack.bleedDuration': e.target.value }))
                          }}
                          onBlur={(e) => {
                            const value = e.target.value.trim()
                            if (value === '' || isNaN(parseInt(value))) {
                              setConfig({
                                ...config,
                                attack: { ...config.attack, bleedDuration: 10 },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['attack.bleedDuration']
                                return next
                              })
                            } else {
                              const num = parseInt(value)
                              if (!isNaN(num)) {
                                setConfig({
                                  ...config,
                                  attack: { ...config.attack, bleedDuration: num },
                                })
                                setInputValues((prev) => {
                                  const next = { ...prev }
                                  delete next['attack.bleedDuration']
                                  return next
                                })
                              }
                            }
                          }}
                        />
                      </label>
                      <label>
                        間隔 (秒):
                        <input
                          type="text"
                          value={inputValues['attack.bleedInterval'] ?? String(config.attack.bleedInterval)}
                          onChange={(e) => {
                            setInputValues((prev) => ({ ...prev, 'attack.bleedInterval': e.target.value }))
                          }}
                          onBlur={(e) => {
                            const value = e.target.value.trim()
                            if (value === '' || isNaN(parseFloat(value))) {
                              setConfig({
                                ...config,
                                attack: { ...config.attack, bleedInterval: 1 },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['attack.bleedInterval']
                                return next
                              })
                            } else {
                              const num = parseFloat(value)
                              if (!isNaN(num)) {
                                setConfig({
                                  ...config,
                                  attack: { ...config.attack, bleedInterval: Math.max(0.1, num) },
                                })
                                setInputValues((prev) => {
                                  const next = { ...prev }
                                  delete next['attack.bleedInterval']
                                  return next
                                })
                              }
                            }
                          }}
                        />
                      </label>
                    </>
                  )}
                </div>
                {config.attack.bleedEnabled && (
                  <div className="settings-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={config.attack.bleedSoundEnabled}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            attack: { ...config.attack, bleedSoundEnabled: e.target.checked },
                          })
                        }
                      />
                      出血ダメージ効果音を有効にする
                    </label>
                  </div>
                )}
                {config.attack.bleedEnabled && config.attack.bleedSoundEnabled && (
                  <div className="settings-row">
                    <label>
                      効果音URL:
                      <input
                        type="text"
                        value={config.attack.bleedSoundUrl}
                        onChange={(e) => {
                          const url = e.target.value
                          if (isValidUrl(url)) {
                            setConfig({
                              ...config,
                              attack: { ...config.attack, bleedSoundUrl: url },
                            })
                          } else {
                            setMessage('無効なURLです。http://、https://、または相対パスを入力してください。')
                            setTimeout(() => setMessage(null), 3000)
                          }
                        }}
                        placeholder="空欄の場合は効果音なし"
                      />
                    </label>
                    <label>
                      音量:
                      <input
                        type="text"
                        value={inputValues['attack.bleedSoundVolume'] ?? String(config.attack.bleedSoundVolume)}
                        onChange={(e) => {
                          setInputValues((prev) => ({ ...prev, 'attack.bleedSoundVolume': e.target.value }))
                        }}
                        onBlur={(e) => {
                          const value = e.target.value.trim()
                          if (value === '' || isNaN(parseFloat(value))) {
                            setConfig({
                              ...config,
                              attack: { ...config.attack, bleedSoundVolume: 0.7 },
                            })
                            setInputValues((prev) => {
                              const next = { ...prev }
                              delete next['attack.bleedSoundVolume']
                              return next
                            })
                          } else {
                            const num = parseFloat(value)
                            if (!isNaN(num)) {
                              setConfig({
                                ...config,
                                attack: { ...config.attack, bleedSoundVolume: Math.min(1, Math.max(0, num)) },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['attack.bleedSoundVolume']
                                return next
                              })
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
                {config.attack.bleedEnabled && config.attack.bleedSoundEnabled && (
                  <p className="settings-hint">
                    例: <code>src/sounds/bleed.mp3</code>（public/sounds に配置）または{' '}
                    <code>https://...</code>
                  </p>
                )}
                <div className="settings-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={config.attack.soundEnabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          attack: { ...config.attack, soundEnabled: e.target.checked },
                        })
                      }
                    />
                    攻撃効果音を有効にする
                  </label>
                </div>
                {config.attack.soundEnabled && (
                  <div className="settings-row">
                    <label>
                      効果音URL:
                      <input
                        type="text"
                        value={config.attack.soundUrl}
                        onChange={(e) => {
                          const url = e.target.value
                          if (isValidUrl(url)) {
                            setConfig({
                              ...config,
                              attack: { ...config.attack, soundUrl: url },
                            })
                          } else {
                            setMessage('無効なURLです。http://、https://、または相対パスを入力してください。')
                            setTimeout(() => setMessage(null), 3000)
                          }
                        }}
                        placeholder="空欄の場合は効果音なし"
                      />
                    </label>
                    <label>
                      音量:
                      <input
                        type="text"
                        value={inputValues['attack.soundVolume'] ?? String(config.attack.soundVolume)}
                        onChange={(e) => {
                          setInputValues((prev) => ({ ...prev, 'attack.soundVolume': e.target.value }))
                        }}
                        onBlur={(e) => {
                          const value = e.target.value.trim()
                          if (value === '' || isNaN(parseFloat(value))) {
                            setConfig({
                              ...config,
                              attack: { ...config.attack, soundVolume: 0.7 },
                            })
                            setInputValues((prev) => {
                              const next = { ...prev }
                              delete next['attack.soundVolume']
                              return next
                            })
                          } else {
                            const num = parseFloat(value)
                            if (!isNaN(num)) {
                              setConfig({
                                ...config,
                                attack: { ...config.attack, soundVolume: Math.min(1, Math.max(0, num)) },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['attack.soundVolume']
                                return next
                              })
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
                {config.attack.soundEnabled && (
                  <p className="settings-hint">
                    例: <code>src/sounds/attack.mp3</code>（public/sounds に配置）または{' '}
                    <code>https://...</code>
                  </p>
                )}
                <div className="settings-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={config.attack.filterEffectEnabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          attack: { ...config.attack, filterEffectEnabled: e.target.checked },
                        })
                      }
                    />
                    攻撃時のフィルターエフェクトを有効にする
                  </label>
                </div>
                <div className="settings-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={config.attack.survivalHp1Enabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          attack: { ...config.attack, survivalHp1Enabled: e.target.checked },
                        })
                      }
                    />
                    攻撃でHPが0になる場合に一定確率で1残す
                  </label>
                </div>
                {config.attack.survivalHp1Enabled && (
                  <>
                    <div className="settings-row">
                      <label>
                        HPが1残る確率（0-100）:
                        <input
                          type="text"
                          inputMode="numeric"
                          value={inputValues['attack.survivalHp1Probability'] ?? String(config.attack.survivalHp1Probability)}
                          onChange={(e) => {
                            setInputValues((prev) => ({ ...prev, 'attack.survivalHp1Probability': e.target.value }))
                          }}
                          onBlur={(e) => {
                            const value = e.target.value.trim()
                            if (value === '' || isNaN(parseInt(value))) {
                              setConfig({
                                ...config,
                                attack: { ...config.attack, survivalHp1Probability: 30 },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['attack.survivalHp1Probability']
                                return next
                              })
                            } else {
                              const num = parseInt(value)
                              if (!isNaN(num)) {
                                setConfig({
                                  ...config,
                                  attack: {
                                    ...config.attack,
                                    survivalHp1Probability: Math.min(100, Math.max(0, num)),
                                  },
                                })
                                setInputValues((prev) => {
                                  const next = { ...prev }
                                  delete next['attack.survivalHp1Probability']
                                  return next
                                })
                              }
                            }
                          }}
                        />
                      </label>
                    </div>
                    <div className="settings-row">
                      <label>
                        表示メッセージ:
                        <input
                          type="text"
                          value={config.attack.survivalHp1Message}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              attack: { ...config.attack, survivalHp1Message: e.target.value },
                            })
                          }
                          placeholder="食いしばり!"
                        />
                      </label>
                    </div>
                  </>
                )}
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
                        value={inputValues['heal.healAmount'] ?? String(config.heal.healAmount)}
                        onChange={(e) => {
                          setInputValues((prev) => ({ ...prev, 'heal.healAmount': e.target.value }))
                        }}
                        onBlur={(e) => {
                          const value = e.target.value.trim()
                          if (value === '' || isNaN(parseInt(value))) {
                            setConfig({
                              ...config,
                              heal: { ...config.heal, healAmount: 20 },
                            })
                            setInputValues((prev) => {
                              const next = { ...prev }
                              delete next['heal.healAmount']
                              return next
                            })
                          } else {
                            const num = parseInt(value)
                            if (!isNaN(num)) {
                              setConfig({
                                ...config,
                                heal: { ...config.heal, healAmount: num },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['heal.healAmount']
                                return next
                              })
                            }
                          }
                        }}
                      />
                    </label>
                  ) : (
                    <>
                      <label>
                        最小回復量:
                        <input
                          type="text"
                          value={inputValues['heal.healMin'] ?? String(config.heal.healMin)}
                          onChange={(e) => {
                            setInputValues((prev) => ({ ...prev, 'heal.healMin': e.target.value }))
                          }}
                          onBlur={(e) => {
                            const value = e.target.value.trim()
                            if (value === '' || isNaN(parseInt(value))) {
                              setConfig({
                                ...config,
                                heal: { ...config.heal, healMin: 10 },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['heal.healMin']
                                return next
                              })
                            } else {
                              const num = parseInt(value)
                              if (!isNaN(num)) {
                                setConfig({
                                  ...config,
                                  heal: { ...config.heal, healMin: num },
                                })
                                setInputValues((prev) => {
                                  const next = { ...prev }
                                  delete next['heal.healMin']
                                  return next
                                })
                              }
                            }
                          }}
                        />
                      </label>
                      <label>
                        最大回復量:
                        <input
                          type="text"
                          value={inputValues['heal.healMax'] ?? String(config.heal.healMax)}
                          onChange={(e) => {
                            setInputValues((prev) => ({ ...prev, 'heal.healMax': e.target.value }))
                          }}
                          onBlur={(e) => {
                            const value = e.target.value.trim()
                            if (value === '' || isNaN(parseInt(value))) {
                              setConfig({
                                ...config,
                                heal: { ...config.heal, healMax: 30 },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['heal.healMax']
                                return next
                              })
                            } else {
                              const num = parseInt(value)
                              if (!isNaN(num)) {
                                setConfig({
                                  ...config,
                                  heal: { ...config.heal, healMax: num },
                                })
                                setInputValues((prev) => {
                                  const next = { ...prev }
                                  delete next['heal.healMax']
                                  return next
                                })
                              }
                            }
                          }}
                        />
                      </label>
                      <label>
                        刻み（50・100など。1のときは最小～最大の連続値）:
                        <input
                          type="text"
                          inputMode="numeric"
                          value={inputValues['heal.healRandomStep'] ?? String(config.heal.healRandomStep ?? 1)}
                          onChange={(e) => setInputValues((prev) => ({ ...prev, 'heal.healRandomStep': e.target.value }))}
                          onBlur={(e) => {
                            const value = e.target.value.trim()
                            const num = value === '' ? 1 : parseInt(value, 10)
                            if (!isNaN(num) && num >= 1) {
                              setConfig({ ...config, heal: { ...config.heal, healRandomStep: num } })
                              setInputValues((prev) => { const next = { ...prev }; delete next['heal.healRandomStep']; return next })
                            }
                          }}
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
                <div className="settings-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={config.heal.healWhenZeroEnabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          heal: { ...config.heal, healWhenZeroEnabled: e.target.checked },
                        })
                      }
                    />
                    HPが0のときも通常回復を許可する
                  </label>
                </div>
                <div className="settings-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={config.heal.soundEnabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          heal: { ...config.heal, soundEnabled: e.target.checked },
                        })
                      }
                    />
                    回復効果音を有効にする
                  </label>
                </div>
                {config.heal.soundEnabled && (
                  <div className="settings-row">
                    <label>
                      効果音URL:
                      <input
                        type="text"
                        value={config.heal.soundUrl}
                        onChange={(e) => {
                          const url = e.target.value
                          if (isValidUrl(url)) {
                            setConfig({
                              ...config,
                              heal: { ...config.heal, soundUrl: url },
                            })
                          } else {
                            setMessage('無効なURLです。http://、https://、または相対パスを入力してください。')
                            setTimeout(() => setMessage(null), 3000)
                          }
                        }}
                        placeholder="空欄の場合は効果音なし"
                      />
                    </label>
                    <label>
                      音量:
                      <input
                        type="text"
                        value={inputValues['heal.soundVolume'] ?? String(config.heal.soundVolume)}
                        onChange={(e) => {
                          setInputValues((prev) => ({ ...prev, 'heal.soundVolume': e.target.value }))
                        }}
                        onBlur={(e) => {
                          const value = e.target.value.trim()
                          if (value === '' || isNaN(parseFloat(value))) {
                            setConfig({
                              ...config,
                              heal: { ...config.heal, soundVolume: 0.7 },
                            })
                            setInputValues((prev) => {
                              const next = { ...prev }
                              delete next['heal.soundVolume']
                              return next
                            })
                          } else {
                            const num = parseFloat(value)
                            if (!isNaN(num)) {
                              setConfig({
                                ...config,
                                heal: { ...config.heal, soundVolume: Math.min(1, Math.max(0, num)) },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['heal.soundVolume']
                                return next
                              })
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
                {config.heal.soundEnabled && (
                  <p className="settings-hint">
                    例: <code>src/sounds/heal.mp3</code>（public/sounds に配置）または{' '}
                    <code>https://...</code>
                  </p>
                )}
                <div className="settings-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={config.heal.filterEffectEnabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          heal: { ...config.heal, filterEffectEnabled: e.target.checked },
                        })
                      }
                    />
                    回復時のフィルターエフェクトを有効にする
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
                    リトライコマンド（HPが最大未満のとき最大まで回復）:
                    <input
                      type="text"
                      value={config.retry.command}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          retry: { ...config.retry, command: e.target.value },
                        })
                      }
                      placeholder="!retry"
                    />
                  </label>
                  <label>
                    全回復コマンド（配信者側・HPを常に最大まで回復）:
                    <input
                      type="text"
                      value={config.retry.fullHealCommand ?? '!fullheal'}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          retry: { ...config.retry, fullHealCommand: e.target.value },
                        })
                      }
                      placeholder="!fullheal"
                    />
                  </label>
                  <label>
                    全員全回復コマンド（配信者・全視聴者を最大HPに・配信者のみ実行可能）:
                    <input
                      type="text"
                      value={config.retry.fullResetAllCommand ?? '!resetall'}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          retry: { ...config.retry, fullResetAllCommand: e.target.value },
                        })
                      }
                      placeholder="!resetall"
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
                    コマンドを有効にする
                  </label>
                </div>
                <div className="settings-row" style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>
                  配信者側の通常回復（設定量だけ回復）
                </div>
                <div className="settings-row">
                  <label>
                    通常回復コマンド:
                    <input
                      type="text"
                      value={config.retry.streamerHealCommand ?? '!heal'}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          retry: { ...config.retry, streamerHealCommand: e.target.value },
                        })
                      }
                      placeholder="!heal"
                    />
                  </label>
                  <label>
                    回復量タイプ:
                    <select
                      value={config.retry.streamerHealType ?? 'fixed'}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          retry: { ...config.retry, streamerHealType: e.target.value as 'fixed' | 'random' },
                        })
                      }
                    >
                      <option value="fixed">固定</option>
                      <option value="random">ランダム</option>
                    </select>
                  </label>
                </div>
                <div className="settings-row">
                  {config.retry.streamerHealType === 'fixed' ? (
                    <label>
                      回復量:
                      <input
                        type="text"
                        inputMode="numeric"
                        value={inputValues['retry.streamerHealAmount'] ?? String(config.retry.streamerHealAmount ?? 20)}
                        onChange={(e) => setInputValues((prev) => ({ ...prev, 'retry.streamerHealAmount': e.target.value }))}
                        onBlur={(e) => {
                          const num = Number(e.target.value.trim())
                          setConfig({ ...config, retry: { ...config.retry, streamerHealAmount: (!isNaN(num) && num >= 1) ? num : 20 } })
                          setInputValues((prev) => { const next = { ...prev }; delete next['retry.streamerHealAmount']; return next })
                        }}
                      />
                    </label>
                  ) : (
                    <>
                      <label>
                        回復量（最小）:
                        <input
                          type="text"
                          inputMode="numeric"
                          value={inputValues['retry.streamerHealMin'] ?? String(config.retry.streamerHealMin ?? 10)}
                          onChange={(e) => setInputValues((prev) => ({ ...prev, 'retry.streamerHealMin': e.target.value }))}
                          onBlur={(e) => {
                            const num = Number(e.target.value.trim())
                            setConfig({ ...config, retry: { ...config.retry, streamerHealMin: (!isNaN(num) && num >= 1) ? num : 10 } })
                            setInputValues((prev) => { const next = { ...prev }; delete next['retry.streamerHealMin']; return next })
                          }}
                        />
                      </label>
                      <label>
                        回復量（最大）:
                        <input
                          type="text"
                          inputMode="numeric"
                          value={inputValues['retry.streamerHealMax'] ?? String(config.retry.streamerHealMax ?? 30)}
                          onChange={(e) => setInputValues((prev) => ({ ...prev, 'retry.streamerHealMax': e.target.value }))}
                          onBlur={(e) => {
                            const num = Number(e.target.value.trim())
                            setConfig({ ...config, retry: { ...config.retry, streamerHealMax: (!isNaN(num) && num >= 1) ? num : 30 } })
                            setInputValues((prev) => { const next = { ...prev }; delete next['retry.streamerHealMax']; return next })
                          }}
                        />
                      </label>
                      <label>
                        刻み（50・100など。1のときは最小～最大の連続値）:
                        <input
                          type="text"
                          inputMode="numeric"
                          value={inputValues['retry.streamerHealRandomStep'] ?? String(config.retry.streamerHealRandomStep ?? 1)}
                          onChange={(e) => setInputValues((prev) => ({ ...prev, 'retry.streamerHealRandomStep': e.target.value }))}
                          onBlur={(e) => {
                            const num = Number(e.target.value.trim())
                            setConfig({ ...config, retry: { ...config.retry, streamerHealRandomStep: (!isNaN(num) && num >= 1) ? Math.floor(num) : 1 } })
                            setInputValues((prev) => { const next = { ...prev }; delete next['retry.streamerHealRandomStep']; return next })
                          }}
                        />
                      </label>
                    </>
                  )}
                  <label>
                    <input
                      type="checkbox"
                      checked={config.retry.streamerHealWhenZeroEnabled ?? true}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          retry: { ...config.retry, streamerHealWhenZeroEnabled: e.target.checked },
                        })
                      }
                    />
                    HP0のときも通常回復を許可
                  </label>
                </div>
                <div className="settings-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={config.retry.soundEnabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          retry: { ...config.retry, soundEnabled: e.target.checked },
                        })
                      }
                    />
                    蘇生効果音を有効にする
                  </label>
                </div>
                {config.retry.soundEnabled && (
                  <div className="settings-row">
                    <label>
                      効果音URL:
                      <input
                        type="text"
                        value={config.retry.soundUrl}
                        onChange={(e) => {
                          const url = e.target.value
                          if (isValidUrl(url)) {
                            setConfig({
                              ...config,
                              retry: { ...config.retry, soundUrl: url },
                            })
                          } else {
                            setMessage('無効なURLです。http://、https://、または相対パスを入力してください。')
                            setTimeout(() => setMessage(null), 3000)
                          }
                        }}
                        placeholder="空欄の場合は効果音なし"
                      />
                    </label>
                    <label>
                      音量:
                      <input
                        type="text"
                        value={inputValues['retry.soundVolume'] ?? String(config.retry.soundVolume)}
                        onChange={(e) => {
                          setInputValues((prev) => ({ ...prev, 'retry.soundVolume': e.target.value }))
                        }}
                        onBlur={(e) => {
                          const value = e.target.value.trim()
                          if (value === '' || isNaN(parseFloat(value))) {
                            setConfig({
                              ...config,
                              retry: { ...config.retry, soundVolume: 0.7 },
                            })
                            setInputValues((prev) => {
                              const next = { ...prev }
                              delete next['retry.soundVolume']
                              return next
                            })
                          } else {
                            const num = parseFloat(value)
                            if (!isNaN(num)) {
                              setConfig({
                                ...config,
                                retry: { ...config.retry, soundVolume: Math.min(1, Math.max(0, num)) },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['retry.soundVolume']
                                return next
                              })
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
                {config.retry.soundEnabled && (
                  <p className="settings-hint">
                    例: <code>src/sounds/revive.mp3</code>（public/sounds に配置）または{' '}
                    <code>https://...</code>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'user' && (
        <div className="settings-tab-panel">
          <div className="settings-section">
            <h3 className="settings-section-header" onClick={() => toggleSection('pvp')}>
              <span className="accordion-icon">{expandedSections.pvp ? '▼' : '▶'}</span>
              PvPモード（配信者 vs 視聴者）
            </h3>
            {expandedSections.pvp && (
              <div className="settings-section-content">
                <div className="settings-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={config.pvp.enabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          pvp: { ...config.pvp, enabled: e.target.checked },
                        })
                      }
                    />
                    PvPモードを有効にする（視聴者ごとにHPを管理・ゲージは表示しない）
                  </label>
                </div>
                {config.pvp.enabled && (
                  <>
                    <div className="settings-row">
                      <label>
                        ユーザー側の最大HP:
                        <input
                          type="text"
                          inputMode="numeric"
                          value={inputValues['pvp.viewerMaxHp'] ?? String(config.pvp.viewerMaxHp ?? 100)}
                          onChange={(e) => {
                            const value = e.target.value
                            setInputValues((prev) => ({ ...prev, 'pvp.viewerMaxHp': value }))
                          }}
                          onBlur={(e) => {
                            const value = e.target.value.trim()
                            const num = value === '' ? 100 : parseInt(value, 10)
                            if (!isNaN(num) && num >= 1) {
                              setConfig((prev) => prev ? { ...prev, pvp: { ...prev.pvp, viewerMaxHp: num } } : prev)
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['pvp.viewerMaxHp']
                                return next
                              })
                            } else {
                              setConfig((prev) => prev ? { ...prev, pvp: { ...prev.pvp, viewerMaxHp: prev.pvp.viewerMaxHp ?? 100 } } : prev)
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['pvp.viewerMaxHp']
                                return next
                              })
                            }
                          }}
                        />
                      </label>
                    </div>
                  </>
                )}
                {config.pvp.enabled && (
                  <>
                    <div className="settings-row" style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>
                      カウンター対象の切り替え
                    </div>
                    <div className="settings-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={config.pvp.counterOnAttackTargetAttacker ?? true}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: { ...config.pvp, counterOnAttackTargetAttacker: e.target.checked },
                            })
                          }
                        />
                        攻撃したユーザーにカウンターする（初期設定・デフォルトON）
                      </label>
                    </div>
                    <div className="settings-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={config.pvp.counterOnAttackTargetRandom ?? false}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: { ...config.pvp, counterOnAttackTargetRandom: e.target.checked },
                            })
                          }
                        />
                        ランダムなユーザーにカウンターする（視聴者が攻撃したとき）
                      </label>
                    </div>
                    <div className="settings-row" style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>
                      視聴者攻撃時に配信者が回復（反転回復）
                    </div>
                    <div className="settings-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={config.pvp.streamerHealOnAttackEnabled ?? false}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: { ...config.pvp, streamerHealOnAttackEnabled: e.target.checked },
                            })
                          }
                        />
                        視聴者が攻撃したときに一定確率で配信者HPが回復する（攻撃が回復に反転）
                      </label>
                    </div>
                    {(config.pvp.streamerHealOnAttackEnabled ?? false) && (
                      <>
                        <div className="settings-row">
                          <label>
                            発生確率 (%):
                            <input
                              type="text"
                              inputMode="numeric"
                              value={inputValues['pvp.streamerHealOnAttackProbability'] ?? String(config.pvp.streamerHealOnAttackProbability ?? 10)}
                              onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.streamerHealOnAttackProbability': e.target.value }))}
                              onBlur={(e) => {
                                const num = Number(e.target.value.trim())
                                if (!isNaN(num) && num >= 0 && num <= 100) {
                                  setConfig({ ...config, pvp: { ...config.pvp, streamerHealOnAttackProbability: num } })
                                  setInputValues((prev) => { const next = { ...prev }; delete next['pvp.streamerHealOnAttackProbability']; return next })
                                }
                              }}
                            />
                          </label>
                          <label>
                            回復量タイプ:
                            <select
                              value={config.pvp.streamerHealOnAttackType ?? 'fixed'}
                              onChange={(e) =>
                                setConfig({ ...config, pvp: { ...config.pvp, streamerHealOnAttackType: e.target.value as 'fixed' | 'random' } })
                              }
                            >
                              <option value="fixed">固定</option>
                              <option value="random">ランダム</option>
                            </select>
                          </label>
                        </div>
                        <div className="settings-row">
                          {(config.pvp.streamerHealOnAttackType ?? 'fixed') === 'random' ? (
                            <>
                              <label>
                                回復量（最小）:
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={inputValues['pvp.streamerHealOnAttackMin'] ?? String(config.pvp.streamerHealOnAttackMin ?? 5)}
                                  onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.streamerHealOnAttackMin': e.target.value }))}
                                  onBlur={(e) => {
                                    const num = Number(e.target.value.trim())
                                    if (!isNaN(num) && num >= 1) {
                                      setConfig({ ...config, pvp: { ...config.pvp, streamerHealOnAttackMin: num } })
                                      setInputValues((prev) => { const next = { ...prev }; delete next['pvp.streamerHealOnAttackMin']; return next })
                                    }
                                  }}
                                />
                              </label>
                              <label>
                                回復量（最大）:
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={inputValues['pvp.streamerHealOnAttackMax'] ?? String(config.pvp.streamerHealOnAttackMax ?? 20)}
                                  onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.streamerHealOnAttackMax': e.target.value }))}
                                  onBlur={(e) => {
                                    const num = Number(e.target.value.trim())
                                    if (!isNaN(num) && num >= 1) {
                                      setConfig({ ...config, pvp: { ...config.pvp, streamerHealOnAttackMax: num } })
                                      setInputValues((prev) => { const next = { ...prev }; delete next['pvp.streamerHealOnAttackMax']; return next })
                                    }
                                  }}
                                />
                              </label>
                              <label>
                                刻み（1のときは最小～最大の連続値）:
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={inputValues['pvp.streamerHealOnAttackRandomStep'] ?? String(config.pvp.streamerHealOnAttackRandomStep ?? 1)}
                                  onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.streamerHealOnAttackRandomStep': e.target.value }))}
                                  onBlur={(e) => {
                                    const num = Number(e.target.value.trim())
                                    if (!isNaN(num) && num >= 1) {
                                      setConfig({ ...config, pvp: { ...config.pvp, streamerHealOnAttackRandomStep: num } })
                                      setInputValues((prev) => { const next = { ...prev }; delete next['pvp.streamerHealOnAttackRandomStep']; return next })
                                    }
                                  }}
                                />
                              </label>
                            </>
                          ) : (
                            <label>
                              回復量:
                              <input
                                type="text"
                                inputMode="numeric"
                                value={inputValues['pvp.streamerHealOnAttackAmount'] ?? String(config.pvp.streamerHealOnAttackAmount ?? 10)}
                                onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.streamerHealOnAttackAmount': e.target.value }))}
                                onBlur={(e) => {
                                  const num = Number(e.target.value.trim())
                                  if (!isNaN(num) && num >= 1) {
                                    setConfig({ ...config, pvp: { ...config.pvp, streamerHealOnAttackAmount: num } })
                                    setInputValues((prev) => { const next = { ...prev }; delete next['pvp.streamerHealOnAttackAmount']; return next })
                                  }
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </>
                    )}
                    <div className="settings-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={config.pvp.counterCommandAcceptsUsername ?? false}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: { ...config.pvp, counterCommandAcceptsUsername: e.target.checked },
                            })
                          }
                        />
                        カウンターコマンドでユーザー名を指定可能（!counter ユーザー名）
                      </label>
                    </div>
                    <div className="settings-row">
                      <label>
                        追加カウンターコマンド（任意・配信者のみ実行）:
                        <input
                          type="text"
                          value={config.pvp.counterCommand}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: { ...config.pvp, counterCommand: e.target.value },
                            })
                          }
                          placeholder="!counter"
                        />
                      </label>
                    </div>
                    <p className="settings-hint" style={{ marginTop: 0 }}>
                      視聴者が攻撃すると自動でカウンターされます。上記コマンドは「同じ視聴者に追加でダメージを与えたいとき」用です。ユーザー名指定ONのときは「!counter ユーザー名」でそのユーザーを攻撃できます。
                    </p>
                    <div className="settings-row">
                      <label>
                        攻撃モード（誰と攻撃し合うか）:
                        <select
                          value={config.pvp.attackMode ?? 'both'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: { ...config.pvp, attackMode: e.target.value as 'streamer_only' | 'both' },
                            })
                          }
                        >
                          <option value="streamer_only">配信者 vs 視聴者のみ（視聴者同士の攻撃なし）</option>
                          <option value="both">両方（配信者 vs 視聴者 ＋ 視聴者同士の攻撃）</option>
                        </select>
                      </label>
                    </div>
                    {(config.pvp.attackMode ?? 'both') === 'both' && (
                      <>
                        <div className="settings-row">
                          <label>
                            視聴者同士攻撃コマンド（例: !attack ユーザー名）:
                            <input
                              type="text"
                              value={config.pvp.viewerAttackViewerCommand ?? '!attack'}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  pvp: { ...config.pvp, viewerAttackViewerCommand: e.target.value },
                                })
                              }
                              placeholder="!attack"
                            />
                          </label>
                        </div>
                        <div className="settings-row">
                          <label>
                            視聴者同士攻撃のダメージタイプ:
                            <select
                              value={config.pvp.viewerVsViewerAttack?.damageType ?? 'fixed'}
                              onChange={(e) => {
                                const base = config.pvp.viewerVsViewerAttack ?? getDefaultConfig().pvp.viewerVsViewerAttack
                                setConfig({
                                  ...config,
                                  pvp: { ...config.pvp, viewerVsViewerAttack: { ...base, damageType: e.target.value as 'fixed' | 'random' } },
                                })
                              }}
                            >
                              <option value="fixed">固定</option>
                              <option value="random">ランダム</option>
                            </select>
                          </label>
                          {(config.pvp.viewerVsViewerAttack?.damageType ?? 'fixed') === 'random' ? (
                            <>
                              <label>
                                ダメージ（最小）:
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={inputValues['pvp.viewerVsViewerAttack.damageMin'] ?? String(config.pvp.viewerVsViewerAttack?.damageMin ?? 5)}
                                  onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.viewerVsViewerAttack.damageMin': e.target.value }))}
                                  onBlur={(e) => {
                                    const num = Number(e.target.value.trim())
                                    if (!isNaN(num) && num >= 1) {
                                      setConfig((prev) => prev ? { ...prev, pvp: { ...prev.pvp, viewerVsViewerAttack: { ...prev.pvp.viewerVsViewerAttack, damageMin: num } } } : prev)
                                      setInputValues((prev) => { const next = { ...prev }; delete next['pvp.viewerVsViewerAttack.damageMin']; return next })
                                    }
                                  }}
                                />
                              </label>
                              <label>
                                ダメージ（最大）:
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={inputValues['pvp.viewerVsViewerAttack.damageMax'] ?? String(config.pvp.viewerVsViewerAttack?.damageMax ?? 15)}
                                  onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.viewerVsViewerAttack.damageMax': e.target.value }))}
                                  onBlur={(e) => {
                                    const num = Number(e.target.value.trim())
                                    if (!isNaN(num) && num >= 1) {
                                      setConfig((prev) => prev ? { ...prev, pvp: { ...prev.pvp, viewerVsViewerAttack: { ...prev.pvp.viewerVsViewerAttack, damageMax: num } } } : prev)
                                      setInputValues((prev) => { const next = { ...prev }; delete next['pvp.viewerVsViewerAttack.damageMax']; return next })
                                    }
                                  }}
                                />
                              </label>
                              <label>
                                刻み（1のときは最小～最大の連続値）:
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={inputValues['pvp.viewerVsViewerAttack.damageRandomStep'] ?? String(config.pvp.viewerVsViewerAttack?.damageRandomStep ?? 1)}
                                  onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.viewerVsViewerAttack.damageRandomStep': e.target.value }))}
                                  onBlur={(e) => {
                                    const num = Number(e.target.value.trim())
                                    if (!isNaN(num) && num >= 1) {
                                      setConfig((prev) => prev ? { ...prev, pvp: { ...prev.pvp, viewerVsViewerAttack: { ...prev.pvp.viewerVsViewerAttack, damageRandomStep: num } } } : prev)
                                      setInputValues((prev) => { const next = { ...prev }; delete next['pvp.viewerVsViewerAttack.damageRandomStep']; return next })
                                    }
                                  }}
                                />
                              </label>
                            </>
                          ) : (
                            <label>
                              ダメージ（下限1、上限なし）:
                              <input
                                type="text"
                                inputMode="numeric"
                                value={inputValues['pvp.viewerVsViewerAttack.damage'] ?? String(config.pvp.viewerVsViewerAttack?.damage ?? 10)}
                                onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.viewerVsViewerAttack.damage': e.target.value }))}
                                onBlur={(e) => {
                                  const num = Number(e.target.value.trim())
                                  const base = config.pvp.viewerVsViewerAttack ?? getDefaultConfig().pvp.viewerVsViewerAttack
                                  setConfig({
                                    ...config,
                                    pvp: {
                                      ...config.pvp,
                                      viewerVsViewerAttack: { ...base, damage: (!isNaN(num) && num >= 1) ? num : 10 },
                                    },
                                  })
                                  setInputValues((prev) => { const next = { ...prev }; delete next['pvp.viewerVsViewerAttack.damage']; return next })
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </>
                    )}
                    <div className="settings-row">
                      <label>
                        HP確認コマンド（視聴者が自分の残りHPを確認）:
                        <input
                          type="text"
                          value={config.pvp.hpCheckCommand}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: { ...config.pvp, hpCheckCommand: e.target.value },
                            })
                          }
                          placeholder="!hp"
                        />
                      </label>
                    </div>
                    <div className="settings-row" style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>
                      ストレングスバフ設定
                    </div>
                    <div className="settings-row">
                      <label>
                        ストレングスバフコマンド（視聴者が実行するとストレングス効果を付与）:
                        <input
                          type="text"
                          value={config.pvp.strengthBuffCommand ?? '!strength'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: { ...config.pvp, strengthBuffCommand: e.target.value },
                            })
                          }
                          placeholder="!strength"
                        />
                      </label>
                    </div>
                    <div className="settings-row">
                      <label>
                        バフ確認コマンド（視聴者が自分のバフ状態を確認）:
                        <input
                          type="text"
                          value={config.pvp.strengthBuffCheckCommand ?? '!buff'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: { ...config.pvp, strengthBuffCheckCommand: e.target.value },
                            })
                          }
                          placeholder="!buff"
                        />
                      </label>
                    </div>
                    <div className="settings-row">
                      <label>
                        ストレングスバフの効果時間（秒）:
                        <input
                          type="text"
                          inputMode="numeric"
                          value={inputValues['pvp.strengthBuffDuration'] ?? String(config.pvp.strengthBuffDuration ?? 300)}
                          onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.strengthBuffDuration': e.target.value }))}
                          onBlur={(e) => {
                            const num = Number(e.target.value.trim())
                            setConfig({ ...config, pvp: { ...config.pvp, strengthBuffDuration: (!isNaN(num) && num >= 1) ? num : 300 } })
                            setInputValues((prev) => { const next = { ...prev }; delete next['pvp.strengthBuffDuration']; return next })
                          }}
                          placeholder="300"
                        />
                      </label>
                    </div>
                    <div className="settings-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={config.pvp.autoReplyStrengthBuff ?? true}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: { ...config.pvp, autoReplyStrengthBuff: e.target.checked },
                            })
                          }
                        />
                        ストレングスバフコマンド実行時の自動返信を有効にする
                      </label>
                    </div>
                    <div className="settings-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={config.pvp.autoReplyStrengthBuffCheck ?? true}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: { ...config.pvp, autoReplyStrengthBuffCheck: e.target.checked },
                            })
                          }
                        />
                        バフ確認コマンド実行時の自動返信を有効にする
                      </label>
                    </div>
                    <div className="settings-row">
                      <label>
                        ストレングスバフ有効時の自動返信メッセージ:
                        <input
                          type="text"
                          value={config.pvp.messageWhenStrengthBuffActivated ?? '{username} にストレングス効果を付与しました！（効果時間: {duration}秒）'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: { ...config.pvp, messageWhenStrengthBuffActivated: e.target.value },
                            })
                          }
                          placeholder="{username} にストレングス効果を付与しました！（効果時間: {duration}秒）"
                        />
                        <small style={{ display: 'block', marginTop: '4px', color: '#888' }}>
                          {'{username} で視聴者名、{duration} で効果時間（秒）に置換されます'}
                        </small>
                      </label>
                    </div>
                    <div className="settings-row">
                      <label>
                        バフ確認時の自動返信メッセージ:
                        <input
                          type="text"
                          value={config.pvp.messageWhenStrengthBuffCheck ?? '{username} のストレングス効果: 残り {remaining}秒 / 効果時間 {duration}秒'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: { ...config.pvp, messageWhenStrengthBuffCheck: e.target.value },
                            })
                          }
                          placeholder="{username} のストレングス効果: 残り {remaining}秒 / 効果時間 {duration}秒"
                        />
                        <small style={{ display: 'block', marginTop: '4px', color: '#888' }}>
                          {'{username} で視聴者名、{remaining} で残り時間（秒）、{duration} で効果時間（秒）に置換されます'}
                        </small>
                      </label>
                    </div>
                    <div className="settings-row" style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>
                      ストレングスバフ効果音設定
                    </div>
                    <div className="settings-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={config.pvp.strengthBuffSoundEnabled ?? false}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: { ...config.pvp, strengthBuffSoundEnabled: e.target.checked },
                            })
                          }
                        />
                        ストレングスバフ効果音を有効にする
                      </label>
                    </div>
                    {config.pvp.strengthBuffSoundEnabled && (
                      <>
                        <div className="settings-row">
                          <label>
                            効果音URL:
                            <input
                              type="text"
                              value={config.pvp.strengthBuffSoundUrl ?? ''}
                              onChange={(e) => {
                                const url = e.target.value
                                if (url === '' || isValidUrl(url)) {
                                  setConfig({
                                    ...config,
                                    pvp: { ...config.pvp, strengthBuffSoundUrl: url },
                                  })
                                  if (url && !isValidUrl(url)) {
                                    setMessage('無効なURLです。http://、https://、または相対パスを入力してください。')
                                    setTimeout(() => setMessage(null), 3000)
                                  }
                                } else {
                                  setMessage('無効なURLです。http://、https://、または相対パスを入力してください。')
                                  setTimeout(() => setMessage(null), 3000)
                                }
                              }}
                              placeholder="空欄の場合は効果音なし"
                            />
                          </label>
                          <label>
                            音量:
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={config.pvp.strengthBuffSoundVolume ?? 0.7}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  pvp: { ...config.pvp, strengthBuffSoundVolume: Number(e.target.value) },
                                })
                              }
                            />
                            <span style={{ marginLeft: '8px', minWidth: '40px', display: 'inline-block' }}>
                              {Math.round((config.pvp.strengthBuffSoundVolume ?? 0.7) * 100)}%
                            </span>
                          </label>
                        </div>
                      </>
                    )}
                    <div className="settings-row">
                      <label>
                        全回復コマンド（視聴者側・実行した視聴者のHPを最大まで回復）:
                        <input
                          type="text"
                          value={config.pvp.viewerFullHealCommand ?? '!fullheal'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: { ...config.pvp, viewerFullHealCommand: e.target.value },
                            })
                          }
                          placeholder="!fullheal"
                        />
                      </label>
                    </div>
                    <div className="settings-row" style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>
                      視聴者側の通常回復（設定量だけ回復）
                    </div>
                    <div className="settings-row">
                      <label>
                        通常回復コマンド:
                        <input
                          type="text"
                          value={config.pvp.viewerHealCommand ?? '!heal'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: { ...config.pvp, viewerHealCommand: e.target.value },
                            })
                          }
                          placeholder="!heal"
                        />
                      </label>
                      <label>
                        回復量タイプ:
                        <select
                          value={config.pvp.viewerHealType ?? 'fixed'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: { ...config.pvp, viewerHealType: e.target.value as 'fixed' | 'random' },
                            })
                          }
                        >
                          <option value="fixed">固定</option>
                          <option value="random">ランダム</option>
                        </select>
                      </label>
                    </div>
                    <div className="settings-row">
                      {config.pvp.viewerHealType === 'fixed' ? (
                        <label>
                          回復量:
                          <input
                            type="text"
                            inputMode="numeric"
                            value={inputValues['pvp.viewerHealAmount'] ?? String(config.pvp.viewerHealAmount ?? 20)}
                            onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.viewerHealAmount': e.target.value }))}
                            onBlur={(e) => {
                              const num = Number(e.target.value.trim())
                              setConfig({ ...config, pvp: { ...config.pvp, viewerHealAmount: (!isNaN(num) && num >= 1) ? num : 20 } })
                              setInputValues((prev) => { const next = { ...prev }; delete next['pvp.viewerHealAmount']; return next })
                            }}
                          />
                        </label>
                      ) : (
                        <>
                          <label>
                            回復量（最小）:
                            <input
                              type="text"
                              inputMode="numeric"
                              value={inputValues['pvp.viewerHealMin'] ?? String(config.pvp.viewerHealMin ?? 10)}
                              onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.viewerHealMin': e.target.value }))}
                              onBlur={(e) => {
                                const num = Number(e.target.value.trim())
                                setConfig({ ...config, pvp: { ...config.pvp, viewerHealMin: (!isNaN(num) && num >= 1) ? num : 10 } })
                                setInputValues((prev) => { const next = { ...prev }; delete next['pvp.viewerHealMin']; return next })
                              }}
                            />
                          </label>
                          <label>
                            回復量（最大）:
                            <input
                              type="text"
                              inputMode="numeric"
                              value={inputValues['pvp.viewerHealMax'] ?? String(config.pvp.viewerHealMax ?? 30)}
                              onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.viewerHealMax': e.target.value }))}
                              onBlur={(e) => {
                                const num = Number(e.target.value.trim())
                                setConfig({ ...config, pvp: { ...config.pvp, viewerHealMax: (!isNaN(num) && num >= 1) ? num : 30 } })
                                setInputValues((prev) => { const next = { ...prev }; delete next['pvp.viewerHealMax']; return next })
                              }}
                            />
                          </label>
                          <label>
                            刻み（50・100など。1のときは最小～最大の連続値）:
                            <input
                              type="text"
                              inputMode="numeric"
                              value={inputValues['pvp.viewerHealRandomStep'] ?? String(config.pvp.viewerHealRandomStep ?? 1)}
                              onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.viewerHealRandomStep': e.target.value }))}
                              onBlur={(e) => {
                                const num = Number(e.target.value.trim())
                                setConfig({ ...config, pvp: { ...config.pvp, viewerHealRandomStep: (!isNaN(num) && num >= 1) ? Math.floor(num) : 1 } })
                                setInputValues((prev) => { const next = { ...prev }; delete next['pvp.viewerHealRandomStep']; return next })
                              }}
                            />
                          </label>
                        </>
                      )}
                      <label>
                        <input
                          type="checkbox"
                          checked={config.pvp.viewerHealWhenZeroEnabled ?? true}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: { ...config.pvp, viewerHealWhenZeroEnabled: e.target.checked },
                            })
                          }
                        />
                        HP0のときも通常回復を許可
                      </label>
                    </div>
                    <div className="settings-row" style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>
                      配信者（カウンター）攻撃設定
                    </div>
                    <div className="settings-row">
                      <label>
                        ダメージタイプ:
                        <select
                          value={config.pvp.streamerAttack.damageType ?? 'fixed'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: {
                                ...config.pvp,
                                streamerAttack: { ...config.pvp.streamerAttack, damageType: e.target.value as 'fixed' | 'random' },
                              },
                            })
                          }
                        >
                          <option value="fixed">固定</option>
                          <option value="random">ランダム</option>
                        </select>
                      </label>
                      {(config.pvp.streamerAttack.damageType ?? 'fixed') === 'random' ? (
                        <>
                          <label>
                            ダメージ（最小）:
                            <input
                              type="text"
                              inputMode="numeric"
                              value={inputValues['pvp.streamerAttack.damageMin'] ?? String(config.pvp.streamerAttack.damageMin ?? 10)}
                              onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.streamerAttack.damageMin': e.target.value }))}
                              onBlur={(e) => {
                                const num = Number(e.target.value.trim())
                                if (!isNaN(num) && num >= 1) {
                                  setConfig((prev) => prev ? { ...prev, pvp: { ...prev.pvp, streamerAttack: { ...prev.pvp.streamerAttack, damageMin: num } } } : prev)
                                  setInputValues((prev) => { const next = { ...prev }; delete next['pvp.streamerAttack.damageMin']; return next })
                                }
                              }}
                            />
                          </label>
                          <label>
                            ダメージ（最大）:
                            <input
                              type="text"
                              inputMode="numeric"
                              value={inputValues['pvp.streamerAttack.damageMax'] ?? String(config.pvp.streamerAttack.damageMax ?? 25)}
                              onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.streamerAttack.damageMax': e.target.value }))}
                              onBlur={(e) => {
                                const num = Number(e.target.value.trim())
                                if (!isNaN(num) && num >= 1) {
                                  setConfig((prev) => prev ? { ...prev, pvp: { ...prev.pvp, streamerAttack: { ...prev.pvp.streamerAttack, damageMax: num } } } : prev)
                                  setInputValues((prev) => { const next = { ...prev }; delete next['pvp.streamerAttack.damageMax']; return next })
                                }
                              }}
                            />
                          </label>
                          <label>
                            刻み（1のときは最小～最大の連続値）:
                            <input
                              type="text"
                              inputMode="numeric"
                              value={inputValues['pvp.streamerAttack.damageRandomStep'] ?? String(config.pvp.streamerAttack.damageRandomStep ?? 1)}
                              onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.streamerAttack.damageRandomStep': e.target.value }))}
                              onBlur={(e) => {
                                const num = Number(e.target.value.trim())
                                if (!isNaN(num) && num >= 1) {
                                  setConfig((prev) => prev ? { ...prev, pvp: { ...prev.pvp, streamerAttack: { ...prev.pvp.streamerAttack, damageRandomStep: num } } } : prev)
                                  setInputValues((prev) => { const next = { ...prev }; delete next['pvp.streamerAttack.damageRandomStep']; return next })
                                }
                              }}
                            />
                          </label>
                        </>
                      ) : (
                        <label>
                          ダメージ:
                          <input
                            type="text"
                            inputMode="numeric"
                            value={inputValues['pvp.streamerAttack.damage'] ?? String(config.pvp.streamerAttack.damage)}
                            onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.streamerAttack.damage': e.target.value }))}
                            onBlur={(e) => {
                              const num = Number(e.target.value.trim())
                              const damage = (!isNaN(num) && num >= 1) ? num : undefined
                              setConfig((prev) => {
                                if (!prev?.pvp?.streamerAttack) return prev
                                return {
                                  ...prev,
                                  pvp: {
                                    ...prev.pvp,
                                    streamerAttack: {
                                      ...prev.pvp.streamerAttack,
                                      damage: damage ?? prev.pvp.streamerAttack.damage,
                                    },
                                  },
                                }
                              })
                              setInputValues((prev) => { const next = { ...prev }; delete next['pvp.streamerAttack.damage']; return next })
                            }}
                          />
                        </label>
                      )}
                      <label>
                        <input
                          type="checkbox"
                          checked={config.pvp.streamerAttack.missEnabled}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: {
                                ...config.pvp,
                                streamerAttack: { ...config.pvp.streamerAttack, missEnabled: e.target.checked },
                              },
                            })
                          }
                        />
                        ミスあり
                      </label>
                      <label>
                        ミス確率（0-100）:
                        <input
                          type="text"
                          inputMode="numeric"
                          value={inputValues['pvp.streamerAttack.missProbability'] ?? String(config.pvp.streamerAttack.missProbability)}
                          onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.streamerAttack.missProbability': e.target.value }))}
                          onBlur={(e) => {
                            const num = Number(e.target.value.trim())
                            setConfig({
                              ...config,
                              pvp: {
                                ...config.pvp,
                                streamerAttack: { ...config.pvp.streamerAttack, missProbability: (!isNaN(num) && num >= 0 && num <= 100) ? num : config.pvp.streamerAttack.missProbability },
                              },
                            })
                            setInputValues((prev) => { const next = { ...prev }; delete next['pvp.streamerAttack.missProbability']; return next })
                          }}
                        />
                      </label>
                    </div>
                    <div className="settings-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={config.pvp.streamerAttack.criticalEnabled}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: {
                                ...config.pvp,
                                streamerAttack: { ...config.pvp.streamerAttack, criticalEnabled: e.target.checked },
                              },
                            })
                          }
                        />
                        クリティカルあり
                      </label>
                      <label>
                        クリティカル確率（0-100）:
                        <input
                          type="text"
                          inputMode="numeric"
                          value={inputValues['pvp.streamerAttack.criticalProbability'] ?? String(config.pvp.streamerAttack.criticalProbability)}
                          onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.streamerAttack.criticalProbability': e.target.value }))}
                          onBlur={(e) => {
                            const num = Number(e.target.value.trim())
                            setConfig({
                              ...config,
                              pvp: {
                                ...config.pvp,
                                streamerAttack: { ...config.pvp.streamerAttack, criticalProbability: (!isNaN(num) && num >= 0 && num <= 100) ? num : config.pvp.streamerAttack.criticalProbability },
                              },
                            })
                            setInputValues((prev) => { const next = { ...prev }; delete next['pvp.streamerAttack.criticalProbability']; return next })
                          }}
                        />
                      </label>
                      <label>
                        倍率:
                        <input
                          type="text"
                          inputMode="decimal"
                          value={inputValues['pvp.streamerAttack.criticalMultiplier'] ?? String(config.pvp.streamerAttack.criticalMultiplier)}
                          onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.streamerAttack.criticalMultiplier': e.target.value }))}
                          onBlur={(e) => {
                            const num = Number(e.target.value.trim())
                            setConfig({
                              ...config,
                              pvp: {
                                ...config.pvp,
                                streamerAttack: { ...config.pvp.streamerAttack, criticalMultiplier: (!isNaN(num) && num >= 1) ? num : config.pvp.streamerAttack.criticalMultiplier },
                              },
                            })
                            setInputValues((prev) => { const next = { ...prev }; delete next['pvp.streamerAttack.criticalMultiplier']; return next })
                          }}
                        />
                      </label>
                    </div>
                    <div className="settings-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={config.pvp.streamerAttack.survivalHp1Enabled}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: {
                                ...config.pvp,
                                streamerAttack: { ...config.pvp.streamerAttack, survivalHp1Enabled: e.target.checked },
                              },
                            })
                          }
                        />
                        食いしばり（HP1残り）
                      </label>
                      <label>
                        確率（0-100）:
                        <input
                          type="text"
                          inputMode="numeric"
                          value={inputValues['pvp.streamerAttack.survivalHp1Probability'] ?? String(config.pvp.streamerAttack.survivalHp1Probability)}
                          onChange={(e) => setInputValues((prev) => ({ ...prev, 'pvp.streamerAttack.survivalHp1Probability': e.target.value }))}
                          onBlur={(e) => {
                            const num = Number(e.target.value.trim())
                            setConfig({
                              ...config,
                              pvp: {
                                ...config.pvp,
                                streamerAttack: { ...config.pvp.streamerAttack, survivalHp1Probability: (!isNaN(num) && num >= 0 && num <= 100) ? num : config.pvp.streamerAttack.survivalHp1Probability },
                              },
                            })
                            setInputValues((prev) => { const next = { ...prev }; delete next['pvp.streamerAttack.survivalHp1Probability']; return next })
                          }}
                        />
                      </label>
                      <label>
                        メッセージ:
                        <input
                          type="text"
                          value={config.pvp.streamerAttack.survivalHp1Message}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              pvp: {
                                ...config.pvp,
                                streamerAttack: { ...config.pvp.streamerAttack, survivalHp1Message: e.target.value },
                              },
                            })
                          }
                          placeholder="食いしばり!"
                        />
                      </label>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'streamer' && (
        <div className="settings-tab-panel">
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
                      value={inputValues['animation.duration'] ?? String(config.animation.duration)}
                      onChange={(e) => {
                        setInputValues((prev) => ({ ...prev, 'animation.duration': e.target.value }))
                      }}
                      onBlur={(e) => {
                        const value = e.target.value.trim()
                        if (value === '' || isNaN(parseInt(value))) {
                          setConfig({
                            ...config,
                            animation: { ...config.animation, duration: 500 },
                          })
                          setInputValues((prev) => {
                            const next = { ...prev }
                            delete next['animation.duration']
                            return next
                          })
                        } else {
                          const num = parseInt(value)
                          if (!isNaN(num)) {
                            setConfig({
                              ...config,
                              animation: { ...config.animation, duration: num },
                            })
                            setInputValues((prev) => {
                              const next = { ...prev }
                              delete next['animation.duration']
                              return next
                            })
                          }
                        }
                      }}
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
                      value={inputValues['display.fontSize'] ?? String(config.display.fontSize)}
                      onChange={(e) => {
                        setInputValues((prev) => ({ ...prev, 'display.fontSize': e.target.value }))
                      }}
                      onBlur={(e) => {
                        const value = e.target.value.trim()
                        if (value === '' || isNaN(parseInt(value))) {
                          setConfig({
                            ...config,
                            display: { ...config.display, fontSize: 24 },
                          })
                          setInputValues((prev) => {
                            const next = { ...prev }
                            delete next['display.fontSize']
                            return next
                          })
                        } else {
                          const num = parseInt(value)
                          if (!isNaN(num)) {
                            setConfig({
                              ...config,
                              display: { ...config.display, fontSize: num },
                            })
                            setInputValues((prev) => {
                              const next = { ...prev }
                              delete next['display.fontSize']
                              return next
                            })
                          }
                        }
                      }}
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
                      placeholder="画像のURLを入力"
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
                      placeholder="効果音のURLを入力"
                    />
                  </label>
                </div>
                <div className="settings-row">
                  <label>
                    音量:
                    <input
                      type="text"
                      value={inputValues['zeroHpSound.volume'] ?? String(config.zeroHpSound.volume)}
                      onChange={(e) => {
                        setInputValues((prev) => ({ ...prev, 'zeroHpSound.volume': e.target.value }))
                      }}
                      onBlur={(e) => {
                        const value = e.target.value.trim()
                        if (value === '' || isNaN(parseFloat(value))) {
                          setConfig({
                            ...config,
                            zeroHpSound: { ...config.zeroHpSound, volume: 0.7 },
                          })
                          setInputValues((prev) => {
                            const next = { ...prev }
                            delete next['zeroHpSound.volume']
                            return next
                          })
                        } else {
                          const num = parseFloat(value)
                          if (!isNaN(num)) {
                            setConfig({
                              ...config,
                              zeroHpSound: {
                                ...config.zeroHpSound,
                                volume: Math.min(1, Math.max(0, num)),
                              },
                            })
                            setInputValues((prev) => {
                              const next = { ...prev }
                              delete next['zeroHpSound.volume']
                              return next
                            })
                          }
                        }
                      }}
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
                      placeholder="動画のURLを入力"
                    />
                  </label>
                </div>
                <div className="settings-row">
                  <label>
                    表示時間（ミリ秒）:
                    <input
                      type="text"
                      value={inputValues['zeroHpEffect.duration'] ?? String(config.zeroHpEffect.duration)}
                      onChange={(e) => {
                        setInputValues((prev) => ({ ...prev, 'zeroHpEffect.duration': e.target.value }))
                      }}
                      onBlur={(e) => {
                        const value = e.target.value.trim()
                        if (value === '' || isNaN(parseInt(value))) {
                          setConfig({
                            ...config,
                            zeroHpEffect: { ...config.zeroHpEffect, duration: 2000 },
                          })
                          setInputValues((prev) => {
                            const next = { ...prev }
                            delete next['zeroHpEffect.duration']
                            return next
                          })
                        } else {
                          const num = parseInt(value)
                          if (!isNaN(num)) {
                            setConfig({
                              ...config,
                              zeroHpEffect: {
                                ...config.zeroHpEffect,
                                duration: Math.max(100, num),
                              },
                            })
                            setInputValues((prev) => {
                              const next = { ...prev }
                              delete next['zeroHpEffect.duration']
                              return next
                            })
                          }
                        }
                      }}
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
            <h3 className="settings-section-header" onClick={() => toggleSection('gaugeColors')}>
              <span className="accordion-icon">{expandedSections.gaugeColors ? '▼' : '▶'}</span>
              HPゲージ色設定
            </h3>
            {expandedSections.gaugeColors && (
              <div className="settings-section-content">
                <div className="settings-color-grid">
                  <div className="settings-color-row">
                    <span className="settings-color-label">最後の1ゲージ（HPが最後に残る分）</span>
                    <div className="settings-color-inputs">
                      <input
                        type="color"
                        className="settings-color-picker"
                        value={config.gaugeColors.lastGauge}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            gaugeColors: { ...config.gaugeColors, lastGauge: e.target.value },
                          })
                        }
                      />
                      <input
                        type="text"
                        className="settings-color-hex"
                        value={config.gaugeColors.lastGauge}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            gaugeColors: { ...config.gaugeColors, lastGauge: e.target.value },
                          })
                        }
                        placeholder="#FF0000"
                      />
                    </div>
                  </div>
                  <div className="settings-color-row">
                    <span className="settings-color-label">2ゲージ目</span>
                    <div className="settings-color-inputs">
                      <input
                        type="color"
                        className="settings-color-picker"
                        value={config.gaugeColors.secondGauge}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            gaugeColors: { ...config.gaugeColors, secondGauge: e.target.value },
                          })
                        }
                      />
                      <input
                        type="text"
                        className="settings-color-hex"
                        value={config.gaugeColors.secondGauge}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            gaugeColors: { ...config.gaugeColors, secondGauge: e.target.value },
                          })
                        }
                        placeholder="#FFA500"
                      />
                    </div>
                  </div>
                  <div className="settings-color-row">
                    <span className="settings-color-label">3ゲージ目以降のパターン1（3, 5, 7…）</span>
                    <div className="settings-color-inputs">
                      <input
                        type="color"
                        className="settings-color-picker"
                        value={config.gaugeColors.patternColor1}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            gaugeColors: { ...config.gaugeColors, patternColor1: e.target.value },
                          })
                        }
                      />
                      <input
                        type="text"
                        className="settings-color-hex"
                        value={config.gaugeColors.patternColor1}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            gaugeColors: { ...config.gaugeColors, patternColor1: e.target.value },
                          })
                        }
                        placeholder="#8000FF"
                      />
                    </div>
                  </div>
                  <div className="settings-color-row">
                    <span className="settings-color-label">3ゲージ目以降のパターン2（4, 6, 8…）</span>
                    <div className="settings-color-inputs">
                      <input
                        type="color"
                        className="settings-color-picker"
                        value={config.gaugeColors.patternColor2}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            gaugeColors: { ...config.gaugeColors, patternColor2: e.target.value },
                          })
                        }
                      />
                      <input
                        type="text"
                        className="settings-color-hex"
                        value={config.gaugeColors.patternColor2}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            gaugeColors: { ...config.gaugeColors, patternColor2: e.target.value },
                          })
                        }
                        placeholder="#4aa3ff"
                      />
                    </div>
                  </div>
                </div>
                <div className="settings-hint">
                  <p>
                    <strong>注意:</strong> 3ゲージ目以降は、設定した2色を交互に使用します。ゲージ数が10を超えても、この2色が繰り返し適用されます。
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="settings-section">
            <h3 className="settings-section-header" onClick={() => toggleSection('damageColors')}>
              <span className="accordion-icon">{expandedSections.damageColors ? '▼' : '▶'}</span>
              ダメージ値色設定
            </h3>
            {expandedSections.damageColors && (
              <div className="settings-section-content">
                <div className="settings-color-grid">
                  <div className="settings-color-row">
                    <span className="settings-color-label">通常ダメージ</span>
                    <div className="settings-color-inputs">
                      <input
                        type="color"
                        className="settings-color-picker"
                        value={config.damageColors.normal}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            damageColors: { ...config.damageColors, normal: e.target.value },
                          })
                        }
                      />
                      <input
                        type="text"
                        className="settings-color-hex"
                        value={config.damageColors.normal}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            damageColors: { ...config.damageColors, normal: e.target.value },
                          })
                        }
                        placeholder="#cc0000"
                      />
                    </div>
                  </div>
                  <div className="settings-color-row">
                    <span className="settings-color-label">クリティカル</span>
                    <div className="settings-color-inputs">
                      <input
                        type="color"
                        className="settings-color-picker"
                        value={config.damageColors.critical}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            damageColors: { ...config.damageColors, critical: e.target.value },
                          })
                        }
                      />
                      <input
                        type="text"
                        className="settings-color-hex"
                        value={config.damageColors.critical}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            damageColors: { ...config.damageColors, critical: e.target.value },
                          })
                        }
                        placeholder="#cc8800"
                      />
                    </div>
                  </div>
                  <div className="settings-color-row">
                    <span className="settings-color-label">出血ダメージ</span>
                    <div className="settings-color-inputs">
                      <input
                        type="color"
                        className="settings-color-picker"
                        value={config.damageColors.bleed}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            damageColors: { ...config.damageColors, bleed: e.target.value },
                          })
                        }
                      />
                      <input
                        type="text"
                        className="settings-color-hex"
                        value={config.damageColors.bleed}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            damageColors: { ...config.damageColors, bleed: e.target.value },
                          })
                        }
                        placeholder="#ff6666"
                      />
                    </div>
                  </div>
                </div>
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

          {/* 外部ウィンドウ設定 */}
          <div className="settings-section">
            <h3 className="settings-section-header" onClick={() => toggleSection('externalWindow')}>
              <span className="accordion-icon">{expandedSections.externalWindow ? '▼' : '▶'}</span>
              外部ウィンドウキャプチャ
            </h3>
            {expandedSections.externalWindow && (
              <div className="settings-section-content">
                <div className="settings-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={config.externalWindow.enabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          externalWindow: { ...config.externalWindow, enabled: e.target.checked },
                        })
                      }
                    />
                    外部ウィンドウキャプチャを有効化
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'autoReply' && (
        <div className="settings-tab-panel">
          <div className="settings-tabs settings-tabs--sub">
            <button
              type="button"
              className={`settings-tab ${autoReplySubTab === 'streamer' ? 'settings-tab-active' : ''}`}
              onClick={() => setAutoReplySubTab('streamer')}
            >
              配信者側
            </button>
            <button
              type="button"
              className={`settings-tab ${autoReplySubTab === 'viewer' ? 'settings-tab-active' : ''}`}
              onClick={() => setAutoReplySubTab('viewer')}
            >
              ユーザー側
            </button>
          </div>
          {autoReplySubTab === 'streamer' && (
            <div className="settings-section">
              <h3>配信者側の自動返信</h3>
              <p className="settings-hint" style={{ marginTop: 0 }}>
                配信者HP0時・回復コマンド使用時にチャットへ送るメッセージを設定します。送信にはOAuthトークンに <code>user:write:chat</code> スコープが必要です。
              </p>
              <div className="settings-row">
                <label>
                  <input
                    type="checkbox"
                    checked={config.retry.streamerAutoReplyEnabled ?? true}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        retry: { ...config.retry, streamerAutoReplyEnabled: e.target.checked },
                      })
                    }
                  />
                  配信者側の自動返信（配信者HP0時などにチャットへメッセージを送る）
                </label>
              </div>
              <div className="settings-row">
                <label>
                  配信者HPが0になったときの自動返信メッセージ（{'{attacker}'} で攻撃した視聴者名に置換）:
                  <input
                    type="text"
                    value={config.hp.messageWhenZeroHp ?? '配信者を {attacker} が倒しました！'}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        hp: { ...config.hp, messageWhenZeroHp: e.target.value },
                      })
                    }
                    placeholder="配信者を {attacker} が倒しました！"
                  />
                </label>
              </div>
              <div className="settings-row" style={{ marginTop: '1rem', fontWeight: 'bold' }}>
                回復コマンドの自動返信
              </div>
              <div className="settings-row">
                <label>
                  <input
                    type="checkbox"
                    checked={config.heal.autoReplyEnabled ?? false}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        heal: { ...config.heal, autoReplyEnabled: e.target.checked },
                      })
                    }
                  />
                  回復コマンド使用時にチャットへ自動返信（攻撃時と同様）
                </label>
              </div>
              {config.heal.autoReplyEnabled && (
                <div className="settings-row">
                  <label>
                    回復時自動返信メッセージ（{'{hp}'} {'{max}'} で置換。視聴者!healの場合は {'{username}'} で視聴者名に置換）:
                    <input
                      type="text"
                      value={config.heal.autoReplyMessageTemplate ?? '配信者の残りHP: {hp}/{max}'}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          heal: { ...config.heal, autoReplyMessageTemplate: e.target.value },
                        })
                      }
                      placeholder="配信者の残りHP: {hp}/{max} または {username} の残りHP: {hp}/{max}"
                    />
                  </label>
                </div>
              )}
            </div>
          )}
          {autoReplySubTab === 'viewer' && (
            <div className="settings-section">
              <h3>ユーザー側（視聴者）の自動返信</h3>
              <p className="settings-hint" style={{ marginTop: 0 }}>
                カウンター攻撃時やHP確認時にチャットへ自動返信します。送信にはOAuthトークンに <code>user:write:chat</code> スコープが必要です。
              </p>
              <div className="settings-row">
                <label>
                  <input
                    type="checkbox"
                    checked={config.pvp.autoReplyAttackCounter ?? true}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pvp: { ...config.pvp, autoReplyAttackCounter: e.target.checked },
                      })
                    }
                  />
                  攻撃・カウンター時の自動返信（HP表示）
                </label>
              </div>
              <div className="settings-row">
                <label>
                  <input
                    type="checkbox"
                    checked={config.pvp.autoReplyWhenViewerZeroHp ?? true}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pvp: { ...config.pvp, autoReplyWhenViewerZeroHp: e.target.checked },
                      })
                    }
                  />
                  視聴者HPが0になったときの自動返信
                </label>
              </div>
              <div className="settings-row">
                <label>
                  <input
                    type="checkbox"
                    checked={config.pvp.autoReplyHpCheck ?? true}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pvp: { ...config.pvp, autoReplyHpCheck: e.target.checked },
                      })
                    }
                  />
                  HP確認コマンドの自動返信
                </label>
              </div>
              <div className="settings-row">
                <label>
                  <input
                    type="checkbox"
                    checked={config.pvp.autoReplyFullHeal ?? true}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pvp: { ...config.pvp, autoReplyFullHeal: e.target.checked },
                      })
                    }
                  />
                  全回復コマンドの自動返信
                </label>
              </div>
              <div className="settings-row">
                <label>
                  <input
                    type="checkbox"
                    checked={config.pvp.autoReplyHeal ?? true}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pvp: { ...config.pvp, autoReplyHeal: e.target.checked },
                      })
                    }
                  />
                  通常回復コマンドの自動返信
                </label>
              </div>
              <div className="settings-row">
                <label>
                  <input
                    type="checkbox"
                    checked={config.pvp.autoReplyBlockedByZeroHp ?? true}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pvp: { ...config.pvp, autoReplyBlockedByZeroHp: e.target.checked },
                      })
                    }
                  />
                  HP0ブロック時の自動返信（「攻撃できません」「回復できません」）
                </label>
              </div>
              <div className="settings-row">
                <label>
                  攻撃時自動返信メッセージ（{'{username}'} {'{hp}'} {'{max}'} で置換）:
                  <input
                    type="text"
                    value={config.pvp.autoReplyMessageTemplate}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pvp: { ...config.pvp, autoReplyMessageTemplate: e.target.value },
                      })
                    }
                    placeholder="{username} の残りHP: {hp}/{max}"
                  />
                </label>
              </div>
              <div className="settings-row" style={{ marginTop: '1rem', fontWeight: 'bold' }}>
                HPが0のときのブロックメッセージ（攻撃・回復不可時に自動返信）
              </div>
              <div className="settings-row">
                <label>
                  攻撃ブロック時:
                  <input
                    type="text"
                    value={config.pvp.messageWhenAttackBlockedByZeroHp ?? 'HPが0なので攻撃できません。'}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pvp: { ...config.pvp, messageWhenAttackBlockedByZeroHp: e.target.value },
                      })
                    }
                    placeholder="HPが0なので攻撃できません。"
                  />
                </label>
              </div>
              <div className="settings-row">
                <label>
                  回復ブロック時:
                  <input
                    type="text"
                    value={config.pvp.messageWhenHealBlockedByZeroHp ?? 'HPが0なので回復できません。'}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pvp: { ...config.pvp, messageWhenHealBlockedByZeroHp: e.target.value },
                      })
                    }
                    placeholder="HPが0なので回復できません。"
                  />
                </label>
              </div>
              <div className="settings-row">
                <label>
                  視聴者HPが0になったときの自動返信メッセージ（{'{username}'} で対象の表示名に置換）:
                  <input
                    type="text"
                    value={config.pvp.messageWhenViewerZeroHp ?? '視聴者 {username} のHPが0になりました。'}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pvp: { ...config.pvp, messageWhenViewerZeroHp: e.target.value },
                      })
                    }
                    placeholder="視聴者 {username} のHPが0になりました。"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="settings-actions">
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

              // 設定を更新。保存するには「設定を保存」を押す
              setConfig(validated)
              setInputValues({})
              setMessage('✅ 設定ファイルを読み込みました。保存するには「設定を保存」を押してください。')
              setTimeout(() => setMessage(null), 3000)
              console.log('✅ 設定ファイルを読み込みました')
            } catch (error) {
              console.error('❌ 設定ファイルの読み込みに失敗しました:', error)
              setMessage('❌ 設定ファイルの読み込みに失敗しました。JSON形式が正しいか確認してください。')
              setTimeout(() => setMessage(null), 5000)
            } finally {
              // ファイル入力をリセット（同じファイルを再度選択できるように）
              if (fileInputRef.current) {
                fileInputRef.current.value = ''
              }
            }
          }}
        />
        <button type="button" className="settings-action-primary" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '設定を保存'}
        </button>
        <button
          type="button"
          className="settings-action-secondary"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            fileInputRef.current?.click()
          }}
        >
          設定を再読み込み（ファイル選択）
        </button>
        <button
          type="button"
          className="settings-action-secondary"
          onClick={handleLoadFromFile}
          disabled={loadingFromFile}
          title="public/config/overlay-config.json の内容でフォームを上書きします"
        >
          {loadingFromFile ? '読み込み中...' : 'JSONファイルから読み込み'}
        </button>
        <button type="button" className="settings-action-reset" onClick={handleReset}>
          リセット
        </button>
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
            <strong>設定の保存先:</strong> JSONファイルのみ。読み込みは JSONファイル → デフォルト設定。同じ内容を再読み込みする場合は「JSONファイルから読み込み」を押してください。
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

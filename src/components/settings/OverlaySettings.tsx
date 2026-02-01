/**
 * オーバーレイ設定UIコンポーネント
 */

import { useState, useEffect, useRef } from 'react'
import { loadOverlayConfig, saveOverlayConfig, getDefaultConfig, validateAndSanitizeConfig } from '../../utils/overlayConfig'
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
    externalWindow: true,
    gaugeColors: true,
    damageColors: true,
  })
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
                ダメージ:
                <input
                  type="text"
                  value={inputValues['attack.damage'] ?? String(config.attack.damage)}
                  onChange={(e) => {
                    setInputValues((prev) => ({ ...prev, 'attack.damage': e.target.value }))
                  }}
                  onBlur={(e) => {
                    const value = e.target.value.trim()
                    if (value === '' || isNaN(parseInt(value))) {
                      setConfig({
                        ...config,
                        attack: { ...config.attack, damage: 10 },
                      })
                      setInputValues((prev) => {
                        const next = { ...prev }
                        delete next['attack.damage']
                        return next
                      })
                    } else {
                      const num = parseInt(value)
                      if (!isNaN(num)) {
                        setConfig({
                          ...config,
                          attack: { ...config.attack, damage: num },
                        })
                        setInputValues((prev) => {
                          const next = { ...prev }
                          delete next['attack.damage']
                          return next
                        })
                      }
                    }
                  }}
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
                      type="number"
                      min={0}
                      max={100}
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
            <div className="settings-row">
              <label>
                最後の1ゲージ（HPが最後に残る分）:
                <input
                  type="color"
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
                  value={config.gaugeColors.lastGauge}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      gaugeColors: { ...config.gaugeColors, lastGauge: e.target.value },
                    })
                  }
                  placeholder="#FF0000"
                  style={{ width: '100px', marginLeft: '0.5rem' }}
                />
              </label>
            </div>
            <div className="settings-row">
              <label>
                2ゲージ目:
                <input
                  type="color"
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
                  value={config.gaugeColors.secondGauge}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      gaugeColors: { ...config.gaugeColors, secondGauge: e.target.value },
                    })
                  }
                  placeholder="#FFA500"
                  style={{ width: '100px', marginLeft: '0.5rem' }}
                />
              </label>
            </div>
            <div className="settings-row">
              <label>
                3ゲージ目以降の交互パターン1（3, 5, 7, 9...ゲージ目）:
                <input
                  type="color"
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
                  value={config.gaugeColors.patternColor1}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      gaugeColors: { ...config.gaugeColors, patternColor1: e.target.value },
                    })
                  }
                  placeholder="#8000FF"
                  style={{ width: '100px', marginLeft: '0.5rem' }}
                />
              </label>
            </div>
            <div className="settings-row">
              <label>
                3ゲージ目以降の交互パターン2（4, 6, 8, 10...ゲージ目）:
                <input
                  type="color"
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
                  value={config.gaugeColors.patternColor2}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      gaugeColors: { ...config.gaugeColors, patternColor2: e.target.value },
                    })
                  }
                  placeholder="#4aa3ff"
                  style={{ width: '100px', marginLeft: '0.5rem' }}
                />
              </label>
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
            <div className="settings-row">
              <label>
                通常ダメージの色:
                <input
                  type="color"
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
                  value={config.damageColors.normal}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      damageColors: { ...config.damageColors, normal: e.target.value },
                    })
                  }
                  placeholder="#cc0000"
                  style={{ width: '100px', marginLeft: '0.5rem' }}
                />
              </label>
            </div>
            <div className="settings-row">
              <label>
                クリティカルダメージの色:
                <input
                  type="color"
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
                  value={config.damageColors.critical}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      damageColors: { ...config.damageColors, critical: e.target.value },
                    })
                  }
                  placeholder="#cc8800"
                  style={{ width: '100px', marginLeft: '0.5rem' }}
                />
              </label>
            </div>
            <div className="settings-row">
              <label>
                出血ダメージの色:
                <input
                  type="color"
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
                  value={config.damageColors.bleed}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      damageColors: { ...config.damageColors, bleed: e.target.value },
                    })
                  }
                  placeholder="#ff6666"
                  style={{ width: '100px', marginLeft: '0.5rem' }}
                />
              </label>
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
        <h3 onClick={() => toggleSection('externalWindow')}>
          {expandedSections.externalWindow ? '▼' : '▶'} 外部ウィンドウキャプチャ
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
            {config.externalWindow.enabled && (
              <>
                <div className="settings-row">
                  <label>位置 X (px)</label>
                  <input
                    type="number"
                    value={inputValues.externalWindowX ?? config.externalWindow.x}
                    onChange={(e) => setInputValues((prev) => ({ ...prev, externalWindowX: e.target.value }))}
                    onBlur={(e) => {
                      const value = Number(e.target.value)
                      if (!isNaN(value)) {
                        setConfig({
                          ...config,
                          externalWindow: { ...config.externalWindow, x: value },
                        })
                      }
                      setInputValues((prev) => {
                        const newValues = { ...prev }
                        delete newValues.externalWindowX
                        return newValues
                      })
                    }}
                  />
                </div>
                <div className="settings-row">
                  <label>位置 Y (px)</label>
                  <input
                    type="number"
                    value={inputValues.externalWindowY ?? config.externalWindow.y}
                    onChange={(e) => setInputValues((prev) => ({ ...prev, externalWindowY: e.target.value }))}
                    onBlur={(e) => {
                      const value = Number(e.target.value)
                      if (!isNaN(value)) {
                        setConfig({
                          ...config,
                          externalWindow: { ...config.externalWindow, y: value },
                        })
                      }
                      setInputValues((prev) => {
                        const newValues = { ...prev }
                        delete newValues.externalWindowY
                        return newValues
                      })
                    }}
                  />
                </div>
                <div className="settings-row">
                  <label>幅 (px)</label>
                  <input
                    type="number"
                    value={inputValues.externalWindowWidth ?? config.externalWindow.width}
                    onChange={(e) => setInputValues((prev) => ({ ...prev, externalWindowWidth: e.target.value }))}
                    onBlur={(e) => {
                      const value = Number(e.target.value)
                      if (!isNaN(value) && value > 0) {
                        setConfig({
                          ...config,
                          externalWindow: { ...config.externalWindow, width: value },
                        })
                      }
                      setInputValues((prev) => {
                        const newValues = { ...prev }
                        delete newValues.externalWindowWidth
                        return newValues
                      })
                    }}
                  />
                </div>
                <div className="settings-row">
                  <label>高さ (px)</label>
                  <input
                    type="number"
                    value={inputValues.externalWindowHeight ?? config.externalWindow.height}
                    onChange={(e) => setInputValues((prev) => ({ ...prev, externalWindowHeight: e.target.value }))}
                    onBlur={(e) => {
                      const value = Number(e.target.value)
                      if (!isNaN(value) && value > 0) {
                        setConfig({
                          ...config,
                          externalWindow: { ...config.externalWindow, height: value },
                        })
                      }
                      setInputValues((prev) => {
                        const newValues = { ...prev }
                        delete newValues.externalWindowHeight
                        return newValues
                      })
                    }}
                  />
                </div>
                <div className="settings-row">
                  <label>透明度 (0-1)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={inputValues.externalWindowOpacity ?? config.externalWindow.opacity}
                    onChange={(e) => setInputValues((prev) => ({ ...prev, externalWindowOpacity: e.target.value }))}
                    onBlur={(e) => {
                      const value = Number(e.target.value)
                      if (!isNaN(value) && value >= 0 && value <= 1) {
                        setConfig({
                          ...config,
                          externalWindow: { ...config.externalWindow, opacity: value },
                        })
                      }
                      setInputValues((prev) => {
                        const newValues = { ...prev }
                        delete newValues.externalWindowOpacity
                        return newValues
                      })
                    }}
                  />
                </div>
                <div className="settings-row">
                  <label>Z-Index (HPゲージより後ろに配置するため低めの値)</label>
                  <input
                    type="number"
                    value={inputValues.externalWindowZIndex ?? config.externalWindow.zIndex}
                    onChange={(e) => setInputValues((prev) => ({ ...prev, externalWindowZIndex: e.target.value }))}
                    onBlur={(e) => {
                      const value = Number(e.target.value)
                      if (!isNaN(value)) {
                        setConfig({
                          ...config,
                          externalWindow: { ...config.externalWindow, zIndex: value },
                        })
                      }
                      setInputValues((prev) => {
                        const newValues = { ...prev }
                        delete newValues.externalWindowZIndex
                        return newValues
                      })
                    }}
                  />
                </div>
                <div className="settings-hint">
                  <p>
                    <strong>使用方法:</strong>
                  </p>
                  <ul>
                    <li>外部ウィンドウキャプチャを有効化すると、ブラウザがウィンドウ選択画面を表示します</li>
                    <li>キャプチャしたいアプリケーションウィンドウを選択してください</li>
                    <li>位置、サイズ、透明度、Z-Indexを調整してHPゲージの後ろに配置できます</li>
                    <li>Z-Indexは低い値（例: 1）に設定すると、HPゲージ（通常はz-index: 10以上）の後ろに表示されます</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </div>

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
              
              // 設定を更新
              setConfig(validated)
              // 入力値を初期化
              setInputValues({})
              // ローカルストレージにも保存
              localStorage.setItem('overlay-config', JSON.stringify(validated))
              setMessage('✅ 設定ファイルを読み込みました')
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
        <button onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '設定を保存'}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            fileInputRef.current?.click()
          }}
        >
          設定を再読み込み
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

/**
 * 効果音まとめタブ（配信者攻撃/回復・リトライ・HP0・PvP などの SE 設定）
 */

import type { Dispatch, SetStateAction } from 'react'
import type { OverlayConfig } from '../../types/overlay'
import { isValidUrl } from '../../utils/security'

export type OverlaySettingsSoundTabProps = {
  config: OverlayConfig
  setConfig: Dispatch<SetStateAction<OverlayConfig | null>>
  inputValues: Record<string, string>
  setInputValues: Dispatch<SetStateAction<Record<string, string>>>
  openSoundFilePicker: (applyUrl: (dataUrl: string) => void) => void | Promise<void>
  setMessage: Dispatch<SetStateAction<string | null>>
}

export function OverlaySettingsSoundTab({
  config,
  setConfig,
  inputValues,
  setInputValues,
  openSoundFilePicker,
  setMessage,
}: OverlaySettingsSoundTabProps) {
  return (
    <div className="settings-tab-panel">
      <div className="settings-section">
        <p className="settings-hint" style={{ marginTop: 0 }}>
          攻撃・回復・ミス・DOT・リトライ・HP0・PvP バフ/必殺などの<strong>効果音</strong>をここに集約しています。各ブロックは元のタブと同じ設定を編集します。ミス・出血などは、該当機能を有効にしているときのみ表示されます。
        </p>

        <h4 className="settings-subsection-title">配信者 — 攻撃（チャンネルポイント）</h4>

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
              <div className="settings-url-with-button">
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
                      setMessage('無効なURLです。http://、https://、data:audio、または相対パスを入力してください。')
                      setTimeout(() => setMessage(null), 3000)
                    }
                  }}
                  placeholder="空欄の場合は効果音なし"
                />
                <button
                  type="button"
                  className="settings-action-secondary settings-url-browse"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    openSoundFilePicker((dataUrl) => {
                      setConfig({
                        ...config,
                        attack: { ...config.attack, missSoundUrl: dataUrl },
                      })
                    })
                  }}
                  title="音声ファイルを選んでURLに自動入力（data:audio）"
                >
                  参照...
                </button>
              </div>
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
            例: <code>src/sounds/miss.mp3</code>（public/sounds に配置）または <code>https://...</code>
          </p>
        )}

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
              <div className="settings-url-with-button">
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
                      setMessage('無効なURLです。http://、https://、data:audio、または相対パスを入力してください。')
                      setTimeout(() => setMessage(null), 3000)
                    }
                  }}
                  placeholder="空欄の場合は効果音なし"
                />
                <button
                  type="button"
                  className="settings-action-secondary settings-url-browse"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    openSoundFilePicker((dataUrl) => {
                      setConfig({
                        ...config,
                        attack: { ...config.attack, bleedSoundUrl: dataUrl },
                      })
                    })
                  }}
                  title="音声ファイルを選んでURLに自動入力（data:audio）"
                >
                  参照...
                </button>
              </div>
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
            例: <code>src/sounds/bleed.mp3</code>（public/sounds に配置）または <code>https://...</code>
          </p>
        )}

        {config.attack.bleedEnabled && (
          <>
            <p className="settings-hint">
              毒DOT・炎DOTのティック効果音（任意）: バリエーションで毒・炎が選ばれたときのみ鳴ります。ONかつURLがある場合のみ再生され、出血用の効果音とは別に指定してください。
            </p>
            <div className="settings-row">
              <label>
                <input
                  type="checkbox"
                  checked={config.attack.dotPoisonSoundEnabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      attack: { ...config.attack, dotPoisonSoundEnabled: e.target.checked },
                    })
                  }
                />
                毒DOTの効果音を有効にする
              </label>
            </div>
            {config.attack.dotPoisonSoundEnabled && (
              <div className="settings-row">
                <label>
                  毒DOT 効果音URL:
                  <div className="settings-url-with-button">
                    <input
                      type="text"
                      value={config.attack.dotPoisonSoundUrl}
                      onChange={(e) => {
                        const url = e.target.value
                        if (isValidUrl(url)) {
                          setConfig({
                            ...config,
                            attack: { ...config.attack, dotPoisonSoundUrl: url },
                          })
                        } else {
                          setMessage('無効なURLです。http://、https://、data:audio、または相対パスを入力してください。')
                          setTimeout(() => setMessage(null), 3000)
                        }
                      }}
                      placeholder="空欄の場合は鳴りません"
                    />
                    <button
                      type="button"
                      className="settings-action-secondary settings-url-browse"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        openSoundFilePicker((dataUrl) => {
                          setConfig({
                            ...config,
                            attack: { ...config.attack, dotPoisonSoundUrl: dataUrl },
                          })
                        })
                      }}
                      title="音声ファイルを選んでURLに自動入力（data:audio）"
                    >
                      参照...
                    </button>
                  </div>
                </label>
                <label>
                  音量:
                  <input
                    type="text"
                    value={inputValues['attack.dotPoisonSoundVolume'] ?? String(config.attack.dotPoisonSoundVolume)}
                    onChange={(e) =>
                      setInputValues((prev) => ({ ...prev, 'attack.dotPoisonSoundVolume': e.target.value }))
                    }
                    onBlur={(e) => {
                      const value = e.target.value.trim()
                      if (value === '' || isNaN(parseFloat(value))) {
                        setConfig({
                          ...config,
                          attack: { ...config.attack, dotPoisonSoundVolume: 0.7 },
                        })
                        setInputValues((prev) => {
                          const next = { ...prev }
                          delete next['attack.dotPoisonSoundVolume']
                          return next
                        })
                      } else {
                        const num = parseFloat(value)
                        if (!isNaN(num)) {
                          setConfig({
                            ...config,
                            attack: {
                              ...config.attack,
                              dotPoisonSoundVolume: Math.min(1, Math.max(0, num)),
                            },
                          })
                          setInputValues((prev) => {
                            const next = { ...prev }
                            delete next['attack.dotPoisonSoundVolume']
                            return next
                          })
                        }
                      }
                    }}
                  />
                </label>
              </div>
            )}
            <div className="settings-row">
              <label>
                <input
                  type="checkbox"
                  checked={config.attack.dotBurnSoundEnabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      attack: { ...config.attack, dotBurnSoundEnabled: e.target.checked },
                    })
                  }
                />
                炎DOTの効果音を有効にする
              </label>
            </div>
            {config.attack.dotBurnSoundEnabled && (
              <div className="settings-row">
                <label>
                  炎DOT 効果音URL:
                  <div className="settings-url-with-button">
                    <input
                      type="text"
                      value={config.attack.dotBurnSoundUrl}
                      onChange={(e) => {
                        const url = e.target.value
                        if (isValidUrl(url)) {
                          setConfig({
                            ...config,
                            attack: { ...config.attack, dotBurnSoundUrl: url },
                          })
                        } else {
                          setMessage('無効なURLです。http://、https://、data:audio、または相対パスを入力してください。')
                          setTimeout(() => setMessage(null), 3000)
                        }
                      }}
                      placeholder="空欄の場合は鳴りません"
                    />
                    <button
                      type="button"
                      className="settings-action-secondary settings-url-browse"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        openSoundFilePicker((dataUrl) => {
                          setConfig({
                            ...config,
                            attack: { ...config.attack, dotBurnSoundUrl: dataUrl },
                          })
                        })
                      }}
                      title="音声ファイルを選んでURLに自動入力（data:audio）"
                    >
                      参照...
                    </button>
                  </div>
                </label>
                <label>
                  音量:
                  <input
                    type="text"
                    value={inputValues['attack.dotBurnSoundVolume'] ?? String(config.attack.dotBurnSoundVolume)}
                    onChange={(e) =>
                      setInputValues((prev) => ({ ...prev, 'attack.dotBurnSoundVolume': e.target.value }))
                    }
                    onBlur={(e) => {
                      const value = e.target.value.trim()
                      if (value === '' || isNaN(parseFloat(value))) {
                        setConfig({
                          ...config,
                          attack: { ...config.attack, dotBurnSoundVolume: 0.7 },
                        })
                        setInputValues((prev) => {
                          const next = { ...prev }
                          delete next['attack.dotBurnSoundVolume']
                          return next
                        })
                      } else {
                        const num = parseFloat(value)
                        if (!isNaN(num)) {
                          setConfig({
                            ...config,
                            attack: {
                              ...config.attack,
                              dotBurnSoundVolume: Math.min(1, Math.max(0, num)),
                            },
                          })
                          setInputValues((prev) => {
                            const next = { ...prev }
                            delete next['attack.dotBurnSoundVolume']
                            return next
                          })
                        }
                      }
                    }}
                  />
                </label>
              </div>
            )}
          </>
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
              <div className="settings-url-with-button">
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
                      setMessage('無効なURLです。http://、https://、data:audio、または相対パスを入力してください。')
                      setTimeout(() => setMessage(null), 3000)
                    }
                  }}
                  placeholder="空欄の場合は効果音なし"
                />
                <button
                  type="button"
                  className="settings-action-secondary settings-url-browse"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    openSoundFilePicker((dataUrl) => {
                      setConfig({
                        ...config,
                        attack: { ...config.attack, soundUrl: dataUrl },
                      })
                    })
                  }}
                  title="音声ファイルを選んでURLに自動入力（data:audio）"
                >
                  参照...
                </button>
              </div>
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
            例: <code>src/sounds/attack.mp3</code>（public/sounds に配置）または <code>https://...</code>
          </p>
        )}

        {config.attack.bleedEnabled && (
          <>
            <p className="settings-hint">
              毒/炎DOTが付与された攻撃のときだけ、攻撃効果音を一時的に置き換えできます（未設定なら通常の攻撃効果音のまま）。
            </p>
            <div className="settings-row">
              <label>
                <input
                  type="checkbox"
                  checked={config.attack.dotPoisonAttackSoundEnabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      attack: { ...config.attack, dotPoisonAttackSoundEnabled: e.target.checked },
                    })
                  }
                />
                毒攻撃SE（置き換え）を有効にする
              </label>
            </div>
            {config.attack.dotPoisonAttackSoundEnabled && (
              <div className="settings-row">
                <label>
                  毒攻撃SE URL:
                  <div className="settings-url-with-button">
                    <input
                      type="text"
                      value={config.attack.dotPoisonAttackSoundUrl}
                      onChange={(e) => {
                        const url = e.target.value
                        if (isValidUrl(url)) {
                          setConfig({
                            ...config,
                            attack: { ...config.attack, dotPoisonAttackSoundUrl: url },
                          })
                        } else {
                          setMessage('無効なURLです。http://、https://、または相対パスを入力してください。')
                          setTimeout(() => setMessage(null), 3000)
                        }
                      }}
                      placeholder="空欄の場合は置き換えなし"
                    />
                    <button
                      type="button"
                      className="settings-action-secondary settings-url-browse"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        openSoundFilePicker((dataUrl) => {
                          setConfig({
                            ...config,
                            attack: { ...config.attack, dotPoisonAttackSoundUrl: dataUrl },
                          })
                        })
                      }}
                      title="音声ファイルを選んでURLに自動入力"
                    >
                      参照...
                    </button>
                  </div>
                </label>
                <label>
                  音量:
                  <input
                    type="text"
                    value={
                      inputValues['attack.dotPoisonAttackSoundVolume'] ??
                      String(config.attack.dotPoisonAttackSoundVolume)
                    }
                    onChange={(e) =>
                      setInputValues((prev) => ({
                        ...prev,
                        'attack.dotPoisonAttackSoundVolume': e.target.value,
                      }))
                    }
                    onBlur={(e) => {
                      const value = e.target.value.trim()
                      if (value === '' || isNaN(parseFloat(value))) {
                        setConfig({
                          ...config,
                          attack: { ...config.attack, dotPoisonAttackSoundVolume: 0.7 },
                        })
                        setInputValues((prev) => {
                          const next = { ...prev }
                          delete next['attack.dotPoisonAttackSoundVolume']
                          return next
                        })
                      } else {
                        const num = parseFloat(value)
                        if (!isNaN(num)) {
                          setConfig({
                            ...config,
                            attack: {
                              ...config.attack,
                              dotPoisonAttackSoundVolume: Math.min(1, Math.max(0, num)),
                            },
                          })
                          setInputValues((prev) => {
                            const next = { ...prev }
                            delete next['attack.dotPoisonAttackSoundVolume']
                            return next
                          })
                        }
                      }
                    }}
                  />
                </label>
              </div>
            )}
            <div className="settings-row">
              <label>
                <input
                  type="checkbox"
                  checked={config.attack.dotBurnAttackSoundEnabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      attack: { ...config.attack, dotBurnAttackSoundEnabled: e.target.checked },
                    })
                  }
                />
                炎攻撃SE（置き換え）を有効にする
              </label>
            </div>
            {config.attack.dotBurnAttackSoundEnabled && (
              <div className="settings-row">
                <label>
                  炎攻撃SE URL:
                  <div className="settings-url-with-button">
                    <input
                      type="text"
                      value={config.attack.dotBurnAttackSoundUrl}
                      onChange={(e) => {
                        const url = e.target.value
                        if (isValidUrl(url)) {
                          setConfig({
                            ...config,
                            attack: { ...config.attack, dotBurnAttackSoundUrl: url },
                          })
                        } else {
                          setMessage('無効なURLです。http://、https://、または相対パスを入力してください。')
                          setTimeout(() => setMessage(null), 3000)
                        }
                      }}
                      placeholder="空欄の場合は置き換えなし"
                    />
                    <button
                      type="button"
                      className="settings-action-secondary settings-url-browse"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        openSoundFilePicker((dataUrl) => {
                          setConfig({
                            ...config,
                            attack: { ...config.attack, dotBurnAttackSoundUrl: dataUrl },
                          })
                        })
                      }}
                      title="音声ファイルを選んでURLに自動入力"
                    >
                      参照...
                    </button>
                  </div>
                </label>
                <label>
                  音量:
                  <input
                    type="text"
                    value={
                      inputValues['attack.dotBurnAttackSoundVolume'] ??
                      String(config.attack.dotBurnAttackSoundVolume)
                    }
                    onChange={(e) =>
                      setInputValues((prev) => ({
                        ...prev,
                        'attack.dotBurnAttackSoundVolume': e.target.value,
                      }))
                    }
                    onBlur={(e) => {
                      const value = e.target.value.trim()
                      if (value === '' || isNaN(parseFloat(value))) {
                        setConfig({
                          ...config,
                          attack: { ...config.attack, dotBurnAttackSoundVolume: 0.7 },
                        })
                        setInputValues((prev) => {
                          const next = { ...prev }
                          delete next['attack.dotBurnAttackSoundVolume']
                          return next
                        })
                      } else {
                        const num = parseFloat(value)
                        if (!isNaN(num)) {
                          setConfig({
                            ...config,
                            attack: {
                              ...config.attack,
                              dotBurnAttackSoundVolume: Math.min(1, Math.max(0, num)),
                            },
                          })
                          setInputValues((prev) => {
                            const next = { ...prev }
                            delete next['attack.dotBurnAttackSoundVolume']
                            return next
                          })
                        }
                      }
                    }}
                  />
                </label>
              </div>
            )}
          </>
        )}

        <h4 className="settings-subsection-title">配信者 — 回復（チャンネルポイント）</h4>
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
              <div className="settings-url-with-button">
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
                      setMessage('無効なURLです。http://、https://、data:audio、または相対パスを入力してください。')
                      setTimeout(() => setMessage(null), 3000)
                    }
                  }}
                  placeholder="空欄の場合は効果音なし"
                />
                <button
                  type="button"
                  className="settings-action-secondary settings-url-browse"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    openSoundFilePicker((dataUrl) => {
                      setConfig({
                        ...config,
                        heal: { ...config.heal, soundUrl: dataUrl },
                      })
                    })
                  }}
                  title="音声ファイルを選んでURLに自動入力（data:audio）"
                >
                  参照...
                </button>
              </div>
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
            例: <code>src/sounds/heal.mp3</code>（public/sounds に配置）または <code>https://...</code>
          </p>
        )}

        <h4 className="settings-subsection-title">リトライ（!retry など・蘇生）</h4>
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
              <div className="settings-url-with-button">
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
                      setMessage('無効なURLです。http://、https://、data:audio、または相対パスを入力してください。')
                      setTimeout(() => setMessage(null), 3000)
                    }
                  }}
                  placeholder="空欄の場合は効果音なし"
                />
                <button
                  type="button"
                  className="settings-action-secondary settings-url-browse"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    openSoundFilePicker((dataUrl) => {
                      setConfig({
                        ...config,
                        retry: { ...config.retry, soundUrl: dataUrl },
                      })
                    })
                  }}
                  title="音声ファイルを選んでURLに自動入力（data:audio）"
                >
                  参照...
                </button>
              </div>
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
            例: <code>src/sounds/revive.mp3</code>（public/sounds に配置）または <code>https://...</code>
          </p>
        )}

        <h4 className="settings-subsection-title">配信者HPが0になったとき</h4>
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
            <div className="settings-url-with-button">
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
                    setMessage('無効なURLです。http://、https://、data:audio、または相対パスを入力してください。')
                    setTimeout(() => setMessage(null), 3000)
                  }
                }}
                placeholder="効果音のURLを入力"
              />
              <button
                type="button"
                className="settings-action-secondary settings-url-browse"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  openSoundFilePicker((dataUrl) => {
                    setConfig({
                      ...config,
                      zeroHpSound: { ...config.zeroHpSound, soundUrl: dataUrl },
                    })
                  })
                }}
                title="音声ファイルを選んでURLに自動入力（data:audio）"
              >
                参照...
              </button>
            </div>
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
          例: <code>src/sounds/custom.mp3</code>（public/sounds に配置）または <code>https://...</code>
          。画像・WebM は「配信者」タブの HP0表示 で設定します。
        </p>

        <h4 className="settings-subsection-title">PvP — ストレングスバフ・必殺技</h4>
        <p className="settings-hint">
          PvP を有効にしている場合に使用されます（詳細は「視聴者」タブ）。
        </p>
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
                <div className="settings-url-with-button">
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
                      } else {
                        setMessage('無効なURLです。http://、https://、data:audio、または相対パスを入力してください。')
                        setTimeout(() => setMessage(null), 3000)
                      }
                    }}
                    placeholder="空欄の場合は効果音なし"
                  />
                  <button
                    type="button"
                    className="settings-action-secondary settings-url-browse"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      openSoundFilePicker((dataUrl) => {
                        setConfig({
                          ...config,
                          pvp: { ...config.pvp, strengthBuffSoundUrl: dataUrl },
                        })
                      })
                    }}
                    title="音声ファイルを選んでURLに自動入力（data:audio）"
                  >
                    参照...
                  </button>
                </div>
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
            <input
              type="checkbox"
              checked={config.pvp.finishingMoveSoundEnabled ?? false}
              onChange={(e) =>
                setConfig({
                  ...config,
                  pvp: { ...config.pvp, finishingMoveSoundEnabled: e.target.checked },
                })
              }
            />
            必殺技効果音を有効にする
          </label>
        </div>
        {config.pvp.finishingMoveSoundEnabled && (
          <div className="settings-row">
            <label>
              必殺技効果音URL:
              <div className="settings-url-with-button">
                <input
                  type="text"
                  value={config.pvp.finishingMoveSoundUrl ?? ''}
                  onChange={(e) => {
                    const url = e.target.value
                    if (url === '' || isValidUrl(url)) {
                      setConfig({
                        ...config,
                        pvp: { ...config.pvp, finishingMoveSoundUrl: url },
                      })
                    } else {
                      setMessage('無効なURLです。http://、https://、data:audio、または相対パスを入力してください。')
                      setTimeout(() => setMessage(null), 3000)
                    }
                  }}
                  placeholder="https://.../finishing-move.mp3"
                />
                <button
                  type="button"
                  className="settings-action-secondary settings-url-browse"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    openSoundFilePicker((dataUrl) => {
                      setConfig({
                        ...config,
                        pvp: { ...config.pvp, finishingMoveSoundUrl: dataUrl },
                      })
                    })
                  }}
                  title="音声ファイルを選んでURLに自動入力（data:audio）"
                >
                  参照...
                </button>
              </div>
            </label>
            <label>
              必殺技効果音音量:
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={config.pvp.finishingMoveSoundVolume ?? 0.7}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    pvp: { ...config.pvp, finishingMoveSoundVolume: parseFloat(e.target.value) || 0.7 },
                  })
                }
              />
              {Math.round((config.pvp.finishingMoveSoundVolume ?? 0.7) * 100)}%
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

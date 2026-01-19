/**
 * オーバーレイ設定UIコンポーネント
 */

import { useState, useEffect } from 'react'
import { loadOverlayConfig, saveOverlayConfig, getDefaultConfig } from '../../utils/overlayConfig'
import type { OverlayConfig } from '../../types/overlay'
import './OverlaySettings.css'

export function OverlaySettings() {
  const [config, setConfig] = useState<OverlayConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true)
        const loadedConfig = await loadOverlayConfig()
        setConfig(loadedConfig)
      } catch (error) {
        console.error('Failed to load config:', error)
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
        setMessage('設定を保存しました（ローカルストレージ）')
      } else {
        setMessage('設定の保存に失敗しました')
      }
    } catch (error) {
      setMessage('設定の保存中にエラーが発生しました')
      console.error('Failed to save config:', error)
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleReset = () => {
    if (confirm('設定をデフォルト値にリセットしますか？')) {
      setConfig(getDefaultConfig())
    }
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
        <h3>HP設定</h3>
        <div className="settings-row">
          <label>
            最大HP:
            <input
              type="number"
              min="1"
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
              type="number"
              min="0"
              max={config.hp.max}
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
              type="number"
              min="1"
              max="10"
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

      <div className="settings-section">
        <h3>攻撃設定</h3>
        <div className="settings-row">
          <label>
            リワードID:
            <input
              type="text"
              value={config.attack.rewardId}
              onChange={(e) =>
                setConfig({
                  ...config,
                  attack: { ...config.attack, rewardId: e.target.value },
                })
              }
              placeholder="チャンネルポイントリワードID"
            />
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
            ダメージ:
            <input
              type="number"
              min="1"
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
                type="number"
                min="0"
                max="100"
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
      </div>

      <div className="settings-section">
        <h3>回復設定</h3>
        <div className="settings-row">
          <label>
            リワードID:
            <input
              type="text"
              value={config.heal.rewardId}
              onChange={(e) =>
                setConfig({
                  ...config,
                  heal: { ...config.heal, rewardId: e.target.value },
                })
              }
              placeholder="チャンネルポイントリワードID"
            />
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
                type="number"
                min="1"
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
                  type="number"
                  min="1"
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
                  type="number"
                  min="1"
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
      </div>

      <div className="settings-section">
        <h3>リトライ設定</h3>
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

      <div className="settings-section">
        <h3>アニメーション設定</h3>
        <div className="settings-row">
          <label>
            アニメーション時間 (ms):
            <input
              type="number"
              min="0"
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

      <div className="settings-section">
        <h3>表示設定</h3>
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
              type="number"
              min="12"
              max="72"
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

      <div className="settings-section">
        <h3>HP0画像設定</h3>
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
              onChange={(e) =>
                setConfig({
                  ...config,
                  zeroHpImage: { ...config.zeroHpImage, imageUrl: e.target.value },
                })
              }
              placeholder="空欄の場合は otsu.png を使用"
            />
          </label>
        </div>
        <p className="settings-hint">
          例: <code>/images/custom.png</code>（public/images に配置）または{' '}
          <code>https://...</code>
        </p>
      </div>

      <div className="settings-section">
        <h3>HP0効果音設定</h3>
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
              onChange={(e) =>
                setConfig({
                  ...config,
                  zeroHpSound: { ...config.zeroHpSound, soundUrl: e.target.value },
                })
              }
              placeholder="空欄の場合は 爆発1.mp3 を使用"
            />
          </label>
        </div>
        <div className="settings-row">
          <label>
            音量:
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
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
          例: <code>/sounds/custom.mp3</code>（public/sounds に配置）または{' '}
          <code>https://...</code>
        </p>
      </div>

      <div className="settings-section">
        <h3>テストモード設定</h3>
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

      <div className="settings-actions">
        <button onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '設定を保存'}
        </button>
        <button onClick={handleReset}>リセット</button>
      </div>

      <div className="settings-info">
        <p>
          <strong>注意:</strong> 設定はローカルストレージに保存されます。
          本番環境では、設定ファイル（public/config/overlay-config.json）を直接編集するか、
          API経由で保存することを推奨します。
        </p>
        <p>
          <strong>OBSブラウザソースの設定:</strong>
        </p>
        <ul>
          <li>URL: <code>http://localhost:5173/overlay</code>（開発環境）</li>
          <li>幅: 1920px（推奨）</li>
          <li>高さ: 1080px（推奨）</li>
        </ul>
      </div>
    </div>
  )
}

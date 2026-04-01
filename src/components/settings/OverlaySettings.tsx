/**
 * オーバーレイ設定UIコンポーネント
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  type SetStateAction,
} from 'react'
import { mergePendingFieldInputs } from '../../utils/mergePendingOverlayFieldInputs'
import {
  loadOverlayConfig,
  loadOverlayConfigFromFile,
  saveOverlayConfig,
  getDefaultConfig,
  validateAndSanitizeConfig,
  DEFAULT_GAUGE_SHAPE,
} from '../../utils/overlayConfig'
import { logger } from '../../lib/logger'
import { isValidUrl } from '../../utils/security'
import { fetchObsScenesAndSources, type ObsScenesAndSourcesResult } from '../../utils/obsWebSocketList'
import type { AttackBleedVariant, AttackDebuffKind, GaugeShapeConfig, OverlayConfig } from '../../types/overlay'
import './OverlaySettings.css'

const GAUGE_SHAPE_FIELD_META: {
  shapeKey: keyof GaugeShapeConfig
  label: string
  min: number
  max: number
  int: boolean
}[] = [
    { shapeKey: 'skewDeg', label: 'スキュー角度（度・平行四辺形）', min: -60, max: 60, int: false },
    { shapeKey: 'defaultBorderRadiusPx', label: '既定デザイン・角丸（px）', min: 0, max: 200, int: true },
    { shapeKey: 'defaultBorderWhitePx', label: '既定デザイン・白枠（px）', min: 0, max: 80, int: true },
    { shapeKey: 'defaultBorderGrayPx', label: '既定デザイン・灰枠の外側（px）', min: 0, max: 160, int: true },
    { shapeKey: 'parallelogramBorderRadiusPx', label: '平行四辺形・角丸（px）', min: 0, max: 80, int: true },
    { shapeKey: 'parallelogramBorderWhitePx', label: '平行四辺形・白枠（px）', min: 0, max: 80, int: true },
    { shapeKey: 'parallelogramBorderGrayPx', label: '平行四辺形・灰枠の外側（px）', min: 0, max: 160, int: true },
    { shapeKey: 'parallelogramFramePaddingPx', label: '平行四辺形・左右余白（px）', min: 0, max: 200, int: true },
  ]

export type OverlaySettingsProps = {
  /** 親が保持する設定（指定時は内部でJSONを読み込まず親と同期） */
  config?: OverlayConfig | null
  onConfigChange?: (next: OverlayConfig) => void
  /** オーバーレイのテストパネル内表示用 */
  embedded?: boolean
}

export type OverlaySettingsHandle = {
  /** 未blurの数値テキストを config に取り込む（親の「設定を保存」から呼ぶ） */
  flushPendingFieldInputs: () => OverlayConfig | null
}

export const OverlaySettings = forwardRef<OverlaySettingsHandle, OverlaySettingsProps>(
  function OverlaySettings({ config: controlledConfig, onConfigChange, embedded = false }, ref) {
    const isControlled = onConfigChange != null
    const [internalConfig, setInternalConfig] = useState<OverlayConfig | null>(null)
    const [loading, setLoading] = useState(() => !isControlled)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
      hp: false,
      attack: false,
      heal: false,
      retry: false,
      pvp: false,
      /** アニメーション・HP表示・ゲージ色・ダメージ色 */
      visual: false,
      /** HP0時の画像・効果音・WebM */
      hpZero: false,
      /** OBS ブラウザソースの切り取り目安 */
      obsCapture: false,
      /** OBS WebSocket（ソースレイヤー操作） */
      obsWebSocket: false,
      test: false,
    })
    const [activeTab, setActiveTab] = useState<'streamer' | 'user' | 'autoReply'>(() => {
      const env = import.meta.env.VITE_OVERLAY_SETTINGS_TAB as string | undefined
      if (env === 'user' || env === 'autoReply' || env === 'streamer') return env
      return 'streamer'
    })
    const [autoReplySubTab, setAutoReplySubTab] = useState<'streamer' | 'viewer'>('streamer')
    const [showAttackRewardId, setShowAttackRewardId] = useState(false)
    const [showHealRewardId, setShowHealRewardId] = useState(false)
    const [obsListLoading, setObsListLoading] = useState(false)
    const [obsListError, setObsListError] = useState<string | null>(null)
    const [obsListData, setObsListData] = useState<ObsScenesAndSourcesResult | null>(null)
    /** OBSブラウザの対話では select/datalist が壊れやすいので、ボタン一覧で選ばせる */
    const [obsScenePickOpen, setObsScenePickOpen] = useState(false)
    const [obsSourcePickOpen, setObsSourcePickOpen] = useState(false)
    // 入力中の値を文字列として保持（空文字列を許可するため）
    const [inputValues, setInputValues] = useState<Record<string, string>>({})
    const [loadingFromFile, setLoadingFromFile] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null) // ファイル選択用のinput要素の参照
    const soundFileInputRef = useRef<HTMLInputElement>(null)
    const pendingSoundApplyRef = useRef<((dataUrl: string) => void) | null>(null)
    const handlePickedSoundFile = useCallback(
      async (file: File, applyUrl: (dataUrlOrUrl: string) => void) => {
        // "普通の" 参照ボタン挙動: 選んだファイル名をそのまま src/sounds/ 配下の相対パスとして入力する。
        // ※実ファイルのコピー/保存は行わない（ユーザーが src/sounds に配置する運用）。
        // Keep original filename (including Japanese). Only strip any path separators.
        // Browser will handle URL encoding as needed.
        const safeName = file.name
          .trim()
          .replace(/^.*[\\/]/, '')
          .slice(0, 200)

        if (!safeName) {
          throw new Error('ファイル名を取得できませんでした')
        }

        const url = `src/sounds/${safeName}`
        applyUrl(url)
        setMessage(`✅ 効果音URLを設定しました: ${url}`)
        setTimeout(() => setMessage(null), 2000)
      },
      []
    )

    const openSoundFilePicker = useCallback(async (applyUrl: (dataUrl: string) => void) => {
      // Prefer File System Access API on Chrome/Edge (lets the browser remember start location more naturally).
      const w = window as unknown as {
        showOpenFilePicker?: (options?: unknown) => Promise<Array<{ getFile: () => Promise<File> }>>
      }

      if (typeof w.showOpenFilePicker === 'function') {
        try {
          const handles = await w.showOpenFilePicker({
            multiple: false,
            types: [
              {
                description: 'Audio',
                accept: {
                  'audio/*': ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'],
                },
              },
            ],
          })
          const h = handles?.[0]
          if (!h) return

          const file = await h.getFile()
          await handlePickedSoundFile(file, applyUrl)
          return
        } catch (err) {
          // If the user cancelled, do nothing.
          const e = err as { name?: unknown; message?: unknown }
          if (e && typeof e.name === 'string' && e.name === 'AbortError') {
            return
          }
          // If saving failed, show the reason instead of silently opening another picker.
          const msg = e && typeof e.message === 'string' && e.message.trim()
            ? e.message.trim()
            : '効果音ファイルの保存に失敗しました'
          setMessage(`❌ ${msg}`)
          setTimeout(() => setMessage(null), 5000)
          return
        }
      }

      pendingSoundApplyRef.current = applyUrl
      soundFileInputRef.current?.click()
    }, [handlePickedSoundFile])

    const config = isControlled ? controlledConfig ?? null : internalConfig

    const setConfig = useCallback(
      (update: SetStateAction<OverlayConfig | null>) => {
        if (isControlled) {
          const prev = controlledConfig
          if (prev == null) return
          const next = typeof update === 'function' ? (update as (p: OverlayConfig | null) => OverlayConfig | null)(prev) : update
          if (next) onConfigChange!(next)
        } else {
          setInternalConfig(update)
        }
      },
      [isControlled, controlledConfig, onConfigChange]
    )

    useEffect(() => {
      if (!embedded || typeof window === 'undefined') return
      const t = new URLSearchParams(window.location.search).get('settingsTab')
      if (t === 'user' || t === 'streamer' || t === 'autoReply') {
        setActiveTab(t)
      }
    }, [embedded])

    useEffect(() => {
      if (isControlled) {
        setLoading(false)
        return
      }
      const loadConfig = async () => {
        try {
          setLoading(true)
          const loadedConfig = await loadOverlayConfig()
          setInternalConfig(loadedConfig)
          setInputValues({})
        } catch (error) {
          logger.error('❌ 設定の読み込みに失敗しました', error)
          setInternalConfig(getDefaultConfig())
          setInputValues({})
        } finally {
          setLoading(false)
        }
      }

      loadConfig()
    }, [isControlled])

    const flushPendingToState = useCallback((): OverlayConfig | null => {
      if (!config) return null
      const merged = mergePendingFieldInputs(config, inputValues)
      setInputValues({})
      if (isControlled) {
        onConfigChange!(merged)
      } else {
        setInternalConfig(merged)
      }
      return merged
    }, [config, inputValues, isControlled, onConfigChange])

    useImperativeHandle(
      ref,
      () => ({
        flushPendingFieldInputs: flushPendingToState,
      }),
      [flushPendingToState]
    )

    const handleSave = async () => {
      const merged = flushPendingToState()
      if (!merged) return

      try {
        setSaving(true)
        setMessage(null)
        const success = await saveOverlayConfig(merged)
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
        logger.error('❌ 設定の保存に失敗しました', error)
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
        logger.error('JSONファイルの読み込みに失敗しました', error)
        setMessage('❌ JSONファイルの読み込みに失敗しました')
        setTimeout(() => setMessage(null), 5000)
      } finally {
        setLoadingFromFile(false)
      }
    }

    const toggleSection = (sectionKey: string) => {
      setExpandedSections((prev) => {
        const nextOpen = !prev[sectionKey]
        if (sectionKey === 'obsWebSocket' && !nextOpen) {
          setObsScenePickOpen(false)
          setObsSourcePickOpen(false)
        }
        return {
          ...prev,
          [sectionKey]: nextOpen,
        }
      })
    }

    if (loading || !config) {
      return <div className="overlay-settings loading">読み込み中...</div>
    }

    return (
      <div className={`overlay-settings${embedded ? ' overlay-settings--embedded' : ''}`}>
        <input
          type="file"
          ref={soundFileInputRef}
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            const apply = pendingSoundApplyRef.current
            pendingSoundApplyRef.current = null

            if (!file || !apply) {
              if (soundFileInputRef.current) soundFileInputRef.current.value = ''
              return
            }
            try {
              await handlePickedSoundFile(file, apply)
            } catch (err) {
              const e2 = err as { message?: unknown }
              const msg =
                e2 && typeof e2.message === 'string' && e2.message.trim()
                  ? e2.message.trim()
                  : '効果音の保存に失敗しました'
              setMessage(`❌ ${msg}`)
              setTimeout(() => setMessage(null), 5000)
            } finally {
              if (soundFileInputRef.current) soundFileInputRef.current.value = ''
            }
          }}
        />
        <header className={`overlay-settings-header${embedded ? ' overlay-settings-header--embedded' : ''}`}>
          <h2>{embedded ? '設定' : 'OBS Overlay 設定'}</h2>
          {!embedded && (
            <p className="overlay-settings-desc">HPゲージ・攻撃・回復・PvP・アニメーションなど、オーバーレイの動作を設定します。</p>
          )}
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
                  <h4 className="settings-subsection-title">HPゲージの表示位置</h4>
                  <div className="settings-row">
                    <label>
                      位置X（px）:
                      <input
                        type="text"
                        value={inputValues['hp.x'] ?? String(config.hp.x)}
                        onChange={(e) => {
                          setInputValues((prev) => ({ ...prev, 'hp.x': e.target.value }))
                        }}
                        onBlur={(e) => {
                          const value = e.target.value.trim()
                          if (value === '' || Number.isNaN(parseInt(value, 10))) {
                            setConfig({
                              ...config,
                              hp: { ...config.hp, x: 0 },
                            })
                            setInputValues((prev) => {
                              const next = { ...prev }
                              delete next['hp.x']
                              return next
                            })
                          } else {
                            const num = parseInt(value, 10)
                            if (!Number.isNaN(num)) {
                              setConfig({
                                ...config,
                                hp: { ...config.hp, x: Math.min(10000, Math.max(-10000, num)) },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['hp.x']
                                return next
                              })
                            }
                          }
                        }}
                      />
                    </label>
                    <label>
                      位置Y（px）:
                      <input
                        type="text"
                        value={inputValues['hp.y'] ?? String(config.hp.y)}
                        onChange={(e) => {
                          setInputValues((prev) => ({ ...prev, 'hp.y': e.target.value }))
                        }}
                        onBlur={(e) => {
                          const value = e.target.value.trim()
                          if (value === '' || Number.isNaN(parseInt(value, 10))) {
                            setConfig({
                              ...config,
                              hp: { ...config.hp, y: 0 },
                            })
                            setInputValues((prev) => {
                              const next = { ...prev }
                              delete next['hp.y']
                              return next
                            })
                          } else {
                            const num = parseInt(value, 10)
                            if (!Number.isNaN(num)) {
                              setConfig({
                                ...config,
                                hp: { ...config.hp, y: Math.min(10000, Math.max(-10000, num)) },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['hp.y']
                                return next
                              })
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                  <p className="settings-hint">
                    画面中央を基準としたオフセットです（右・下が正）。オーバーレイ全体の中央に合わせてゲージを置く場合は 0 / 0 です。
                  </p>
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
                    <div className="settings-color-grid">
                      <div className="settings-color-row">
                        <span className="settings-color-label">MISS（回避）表示の色</span>
                        <div className="settings-color-inputs">
                          <input
                            type="color"
                            className="settings-color-picker"
                            value={
                              /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(config.attack.missTextColor)
                                ? config.attack.missTextColor
                                : '#ffffff'
                            }
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                attack: { ...config.attack, missTextColor: e.target.value },
                              })
                            }
                          />
                          <input
                            type="text"
                            className="settings-color-hex"
                            value={config.attack.missTextColor}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                attack: { ...config.attack, missTextColor: e.target.value },
                              })
                            }
                            placeholder="#ffffff"
                          />
                        </div>
                      </div>
                    </div>
                  )}
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
                    <div className="settings-row settings-row--bleed-variants">
                      <div className="settings-bleed-variants-inner">
                        <p className="settings-hint">
                          持続ダメージ（DOT）バリエーション（任意）: 各行で種類（出血／毒／炎）と数値を指定します。1 行以上かつウェイトが正の行だけが抽選されます。未設定または行が空のときは、上の単一設定が使われ、種類は出血になります。行の「数値色」が空のときは、表示設定の出血／毒／炎の既定色が使われます。
                        </p>
                        {(config.attack.bleedVariants ?? []).map((row, idx) => (
                          <div key={idx} className="settings-bleed-variant-row">
                            <label>
                              種類:
                              <select
                                value={row.debuffKind ?? 'bleed'}
                                onChange={(e) => {
                                  const kind = e.target.value as AttackDebuffKind
                                  const variants = [...(config.attack.bleedVariants ?? [])]
                                  variants[idx] = { ...variants[idx], debuffKind: kind }
                                  setConfig({
                                    ...config,
                                    attack: { ...config.attack, bleedVariants: variants },
                                  })
                                }}
                              >
                                <option value="bleed">出血</option>
                                <option value="poison">毒</option>
                                <option value="burn">炎</option>
                              </select>
                            </label>
                            <label>
                              ウェイト:
                              <input
                                type="text"
                                inputMode="decimal"
                                value={
                                  inputValues[`attack.bleedVariants.${idx}.weight`] ?? String(row.weight)
                                }
                                onChange={(e) =>
                                  setInputValues((prev) => ({
                                    ...prev,
                                    [`attack.bleedVariants.${idx}.weight`]: e.target.value,
                                  }))
                                }
                                onBlur={(e) => {
                                  const value = e.target.value.trim()
                                  const variants = [...(config.attack.bleedVariants ?? [])]
                                  if (value === '' || isNaN(parseFloat(value))) {
                                    variants[idx] = { ...variants[idx], weight: 1 }
                                    setConfig({
                                      ...config,
                                      attack: { ...config.attack, bleedVariants: variants },
                                    })
                                  } else {
                                    const num = parseFloat(value)
                                    if (!isNaN(num)) {
                                      variants[idx] = { ...variants[idx], weight: Math.max(0, num) }
                                      setConfig({
                                        ...config,
                                        attack: { ...config.attack, bleedVariants: variants },
                                      })
                                    }
                                  }
                                  setInputValues((prev) => {
                                    const next = { ...prev }
                                    delete next[`attack.bleedVariants.${idx}.weight`]
                                    return next
                                  })
                                }}
                              />
                            </label>
                            <label>
                              ティック:
                              <input
                                type="text"
                                inputMode="numeric"
                                value={
                                  inputValues[`attack.bleedVariants.${idx}.damage`] ?? String(row.damage)
                                }
                                onChange={(e) =>
                                  setInputValues((prev) => ({
                                    ...prev,
                                    [`attack.bleedVariants.${idx}.damage`]: e.target.value,
                                  }))
                                }
                                onBlur={(e) => {
                                  const value = e.target.value.trim()
                                  const variants = [...(config.attack.bleedVariants ?? [])]
                                  if (value === '' || isNaN(parseInt(value, 10))) {
                                    variants[idx] = { ...variants[idx], damage: 1 }
                                    setConfig({
                                      ...config,
                                      attack: { ...config.attack, bleedVariants: variants },
                                    })
                                  } else {
                                    const num = parseInt(value, 10)
                                    if (!isNaN(num)) {
                                      variants[idx] = { ...variants[idx], damage: Math.max(1, num) }
                                      setConfig({
                                        ...config,
                                        attack: { ...config.attack, bleedVariants: variants },
                                      })
                                    }
                                  }
                                  setInputValues((prev) => {
                                    const next = { ...prev }
                                    delete next[`attack.bleedVariants.${idx}.damage`]
                                    return next
                                  })
                                }}
                              />
                            </label>
                            <label>
                              持続(秒):
                              <input
                                type="text"
                                inputMode="decimal"
                                value={
                                  inputValues[`attack.bleedVariants.${idx}.duration`] ??
                                  String(row.duration)
                                }
                                onChange={(e) =>
                                  setInputValues((prev) => ({
                                    ...prev,
                                    [`attack.bleedVariants.${idx}.duration`]: e.target.value,
                                  }))
                                }
                                onBlur={(e) => {
                                  const value = e.target.value.trim()
                                  const variants = [...(config.attack.bleedVariants ?? [])]
                                  if (value === '' || isNaN(parseFloat(value))) {
                                    variants[idx] = { ...variants[idx], duration: 10 }
                                    setConfig({
                                      ...config,
                                      attack: { ...config.attack, bleedVariants: variants },
                                    })
                                  } else {
                                    const num = parseFloat(value)
                                    if (!isNaN(num)) {
                                      variants[idx] = { ...variants[idx], duration: Math.max(1, num) }
                                      setConfig({
                                        ...config,
                                        attack: { ...config.attack, bleedVariants: variants },
                                      })
                                    }
                                  }
                                  setInputValues((prev) => {
                                    const next = { ...prev }
                                    delete next[`attack.bleedVariants.${idx}.duration`]
                                    return next
                                  })
                                }}
                              />
                            </label>
                            <label>
                              間隔:
                              <input
                                type="text"
                                inputMode="decimal"
                                value={
                                  inputValues[`attack.bleedVariants.${idx}.interval`] ??
                                  String(row.interval)
                                }
                                onChange={(e) =>
                                  setInputValues((prev) => ({
                                    ...prev,
                                    [`attack.bleedVariants.${idx}.interval`]: e.target.value,
                                  }))
                                }
                                onBlur={(e) => {
                                  const value = e.target.value.trim()
                                  const variants = [...(config.attack.bleedVariants ?? [])]
                                  if (value === '' || isNaN(parseFloat(value))) {
                                    variants[idx] = { ...variants[idx], interval: 1 }
                                    setConfig({
                                      ...config,
                                      attack: { ...config.attack, bleedVariants: variants },
                                    })
                                  } else {
                                    const num = parseFloat(value)
                                    if (!isNaN(num)) {
                                      variants[idx] = { ...variants[idx], interval: Math.max(0.1, num) }
                                      setConfig({
                                        ...config,
                                        attack: { ...config.attack, bleedVariants: variants },
                                      })
                                    }
                                  }
                                  setInputValues((prev) => {
                                    const next = { ...prev }
                                    delete next[`attack.bleedVariants.${idx}.interval`]
                                    return next
                                  })
                                }}
                              />
                            </label>
                            <label>
                              数値色:
                              <input
                                type="text"
                                placeholder="種別の既定色を使用"
                                value={
                                  inputValues[`attack.bleedVariants.${idx}.damageColor`] ??
                                  row.damageColor ??
                                  ''
                                }
                                onChange={(e) =>
                                  setInputValues((prev) => ({
                                    ...prev,
                                    [`attack.bleedVariants.${idx}.damageColor`]: e.target.value,
                                  }))
                                }
                                onBlur={(e) => {
                                  const raw = e.target.value.trim()
                                  const variants = [...(config.attack.bleedVariants ?? [])]
                                  const nextVal: AttackBleedVariant = { ...variants[idx] }
                                  if (raw === '') {
                                    delete nextVal.damageColor
                                  } else {
                                    nextVal.damageColor = raw
                                  }
                                  variants[idx] = nextVal
                                  setConfig({
                                    ...config,
                                    attack: { ...config.attack, bleedVariants: variants },
                                  })
                                  setInputValues((prev) => {
                                    const next = { ...prev }
                                    delete next[`attack.bleedVariants.${idx}.damageColor`]
                                    return next
                                  })
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              className="settings-action-secondary"
                              onClick={() => {
                                const prevList = config.attack.bleedVariants ?? []
                                const nextList = prevList.filter((_, j) => j !== idx)
                                setInputValues((prev) => {
                                  const next = { ...prev }
                                  for (const k of Object.keys(next)) {
                                    if (k.startsWith('attack.bleedVariants.')) delete next[k]
                                  }
                                  return next
                                })
                                setConfig({
                                  ...config,
                                  attack: {
                                    ...config.attack,
                                    bleedVariants: nextList.length > 0 ? nextList : undefined,
                                  },
                                })
                              }}
                            >
                              削除
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="settings-action-secondary"
                          onClick={() => {
                            const a = config.attack
                            const row: AttackBleedVariant = {
                              weight: 1,
                              damage: a.bleedDamage,
                              duration: a.bleedDuration,
                              interval: a.bleedInterval,
                              debuffKind: 'bleed',
                            }
                            setInputValues((prev) => {
                              const next = { ...prev }
                              for (const k of Object.keys(next)) {
                                if (k.startsWith('attack.bleedVariants.')) delete next[k]
                              }
                              return next
                            })
                            setConfig({
                              ...config,
                              attack: {
                                ...a,
                                bleedVariants: [...(a.bleedVariants ?? []), row],
                              },
                            })
                          }}
                        >
                          バリエーション行を追加
                        </button>
                      </div>
                    </div>
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
                      例: <code>src/sounds/bleed.mp3</code>（public/sounds に配置）または{' '}
                      <code>https://...</code>
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
                      例: <code>src/sounds/attack.mp3</code>（public/sounds に配置）または{' '}
                      <code>https://...</code>
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
                              value={inputValues['attack.dotPoisonAttackSoundVolume'] ?? String(config.attack.dotPoisonAttackSoundVolume)}
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
                              value={inputValues['attack.dotBurnAttackSoundVolume'] ?? String(config.attack.dotBurnAttackSoundVolume)}
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
                      例: <code>src/sounds/revive.mp3</code>（public/sounds に配置）または{' '}
                      <code>https://...</code>
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="settings-section">
              <h3 className="settings-section-header" onClick={() => toggleSection('visual')}>
                <span className="accordion-icon">{expandedSections.visual ? '▼' : '▶'}</span>
                表示・アニメーション・色
              </h3>
              {expandedSections.visual && (
                <div className="settings-section-content">
                  <h4 className="settings-subsection-title">アニメーション</h4>
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

                  <h4 className="settings-subsection-title">背景（クロマキー/透明/任意色）</h4>
                  <div className="settings-hint">
                    <p>
                      透明にしたい場合は「透明」を選んでください（OBS側でもブラウザソースの背景が透過として扱われる必要があります）。
                    </p>
                  </div>
                  <div className="settings-row">
                    <label>
                      <input
                        type="radio"
                        name="overlay-bg-mode"
                        checked={config.background.mode === 'green'}
                        onChange={() => setConfig({ ...config, background: { ...config.background, mode: 'green' } })}
                      />
                      グリーン（クロマキー用）
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="overlay-bg-mode"
                        checked={config.background.mode === 'transparent'}
                        onChange={() => setConfig({ ...config, background: { ...config.background, mode: 'transparent' } })}
                      />
                      透明
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="overlay-bg-mode"
                        checked={config.background.mode === 'dark-gray'}
                        onChange={() => setConfig({ ...config, background: { ...config.background, mode: 'dark-gray' } })}
                      />
                      濃いグレー（プレビュー用）
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="overlay-bg-mode"
                        checked={config.background.mode === 'custom'}
                        onChange={() => setConfig({ ...config, background: { ...config.background, mode: 'custom' } })}
                      />
                      カスタム
                    </label>
                  </div>
                  {config.background.mode === 'custom' && (
                    <div className="settings-row">
                      <label>
                        カスタム色（CSSカラー / #RRGGBB）:
                        <input
                          type="text"
                          value={config.background.customColor}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              background: { ...config.background, customColor: e.target.value },
                            })
                          }
                          placeholder="#00ff00"
                        />
                      </label>
                    </div>
                  )}
                  <h4 className="settings-subsection-title">HP表示</h4>
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
                  <div className="settings-row">
                    <label>
                      ゲージの形（デザインパターン）:
                      <select
                        value={config.display.gaugeDesign ?? 'default'}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            display: {
                              ...config.display,
                              gaugeDesign: e.target.value as 'default' | 'parallelogram',
                            },
                          })
                        }
                      >
                        <option value="default">既定（角丸・二重枠）</option>
                        <option value="parallelogram">平行四辺形（スラント）</option>
                      </select>
                    </label>
                  </div>
                  <h4 className="settings-subsection-title">ゲージ枠の微調整</h4>
                  <p className="settings-hint">
                    数値はテキストで入力できます。空のままフォーカスを外すと項目ごとの初期値に戻ります。
                  </p>
                  <div className="settings-row">
                    {GAUGE_SHAPE_FIELD_META.map(({ shapeKey, label, min, max, int }) => {
                      const inputKey = `display.gaugeShape.${shapeKey}`
                      const fallback = DEFAULT_GAUGE_SHAPE[shapeKey]
                      return (
                        <label key={shapeKey}>
                          {label}:
                          <input
                            type="text"
                            value={
                              inputValues[inputKey] ?? String(config.display.gaugeShape[shapeKey])
                            }
                            onChange={(e) =>
                              setInputValues((prev) => ({ ...prev, [inputKey]: e.target.value }))
                            }
                            onBlur={(e) => {
                              const raw = e.target.value.trim()
                              if (raw === '') {
                                setConfig({
                                  ...config,
                                  display: {
                                    ...config.display,
                                    gaugeShape: {
                                      ...config.display.gaugeShape,
                                      [shapeKey]: fallback,
                                    },
                                  },
                                })
                                setInputValues((prev) => {
                                  const next = { ...prev }
                                  delete next[inputKey]
                                  return next
                                })
                                return
                              }
                              const num = int ? Math.round(parseFloat(raw)) : parseFloat(raw)
                              if (!Number.isFinite(num)) {
                                setConfig({
                                  ...config,
                                  display: {
                                    ...config.display,
                                    gaugeShape: {
                                      ...config.display.gaugeShape,
                                      [shapeKey]: fallback,
                                    },
                                  },
                                })
                                setInputValues((prev) => {
                                  const next = { ...prev }
                                  delete next[inputKey]
                                  return next
                                })
                                return
                              }
                              const clamped = int
                                ? Math.min(max, Math.max(min, num))
                                : Math.min(max, Math.max(min, Math.round(num * 1000) / 1000))
                              setConfig({
                                ...config,
                                display: {
                                  ...config.display,
                                  gaugeShape: {
                                    ...config.display.gaugeShape,
                                    [shapeKey]: clamped,
                                  },
                                },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next[inputKey]
                                return next
                              })
                            }}
                          />
                        </label>
                      )
                    })}
                  </div>
                  <h4 className="settings-subsection-title">ゲージの色</h4>
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
                      <span className="settings-color-label">3ゲージ目以降（パターン1）</span>
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
                      <span className="settings-color-label">3ゲージ目以降（パターン2）</span>
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
                  <h4 className="settings-subsection-title">枠・外形の色</h4>
                  <div className="settings-hint">
                    <p>ゲージのベース背景と二重枠（内側／外側リング）です。既定デザイン・平行四辺形のどちらにも適用されます。</p>
                  </div>
                  <div className="settings-color-grid">
                    <div className="settings-color-row">
                      <span className="settings-color-label">枠内の背景</span>
                      <div className="settings-color-inputs">
                        <input
                          type="color"
                          className="settings-color-picker"
                          value={
                            /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(config.gaugeColors.frameBackground)
                              ? config.gaugeColors.frameBackground
                              : '#000000'
                          }
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              gaugeColors: { ...config.gaugeColors, frameBackground: e.target.value },
                            })
                          }
                        />
                        <input
                          type="text"
                          className="settings-color-hex"
                          value={config.gaugeColors.frameBackground}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              gaugeColors: { ...config.gaugeColors, frameBackground: e.target.value },
                            })
                          }
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                    <div className="settings-color-row">
                      <span className="settings-color-label">内側の枠（リング）</span>
                      <div className="settings-color-inputs">
                        <input
                          type="color"
                          className="settings-color-picker"
                          value={
                            /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(config.gaugeColors.frameBorderInner)
                              ? config.gaugeColors.frameBorderInner
                              : '#ffffff'
                          }
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              gaugeColors: { ...config.gaugeColors, frameBorderInner: e.target.value },
                            })
                          }
                        />
                        <input
                          type="text"
                          className="settings-color-hex"
                          value={config.gaugeColors.frameBorderInner}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              gaugeColors: { ...config.gaugeColors, frameBorderInner: e.target.value },
                            })
                          }
                          placeholder="#ffffff"
                        />
                      </div>
                    </div>
                    <div className="settings-color-row">
                      <span className="settings-color-label">外側の枠（リング）</span>
                      <div className="settings-color-inputs">
                        <input
                          type="color"
                          className="settings-color-picker"
                          value={
                            /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(config.gaugeColors.frameBorderOuter)
                              ? config.gaugeColors.frameBorderOuter
                              : '#808080'
                          }
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              gaugeColors: { ...config.gaugeColors, frameBorderOuter: e.target.value },
                            })
                          }
                        />
                        <input
                          type="text"
                          className="settings-color-hex"
                          value={config.gaugeColors.frameBorderOuter}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              gaugeColors: { ...config.gaugeColors, frameBorderOuter: e.target.value },
                            })
                          }
                          placeholder="#808080"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="settings-hint">
                    <p>
                      <strong>注意:</strong> 3ゲージ目以降は、設定した2色を交互に使用します。ゲージ数が10を超えても、この2色が繰り返し適用されます。
                    </p>
                  </div>
                  <h4 className="settings-subsection-title">ダメージ数値の色</h4>
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
                      <span className="settings-color-label">出血DOT</span>
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
                    <div className="settings-color-row">
                      <span className="settings-color-label">毒DOT</span>
                      <div className="settings-color-inputs">
                        <input
                          type="color"
                          className="settings-color-picker"
                          value={config.damageColors.dotPoison}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              damageColors: { ...config.damageColors, dotPoison: e.target.value },
                            })
                          }
                        />
                        <input
                          type="text"
                          className="settings-color-hex"
                          value={config.damageColors.dotPoison}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              damageColors: { ...config.damageColors, dotPoison: e.target.value },
                            })
                          }
                          placeholder="#66dd88"
                        />
                      </div>
                    </div>
                    <div className="settings-color-row">
                      <span className="settings-color-label">炎DOT</span>
                      <div className="settings-color-inputs">
                        <input
                          type="color"
                          className="settings-color-picker"
                          value={config.damageColors.dotBurn}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              damageColors: { ...config.damageColors, dotBurn: e.target.value },
                            })
                          }
                        />
                        <input
                          type="text"
                          className="settings-color-hex"
                          value={config.damageColors.dotBurn}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              damageColors: { ...config.damageColors, dotBurn: e.target.value },
                            })
                          }
                          placeholder="#ff9944"
                        />
                      </div>
                    </div>
                  </div>
                  <h4 className="settings-subsection-title">回復数値の色</h4>
                  <div className="settings-color-grid">
                    <div className="settings-color-row">
                      <span className="settings-color-label">回復（+数値）</span>
                      <div className="settings-color-inputs">
                        <input
                          type="color"
                          className="settings-color-picker"
                          value={config.healColors.normal}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              healColors: { ...config.healColors, normal: e.target.value },
                            })
                          }
                        />
                        <input
                          type="text"
                          className="settings-color-hex"
                          value={config.healColors.normal}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              healColors: { ...config.healColors, normal: e.target.value },
                            })
                          }
                          placeholder="#00ff88"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="settings-section">
              <h3 className="settings-section-header" onClick={() => toggleSection('hpZero')}>
                <span className="accordion-icon">{expandedSections.hpZero ? '▼' : '▶'}</span>
                HPが0のときの演出
              </h3>
              {expandedSections.hpZero && (
                <div className="settings-section-content">
                  <h4 className="settings-subsection-title">画像</h4>
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
                  <div className="settings-row">
                    <label>
                      スケール倍率:
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={config.zeroHpImage.scale}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            zeroHpImage: {
                              ...config.zeroHpImage,
                              scale: Number(e.target.value) || 1,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      背景色 (CSSカラー):
                      <input
                        type="text"
                        value={config.zeroHpImage.backgroundColor}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            zeroHpImage: {
                              ...config.zeroHpImage,
                              backgroundColor: e.target.value,
                            },
                          })
                        }
                        placeholder="例: transparent, #000000, rgba(0,0,0,0.7)"
                      />
                    </label>
                    <label>
                      オフセットX (px):
                      <input
                        type="number"
                        value={config.zeroHpImage.offsetX}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            zeroHpImage: {
                              ...config.zeroHpImage,
                              offsetX: Number(e.target.value) || 0,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      オフセットY (px):
                      <input
                        type="number"
                        value={config.zeroHpImage.offsetY}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            zeroHpImage: {
                              ...config.zeroHpImage,
                              offsetY: Number(e.target.value) || 0,
                            },
                          })
                        }
                      />
                    </label>
                  </div>
                  <p className="settings-hint">
                    例: <code>src/images/custom.png</code>（public/images に配置）または{' '}
                    <code>https://...</code>
                  </p>
                  <h4 className="settings-subsection-title">効果音</h4>
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
                    例: <code>src/sounds/custom.mp3</code>（public/sounds に配置）または{' '}
                    <code>https://...</code>
                  </p>
                  <h4 className="settings-subsection-title">動画（WebM）</h4>
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
              <h3 className="settings-section-header" onClick={() => toggleSection('obsCapture')}>
                <span className="accordion-icon">{expandedSections.obsCapture ? '▼' : '▶'}</span>
                OBS キャプチャの目安表示
              </h3>
              {expandedSections.obsCapture && (
                <div className="settings-section-content">
                  <div className="settings-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={config.obsCaptureGuide.enabled}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            obsCaptureGuide: { ...config.obsCaptureGuide, enabled: e.target.checked },
                          })
                        }
                      />
                      切り取り範囲のガイドを表示する
                    </label>
                  </div>
                  <div className="settings-hint">
                    <p>
                      ブラウザソースで OBS に取り込むときの切り取り（クロップ）の目安です。角のマーカーと枠で表示領域の境界が分かります。配信本番では必ず OFF にしてください。
                    </p>
                  </div>
                  <div className="settings-row">
                    <label>
                      画面端からの余白（px）:
                      <input
                        type="text"
                        value={inputValues['obsCaptureGuide.insetPx'] ?? String(config.obsCaptureGuide.insetPx)}
                        onChange={(e) => {
                          setInputValues((prev) => ({ ...prev, 'obsCaptureGuide.insetPx': e.target.value }))
                        }}
                        onBlur={(e) => {
                          const value = e.target.value.trim()
                          if (value === '' || Number.isNaN(parseInt(value, 10))) {
                            setConfig({
                              ...config,
                              obsCaptureGuide: { ...config.obsCaptureGuide, insetPx: 16 },
                            })
                            setInputValues((prev) => {
                              const next = { ...prev }
                              delete next['obsCaptureGuide.insetPx']
                              return next
                            })
                          } else {
                            const num = parseInt(value, 10)
                            if (!Number.isNaN(num)) {
                              setConfig({
                                ...config,
                                obsCaptureGuide: {
                                  ...config.obsCaptureGuide,
                                  insetPx: Math.min(400, Math.max(0, num)),
                                },
                              })
                              setInputValues((prev) => {
                                const next = { ...prev }
                                delete next['obsCaptureGuide.insetPx']
                                return next
                              })
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                  <p className="settings-hint">0〜400。角ガイドが画面端で欠けないようにするためのオフセットです。</p>
                </div>
              )}
            </div>

            <div className="settings-section obs-ws-settings">
              <h3 className="settings-section-header" onClick={() => toggleSection('obsWebSocket')}>
                <span className="accordion-icon">{expandedSections.obsWebSocket ? '▼' : '▶'}</span>
                OBS WebSocket API（ソースレイヤー操作）
              </h3>
              {expandedSections.obsWebSocket && (
                <div className="settings-section-content settings-section-content--obs-ws">
                  <div className="settings-hint">
                    <p>
                      OBS 28 以降は追加プラグインなしで WebSocket（v5）が使えます。OBS の「ツール」→「WebSocket サーバー設定」でポート（既定 4455）とパスワードを確認してください。
                    </p>
                  </div>
                  <div className="settings-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={config.obsWebSocket.enabled}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            obsWebSocket: { ...config.obsWebSocket, enabled: e.target.checked },
                          })
                        }
                      />
                      OBS WebSocket でソースの位置・スケール演出を行う（ダメージ／回復等と連動させる場合）
                    </label>
                  </div>
                  <div className="settings-row">
                    <label>
                      ホスト:
                      <input
                        type="text"
                        style={{ marginLeft: '0.5rem' }}
                        value={config.obsWebSocket.host}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            obsWebSocket: { ...config.obsWebSocket, host: e.target.value },
                          })
                        }
                        placeholder="localhost"
                      />
                    </label>
                  </div>
                  <div className="settings-row">
                    <label>
                      ポート:
                      <input
                        type="number"
                        min={1}
                        max={65535}
                        style={{ marginLeft: '0.5rem', width: '6rem' }}
                        value={config.obsWebSocket.port}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10)
                          if (Number.isNaN(n)) return
                          setConfig({
                            ...config,
                            obsWebSocket: {
                              ...config.obsWebSocket,
                              port: Math.min(65535, Math.max(1, n)),
                            },
                          })
                        }}
                      />
                    </label>
                  </div>
                  <div className="settings-row">
                    <label>
                      パスワード（未設定なら空欄）:
                      <input
                        type="password"
                        autoComplete="off"
                        style={{ marginLeft: '0.5rem', width: '12rem' }}
                        value={config.obsWebSocket.password}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            obsWebSocket: { ...config.obsWebSocket, password: e.target.value },
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="settings-row">
                    <button
                      type="button"
                      className="test-button test-reload"
                      style={{ width: 'auto', padding: '0.4rem 0.75rem' }}
                      disabled={obsListLoading}
                      onClick={async () => {
                        setObsListError(null)
                        setObsListLoading(true)
                        try {
                          const data = await fetchObsScenesAndSources({
                            host: config.obsWebSocket.host,
                            port: config.obsWebSocket.port,
                            password: config.obsWebSocket.password,
                          })
                          setObsListData(data)
                        } catch (err) {
                          setObsListData(null)
                          const msg =
                            err instanceof Error ? err.message : 'OBS WebSocket への接続に失敗しました'
                          setObsListError(msg)
                          logger.warn('[OBS WebSocket] 一覧取得失敗', err)
                        } finally {
                          setObsListLoading(false)
                        }
                      }}
                    >
                      {obsListLoading ? '接続中…' : 'シーン・ソース一覧を取得'}
                    </button>
                  </div>

                  {obsListError && (
                    <p className="settings-hint" style={{ color: '#ff8888' }}>
                      {obsListError}
                    </p>
                  )}
                  {obsListData && !obsListError && (
                    <p className="settings-hint">
                      取得済み: シーン {obsListData.sceneNames.length} 件
                      {obsListData.currentProgramSceneName
                        ? `（現在のプログラムシーン: ${obsListData.currentProgramSceneName}）`
                        : ''}
                    </p>
                  )}

                  {(() => {
                    const effectiveScene =
                      config.obsWebSocket.sceneName.trim() ||
                      obsListData?.currentProgramSceneName.trim() ||
                      ''
                    const sourcesForPick =
                      effectiveScene && obsListData?.sourcesByScene
                        ? obsListData.sourcesByScene[effectiveScene] ?? []
                        : []

                    return (
                      <>
                        <div className="settings-row obs-ws-field-block">
                          <label>
                            対象シーン（空欄＝現在のプログラムシーン）:
                            <input
                              type="text"
                              className="obs-ws-text-input"
                              autoComplete="off"
                              spellCheck={false}
                              value={config.obsWebSocket.sceneName}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  obsWebSocket: { ...config.obsWebSocket, sceneName: e.target.value },
                                })
                              }
                              placeholder="空欄 or シーン名を入力"
                            />
                          </label>
                          {obsListData && obsListData.sceneNames.length > 0 && (
                            <div className="obs-ws-pick-wrap">
                              <button
                                type="button"
                                className="obs-ws-pick-toggle"
                                onClick={() => {
                                  setObsScenePickOpen((o) => !o)
                                  setObsSourcePickOpen(false)
                                }}
                              >
                                {obsScenePickOpen ? 'シーン候補を閉じる' : 'シーン候補から選ぶ（OBS対話向け）'}
                              </button>
                              {obsScenePickOpen && (
                                <div className="obs-ws-pick-chips" role="list">
                                  <button
                                    type="button"
                                    className="obs-ws-pick-chip"
                                    onClick={() => {
                                      setConfig({
                                        ...config,
                                        obsWebSocket: { ...config.obsWebSocket, sceneName: '' },
                                      })
                                      setObsScenePickOpen(false)
                                    }}
                                  >
                                    （プログラムシーン・空欄）
                                  </button>
                                  {obsListData.sceneNames.map((name) => (
                                    <button
                                      key={name}
                                      type="button"
                                      className="obs-ws-pick-chip"
                                      onClick={() => {
                                        setConfig({
                                          ...config,
                                          obsWebSocket: { ...config.obsWebSocket, sceneName: name },
                                        })
                                        setObsScenePickOpen(false)
                                      }}
                                    >
                                      {name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="settings-row obs-ws-field-block">
                          <label>
                            対象ソース（レイヤー名）:
                            <input
                              type="text"
                              className="obs-ws-text-input"
                              autoComplete="off"
                              spellCheck={false}
                              value={config.obsWebSocket.sourceName}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  obsWebSocket: { ...config.obsWebSocket, sourceName: e.target.value },
                                })
                              }
                              placeholder="ソース名を入力"
                            />
                          </label>
                          {obsListData && sourcesForPick.length > 0 && (
                            <div className="obs-ws-pick-wrap">
                              <button
                                type="button"
                                className="obs-ws-pick-toggle"
                                onClick={() => {
                                  setObsSourcePickOpen((o) => !o)
                                  setObsScenePickOpen(false)
                                }}
                              >
                                {obsSourcePickOpen ? 'ソース候補を閉じる' : 'ソース候補から選ぶ（OBS対話向け）'}
                              </button>
                              {obsSourcePickOpen && (
                                <div className="obs-ws-pick-chips obs-ws-pick-chips--scroll" role="list">
                                  {sourcesForPick.map((sn) => (
                                    <button
                                      key={sn}
                                      type="button"
                                      className="obs-ws-pick-chip"
                                      onClick={() => {
                                        setConfig({
                                          ...config,
                                          obsWebSocket: { ...config.obsWebSocket, sourceName: sn },
                                        })
                                        setObsSourcePickOpen(false)
                                      }}
                                    >
                                      {sn}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="settings-hint">
                          OBS のブラウザソース「対話」では、 OS 標準のプルダウン（select / datalist）が動かないことがあります。候補は上のボタンから選んでください。シーン未指定時のソース一覧は、一覧取得時点のプログラムシーンに基づきます。
                        </p>
                      </>
                    )
                  })()}
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
                  <div className="settings-row" style={{ marginTop: '1rem', fontWeight: 'bold' }}>
                    必殺技設定
                  </div>
                  <div className="settings-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={config.pvp.viewerFinishingMoveEnabled ?? true}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            pvp: { ...config.pvp, viewerFinishingMoveEnabled: e.target.checked },
                          })
                        }
                      />
                      必殺技を有効にする
                    </label>
                  </div>
                  {config.pvp.viewerFinishingMoveEnabled && (
                    <>
                      <div className="settings-row">
                        <label>
                          必殺技発動確率 (%):
                          <input
                            type="number"
                            inputMode="numeric"
                            step="0.01"
                            min="0"
                            max="100"
                            value={inputValues['pvp.viewerFinishingMoveProbability'] ?? String(config.pvp.viewerFinishingMoveProbability ?? 0.01)}
                            onChange={(e) => {
                              setInputValues((prev) => ({ ...prev, 'pvp.viewerFinishingMoveProbability': e.target.value }))
                            }}
                            onBlur={(e) => {
                              const value = e.target.value.trim()
                              const num = value === '' ? 0.01 : parseFloat(value)
                              if (!isNaN(num) && num >= 0 && num <= 100) {
                                const rounded = Math.round(num * 100) / 100
                                setConfig((prev) => prev ? { ...prev, pvp: { ...prev.pvp, viewerFinishingMoveProbability: rounded } } : prev)
                                setInputValues((prev) => {
                                  const next = { ...prev }
                                  delete next['pvp.viewerFinishingMoveProbability']
                                  return next
                                })
                              } else {
                                setConfig((prev) => prev ? { ...prev, pvp: { ...prev.pvp, viewerFinishingMoveProbability: prev.pvp.viewerFinishingMoveProbability ?? 0.01 } } : prev)
                                setInputValues((prev) => {
                                  const next = { ...prev }
                                  delete next['pvp.viewerFinishingMoveProbability']
                                  return next
                                })
                              }
                            }}
                          />
                        </label>
                        <label>
                          必殺技ダメージ倍率:
                          <input
                            type="text"
                            inputMode="numeric"
                            value={inputValues['pvp.viewerFinishingMoveMultiplier'] ?? String(config.pvp.viewerFinishingMoveMultiplier ?? 10)}
                            onChange={(e) => {
                              setInputValues((prev) => ({ ...prev, 'pvp.viewerFinishingMoveMultiplier': e.target.value }))
                            }}
                            onBlur={(e) => {
                              const value = e.target.value.trim()
                              const num = value === '' ? 10 : parseFloat(value)
                              if (!isNaN(num) && num >= 1) {
                                setConfig((prev) => prev ? { ...prev, pvp: { ...prev.pvp, viewerFinishingMoveMultiplier: num } } : prev)
                                setInputValues((prev) => {
                                  const next = { ...prev }
                                  delete next['pvp.viewerFinishingMoveMultiplier']
                                  return next
                                })
                              } else {
                                setConfig((prev) => prev ? { ...prev, pvp: { ...prev.pvp, viewerFinishingMoveMultiplier: prev.pvp.viewerFinishingMoveMultiplier ?? 10 } } : prev)
                                setInputValues((prev) => {
                                  const next = { ...prev }
                                  delete next['pvp.viewerFinishingMoveMultiplier']
                                  return next
                                })
                              }
                            }}
                          />
                        </label>
                      </div>
                      <div className="settings-row">
                        <label>
                          必殺技表示テキスト:
                          <input
                            type="text"
                            value={config.pvp.finishingMoveText ?? '必殺技！'}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                pvp: { ...config.pvp, finishingMoveText: e.target.value },
                              })
                            }
                            placeholder="必殺技！"
                          />
                        </label>
                      </div>
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
                    </>
                  )}
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

        {!embedded && (
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

                  setConfig(validated)
                  setInputValues({})
                  setMessage('✅ 設定ファイルを読み込みました。保存するには「設定を保存」を押してください。')
                  setTimeout(() => setMessage(null), 3000)
                  logger.info('✅ 設定ファイルを読み込みました')
                } catch (error) {
                  logger.error('❌ 設定ファイルの読み込みに失敗しました:', error)
                  setMessage('❌ 設定ファイルの読み込みに失敗しました。JSON形式が正しいか確認してください。')
                  setTimeout(() => setMessage(null), 5000)
                } finally {
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
        )}

        {embedded && (
          <div className="settings-actions settings-actions--embedded">
            <button
              type="button"
              className="settings-action-secondary"
              onClick={handleLoadFromFile}
              disabled={loadingFromFile}
              title="public/config/overlay-config.json の内容でフォームを上書きします"
            >
              {loadingFromFile ? '読み込み中...' : 'JSONから再読込'}
            </button>
            <button type="button" className="settings-action-reset" onClick={handleReset}>
              リセット
            </button>
          </div>
        )}

        {!embedded && (
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
        )}
      </div>
    )
  })

OverlaySettings.displayName = 'OverlaySettings'


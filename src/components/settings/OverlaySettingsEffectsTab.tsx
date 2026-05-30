/**
 * 視覚エフェクトまとめタブ（攻撃・回復・蘇生・HP0・DOT・フィルター等）
 */

import type { Dispatch, SetStateAction } from 'react'
import type { ComboRouletteOverlayVisual, EffectFilterConfig, OverlayConfig } from '../../types/overlay'
import { isValidUrl } from '../../utils/security'

export type OverlaySettingsEffectsTabProps = {
  config: OverlayConfig
  setConfig: Dispatch<SetStateAction<OverlayConfig | null>>
  inputValues: Record<string, string>
  setInputValues: Dispatch<SetStateAction<Record<string, string>>>
  setMessage: Dispatch<SetStateAction<string | null>>
}

function parseComboRouletteVisual(value: string): ComboRouletteOverlayVisual {
  if (value === 'glassCanvas') return 'glassCanvas'
  if (value === 'slashArc') return 'slashArc'
  return 'webm'
}

function EffectFilterSliders({
  label,
  filter,
  onChange,
}: {
  label: string
  filter: EffectFilterConfig
  onChange: (next: EffectFilterConfig) => void
}) {
  return (
    <div>
      <p className="settings-hint">
        <strong>{label}</strong>
      </p>
      <div className="settings-row">
        <label>
          Sepia（0〜1）: {filter.sepia}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={filter.sepia}
            onChange={(e) => onChange({ ...filter, sepia: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="settings-row">
        <label>
          Hue rotate（-360〜360）: {filter.hueRotate}°
          <input
            type="range"
            min={-360}
            max={360}
            step={1}
            value={filter.hueRotate}
            onChange={(e) => onChange({ ...filter, hueRotate: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="settings-row">
        <label>
          Saturate（0〜2）: {filter.saturate}
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={filter.saturate}
            onChange={(e) => onChange({ ...filter, saturate: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="settings-row">
        <label>
          Brightness（0〜2）: {filter.brightness}
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={filter.brightness}
            onChange={(e) => onChange({ ...filter, brightness: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="settings-row">
        <label>
          Contrast（0〜2）: {filter.contrast}
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={filter.contrast}
            onChange={(e) => onChange({ ...filter, contrast: Number(e.target.value) })}
          />
        </label>
      </div>
    </div>
  )
}

function WebmUrlInput({
  value,
  onValidUrl,
  placeholder,
  setMessage,
}: {
  value: string
  onValidUrl: (url: string) => void
  placeholder: string
  setMessage: Dispatch<SetStateAction<string | null>>
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => {
        const url = e.target.value
        if (isValidUrl(url)) {
          onValidUrl(url)
        } else {
          setMessage('無効なURLです。http://、https://、または相対パスを入力してください。')
          setTimeout(() => setMessage(null), 3000)
        }
      }}
      placeholder={placeholder}
    />
  )
}

export function OverlaySettingsEffectsTab({
  config,
  setConfig,
  inputValues,
  setInputValues,
  setMessage,
}: OverlaySettingsEffectsTabProps) {
  const visualSelectOptions = (
    <>
      <option value="webm">透過 WebM（下の URL）</option>
      <option value="glassCanvas">内蔵: ガラス着弾 Canvas（約3.5秒・URL 不要）</option>
      <option value="slashArc">内蔵: 斬撃フラッシュ（全画面 Canvas・約0.75秒・URL 不要）</option>
    </>
  )

  return (
    <div className="settings-tab-panel">
      <div className="settings-section">
        <p className="settings-hint" style={{ marginTop: 0 }}>
          攻撃・回復・蘇生・HP0・DOT 付与などの<strong>視覚エフェクト</strong>をここに集約しています。各ブロックは元のセクションと同じ設定を編集します。
          <strong>効果音</strong>は「効果音」タブで設定します。
        </p>

        <h4 className="settings-subsection-title">攻撃 — 画面フィルター</h4>
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

        <h4 className="settings-subsection-title">色味フィルター（ダメージ／回復）</h4>
        <p className="settings-hint">
          ダメージ時・回復時に画面へ掛けるフィルターです。攻撃/回復のフィルター ON が有効なときだけ反映されます。
        </p>
        <div className="settings-grid-2col">
          <EffectFilterSliders
            label="ダメージ時"
            filter={config.damageEffectFilter}
            onChange={(damageEffectFilter) => setConfig({ ...config, damageEffectFilter })}
          />
          <EffectFilterSliders
            label="回復時"
            filter={config.healEffectFilter}
            onChange={(healEffectFilter) => setConfig({ ...config, healEffectFilter })}
          />
        </div>

        <h4 className="settings-subsection-title">攻撃 — オーバーレイ（WebM / 内蔵Canvas）</h4>
        <p className="settings-hint">
          通常命中・合わせ技成功・ルーレット成功それぞれで、透過 WebM・内蔵ガラス着弾・内蔵斬撃フラッシュから選べます。
        </p>
        <div className="settings-row">
          <label>
            <input
              type="checkbox"
              checked={config.attack.attackEffectEnabled}
              onChange={(e) =>
                setConfig({
                  ...config,
                  attack: { ...config.attack, attackEffectEnabled: e.target.checked },
                })
              }
            />
            通常攻撃（命中）エフェクトを有効にする
          </label>
        </div>
        {config.attack.attackEffectEnabled && (
          <>
            <div className="settings-row">
              <label>
                映像の種類:
                <select
                  value={config.attack.attackEffectVisual ?? 'webm'}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      attack: {
                        ...config.attack,
                        attackEffectVisual: parseComboRouletteVisual(e.target.value),
                      },
                    })
                  }
                >
                  {visualSelectOptions}
                </select>
              </label>
            </div>
            {(config.attack.attackEffectVisual ?? 'webm') === 'webm' && (
              <div className="settings-row">
                <label>
                  WebM URL:
                  <WebmUrlInput
                    value={config.attack.attackEffectVideoUrl}
                    placeholder="例: src/images/attack.webm または https://..."
                    setMessage={setMessage}
                    onValidUrl={(attackEffectVideoUrl) =>
                      setConfig({
                        ...config,
                        attack: { ...config.attack, attackEffectVideoUrl },
                      })
                    }
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
              checked={config.attack.comboTechniqueEffectEnabled}
              onChange={(e) =>
                setConfig({
                  ...config,
                  attack: { ...config.attack, comboTechniqueEffectEnabled: e.target.checked },
                })
              }
            />
            合わせ技成功エフェクトを有効にする
          </label>
        </div>
        <div className="settings-row">
          <label>
            合わせ技成功 — 映像の種類:
            <select
              value={config.attack.comboTechniqueEffectVisual ?? 'webm'}
              onChange={(e) =>
                setConfig({
                  ...config,
                  attack: {
                    ...config.attack,
                    comboTechniqueEffectVisual: parseComboRouletteVisual(e.target.value),
                  },
                })
              }
            >
              {visualSelectOptions}
            </select>
          </label>
        </div>
        {config.attack.comboTechniqueEffectEnabled &&
          (config.attack.comboTechniqueEffectVisual ?? 'webm') === 'webm' && (
            <div className="settings-row">
              <label>
                WebM URL:
                <WebmUrlInput
                  value={config.attack.comboTechniqueEffectVideoUrl}
                  placeholder="例: src/images/combo.webm または https://..."
                  setMessage={setMessage}
                  onValidUrl={(comboTechniqueEffectVideoUrl) =>
                    setConfig({
                      ...config,
                      attack: { ...config.attack, comboTechniqueEffectVideoUrl },
                    })
                  }
                />
              </label>
            </div>
          )}

        <div className="settings-row">
          <label>
            <input
              type="checkbox"
              checked={config.attack.rouletteEffectEnabled}
              onChange={(e) =>
                setConfig({
                  ...config,
                  attack: { ...config.attack, rouletteEffectEnabled: e.target.checked },
                })
              }
            />
            追加攻撃ルーレット成功エフェクトを有効にする
          </label>
        </div>
        <div className="settings-row">
          <label>
            ルーレット成功 — 映像の種類:
            <select
              value={config.attack.rouletteEffectVisual ?? 'webm'}
              onChange={(e) =>
                setConfig({
                  ...config,
                  attack: {
                    ...config.attack,
                    rouletteEffectVisual: parseComboRouletteVisual(e.target.value),
                  },
                })
              }
            >
              {visualSelectOptions}
            </select>
          </label>
        </div>
        {config.attack.rouletteEffectEnabled &&
          (config.attack.rouletteEffectVisual ?? 'webm') === 'webm' && (
            <div className="settings-row">
              <label>
                WebM URL:
                <WebmUrlInput
                  value={config.attack.rouletteEffectVideoUrl}
                  placeholder="例: src/images/roulette.webm または https://..."
                  setMessage={setMessage}
                  onValidUrl={(rouletteEffectVideoUrl) =>
                    setConfig({
                      ...config,
                      attack: { ...config.attack, rouletteEffectVideoUrl },
                    })
                  }
                />
              </label>
            </div>
          )}

        <h4 className="settings-subsection-title">攻撃 — デバフ付与（WebM）</h4>
        <p className="settings-hint">
          出血・毒・炎の DOT が付与されたときに中央へ重ねる透過 WebM です。種類ごとに設定できます。
        </p>
        {(
          [
            {
              label: '出血',
              enabledKey: 'dotBleedEffectEnabled' as const,
              urlKey: 'dotBleedEffectVideoUrl' as const,
            },
            {
              label: '毒',
              enabledKey: 'dotPoisonEffectEnabled' as const,
              urlKey: 'dotPoisonEffectVideoUrl' as const,
            },
            {
              label: '炎',
              enabledKey: 'dotBurnEffectEnabled' as const,
              urlKey: 'dotBurnEffectVideoUrl' as const,
            },
          ] as const
        ).map(({ label, enabledKey, urlKey }) => (
          <div key={enabledKey} className="settings-debuff-effect-block">
            <div className="settings-row">
              <label>
                <input
                  type="checkbox"
                  checked={config.attack[enabledKey]}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      attack: { ...config.attack, [enabledKey]: e.target.checked },
                    })
                  }
                />
                {label} DOT 付与エフェクトを有効にする
              </label>
            </div>
            {config.attack[enabledKey] && (
              <div className="settings-row">
                <label>
                  WebM URL:
                  <WebmUrlInput
                    value={config.attack[urlKey]}
                    placeholder="例: src/images/debuff.webm または https://..."
                    setMessage={setMessage}
                    onValidUrl={(url) =>
                      setConfig({
                        ...config,
                        attack: { ...config.attack, [urlKey]: url },
                      })
                    }
                  />
                </label>
              </div>
            )}
          </div>
        ))}

        <h4 className="settings-subsection-title">回復 — エフェクト</h4>
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
            回復エフェクトを表示（パーティクル）
          </label>
        </div>
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
        <p className="settings-hint">
          回復時に中央へ重ねる透過 WebM です。上のパーティクルとは別です。
        </p>
        <div className="settings-row">
          <label>
            <input
              type="checkbox"
              checked={config.heal.overlayEffectEnabled}
              onChange={(e) =>
                setConfig({
                  ...config,
                  heal: { ...config.heal, overlayEffectEnabled: e.target.checked },
                })
              }
            />
            回復オーバーレイエフェクトを有効にする
          </label>
        </div>
        {config.heal.overlayEffectEnabled && (
          <div className="settings-row">
            <label>
              WebM URL:
              <WebmUrlInput
                value={config.heal.overlayEffectVideoUrl}
                placeholder="例: src/images/heal.webm または https://..."
                setMessage={setMessage}
                onValidUrl={(overlayEffectVideoUrl) =>
                  setConfig({
                    ...config,
                    heal: { ...config.heal, overlayEffectVideoUrl },
                  })
                }
              />
            </label>
          </div>
        )}

        <h4 className="settings-subsection-title">蘇生（リトライ）— オーバーレイ（WebM）</h4>
        <p className="settings-hint">
          リトライ・全回復・全員全回復などで HP を最大まで戻したときに中央へ重ねる透過 WebM です。
        </p>
        <div className="settings-row">
          <label>
            <input
              type="checkbox"
              checked={config.retry.overlayEffectEnabled}
              onChange={(e) =>
                setConfig({
                  ...config,
                  retry: { ...config.retry, overlayEffectEnabled: e.target.checked },
                })
              }
            />
            蘇生オーバーレイエフェクトを有効にする
          </label>
        </div>
        {config.retry.overlayEffectEnabled && (
          <div className="settings-row">
            <label>
              WebM URL:
              <WebmUrlInput
                value={config.retry.overlayEffectVideoUrl}
                placeholder="例: src/images/revive.webm または https://..."
                setMessage={setMessage}
                onValidUrl={(overlayEffectVideoUrl) =>
                  setConfig({
                    ...config,
                    retry: { ...config.retry, overlayEffectVideoUrl },
                  })
                }
              />
            </label>
          </div>
        )}

        <h4 className="settings-subsection-title">配信者HP0 — 動画（WebM）</h4>
        <p className="settings-hint">
          配信者HPが 0 になった瞬間に中央へ重ねる透過 WebM です。静止画は「配信者HP0のときの演出」セクションで設定します。
        </p>
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
            <WebmUrlInput
              value={config.zeroHpEffect.videoUrl}
              placeholder="動画のURLを入力"
              setMessage={setMessage}
              onValidUrl={(videoUrl) =>
                setConfig({
                  ...config,
                  zeroHpEffect: { ...config.zeroHpEffect, videoUrl },
                })
              }
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
          例: <code>src/images/bakuhatsu.webm</code>（public/images に配置）または <code>https://...</code>
        </p>
      </div>
    </div>
  )
}

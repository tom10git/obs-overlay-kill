/**
 * チャンネルポイントまとめタブ
 */

import type { Dispatch, SetStateAction } from 'react'
import type { OverlayConfig } from '../../types/overlay'

export type OverlaySettingsChannelPointsTabProps = {
  config: OverlayConfig
  setConfig: Dispatch<SetStateAction<OverlayConfig | null>>
  inputValues: Record<string, string>
  setInputValues: Dispatch<SetStateAction<Record<string, string>>>
}

export function OverlaySettingsChannelPointsTab({
  config,
  setConfig,
  inputValues,
  setInputValues,
}: OverlaySettingsChannelPointsTabProps) {
  return (
    <div className="settings-tab-panel">
      <div className="settings-section">
        <p className="settings-hint" style={{ marginTop: 0 }}>
          Twitch の<strong>チャンネルポイント</strong>引き換えで、通常攻撃・回復・蘇生・ストレングスを発動できます。
          OAuth トークンに <code>channel:read:redemptions</code> が必要です。
          <strong> Twitch クリエイターダッシュボードで作成したリワード</strong>は EventSub WebSocket で検知します（Helix ポーリングでは取得できません）。
          自動完了（FULFILLED）は API 経由で作成したリワードのみ可能です（<code>channel:manage:redemptions</code> 必須）。
          ダッシュボード作成リワードは Twitch 側のリクエストキューで手動完了してください。
          リワード ID が空のときは、下の<strong>表示名</strong>で Twitch のカスタムリワードと照合します（大文字小文字は区別しません）。
        </p>

        <h4 className="settings-subsection-title">共通（API 作成リワード向けポーリング）</h4>
        <div className="settings-row">
          <label>
            引き換えチェック間隔（秒・2〜60）:
            <input
              type="text"
              inputMode="numeric"
              value={
                inputValues['attack.channelPointsPollIntervalSec'] ??
                String(config.attack.channelPointsPollIntervalSec)
              }
              onChange={(e) => {
                setInputValues((prev) => ({
                  ...prev,
                  'attack.channelPointsPollIntervalSec': e.target.value,
                }))
              }}
              onBlur={(e) => {
                const value = e.target.value.trim()
                const num = value === '' ? 4 : parseInt(value, 10)
                const sec = !Number.isNaN(num) ? Math.max(2, Math.min(60, num)) : 4
                setConfig({
                  ...config,
                  attack: { ...config.attack, channelPointsPollIntervalSec: sec },
                })
                setInputValues((prev) => {
                  const next = { ...prev }
                  delete next['attack.channelPointsPollIntervalSec']
                  return next
                })
              }}
            />
          </label>
        </div>
        <div className="settings-row">
          <label>
            <input
              type="checkbox"
              checked={config.attack.channelPointsAutoFulfill}
              onChange={(e) =>
                setConfig({
                  ...config,
                  attack: { ...config.attack, channelPointsAutoFulfill: e.target.checked },
                })
              }
            />
            処理後に引き換えを自動完了（FULFILLED）にする
          </label>
        </div>

        <h4 className="settings-subsection-title">通常攻撃</h4>
        <p className="settings-hint">
          「攻撃・ダメージ・リワード」の攻撃設定（ダメージ・ミス・クリティカル等）がそのまま使われます。攻撃全体が OFF のときは発動しません。
        </p>
        <div className="settings-row">
          <label>
            <input
              type="checkbox"
              checked={config.attack.channelPointsAttackEnabled}
              onChange={(e) =>
                setConfig({
                  ...config,
                  attack: { ...config.attack, channelPointsAttackEnabled: e.target.checked },
                })
              }
            />
            チャンネルポイントで攻撃を有効にする
          </label>
        </div>
        <div className="settings-row">
          <label>
            リワード表示名:
            <input
              type="text"
              value={config.attack.channelPointsRewardTitle}
              onChange={(e) =>
                setConfig({
                  ...config,
                  attack: { ...config.attack, channelPointsRewardTitle: e.target.value },
                })
              }
              placeholder="例: 配信者を攻撃"
            />
          </label>
          <label>
            リワード ID（任意・設定時は表示名より優先）:
            <input
              type="text"
              value={config.attack.channelPointsRewardId}
              onChange={(e) =>
                setConfig({
                  ...config,
                  attack: { ...config.attack, channelPointsRewardId: e.target.value.trim() },
                })
              }
              placeholder="Twitch の UUID"
            />
          </label>
        </div>

        <h4 className="settings-subsection-title">回復</h4>
        <p className="settings-hint">
          回復量は「回復・リワード」の設定に従います。HP0 時は「HP0でも回復を許可」が ON のときのみ発動します。
        </p>
        <div className="settings-row">
          <label>
            <input
              type="checkbox"
              checked={config.heal.channelPointsHealEnabled}
              onChange={(e) =>
                setConfig({
                  ...config,
                  heal: { ...config.heal, channelPointsHealEnabled: e.target.checked },
                })
              }
            />
            チャンネルポイントで回復を有効にする
          </label>
        </div>
        <div className="settings-row">
          <label>
            リワード表示名:
            <input
              type="text"
              value={config.heal.channelPointsHealRewardTitle}
              onChange={(e) =>
                setConfig({
                  ...config,
                  heal: { ...config.heal, channelPointsHealRewardTitle: e.target.value },
                })
              }
              placeholder="例: 配信者を回復"
            />
          </label>
          <label>
            リワード ID（任意）:
            <input
              type="text"
              value={config.heal.channelPointsHealRewardId}
              onChange={(e) =>
                setConfig({
                  ...config,
                  heal: { ...config.heal, channelPointsHealRewardId: e.target.value.trim() },
                })
              }
            />
          </label>
        </div>

        <h4 className="settings-subsection-title">蘇生</h4>
        <p className="settings-hint">
          配信者 HP を最大まで回復します（!retry と同様）。HP0 でも発動します。
        </p>
        <div className="settings-row">
          <label>
            <input
              type="checkbox"
              checked={config.retry.channelPointsReviveEnabled}
              onChange={(e) =>
                setConfig({
                  ...config,
                  retry: { ...config.retry, channelPointsReviveEnabled: e.target.checked },
                })
              }
            />
            チャンネルポイントで蘇生を有効にする
          </label>
        </div>
        <div className="settings-row">
          <label>
            リワード表示名:
            <input
              type="text"
              value={config.retry.channelPointsReviveRewardTitle}
              onChange={(e) =>
                setConfig({
                  ...config,
                  retry: { ...config.retry, channelPointsReviveRewardTitle: e.target.value },
                })
              }
              placeholder="例: 配信者を蘇生"
            />
          </label>
          <label>
            リワード ID（任意）:
            <input
              type="text"
              value={config.retry.channelPointsReviveRewardId}
              onChange={(e) =>
                setConfig({
                  ...config,
                  retry: { ...config.retry, channelPointsReviveRewardId: e.target.value.trim() },
                })
              }
            />
          </label>
        </div>

        <h4 className="settings-subsection-title">ストレングス</h4>
        <p className="settings-hint">
          PvP のストレングス設定（効果時間・対象・効果音・自動返信）に従います。引き換えた視聴者に個人用バフを付与します（対象が「全員」のときは全員用バフ）。
        </p>
        <div className="settings-row">
          <label>
            <input
              type="checkbox"
              checked={config.pvp.channelPointsStrengthBuffEnabled}
              onChange={(e) =>
                setConfig({
                  ...config,
                  pvp: { ...config.pvp, channelPointsStrengthBuffEnabled: e.target.checked },
                })
              }
            />
            チャンネルポイントでストレングスを有効にする
          </label>
        </div>
        <div className="settings-row">
          <label>
            リワード表示名:
            <input
              type="text"
              value={config.pvp.channelPointsStrengthBuffRewardTitle}
              onChange={(e) =>
                setConfig({
                  ...config,
                  pvp: { ...config.pvp, channelPointsStrengthBuffRewardTitle: e.target.value },
                })
              }
              placeholder="例: 強化バフ"
            />
          </label>
          <label>
            リワード ID（任意）:
            <input
              type="text"
              value={config.pvp.channelPointsStrengthBuffRewardId}
              onChange={(e) =>
                setConfig({
                  ...config,
                  pvp: { ...config.pvp, channelPointsStrengthBuffRewardId: e.target.value.trim() },
                })
              }
            />
          </label>
        </div>
      </div>
    </div>
  )
}

import { buildTwitchEnvPanelRows } from '../../utils/twitchEnvPanel'

/** テストパネル: .env の Twitch 設定（読み取り専用・既定は折りたたみ） */
export function TestPanelTwitchEnv() {
  const rows = buildTwitchEnvPanelRows()
  const configuredCount = rows.filter((row) => row.configured).length

  return (
    <details className="test-panel-twitch-env-details">
      <summary className="test-panel-twitch-env-summary">
        <span className="test-panel-twitch-env-summary-title">Twitch 認証 (.env)</span>
        <span className="test-panel-twitch-env-summary-meta">
          {configuredCount}/{rows.length} 設定済み
        </span>
      </summary>
      <div className="test-panel-twitch-env-body">
        <p className="test-panel-twitch-env-note">
          設定はプロジェクト直下の <code>.env</code> で行います。変更後は dev サーバー再起動が必要です。
        </p>
        <dl className="test-panel-twitch-env-list">
          {rows.map((row) => (
            <div key={row.envKey} className="test-panel-twitch-env-row">
              <dt className="test-panel-twitch-env-key">{row.envKey}</dt>
              <dd className="test-panel-twitch-env-value">
                <code
                  className={
                    row.configured
                      ? 'test-panel-twitch-env-code test-panel-twitch-env-code--set'
                      : 'test-panel-twitch-env-code test-panel-twitch-env-code--unset'
                  }
                >
                  {row.display}
                </code>
                {row.runtimeNote ? (
                  <span className="test-panel-twitch-env-runtime">{row.runtimeNote}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  )
}

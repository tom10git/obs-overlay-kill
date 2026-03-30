import { useEffect, useState } from 'react'
import { getLogBuffer, subscribeLogs, clearLogBuffer, type LogEntry } from '../lib/logger'
import './DebugLog.css'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('ja-JP', { hour12: false })
}

/**
 * 開発時・localStorage obs-overlay-debug=1 時に表示するログパネル
 */
export function DebugLog() {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<LogEntry[]>(() => [...getLogBuffer()])

  useEffect(() => {
    let enabled = import.meta.env.DEV
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('obs-overlay-debug') === '1') {
        enabled = true
      }
    } catch {
      /* ignore */
    }
    if (!enabled) return

    return subscribeLogs(() => setEntries([...getLogBuffer()]))
  }, [])

  let enabled = import.meta.env.DEV
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('obs-overlay-debug') === '1') {
      enabled = true
    }
  } catch {
    /* ignore */
  }

  if (!enabled) return null

  return (
    <div className="debug-log-root">
      <button type="button" className="debug-log-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? 'ログ ▼' : 'ログ ▶'}
      </button>
      {open && (
        <div className="debug-log-panel">
          <div className="debug-log-toolbar">
            <button type="button" className="debug-log-clear" onClick={() => clearLogBuffer()}>
              クリア
            </button>
          </div>
          <ul className="debug-log-list">
            {entries.length === 0 ? (
              <li className="debug-log-empty">（ログなし）</li>
            ) : (
              [...entries].reverse().map((e, i) => (
                <li key={`${e.ts}-${i}`} className={`debug-log-line debug-log-line--${e.level}`}>
                  <span className="debug-log-time">{formatTime(e.ts)}</span>
                  <span className="debug-log-level">{e.level}</span>
                  <span className="debug-log-msg">{e.message}</span>
                  {e.detail && <pre className="debug-log-detail">{e.detail}</pre>}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

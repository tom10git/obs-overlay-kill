import type { ReactNode } from 'react'
import './SettingsHint.css'

type SettingsHintProps = {
  /** 画面上の短いラベル（省略可） */
  label?: string
  /** ホバーで表示する説明 */
  tip: string
  children?: ReactNode
  className?: string
}

/** 設定項目の短い表示 + ホバー吹き出し */
export function SettingsHint({
  label,
  tip,
  children,
  className = '',
}: SettingsHintProps) {
  return (
    <span
      className={`settings-hint-wrap ${className}`.trim()}
      data-tip={tip}
      tabIndex={0}
      role="note"
      aria-label={tip}
    >
      {label != null && label !== '' ? (
        <span className="settings-hint-label">{label}</span>
      ) : null}
      {children}
      <span className="settings-hint-bubble" role="tooltip">
        {tip}
      </span>
    </span>
  )
}

import type { ReactNode } from 'react'
import './PremiumLabel.css'

type PremiumLabelProps = {
  children: ReactNode
  className?: string
}

/** 有料機能の見出しに付けるラベル */
export function PremiumLabel({ children, className = '' }: PremiumLabelProps) {
  return (
    <span className={`premium-label ${className}`.trim()}>
      <span className="premium-label-badge" aria-hidden>
        PRO
      </span>
      <span className="premium-label-text">{children}</span>
    </span>
  )
}

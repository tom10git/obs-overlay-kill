import { useState } from 'react'
import type { BillingTarget } from '../../lib/billingApi'
import './StripeSubscribeButton.css'

type StripeSubscribeButtonProps = {
  featureTarget: BillingTarget
  label: string
  disabled?: boolean
  onSubscribe: (target: BillingTarget) => Promise<{ ok: boolean; message: string }>
}

export function StripeSubscribeButton({
  featureTarget,
  label,
  disabled = false,
  onSubscribe,
}: StripeSubscribeButtonProps) {
  const [busy, setBusy] = useState(false)

  const handleClick = async () => {
    if (disabled || busy) return
    setBusy(true)
    try {
      await onSubscribe(featureTarget)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className="stripe-subscribe-btn"
      disabled={disabled || busy}
      onClick={() => void handleClick()}
    >
      {busy ? '処理中…' : label}
    </button>
  )
}

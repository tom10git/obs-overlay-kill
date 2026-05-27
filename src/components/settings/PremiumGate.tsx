import type { PremiumFeatureId } from '../../constants/premiumFeatures'
import { PREMIUM_FEATURES } from '../../constants/premiumFeatures'
import { useFeatureUnlock } from '../../context/FeatureUnlockContext'
import { PremiumLabel } from '../ui/PremiumLabel'
import './PremiumGate.css'

type PremiumGateProps = {
  featureId: PremiumFeatureId
  title?: string
  children: React.ReactNode
  /** ロック時も見出しだけ表示 */
  showHeaderWhenLocked?: boolean
}

export function PremiumGate({
  featureId,
  title,
  children,
  showHeaderWhenLocked = true,
}: PremiumGateProps) {
  const { isUnlocked } = useFeatureUnlock()
  const meta = PREMIUM_FEATURES[featureId]
  const unlocked = isUnlocked(featureId)
  const displayTitle = title ?? meta.sectionTitle

  if (unlocked) {
    return <>{children}</>
  }

  return (
    <div className="premium-gate premium-gate--locked">
      {showHeaderWhenLocked && (
        <h4 className="premium-gate-header">
          <PremiumLabel>{displayTitle}</PremiumLabel>
        </h4>
      )}
      <div className="premium-gate-overlay">
        <p className="premium-gate-msg">
          この機能は月額サブスクリプション、または招待コードで解放できます。
        </p>
        <p className="premium-gate-hint">
          「課金」タブからログインし、契約または招待コードを適用してください。
        </p>
      </div>
      <div className="premium-gate-content premium-gate-content--dimmed" aria-hidden>
        {children}
      </div>
    </div>
  )
}

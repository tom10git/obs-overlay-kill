import { useState } from 'react'
import {
  formatPremiumBundlePriceBreakdown,
  getPremiumBundlePriceJpy,
  getPremiumFeaturePriceJpy,
  PREMIUM_FEATURE_PRICE_JPY,
  PREMIUM_FEATURES,
  PREMIUM_FEATURE_IDS,
  type PremiumFeatureId,
} from '../../constants/premiumFeatures'
import { useAuth } from '../../context/AuthContext'
import { useFeatureUnlock } from '../../context/FeatureUnlockContext'
import { StripeSubscribeButton } from './StripeSubscribeButton'
import './FeatureUnlockPanel.css'

export function FeatureUnlockPanel() {
  const {
    configured: authConfigured,
    session,
    loading: authLoading,
    signInWithEmail,
    signOut,
  } = useAuth()
  const {
    state,
    billingConfigured,
    isUnlocked,
    redeemInvite,
    startCheckout,
    openBillingPortal,
    canOfferBundleSubscription,
    canOfferIndividualSubscription,
    hasActiveStripeSubscription,
    refreshEntitlements,
  } = useFeatureUnlock()

  const [email, setEmail] = useState('')
  const [authMsg, setAuthMsg] = useState<string | null>(null)
  const [inviteInput, setInviteInput] = useState('')
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)

  const bundlePriceJpy = getPremiumBundlePriceJpy()
  const bundleBreakdown = formatPremiumBundlePriceBreakdown()

  const handleSignIn = async () => {
    const result = await signInWithEmail(email)
    setAuthMsg(result.message)
  }

  const handleInvite = async () => {
    const result = await redeemInvite(inviteInput)
    setInviteMsg(result.message)
    if (result.ok) setInviteInput('')
  }

  if (!authConfigured || !billingConfigured) {
    return (
      <div className="feature-unlock-panel">
        <p className="feature-unlock-muted">
          課金機能は Supabase（Auth・Edge Functions）の設定が必要です。
        </p>
      </div>
    )
  }

  return (
    <div className="feature-unlock-panel">
      <h3 className="feature-unlock-heading">機能の解放</h3>

      <section className="feature-unlock-section feature-unlock-section--auth">
        <h4 className="feature-unlock-section-title">ログイン</h4>
        {authLoading ? (
          <p className="feature-unlock-muted">確認中…</p>
        ) : session ? (
          <>
            <p className="feature-unlock-auth-email">{session.user.email}</p>
            <div className="feature-unlock-auth-actions">
              <button
                type="button"
                className="feature-unlock-link-btn"
                onClick={() => void refreshEntitlements()}
              >
                状態を更新
              </button>
              <button
                type="button"
                className="feature-unlock-link-btn"
                onClick={() => void openBillingPortal()}
              >
                契約の管理
              </button>
              <button
                type="button"
                className="feature-unlock-link-btn"
                onClick={() => void signOut()}
              >
                ログアウト
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="feature-unlock-serial-row">
              <input
                type="email"
                className="feature-unlock-serial-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="メールアドレス"
                autoComplete="email"
              />
              <button
                type="button"
                className="feature-unlock-serial-btn"
                onClick={() => void handleSignIn()}
              >
                リンクを送信
              </button>
            </div>
            {authMsg && <p className="feature-unlock-serial-msg">{authMsg}</p>}
          </>
        )}
      </section>

      <p className="feature-unlock-price">
        単品: 各機能 月額 <strong>{PREMIUM_FEATURE_PRICE_JPY}円</strong>
        <span className="feature-unlock-price-sep">／</span>
        全機能: 月額 <strong>{bundlePriceJpy}円</strong>
        <span className="feature-unlock-price-note">（{bundleBreakdown}）</span>
      </p>

      {state.allUnlocked && (
        <p className="feature-unlock-active">全機能が解放されています</p>
      )}

      {session && (
        <>
          <section className="feature-unlock-section">
            <h4 className="feature-unlock-section-title">個別（月額）</h4>
            <ul className="feature-unlock-list">
              {PREMIUM_FEATURE_IDS.map((id: PremiumFeatureId) => {
                const meta = PREMIUM_FEATURES[id]
                const unlocked = isUnlocked(id)
                return (
                  <li key={id} className="feature-unlock-item">
                    <div className="feature-unlock-item-head">
                      <span className="feature-unlock-item-name">
                        {meta.shortLabel}
                      </span>
                      {unlocked ? (
                        <span className="feature-unlock-badge feature-unlock-badge--on">
                          利用中
                        </span>
                      ) : (
                        <span className="feature-unlock-badge">未解放</span>
                      )}
                    </div>
                    <p className="feature-unlock-item-tip">{meta.tooltip}</p>
                    {!unlocked && hasActiveStripeSubscription(id) && (
                      <p className="feature-unlock-muted">
                        契約済みです。反映されない場合は「状態を更新」を押してください。
                      </p>
                    )}
                    {!unlocked &&
                      !hasActiveStripeSubscription(id) &&
                      canOfferIndividualSubscription(id) && (
                        <StripeSubscribeButton
                          featureTarget={id}
                          label={`${meta.shortLabel}（月${getPremiumFeaturePriceJpy(id)}円）`}
                          onSubscribe={startCheckout}
                        />
                      )}
                  </li>
                )
              })}
            </ul>
          </section>

          {!state.allUnlocked && (
          <section className="feature-unlock-section feature-unlock-section--bundle">
            <h4 className="feature-unlock-section-title">全機能まとめて</h4>
            <p className="feature-unlock-bundle-price">
              月額 <strong>{bundlePriceJpy}円</strong>
              <span className="feature-unlock-bundle-breakdown">
                （単品合計: {bundleBreakdown}）
              </span>
            </p>
            {!state.allUnlocked && (
              <p className="feature-unlock-bundle-notice">
                {canOfferBundleSubscription
                  ? '※ 単品契約がある場合は先に解約してください。重複して契約できません。'
                  : '※ 単品契約が有効なため、全機能パックは現在契約できません。'}
              </p>
            )}
            {!state.allUnlocked &&
              state.hasBundleStripe &&
              !isUnlocked('probabilities') && (
                <p className="feature-unlock-muted">
                  全機能パックは契約済みです。反映されない場合は「状態を更新」を押してください。
                </p>
              )}
            {!state.allUnlocked && canOfferBundleSubscription && (
              <StripeSubscribeButton
                featureTarget="all"
                label={`全機能パック（月${bundlePriceJpy}円）`}
                onSubscribe={startCheckout}
              />
            )}
          </section>
          )}

          <section className="feature-unlock-section feature-unlock-section--serial">
            <h4 className="feature-unlock-section-title">招待コード</h4>
            <p className="feature-unlock-muted feature-unlock-invite-hint">
              発行されたアカウント専用のコードです。他のアカウントでは使えません。
            </p>
            <div className="feature-unlock-serial-row">
              <input
                type="text"
                className="feature-unlock-serial-input"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                placeholder="招待コード"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="feature-unlock-serial-btn"
                onClick={() => void handleInvite()}
              >
                適用
              </button>
            </div>
            {inviteMsg && (
              <p
                className={`feature-unlock-serial-msg${inviteMsg.includes('反映') ? ' feature-unlock-serial-msg--ok' : ''}`}
              >
                {inviteMsg}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  )
}

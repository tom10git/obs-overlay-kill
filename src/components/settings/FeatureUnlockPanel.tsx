import { useState, useEffect } from 'react'
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
import { formatOtpCooldownWait, getOtpCooldownRemainingMs } from '../../utils/otpSendCooldown'
import './FeatureUnlockPanel.css'

export function FeatureUnlockPanel() {
  const {
    configured: authConfigured,
    session,
    profile,
    profileLoading,
    registrationComplete,
    loading: authLoading,
    signInWithEmail,
    saveDisplayName,
    signOut,
    magicLinkError,
    clearMagicLinkError,
  } = useAuth()
  const {
    state,
    billingConfigured,
    isUnlocked,
    redeemInvite,
    startCheckout,
    openBillingPortal,
    canOfferBundleSubscription,
    canUpgradeToBundleSubscription,
    canOfferIndividualSubscription,
    hasActiveStripeSubscription,
    refreshEntitlements,
  } = useFeatureUnlock()

  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [profileNameInput, setProfileNameInput] = useState('')
  const [authMsg, setAuthMsg] = useState<string | null>(null)
  const [profileMsg, setProfileMsg] = useState<string | null>(null)
  const [inviteInput, setInviteInput] = useState('')
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [otpCooldownMs, setOtpCooldownMs] = useState(0)

  useEffect(() => {
    const tick = () => setOtpCooldownMs(getOtpCooldownRemainingMs())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  const bundlePriceJpy = getPremiumBundlePriceJpy()
  const bundleBreakdown = formatPremiumBundlePriceBreakdown()
  const billingReady = Boolean(session && registrationComplete)
  const otpSendBlocked = otpCooldownMs > 0
  const otpSendWaitLabel = otpSendBlocked ? formatOtpCooldownWait(otpCooldownMs) : ''

  const handleSignIn = async () => {
    if (authMode === 'register' && !displayName.trim()) {
      setAuthMsg('ユーザー名を入力してください。')
      return
    }
    const result = await signInWithEmail(
      email,
      authMode === 'register' ? displayName : undefined,
    )
    setAuthMsg(result.message)
    setOtpCooldownMs(getOtpCooldownRemainingMs())
  }

  const handleSaveDisplayName = async () => {
    const result = await saveDisplayName(profileNameInput)
    setProfileMsg(result.message)
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

      <section className="feature-unlock-section feature-unlock-section--overview">
        <h4 className="feature-unlock-section-title">概要</h4>
        <ol className="feature-unlock-flow">
          <li>
            <strong>① ログイン / アカウント登録</strong> — 登録済みの方はメールだけでログイン。初めての方はメールとユーザー名を入力
          </li>
          <li>
            <strong>② 解放方法（どちらか）</strong>
            <ul className="feature-unlock-flow-sub">
              <li>
                <strong>月額（Stripe）</strong> — 機能ごと、または全機能まとめて契約。個別契約中でも後から全機能パックへ切り替え可能
              </li>
              <li>
                <strong>招待コード</strong> — 管理者からもらった token を入力（サブスク不要・無期限）
              </li>
            </ul>
          </li>
        </ol>
        <p className="feature-unlock-muted feature-unlock-flow-note">
          未契約・未招待の機能は設定画面でロックされます。管理者の招待用 label は管理メモのみで、ユーザー側の登録手順は同じです。
        </p>
      </section>

      <section className="feature-unlock-section feature-unlock-section--auth">
        <h4 className="feature-unlock-section-title">① ログイン / アカウント登録</h4>
        {authLoading || profileLoading ? (
          <p className="feature-unlock-muted">確認中…</p>
        ) : session ? (
          <>
            <p className="feature-unlock-auth-email">
              {profile?.display_name ? `${profile.display_name}（${session.user.email}）` : session.user.email}
            </p>
            {!registrationComplete && (
              <>
                <p className="feature-unlock-muted">
                  ユーザー名が未登録です。課金・招待コードの前に保存してください。
                </p>
                <div className="feature-unlock-serial-row">
                  <input
                    type="text"
                    className="feature-unlock-serial-input"
                    value={profileNameInput}
                    onChange={(e) => setProfileNameInput(e.target.value)}
                    placeholder="ユーザー名（日本語可）"
                    autoComplete="nickname"
                  />
                  <button
                    type="button"
                    className="feature-unlock-serial-btn"
                    onClick={() => void handleSaveDisplayName()}
                  >
                    ユーザー名を保存
                  </button>
                </div>
                {profileMsg && <p className="feature-unlock-serial-msg">{profileMsg}</p>}
              </>
            )}
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
            <div className="feature-unlock-auth-mode" role="tablist" aria-label="ログインまたは新規登録">
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'login'}
                className={`feature-unlock-auth-mode-btn${authMode === 'login' ? ' feature-unlock-auth-mode-btn--on' : ''}`}
                onClick={() => {
                  setAuthMode('login')
                  setAuthMsg(null)
                }}
              >
                ログイン
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'register'}
                className={`feature-unlock-auth-mode-btn${authMode === 'register' ? ' feature-unlock-auth-mode-btn--on' : ''}`}
                onClick={() => {
                  setAuthMode('register')
                  setAuthMsg(null)
                }}
              >
                新規登録
              </button>
            </div>

            {authMode === 'login' ? (
              <>
                <p className="feature-unlock-muted">
                  登録済みのメールアドレスを入力してください。リンクは
                  <strong> このブラウザ </strong>
                  で開いてください（スマホのメールアプリから開くと失敗することがあります）。
                </p>
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
                    disabled={otpSendBlocked}
                    onClick={() => void handleSignIn()}
                  >
                    {otpSendBlocked
                      ? `待機中（${otpSendWaitLabel}）`
                      : 'ログインリンクを送信'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="feature-unlock-muted">
                  初めて利用する方は、メールアドレスとユーザー名の両方を入力してください。
                </p>
                <div className="feature-unlock-serial-row">
                  <input
                    type="email"
                    className="feature-unlock-serial-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="メールアドレス"
                    autoComplete="email"
                  />
                </div>
                <div className="feature-unlock-serial-row">
                  <input
                    type="text"
                    className="feature-unlock-serial-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="ユーザー名（日本語可・表示名）"
                    autoComplete="nickname"
                  />
                  <button
                    type="button"
                    className="feature-unlock-serial-btn"
                    disabled={otpSendBlocked}
                    onClick={() => void handleSignIn()}
                  >
                    {otpSendBlocked
                      ? `待機中（${otpSendWaitLabel}）`
                      : '登録リンクを送信'}
                  </button>
                </div>
              </>
            )}
            {authMsg && <p className="feature-unlock-serial-msg">{authMsg}</p>}
            {magicLinkError && (
              <p className="feature-unlock-serial-msg">{magicLinkError}</p>
            )}
          </>
        )}
      </section>

      {!billingReady && session && (
        <p className="feature-unlock-setup">
          ② の契約・招待コードは、ユーザー名の保存が完了してから利用できます。
        </p>
      )}

      <p className="feature-unlock-price">
        単品: 各機能 月額 <strong>{PREMIUM_FEATURE_PRICE_JPY}円</strong>
        <span className="feature-unlock-price-sep">／</span>
        全機能: 月額 <strong>{bundlePriceJpy}円</strong>
        <span className="feature-unlock-price-note">（{bundleBreakdown}）</span>
      </p>

      {state.allUnlocked && (
        <p className="feature-unlock-active">全機能が解放されています</p>
      )}

      {billingReady && (
        <>
          <section className="feature-unlock-section">
            <h4 className="feature-unlock-section-title">②-A 月額サブスクリプション（Stripe）</h4>
            <h5 className="feature-unlock-subsection-title">個別契約</h5>
            <ul className="feature-unlock-list">
              {PREMIUM_FEATURE_IDS.map((id: PremiumFeatureId) => {
                const meta = PREMIUM_FEATURES[id]
                const unlocked = isUnlocked(id)
                return (
                  <li key={id} className="feature-unlock-item">
                    <div className="feature-unlock-item-head">
                      <span className="feature-unlock-item-name">{meta.shortLabel}</span>
                      {unlocked ? (
                        <span className="feature-unlock-badge feature-unlock-badge--on">利用中</span>
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

            {!state.allUnlocked && (
              <div className="feature-unlock-section--bundle-inner">
                <h5 className="feature-unlock-subsection-title">全機能まとめて</h5>
                <p className="feature-unlock-bundle-price">
                  月額 <strong>{bundlePriceJpy}円</strong>
                  <span className="feature-unlock-bundle-breakdown">
                    （単品合計: {bundleBreakdown}）
                  </span>
                </p>
                {canUpgradeToBundleSubscription && (
                  <>
                    <p className="feature-unlock-bundle-notice">
                      個別契約中です。全機能パックに切り替えると、Stripe 上の個別契約は自動で解約され、全機能パックに統一されます。
                    </p>
                    <StripeSubscribeButton
                      featureTarget="all"
                      label={`全機能パックに切り替え（月${bundlePriceJpy}円）`}
                      onSubscribe={startCheckout}
                    />
                  </>
                )}
                {canOfferBundleSubscription && (
                  <StripeSubscribeButton
                    featureTarget="all"
                    label={`全機能パック（月${bundlePriceJpy}円）`}
                    onSubscribe={startCheckout}
                  />
                )}
                {!canOfferBundleSubscription &&
                  !canUpgradeToBundleSubscription &&
                  state.hasBundleStripe &&
                  !isUnlocked('probabilities') && (
                    <p className="feature-unlock-muted">
                      全機能パックは契約済みです。反映されない場合は「状態を更新」を押してください。
                    </p>
                  )}
              </div>
            )}
          </section>

          <section className="feature-unlock-section feature-unlock-section--serial">
            <h4 className="feature-unlock-section-title">②-B 招待コード（サブスク不要）</h4>
            <p className="feature-unlock-muted feature-unlock-invite-hint">
              管理者から受け取った token（長い英数字）を貼ります。① で登録したメールと、管理者が登録した
              allowedEmail が一致している必要があります。適用後は無期限で利用できます。
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

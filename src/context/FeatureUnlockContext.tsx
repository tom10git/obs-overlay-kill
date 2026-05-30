import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  isDevUnlockAllEnabled,
  PREMIUM_FEATURE_IDS,
  type PremiumFeatureId,
} from '../constants/premiumFeatures'
import {
  confirmStripeCheckout,
  fetchEntitlements,
  openStripePortal,
  redeemInviteToken,
  startStripeCheckout,
  type BillingTarget,
  type EntitlementsResponse,
  type InviteRedeemError,
} from '../lib/billingApi'
import { useAuth } from './AuthContext'
import { billingLog } from '../utils/billingLog'

export type FeatureUnlockView = {
  allUnlocked: boolean
  features: Partial<Record<PremiumFeatureId, boolean>>
  hasBundleStripe: boolean
  hasIndividualStripe: boolean
  stripeActiveFeatures: string[]
  loading: boolean
  updatedAt: number
}

type FeatureUnlockContextValue = {
  state: FeatureUnlockView
  billingConfigured: boolean
  isUnlocked: (id: PremiumFeatureId) => boolean
  refreshEntitlements: () => Promise<void>
  redeemInvite: (token: string) => Promise<{ ok: boolean; message: string }>
  startCheckout: (target: BillingTarget) => Promise<{ ok: boolean; message: string }>
  openBillingPortal: () => Promise<{ ok: boolean; message: string }>
  canOfferBundleSubscription: boolean
  canUpgradeToBundleSubscription: boolean
  canOfferIndividualSubscription: (id: PremiumFeatureId) => boolean
  hasActiveStripeSubscription: (id: PremiumFeatureId) => boolean
}

const emptyView = (): FeatureUnlockView => ({
  allUnlocked: false,
  features: {},
  hasBundleStripe: false,
  hasIndividualStripe: false,
  stripeActiveFeatures: [],
  loading: true,
  updatedAt: 0,
})

const FeatureUnlockContext = createContext<FeatureUnlockContextValue | null>(null)

function applyEntitlements(data: EntitlementsResponse): FeatureUnlockView {
  return {
    allUnlocked: data.allUnlocked,
    features: data.features,
    hasBundleStripe: data.hasBundleStripe,
    hasIndividualStripe: data.hasIndividualStripe,
    stripeActiveFeatures: data.stripeActiveFeatures ?? [],
    loading: false,
    updatedAt: data.updatedAt,
  }
}

export function FeatureUnlockProvider({ children }: { children: ReactNode }) {
  const { session, configured: authConfigured, registrationComplete } = useAuth()
  const billingConfigured = authConfigured
  const devAll = isDevUnlockAllEnabled()

  const [state, setState] = useState<FeatureUnlockView>(emptyView)

  const refreshEntitlements = useCallback(async () => {
    if (devAll) {
      setState({
        allUnlocked: true,
        features: Object.fromEntries(
          PREMIUM_FEATURE_IDS.map((id) => [id, true]),
        ) as FeatureUnlockView['features'],
        hasBundleStripe: false,
        hasIndividualStripe: false,
        stripeActiveFeatures: [],
        loading: false,
        updatedAt: Date.now(),
      })
      return
    }
    if (!session) {
      setState({ ...emptyView(), loading: false })
      return
    }
    setState((s) => ({ ...s, loading: true }))
    const data = await fetchEntitlements(session)
    if (data) {
      setState(applyEntitlements(data))
    } else {
      billingLog('warn', 'Failed to fetch entitlements')
      setState({ ...emptyView(), loading: false })
    }
  }, [devAll, session])

  useEffect(() => {
    void refreshEntitlements()
  }, [refreshEntitlements])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('billing') === 'success') {
      const checkoutSessionId = params.get('session_id')
      void (async () => {
        if (checkoutSessionId && session) {
          await confirmStripeCheckout(session, checkoutSessionId)
        }
        await refreshEntitlements()
      })()
      params.delete('billing')
      params.delete('session_id')
      const q = params.toString()
      const path = window.location.pathname + (q ? `?${q}` : '')
      window.history.replaceState({}, '', path)
    }
  }, [refreshEntitlements, session])

  const isUnlocked = useCallback(
    (id: PremiumFeatureId) => {
      if (devAll) return true
      if (state.allUnlocked) return true
      return Boolean(state.features[id])
    },
    [devAll, state.allUnlocked, state.features],
  )

  const inviteRedeemMessage = (error?: InviteRedeemError): string => {
    switch (error) {
      case 'EMAIL_MISMATCH':
        return 'ログイン中のメールが、この招待コードに紐づいたメールと一致しません。マジックリンクでログインしたメールと、管理者が登録した allowedEmail を同じにしてください。'
      case 'INVALID':
        return '招待コードが見つかりません。created-invites-*.json の token をそのまま貼ってください（メールアドレスではありません）。'
      case 'USED':
      case 'ALREADY_REDEEMED':
        return 'この招待コードは既に使用済みです。'
      case 'REVOKED':
        return 'この招待コードは無効化されています。'
      case 'EXPIRED':
        return 'この招待コードは期限切れです。'
      default:
        return 'コードを適用できませんでした。'
    }
  }

  const redeemInvite = useCallback(
    async (token: string) => {
      if (!session) {
        return { ok: false, message: '先にアカウント登録（メール・ユーザー名）を完了してください。' }
      }
      if (!registrationComplete) {
        return {
          ok: false,
          message: 'ユーザー名の登録が未完了です。上の「ユーザー名を保存」を押してください。',
        }
      }
      const result = await redeemInviteToken(session, token)
      if (!result.ok) {
        billingLog('warn', 'Invite redeem rejected', result.error)
        return { ok: false, message: inviteRedeemMessage(result.error) }
      }
      await refreshEntitlements()
      return { ok: true, message: '反映しました。' }
    },
    [session, registrationComplete, refreshEntitlements],
  )

  const startCheckout = useCallback(
    async (target: BillingTarget) => {
      if (!session) {
        return { ok: false, message: '先にアカウント登録（メール・ユーザー名）を完了してください。' }
      }
      if (!registrationComplete) {
        return {
          ok: false,
          message: 'ユーザー名の登録が未完了です。上の「ユーザー名を保存」を押してください。',
        }
      }
      const result = await startStripeCheckout(session, target)
      if (result.alreadySubscribed) {
        await refreshEntitlements()
        return {
          ok: false,
          message: 'この機能は既に契約済みです。「状態を更新」を押してください。',
        }
      }
      if (!result.ok) {
        billingLog('warn', 'Stripe checkout start failed', { target })
        return { ok: false, message: '決済を開始できませんでした。' }
      }
      return { ok: true, message: '' }
    },
    [session, registrationComplete, refreshEntitlements],
  )

  const openBillingPortal = useCallback(
    async () => {
      if (!session) {
        return { ok: false, message: 'ログインしてください。' }
      }
      const ok = await openStripePortal(session)
      if (!ok) {
        billingLog('warn', 'Stripe portal open failed')
        return { ok: false, message: '契約管理を開けませんでした。' }
      }
      return { ok: true, message: '' }
    },
    [session],
  )

  const hasStripeFor = useCallback(
    (id: PremiumFeatureId) =>
      state.stripeActiveFeatures.includes('all') ||
      state.stripeActiveFeatures.includes(id),
    [state.stripeActiveFeatures],
  )

  const canOfferBundle =
    !state.allUnlocked &&
    !state.hasBundleStripe &&
    !state.hasIndividualStripe &&
    Boolean(session) &&
    registrationComplete

  const canUpgradeToBundle =
    !state.allUnlocked &&
    !state.hasBundleStripe &&
    state.hasIndividualStripe &&
    Boolean(session) &&
    registrationComplete

  const canOfferIndividual = useCallback(
    (id: PremiumFeatureId) =>
      !state.allUnlocked &&
      !state.hasBundleStripe &&
      !isUnlocked(id) &&
      !hasStripeFor(id) &&
      Boolean(session) &&
      registrationComplete,
    [state.allUnlocked, state.hasBundleStripe, isUnlocked, hasStripeFor, session, registrationComplete],
  )

  const value = useMemo(
    () => ({
      state,
      billingConfigured,
      isUnlocked,
      refreshEntitlements,
      redeemInvite,
      startCheckout,
      openBillingPortal,
      canOfferBundleSubscription: canOfferBundle,
      canUpgradeToBundleSubscription: canUpgradeToBundle,
      canOfferIndividualSubscription: canOfferIndividual,
      hasActiveStripeSubscription: hasStripeFor,
    }),
    [
      state,
      billingConfigured,
      isUnlocked,
      refreshEntitlements,
      redeemInvite,
      startCheckout,
      openBillingPortal,
      canOfferBundle,
      canUpgradeToBundle,
      canOfferIndividual,
      hasStripeFor,
    ],
  )

  return (
    <FeatureUnlockContext.Provider value={value}>
      {children}
    </FeatureUnlockContext.Provider>
  )
}

export function useFeatureUnlock(): FeatureUnlockContextValue {
  const ctx = useContext(FeatureUnlockContext)
  if (!ctx) {
    throw new Error('useFeatureUnlock must be used within FeatureUnlockProvider')
  }
  return ctx
}

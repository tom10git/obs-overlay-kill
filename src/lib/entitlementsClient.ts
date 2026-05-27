import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PREMIUM_FEATURE_IDS,
  type PremiumFeatureId,
} from '../constants/premiumFeatures'
export type EntitlementsResponse = {
  allUnlocked: boolean
  features: Partial<Record<PremiumFeatureId, boolean>>
  hasBundleStripe: boolean
  hasIndividualStripe: boolean
  stripeActiveFeatures?: string[]
  updatedAt: number
}

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']

/** 招待 all は4機能を個別行で付与するため、全件揃えば全機能解放とみなす */
function deriveAllUnlocked(
  features: Partial<Record<PremiumFeatureId, boolean>>,
  hasAllRow: boolean,
): boolean {
  if (hasAllRow) return true
  return PREMIUM_FEATURE_IDS.every((id) => features[id])
}

function mergeFeaturesFromStripeSubs(
  features: Partial<Record<PremiumFeatureId, boolean>>,
  allUnlocked: boolean,
  activeSubs: { feature_id: string }[],
): { features: Partial<Record<PremiumFeatureId, boolean>>; allUnlocked: boolean } {
  const next = { ...features }
  let all = allUnlocked

  for (const sub of activeSubs) {
    if (sub.feature_id === 'all') {
      all = true
      for (const id of PREMIUM_FEATURE_IDS) next[id] = true
    } else if (PREMIUM_FEATURE_IDS.includes(sub.feature_id as PremiumFeatureId)) {
      next[sub.feature_id as PremiumFeatureId] = true
    }
  }

  return {
    features: next,
    allUnlocked: deriveAllUnlocked(next, all),
  }
}

function expandActiveStripeFeatureIds(
  subs: { feature_id: string }[],
): string[] {
  const hasBundle = subs.some((s) => s.feature_id === 'all')
  if (hasBundle) return ['all', ...PREMIUM_FEATURE_IDS]
  return subs.map((s) => s.feature_id)
}

/** Supabase RLS 経由で解放状態を取得（Next.js API 不要） */
export async function loadEntitlementsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<EntitlementsResponse | null> {
  const { data: entRows, error: entErr } = await supabase
    .from('feature_entitlements')
    .select('feature_id, active, expires_at')
    .eq('user_id', userId)
    .eq('active', true)

  if (entErr) return null

  const now = Date.now()
  const activeEnt = (entRows ?? []).filter((row) => {
    if (!row.expires_at) return true
    return new Date(row.expires_at).getTime() > now
  })

  const features: Partial<Record<PremiumFeatureId, boolean>> = {}
  let allUnlocked = false
  for (const row of activeEnt) {
    if (row.feature_id === 'all') allUnlocked = true
    if (PREMIUM_FEATURE_IDS.includes(row.feature_id as PremiumFeatureId)) {
      features[row.feature_id as PremiumFeatureId] = true
    }
  }

  const { data: subs, error: subErr } = await supabase
    .from('stripe_subscriptions')
    .select('feature_id, status')
    .eq('user_id', userId)
    .in('status', [...ACTIVE_STATUSES])

  if (subErr) return null

  const activeSubs = subs ?? []
  const merged = mergeFeaturesFromStripeSubs(features, allUnlocked, activeSubs)

  const hasBundleStripe = activeSubs.some((s) => s.feature_id === 'all')
  const hasIndividualStripe = activeSubs.some((s) =>
    PREMIUM_FEATURE_IDS.includes(s.feature_id as PremiumFeatureId),
  )

  return {
    allUnlocked: deriveAllUnlocked(merged.features, merged.allUnlocked),
    features: merged.features,
    hasBundleStripe,
    hasIndividualStripe,
    stripeActiveFeatures: expandActiveStripeFeatureIds(activeSubs),
    updatedAt: Date.now(),
  }
}

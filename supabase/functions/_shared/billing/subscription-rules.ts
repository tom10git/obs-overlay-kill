import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { PREMIUM_FEATURE_IDS, type BillingTarget } from './features.ts'

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'] as const

export type ActiveStripeState = {
  featureIds: Set<string>
  hasBundle: boolean
  hasIndividual: boolean
}

export async function getActiveStripeSubscriptions(
  admin: SupabaseClient,
  userId: string,
): Promise<ActiveStripeState> {
  const { data: subs } = await admin
    .from('stripe_subscriptions')
    .select('feature_id, status')
    .eq('user_id', userId)
    .in('status', [...ACTIVE_STATUSES])

  const featureIds = new Set<string>()
  let hasBundle = false
  let hasIndividual = false

  for (const s of subs ?? []) {
    featureIds.add(s.feature_id)
    if (s.feature_id === 'all') hasBundle = true
    if (
      (PREMIUM_FEATURE_IDS as readonly string[]).includes(s.feature_id)
    ) {
      hasIndividual = true
    }
  }

  return { featureIds, hasBundle, hasIndividual }
}

function alreadyCoversFeature(
  active: ActiveStripeState,
  target: BillingTarget,
): boolean {
  if (active.hasBundle) return true
  if (target === 'all') {
    return PREMIUM_FEATURE_IDS.every((id) => active.featureIds.has(id))
  }
  return active.featureIds.has(target)
}

export async function canStartStripeCheckout(
  admin: SupabaseClient,
  userId: string,
  target: BillingTarget,
): Promise<{ allowed: boolean; log?: string }> {
  const active = await getActiveStripeSubscriptions(admin, userId)

  if (alreadyCoversFeature(active, target)) {
    return {
      allowed: false,
      log: `Checkout blocked: already subscribed (${target})`,
    }
  }

  if (target === 'all' && active.hasIndividual) {
    return {
      allowed: false,
      log: `Bundle blocked: user has individual subs (${[...active.featureIds].join(',')})`,
    }
  }

  if (target !== 'all' && active.hasBundle) {
    return {
      allowed: false,
      log: 'Individual blocked: user has bundle subscription',
    }
  }

  return { allowed: true }
}

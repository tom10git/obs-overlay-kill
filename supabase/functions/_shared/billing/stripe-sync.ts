import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type Stripe from 'npm:stripe@17.7.0'
import { syncEntitlementsFromSubscription } from './entitlements.ts'
import { isBillingTarget } from './features.ts'

const ACTIVE = new Set(['active', 'trialing', 'past_due'])

function featureIdFromPriceId(priceId: string): string | null {
  const map: Record<string, string | undefined> = {
    probabilities: Deno.env.get('STRIPE_PRICE_PROBABILITIES'),
    autoReply: Deno.env.get('STRIPE_PRICE_AUTO_REPLY'),
    viewerSettings: Deno.env.get('STRIPE_PRICE_VIEWER_SETTINGS'),
    layoutFine: Deno.env.get('STRIPE_PRICE_LAYOUT_FINE'),
    all: Deno.env.get('STRIPE_PRICE_ALL_FEATURES'),
  }
  for (const [fid, pid] of Object.entries(map)) {
    if (pid && pid === priceId) return fid
  }
  return null
}

export async function upsertSubscriptionFromStripe(
  admin: SupabaseClient,
  subscription: Stripe.Subscription,
  overrides?: { userId?: string; featureId?: string },
): Promise<{ ok: boolean; log?: string }> {
  const priceId = subscription.items.data[0]?.price?.id ?? ''
  const userId =
    overrides?.userId ?? subscription.metadata.supabase_user_id ?? undefined
  const featureId =
    overrides?.featureId ??
    subscription.metadata.feature_id ??
    (priceId ? featureIdFromPriceId(priceId) : null) ??
    undefined
  if (!userId || !featureId || !isBillingTarget(featureId)) {
    return { ok: false, log: 'missing subscription metadata' }
  }

  const active = ACTIVE.has(subscription.status)
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null

  await admin.from('stripe_subscriptions').upsert({
    stripe_subscription_id: subscription.id,
    user_id: userId,
    stripe_price_id: priceId,
    feature_id: featureId,
    status: subscription.status,
    current_period_end: periodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  })

  await syncEntitlementsFromSubscription(admin, {
    userId,
    featureId,
    stripeSubscriptionId: subscription.id,
    active,
    expiresAt: active ? periodEnd : new Date().toISOString(),
  })

  return { ok: true }
}

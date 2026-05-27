import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { expandFeatureEntitlements, type BillingTarget } from './features.ts'

export async function syncEntitlementsFromSubscription(
  admin: SupabaseClient,
  params: {
    userId: string
    featureId: BillingTarget
    stripeSubscriptionId: string
    active: boolean
    expiresAt: string | null
  },
) {
  const features = expandFeatureEntitlements(params.featureId)
  const now = new Date().toISOString()

  if (!params.active) {
    await admin
      .from('feature_entitlements')
      .update({ active: false, updated_at: now })
      .eq('user_id', params.userId)
      .eq('stripe_subscription_id', params.stripeSubscriptionId)
    return
  }

  for (const fid of features) {
    await admin.from('feature_entitlements').upsert(
      {
        user_id: params.userId,
        feature_id: fid,
        source: 'stripe',
        stripe_subscription_id: params.stripeSubscriptionId,
        invite_token_id: null,
        active: true,
        expires_at: params.expiresAt,
        updated_at: now,
      },
      { onConflict: 'user_id,feature_id' },
    )
  }
}

export async function grantInviteEntitlements(
  admin: SupabaseClient,
  params: {
    userId: string
    featureId: BillingTarget
    inviteTokenId: string
  },
) {
  const features = expandFeatureEntitlements(params.featureId)
  const now = new Date().toISOString()
  for (const fid of features) {
    await admin.from('feature_entitlements').upsert(
      {
        user_id: params.userId,
        feature_id: fid,
        source: 'invite',
        stripe_subscription_id: null,
        invite_token_id: params.inviteTokenId,
        active: true,
        expires_at: null,
        updated_at: now,
      },
      { onConflict: 'user_id,feature_id' },
    )
  }
}

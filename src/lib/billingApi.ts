import type { PremiumFeatureId } from '../constants/premiumFeatures'
import { FunctionsHttpError, type Session } from '@supabase/supabase-js'
import { getSupabaseClient } from './supabaseClient'
import {
  loadEntitlementsForUser,
  type EntitlementsResponse,
} from './entitlementsClient'

export type BillingTarget = PremiumFeatureId | 'all'

export type { EntitlementsResponse }

async function invokeBillingFunction<T>(
  name: string,
  session: Session,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data?: T }> {
  const supabase = getSupabaseClient()
  if (!supabase) return { ok: false, status: 0 }

  const { data, error } = await supabase.functions.invoke(name, {
    body: body ?? {},
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (error) {
    let status = 500
    if (error instanceof FunctionsHttpError && error.context) {
      status = error.context.status
    }
    return { ok: false, status, data: data as T | undefined }
  }

  return { ok: true, status: 200, data: data as T }
}

export async function fetchEntitlements(
  session: Session | null,
): Promise<EntitlementsResponse | null> {
  const supabase = getSupabaseClient()
  if (!supabase || !session?.user) return null
  return loadEntitlementsForUser(supabase, session.user.id)
}

export async function confirmStripeCheckout(
  session: Session | null,
  sessionId: string,
): Promise<boolean> {
  if (!session) return false
  const result = await invokeBillingFunction<{ ok?: boolean }>(
    'stripe-confirm-checkout',
    session,
    { sessionId },
  )
  return result.ok
}

export async function startStripeCheckout(
  session: Session | null,
  featureId: BillingTarget,
): Promise<{ ok: boolean; alreadySubscribed?: boolean }> {
  if (!session) return { ok: false }

  const overlay =
    (import.meta.env.VITE_OVERLAY_PUBLIC_URL as string | undefined)?.trim() ||
    (typeof window !== 'undefined' ? window.location.origin : '')

  const result = await invokeBillingFunction<{ url?: string }>(
    'stripe-checkout',
    session,
    {
      featureId,
      successUrl: `${overlay}/overlay?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${overlay}/overlay?billing=cancel`,
    },
  )

  if (result.status === 409) return { ok: false, alreadySubscribed: true }
  if (!result.ok || !result.data?.url) return { ok: false }

  window.location.href = result.data.url
  return { ok: true }
}

export async function openStripePortal(
  session: Session | null,
): Promise<{ ok: boolean }> {
  if (!session) return { ok: false }
  const result = await invokeBillingFunction<{ url?: string }>(
    'stripe-portal',
    session,
  )
  if (!result.ok || !result.data?.url) return { ok: false }
  window.location.href = result.data.url
  return { ok: true }
}

export async function redeemInviteToken(
  session: Session | null,
  token: string,
): Promise<{ ok: boolean }> {
  if (!session) return { ok: false }
  const result = await invokeBillingFunction('invite-redeem', session, { token })
  return { ok: result.ok }
}

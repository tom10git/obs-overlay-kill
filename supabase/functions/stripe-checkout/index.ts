import { getUserFromRequest } from '../_shared/auth.ts'
import { canStartStripeCheckout } from '../_shared/billing/subscription-rules.ts'
import { isBillingTarget } from '../_shared/billing/features.ts'
import { handleCorsPreflight, jsonResponse, overlayOrigin } from '../_shared/cors.ts'
import { createSupabaseAdmin } from '../_shared/supabase-admin.ts'
import { getStripe, getStripePriceId } from '../_shared/stripe.ts'

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return jsonResponse(req,{ error: 'method_not_allowed' }, 405)
  }

  try {
    const user = await getUserFromRequest(req)
    if (!user) return jsonResponse(req,{ error: 'unauthorized' }, 401)

    const body = (await req.json()) as {
      featureId?: string
      successUrl?: string
      cancelUrl?: string
    }
    const featureId = body.featureId?.trim()
    if (!featureId || !isBillingTarget(featureId)) {
      return jsonResponse(req,{ error: 'invalid_feature' }, 400)
    }

    const priceId = getStripePriceId(featureId)
    if (!priceId) {
      return jsonResponse(req,{ error: 'price_not_configured' }, 503)
    }

    const admin = createSupabaseAdmin()
    const gate = await canStartStripeCheckout(admin, user.id, featureId)
    if (!gate.allowed) {
      console.warn('[billing]', gate.log)
      return jsonResponse(req,{ error: 'checkout_blocked' }, 409)
    }

    const { data: existingCustomer } = await admin
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    const stripe = getStripe()
    let customerId = existingCustomer?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await admin.from('stripe_customers').upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
      })
    }

    const overlay = overlayOrigin()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url:
        body.successUrl?.trim() ||
        `${overlay}/overlay?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        body.cancelUrl?.trim() || `${overlay}/overlay?billing=cancel`,
      client_reference_id: user.id,
      metadata: {
        supabase_user_id: user.id,
        feature_id: featureId,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          feature_id: featureId,
        },
      },
      allow_promotion_codes: true,
    })

    if (!session.url) {
      return jsonResponse(req,{ error: 'session_failed' }, 500)
    }

    return jsonResponse(req,{ url: session.url })
  } catch (e) {
    console.error('[billing] stripe-checkout', e)
    return jsonResponse(req,{ error: 'internal' }, 500)
  }
})

import { getUserFromRequest } from '../_shared/auth.ts'
import { upsertSubscriptionFromStripe } from '../_shared/billing/stripe-sync.ts'
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts'
import { createSupabaseAdmin } from '../_shared/supabase-admin.ts'
import { getStripe } from '../_shared/stripe.ts'

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return jsonResponse(req,{ error: 'method_not_allowed' }, 405)
  }

  try {
    const user = await getUserFromRequest(req)
    if (!user) return jsonResponse(req,{ error: 'unauthorized' }, 401)

    const body = (await req.json()) as { sessionId?: string }
    const sessionId = body.sessionId?.trim()
    if (!sessionId) {
      return jsonResponse(req,{ error: 'session_required' }, 400)
    }

    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    if (session.client_reference_id && session.client_reference_id !== user.id) {
      return jsonResponse(req,{ error: 'session_user_mismatch' }, 403)
    }

    const sub =
      typeof session.subscription === 'string'
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription

    if (!sub) {
      return jsonResponse(req,{ error: 'no_subscription' }, 404)
    }

    const admin = createSupabaseAdmin()
    const result = await upsertSubscriptionFromStripe(admin, sub)
    if (!result.ok) {
      console.warn('[billing] confirm-checkout', result.log)
      return jsonResponse(req,{ error: 'sync_failed' }, 500)
    }

    return jsonResponse(req,{ ok: true })
  } catch (e) {
    console.error('[billing] stripe-confirm-checkout', e)
    return jsonResponse(req,{ error: 'internal' }, 500)
  }
})

import { getUserFromRequest } from '../_shared/auth.ts'
import {
  handleCorsPreflight,
  jsonResponse,
  overlayOrigin,
} from '../_shared/cors.ts'
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

    const admin = createSupabaseAdmin()
    const { data: row } = await admin
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!row?.stripe_customer_id) {
      return jsonResponse(req,{ error: 'no_customer' }, 404)
    }

    const portal = await getStripe().billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${overlayOrigin()}/overlay?settingsTab=billing`,
    })

    return jsonResponse(req,{ url: portal.url })
  } catch (e) {
    console.error('[billing] stripe-portal', e)
    return jsonResponse(req,{ error: 'internal' }, 500)
  }
})

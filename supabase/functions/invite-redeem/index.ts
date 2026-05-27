import { getUserFromRequest } from '../_shared/auth.ts'
import { redeemInviteToken } from '../_shared/billing/invites.ts'
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts'
import { createSupabaseAdmin } from '../_shared/supabase-admin.ts'

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return jsonResponse(req,{ error: 'method_not_allowed' }, 405)
  }

  try {
    const user = await getUserFromRequest(req)
    if (!user) return jsonResponse(req,{ error: 'unauthorized' }, 401)

    const body = (await req.json()) as { token?: string }
    const token = body.token?.trim()
    if (!token || token.length < 8) {
      return jsonResponse(req,{ error: 'invalid_token' }, 400)
    }

    const admin = createSupabaseAdmin()
    const result = await redeemInviteToken(admin, {
      rawToken: token,
      userId: user.id,
      userEmail: user.email,
    })

    if (!result.ok) {
      console.warn('[billing] invite redeem', result.log, { userId: user.id })
      return jsonResponse(req,{ error: 'redeem_failed' }, 403)
    }

    return jsonResponse(req,{ ok: true })
  } catch (e) {
    console.error('[billing] invite-redeem', e)
    return jsonResponse(req,{ error: 'internal' }, 500)
  }
})

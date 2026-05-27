import { createInviteToken } from '../_shared/billing/invite-admin.ts'
import { isBillingTarget } from '../_shared/billing/features.ts'
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts'
import { createSupabaseAdmin } from '../_shared/supabase-admin.ts'

function requireAdmin(req: Request): boolean {
  const secret = Deno.env.get('BILLING_ADMIN_SECRET')?.trim()
  if (!secret) return false
  return req.headers.get('x-billing-admin-secret') === secret
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return jsonResponse(req,{ error: 'method_not_allowed' }, 405)
  }

  if (!requireAdmin(req)) {
    return jsonResponse(req,{ error: 'forbidden' }, 403)
  }

  try {
    const body = (await req.json()) as {
      featureId?: string
      allowedEmail?: string
      allowedUserId?: string
      bindOnFirstRedeem?: boolean
      neverExpires?: boolean
      expiresInDays?: number
      maxRedemptions?: number
      note?: string
      label?: string
    }

    const featureId = body.featureId?.trim()
    if (!featureId || !isBillingTarget(featureId)) {
      return jsonResponse(req,{ error: 'invalid_feature' }, 400)
    }

    if (
      !body.allowedEmail?.trim() &&
      !body.allowedUserId?.trim() &&
      !body.bindOnFirstRedeem
    ) {
      return jsonResponse(req,{ error: 'recipient_required' }, 400)
    }

    const admin = createSupabaseAdmin()
    const result = await createInviteToken(admin, {
      featureId,
      allowedEmail: body.allowedEmail,
      allowedUserId: body.allowedUserId,
      bindOnFirstRedeem: body.bindOnFirstRedeem,
      neverExpires: body.neverExpires,
      expiresInDays: body.expiresInDays,
      maxRedemptions: body.maxRedemptions,
      note: body.note,
      label: body.label,
    })

    if ('error' in result) {
      return jsonResponse(req,{ error: result.error }, 500)
    }

    return jsonResponse(req,result)
  } catch (e) {
    console.error('[billing] admin-create-invite', e)
    return jsonResponse(req,{ error: 'internal' }, 500)
  }
})

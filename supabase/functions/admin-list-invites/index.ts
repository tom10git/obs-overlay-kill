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

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse(req,{ error: 'method_not_allowed' }, 405)
  }

  if (!requireAdmin(req)) {
    return jsonResponse(req,{ error: 'forbidden' }, 403)
  }

  try {
    const admin = createSupabaseAdmin()
    const { data, error } = await admin
      .from('invite_tokens')
      .select(
        'id, feature_id, allowed_email_hash, allowed_user_id, label, note, expires_at, revoked_at, max_redemptions, redemption_count, redeemed_by, redeemed_at, bind_on_first_redeem, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('[billing] list invites', error)
      return jsonResponse(req,{ error: 'fetch_failed' }, 500)
    }

    const invites = (data ?? []).map((row) => ({
      id: row.id,
      featureId: row.feature_id,
      emailBound: Boolean(row.allowed_email_hash),
      allowedUserId: row.allowed_user_id,
      label: row.label,
      note: row.note,
      neverExpires: row.expires_at == null,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      maxRedemptions: row.max_redemptions,
      redemptionCount: row.redemption_count,
      redeemedBy: row.redeemed_by,
      redeemedAt: row.redeemed_at,
      bindOnFirstRedeem: row.bind_on_first_redeem,
      createdAt: row.created_at,
    }))

    return jsonResponse(req,{ invites, count: invites.length })
  } catch (e) {
    console.error('[billing] admin-list-invites', e)
    return jsonResponse(req,{ error: 'internal' }, 500)
  }
})

import {
  createInviteTokensBatch,
  type CreateInviteInput,
} from '../_shared/billing/invite-admin.ts'
import { isBillingTarget } from '../_shared/billing/features.ts'
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts'
import { createSupabaseAdmin } from '../_shared/supabase-admin.ts'

function requireAdmin(req: Request): boolean {
  const secret = Deno.env.get('BILLING_ADMIN_SECRET')?.trim()
  if (!secret) return false
  return req.headers.get('x-billing-admin-secret') === secret
}

type BatchBody = {
  invites?: Array<{
    featureId?: string
    allowedEmail?: string
    allowedUserId?: string
    bindOnFirstRedeem?: boolean
    neverExpires?: boolean
    expiresInDays?: number
    maxRedemptions?: number
    note?: string
    label?: string
  }>
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
    const body = (await req.json()) as BatchBody
    const raw = body.invites
    if (!Array.isArray(raw) || raw.length === 0) {
      return jsonResponse(req,{ error: 'invites_required' }, 400)
    }
    if (raw.length > 100) {
      return jsonResponse(req,{ error: 'too_many' }, 400)
    }

    const inputs: CreateInviteInput[] = []
    for (let i = 0; i < raw.length; i++) {
      const row = raw[i]
      const featureId = row.featureId?.trim()
      if (!featureId || !isBillingTarget(featureId)) {
        return jsonResponse(req,{ error: 'invalid_feature', index: i }, 400)
      }
      if (!row.allowedEmail?.trim() && !row.allowedUserId?.trim() && !row.bindOnFirstRedeem) {
        return jsonResponse(req,
          { error: 'recipient_required', index: i },
          400,
        )
      }
      inputs.push({
        featureId,
        allowedEmail: row.allowedEmail,
        allowedUserId: row.allowedUserId,
        bindOnFirstRedeem: row.bindOnFirstRedeem,
        neverExpires: row.neverExpires ?? true,
        expiresInDays: row.expiresInDays,
        maxRedemptions: row.maxRedemptions ?? 1,
        note: row.note,
        label: row.label,
      })
    }

    const admin = createSupabaseAdmin()
    const result = await createInviteTokensBatch(admin, inputs)
    return jsonResponse(req,result)
  } catch (e) {
    console.error('[billing] admin-create-invites', e)
    return jsonResponse(req,{ error: 'internal' }, 500)
  }
})

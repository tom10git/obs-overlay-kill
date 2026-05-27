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
    const body = (await req.json()) as { id?: string }
    const id = body.id?.trim()
    if (!id) return jsonResponse(req,{ error: 'id_required' }, 400)

    const admin = createSupabaseAdmin()
    const { error } = await admin
      .from('invite_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('[billing] revoke invite', error)
      return jsonResponse(req,{ error: 'update_failed' }, 500)
    }

    return jsonResponse(req,{ ok: true })
  } catch (e) {
    console.error('[billing] admin-revoke-invite', e)
    return jsonResponse(req,{ error: 'internal' }, 500)
  }
})

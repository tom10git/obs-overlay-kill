import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { hashInviteEmail } from './email-hash.ts'
import { grantInviteEntitlements } from './entitlements.ts'
import type { BillingTarget } from './features.ts'

export async function hashInviteToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token.trim())
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export type RedeemInviteResult =
  | { ok: true }
  | { ok: false; code: string; log: string }

export async function redeemInviteToken(
  admin: SupabaseClient,
  params: { rawToken: string; userId: string; userEmail: string | undefined },
): Promise<RedeemInviteResult> {
  const tokenHash = await hashInviteToken(params.rawToken)
  const { data: row, error } = await admin
    .from('invite_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !row) {
    return { ok: false, code: 'INVALID', log: 'Invite token not found' }
  }

  if (row.revoked_at) {
    return { ok: false, code: 'REVOKED', log: 'Invite token revoked' }
  }

  if (
    row.expires_at != null &&
    new Date(row.expires_at).getTime() < Date.now()
  ) {
    return { ok: false, code: 'EXPIRED', log: 'Invite token expired' }
  }

  if (row.redemption_count >= row.max_redemptions) {
    return { ok: false, code: 'USED', log: 'Invite token exhausted' }
  }

  if (row.allowed_user_id && row.allowed_user_id !== params.userId) {
    return {
      ok: false,
      code: 'USER_MISMATCH',
      log: 'Invite bound to another user',
    }
  }

  // 本人確認は Supabase Auth（JWT の email）のみ。平文メールは DB に無い
  if (row.allowed_email_hash) {
    if (!params.userEmail?.trim()) {
      return {
        ok: false,
        code: 'EMAIL_MISMATCH',
        log: 'Signed-in user has no email on JWT',
      }
    }
    const userHash = await hashInviteEmail(params.userEmail)
    if (userHash !== row.allowed_email_hash) {
      return {
        ok: false,
        code: 'EMAIL_MISMATCH',
        log: 'Invite email hash does not match signed-in user',
      }
    }
  }

  if (row.redeemed_by && row.redeemed_by !== params.userId) {
    return {
      ok: false,
      code: 'ALREADY_REDEEMED',
      log: 'Invite already redeemed by another account',
    }
  }

  let bindUserId = row.allowed_user_id as string | null
  if (row.bind_on_first_redeem && !bindUserId) {
    bindUserId = params.userId
    await admin
      .from('invite_tokens')
      .update({ allowed_user_id: params.userId })
      .eq('id', row.id)
  }

  const { error: updErr } = await admin
    .from('invite_tokens')
    .update({
      redeemed_by: params.userId,
      redeemed_at: new Date().toISOString(),
      redemption_count: row.redemption_count + 1,
      allowed_user_id: bindUserId ?? row.allowed_user_id,
    })
    .eq('id', row.id)

  if (updErr) {
    return { ok: false, code: 'DB', log: updErr.message }
  }

  await grantInviteEntitlements(admin, {
    userId: params.userId,
    featureId: row.feature_id as BillingTarget,
    inviteTokenId: row.id,
  })

  return { ok: true }
}

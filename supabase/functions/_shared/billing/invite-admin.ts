import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { hashInviteToken } from './invites.ts'
import { isBillingTarget, type BillingTarget } from './features.ts'

export type CreateInviteInput = {
  featureId: BillingTarget
  allowedEmail?: string
  allowedUserId?: string
  bindOnFirstRedeem?: boolean
  neverExpires?: boolean
  expiresInDays?: number
  maxRedemptions?: number
  note?: string
  label?: string
}

export type CreatedInvite = {
  id: string
  token: string
  featureId: BillingTarget
  expiresAt: string | null
  label: string | null
  allowedEmail: string | null
}

function resolveExpiresAt(input: CreateInviteInput): string | null {
  if (input.neverExpires) return null
  const days = Math.min(Math.max(input.expiresInDays ?? 30, 1), 3650)
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

function generateRawToken(): string {
  return crypto.randomUUID().replace(/-/g, '') +
    crypto.randomUUID().replace(/-/g, '')
}

export async function createInviteToken(
  admin: SupabaseClient,
  input: CreateInviteInput,
): Promise<CreatedInvite | { error: string }> {
  if (!isBillingTarget(input.featureId)) {
    return { error: 'invalid_feature' }
  }

  const rawToken = generateRawToken()
  const tokenHash = await hashInviteToken(rawToken)
  const expiresAt = resolveExpiresAt(input)

  const { data, error } = await admin
    .from('invite_tokens')
    .insert({
      token_hash: tokenHash,
      feature_id: input.featureId,
      allowed_email: input.allowedEmail?.trim().toLowerCase() || null,
      allowed_user_id: input.allowedUserId?.trim() || null,
      bind_on_first_redeem: Boolean(input.bindOnFirstRedeem),
      max_redemptions: input.maxRedemptions ?? 1,
      expires_at: expiresAt,
      note: input.note?.trim() || null,
      label: input.label?.trim() || null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[billing] create invite', error)
    return { error: 'insert_failed' }
  }

  return {
    id: data.id,
    token: rawToken,
    featureId: input.featureId,
    expiresAt,
    label: input.label?.trim() || null,
    allowedEmail: input.allowedEmail?.trim().toLowerCase() || null,
  }
}

export async function createInviteTokensBatch(
  admin: SupabaseClient,
  inputs: CreateInviteInput[],
): Promise<{ created: CreatedInvite[]; errors: { index: number; error: string }[] }> {
  const created: CreatedInvite[] = []
  const errors: { index: number; error: string }[] = []

  for (let i = 0; i < inputs.length; i++) {
    const result = await createInviteToken(admin, inputs[i])
    if ('error' in result) {
      errors.push({ index: i, error: result.error })
    } else {
      created.push(result)
    }
  }

  return { created, errors }
}

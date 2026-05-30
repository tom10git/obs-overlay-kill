import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { hashInviteEmail } from './email-hash.ts'
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

export type SkippedInvite = {
  skipped: true
  reason: 'already_exists' | 'duplicate_in_batch'
  id: string
  featureId: BillingTarget
  label: string | null
  allowedEmail: string | null
  redemptionCount: number
  redeemedAt: string | null
  createdAt: string
}

export type CreateInviteResult = CreatedInvite | SkippedInvite | { error: string }

type ActiveInviteRow = {
  id: string
  feature_id: string
  label: string | null
  redemption_count: number
  redeemed_at: string | null
  created_at: string
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

function toSkipped(
  row: ActiveInviteRow,
  reason: SkippedInvite['reason'],
  allowedEmail: string | null,
): SkippedInvite {
  return {
    skipped: true,
    reason,
    id: row.id,
    featureId: row.feature_id as BillingTarget,
    label: row.label,
    allowedEmail,
    redemptionCount: row.redemption_count,
    redeemedAt: row.redeemed_at,
    createdAt: row.created_at,
  }
}

/** 無効化されていない招待（使用済みでも再発行しない） */
async function findActiveInviteByEmailHash(
  admin: SupabaseClient,
  emailHash: string,
): Promise<ActiveInviteRow | null> {
  const { data, error } = await admin
    .from('invite_tokens')
    .select('id, feature_id, label, redemption_count, redeemed_at, created_at')
    .eq('allowed_email_hash', emailHash)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[billing] find invite by email hash', error)
    return null
  }
  return data
}

async function findActiveInviteByUserId(
  admin: SupabaseClient,
  userId: string,
): Promise<ActiveInviteRow | null> {
  const { data, error } = await admin
    .from('invite_tokens')
    .select('id, feature_id, label, redemption_count, redeemed_at, created_at')
    .eq('allowed_user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[billing] find invite by user id', error)
    return null
  }
  return data
}

export async function createInviteToken(
  admin: SupabaseClient,
  input: CreateInviteInput,
  options?: { skipDuplicateCheck?: boolean },
): Promise<CreateInviteResult> {
  if (!isBillingTarget(input.featureId)) {
    return { error: 'invalid_feature' }
  }

  const allowedEmailNorm = input.allowedEmail?.trim().toLowerCase() || null
  const allowedUserId = input.allowedUserId?.trim() || null
  const allowedEmailHash = allowedEmailNorm
    ? await hashInviteEmail(allowedEmailNorm)
    : null

  if (!options?.skipDuplicateCheck) {
    if (allowedEmailHash) {
      const existing = await findActiveInviteByEmailHash(admin, allowedEmailHash)
      if (existing) {
        return toSkipped(existing, 'already_exists', allowedEmailNorm)
      }
    }
    if (allowedUserId) {
      const existing = await findActiveInviteByUserId(admin, allowedUserId)
      if (existing) {
        return toSkipped(existing, 'already_exists', allowedEmailNorm)
      }
    }
  }

  const rawToken = generateRawToken()
  const tokenHash = await hashInviteToken(rawToken)
  const expiresAt = resolveExpiresAt(input)

  const { data, error } = await admin
    .from('invite_tokens')
    .insert({
      token_hash: tokenHash,
      feature_id: input.featureId,
      allowed_email_hash: allowedEmailHash,
      allowed_user_id: allowedUserId,
      bind_on_first_redeem: Boolean(input.bindOnFirstRedeem),
      max_redemptions: input.maxRedemptions ?? 1,
      expires_at: expiresAt,
      note: input.note?.trim() || null,
      label: input.label?.trim() || null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      if (allowedEmailHash) {
        const existing = await findActiveInviteByEmailHash(admin, allowedEmailHash)
        if (existing) {
          return toSkipped(existing, 'already_exists', allowedEmailNorm)
        }
      }
    }
    console.error('[billing] create invite', error)
    return { error: 'insert_failed' }
  }

  return {
    id: data.id,
    token: rawToken,
    featureId: input.featureId,
    expiresAt,
    label: input.label?.trim() || null,
    allowedEmail: allowedEmailNorm,
  }
}

export async function createInviteTokensBatch(
  admin: SupabaseClient,
  inputs: CreateInviteInput[],
): Promise<{
  created: CreatedInvite[]
  skipped: SkippedInvite[]
  errors: { index: number; error: string }[]
}> {
  const created: CreatedInvite[] = []
  const skipped: SkippedInvite[] = []
  const errors: { index: number; error: string }[] = []
  const seenEmailHashes = new Set<string>()
  const seenUserIds = new Set<string>()

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]
    const emailNorm = input.allowedEmail?.trim().toLowerCase() || null
    const userId = input.allowedUserId?.trim() || null
    const emailHash = emailNorm ? await hashInviteEmail(emailNorm) : null

    if (emailHash && seenEmailHashes.has(emailHash)) {
      skipped.push({
        skipped: true,
        reason: 'duplicate_in_batch',
        id: '',
        featureId: input.featureId,
        label: input.label?.trim() || null,
        allowedEmail: emailNorm,
        redemptionCount: 0,
        redeemedAt: null,
        createdAt: new Date().toISOString(),
      })
      continue
    }

    if (userId && seenUserIds.has(userId)) {
      skipped.push({
        skipped: true,
        reason: 'duplicate_in_batch',
        id: '',
        featureId: input.featureId,
        label: input.label?.trim() || null,
        allowedEmail: emailNorm,
        redemptionCount: 0,
        redeemedAt: null,
        createdAt: new Date().toISOString(),
      })
      continue
    }

    const result = await createInviteToken(admin, input)
    if ('error' in result) {
      errors.push({ index: i, error: result.error })
    } else if ('skipped' in result) {
      skipped.push(result)
      if (emailHash) seenEmailHashes.add(emailHash)
      if (userId) seenUserIds.add(userId)
    } else {
      created.push(result)
      if (emailHash) seenEmailHashes.add(emailHash)
      if (userId) seenUserIds.add(userId)
    }
  }

  return { created, skipped, errors }
}

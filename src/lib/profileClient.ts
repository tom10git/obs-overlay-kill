import type { SupabaseClient } from '@supabase/supabase-js'

export type UserProfile = {
  email: string | null
  display_name: string | null
}

const DISPLAY_NAME_MIN = 1
const DISPLAY_NAME_MAX = 32

/** 表示名の文字数（絵文字などは grapheme 単位） */
function displayNameLength(value: string): number {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter('ja', { granularity: 'grapheme' })
    return [...seg.segment(value)].length
  }
  return [...value].length
}

/** 日本語の表示名向け（ひらがな・カタカナ・漢字・中点・括弧など可） */
const DISPLAY_NAME_PATTERN =
  /^[\p{L}\p{N}\p{M}\s_\-.・（）「」、。：！？〜ー]+$/u

export function validateDisplayName(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const value = raw.trim()
  const len = displayNameLength(value)
  if (len < DISPLAY_NAME_MIN) {
    return { ok: false, message: `ユーザー名を${DISPLAY_NAME_MIN}文字以上で入力してください。` }
  }
  if (len > DISPLAY_NAME_MAX) {
    return { ok: false, message: `ユーザー名は${DISPLAY_NAME_MAX}文字以内にしてください。` }
  }
  if (!DISPLAY_NAME_PATTERN.test(value)) {
    return {
      ok: false,
      message:
        'ユーザー名に使えない文字が含まれています（絵文字などは不可）。ひらがな・カタカナ・漢字・数字・・（）などが使えます。',
    }
  }
  return { ok: true, value }
}

export async function fetchUserProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('email, display_name')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null
  return data as UserProfile
}

export async function saveUserDisplayName(
  supabase: SupabaseClient,
  userId: string,
  displayName: string,
): Promise<{ ok: boolean; message?: string }> {
  const parsed = validateDisplayName(displayName)
  if (!parsed.ok) return { ok: false, message: parsed.message }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: parsed.value, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('display_name') && msg.includes('schema cache')) {
      return {
        ok: false,
        message:
          'データベースに display_name 列がありません。管理者が Supabase SQL で supabase/migrations/20260330000002_profiles_display_name.sql を実行してください。',
      }
    }
    return {
      ok: false,
      message: `ユーザー名を保存できませんでした。${msg ? `（${msg}）` : ''}`,
    }
  }
  return { ok: true }
}

export function isProfileRegistrationComplete(profile: UserProfile | null): boolean {
  return Boolean(profile?.display_name?.trim())
}

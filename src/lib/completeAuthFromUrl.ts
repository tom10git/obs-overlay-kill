import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js'

const AUTH_QUERY_KEYS = [
  'code',
  'token_hash',
  'type',
  'error',
  'error_description',
] as const

function stripAuthQueryParams(url: URL): void {
  for (const key of AUTH_QUERY_KEYS) {
    url.searchParams.delete(key)
  }
  const q = url.searchParams.toString()
  const next = url.pathname + (q ? `?${q}` : '') + url.hash
  window.history.replaceState({}, '', next)
}

/** メールのマジックリンク戻り（?code= / ?token_hash=）でセッションを確立 */
export async function completeAuthFromUrl(
  supabase: SupabaseClient,
): Promise<{ handled: boolean; ok: boolean; error?: string }> {
  if (typeof window === 'undefined') {
    return { handled: false, ok: false }
  }

  const url = new URL(window.location.href)
  const authError =
    url.searchParams.get('error_description')?.trim() ||
    url.searchParams.get('error')?.trim()
  if (authError) {
    stripAuthQueryParams(url)
    return { handled: true, ok: false, error: authError }
  }

  const code = url.searchParams.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    stripAuthQueryParams(url)
    if (error) return { handled: true, ok: false, error: error.message }
    return { handled: true, ok: true }
  }

  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    })
    stripAuthQueryParams(url)
    if (error) return { handled: true, ok: false, error: error.message }
    return { handled: true, ok: true }
  }

  return { handled: false, ok: false }
}

export function formatMagicLinkReturnError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('pkce') || m.includes('code verifier')) {
    return (
      'ログインリンクは、リンクを送ったのと同じブラウザで開いてください。' +
      '別ブラウザ・スマホのメールアプリから開くと失敗することがあります。'
    )
  }
  if (m.includes('expired') || m.includes('invalid')) {
    return 'ログインリンクの有効期限が切れています。もう一度「リンクを送信」してください。'
  }
  return `ログインリンクの処理に失敗しました。（${message}）`
}

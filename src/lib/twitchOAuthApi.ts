import type { Session } from '@supabase/supabase-js'
import { getSupabaseClient } from './supabaseClient'

export type TwitchTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
}

async function invokeTwitchOAuth(
  session: Session,
  body: Record<string, unknown>,
): Promise<TwitchTokenResponse | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data, error } = await supabase.functions.invoke('twitch-oauth', {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (error) {
    console.warn('[twitch-oauth] invoke failed:', error.message)
    return null
  }
  if (!data) return null
  const err = (data as { error?: string })?.error
  if (err) {
    console.warn('[twitch-oauth] edge error:', err)
    return null
  }
  return data as TwitchTokenResponse
}

export async function exchangeTwitchCodeViaBackend(
  session: Session,
  code: string,
  redirectUri: string,
): Promise<TwitchTokenResponse | null> {
  return invokeTwitchOAuth(session, {
    action: 'exchange',
    code,
    redirectUri,
  })
}

export async function refreshTwitchTokenViaBackend(
  session: Session,
  options?: { refreshToken?: string },
): Promise<TwitchTokenResponse | null> {
  return invokeTwitchOAuth(session, {
    action: 'refresh',
    ...(options?.refreshToken
      ? { refreshToken: options.refreshToken }
      : {}),
  })
}

export async function importTwitchRefreshViaBackend(
  session: Session,
  refreshToken: string,
): Promise<TwitchTokenResponse | null> {
  return invokeTwitchOAuth(session, {
    action: 'import',
    refreshToken,
  })
}

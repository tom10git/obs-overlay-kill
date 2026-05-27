import { createClient } from 'npm:@supabase/supabase-js@2'

export function twitchAppCredentials(): {
  clientId: string
  clientSecret: string
} | null {
  const clientId = Deno.env.get('TWITCH_TOKEN_APP_CLIENT_ID')?.trim()
  const clientSecret = Deno.env.get('TWITCH_TOKEN_APP_CLIENT_SECRET')?.trim()
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export async function exchangeTwitchCode(params: {
  code: string
  redirectUri: string
}): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
  scope?: string
}> {
  const creds = twitchAppCredentials()
  if (!creds) throw new Error('twitch_app_not_configured')

  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    code: params.code,
    grant_type: 'authorization_code',
    redirect_uri: params.redirectUri,
  })

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || data.error_description || `HTTP ${res.status}`)
  }
  return data
}

export async function refreshTwitchToken(refreshToken: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
  scope?: string
}> {
  const creds = twitchAppCredentials()
  if (!creds) throw new Error('twitch_app_not_configured')

  const normalized = refreshToken.replace(/^oauth:/i, '').trim()
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: normalized,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  })

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || data.error_description || `HTTP ${res.status}`)
  }
  return data
}

export async function saveTwitchCredentials(
  userId: string,
  tokens: {
    access_token: string
    refresh_token: string
    expires_in: number
  },
) {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const expiresAt = new Date(
    Date.now() + (tokens.expires_in - 300) * 1000,
  ).toISOString()

  await admin.from('user_twitch_credentials').upsert({
    user_id: userId,
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  })
}

export async function loadRefreshToken(userId: string): Promise<string | null> {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data } = await admin
    .from('user_twitch_credentials')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.refresh_token ?? null
}

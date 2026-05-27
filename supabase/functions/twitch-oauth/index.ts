import { getUserFromRequest } from '../_shared/auth.ts'
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts'
import {
  exchangeTwitchCode,
  loadRefreshToken,
  refreshTwitchToken,
  saveTwitchCredentials,
} from '../_shared/twitch-oauth.ts'

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return jsonResponse(req,{ error: 'method_not_allowed' }, 405)
  }

  try {
    const user = await getUserFromRequest(req)
    if (!user) return jsonResponse(req,{ error: 'unauthorized' }, 401)

    const body = (await req.json()) as {
      action?: string
      code?: string
      redirectUri?: string
      refreshToken?: string
    }

    const action = body.action?.trim() || 'refresh'

    if (action === 'exchange') {
      const code = body.code?.trim()
      const redirectUri = body.redirectUri?.trim()
      if (!code || !redirectUri) {
        return jsonResponse(req,{ error: 'code_required' }, 400)
      }
      const tokens = await exchangeTwitchCode({ code, redirectUri })
      await saveTwitchCredentials(user.id, tokens)
      return jsonResponse(req,{
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
      })
    }

    if (action === 'import') {
      const rt = body.refreshToken?.trim()
      if (!rt) return jsonResponse(req,{ error: 'refresh_required' }, 400)
      const tokens = await refreshTwitchToken(rt)
      await saveTwitchCredentials(user.id, tokens)
      return jsonResponse(req,{
        access_token: tokens.access_token,
        expires_in: tokens.expires_in,
      })
    }

    let refresh = await loadRefreshToken(user.id)
    if (!refresh && body.refreshToken?.trim()) {
      refresh = body.refreshToken.trim()
    }
    if (!refresh) {
      return jsonResponse(req,{ error: 'no_credentials' }, 404)
    }

    const tokens = await refreshTwitchToken(refresh)
    await saveTwitchCredentials(user.id, tokens)
    return jsonResponse(req,{
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
    })
  } catch (e) {
    console.error('[twitch-oauth]', e)
    return jsonResponse(req,{ error: 'internal' }, 500)
  }
})

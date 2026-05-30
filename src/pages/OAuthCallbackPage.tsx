/**
 * Twitch OAuth コールバック
 * Supabase ログイン時は Edge Function で code 交換（Secret をブラウザに載せない）
 */

import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { setTwitchOAuthTokens } from '../config/auth'
import {
  TWITCH_TOKEN_APP_CLIENT_ID_ENV_HINT,
  TWITCH_TOKEN_APP_CLIENT_SECRET_ENV_HINT,
} from '../constants/twitchEnv'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient'
import { exchangeTwitchCodeViaBackend } from '../lib/twitchOAuthApi'
import './OAuthCallbackPage.css'

export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'exchanging' | 'success' | 'error'>('exchanging')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      setStatus('error')
      setErrorMessage(searchParams.get('error_description') || error)
      return
    }

    if (!code) {
      setStatus('error')
      setErrorMessage('認証コードがありません。')
      return
    }

    const redirectUri = `${window.location.origin}/oauth/callback`

    const run = async () => {
      const supabase = getSupabaseClient()
      if (isSupabaseConfigured() && supabase) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setStatus('error')
          setErrorMessage(
            'Supabase セッションがありません。OAuth は .env 方式（get-oauth-token.bat）を使うか、Supabase Auth で別途ログインが必要です。',
          )
          return
        }
        const tokens = await exchangeTwitchCodeViaBackend(
          session,
          code,
          redirectUri,
        )
        if (!tokens?.access_token || !tokens.refresh_token) {
          setStatus('error')
          setErrorMessage(
            'トークン交換に失敗しました。twitch-oauth をデプロイし、Supabase secrets に Twitch Client Secret を設定してください。',
          )
          return
        }
        setTwitchOAuthTokens(tokens.access_token, tokens.refresh_token)
        setStatus('success')
        setTimeout(() => navigate('/overlay?oauth=success', { replace: true }), 2000)
        return
      }

      setStatus('error')
      setErrorMessage(
        `Supabase が未設定です。${TWITCH_TOKEN_APP_CLIENT_ID_ENV_HINT} / docs/SECURITY.md の .env 手順（get-oauth-token.bat 等）を確認してください。` +
          `（レガシーでは ${TWITCH_TOKEN_APP_CLIENT_SECRET_ENV_HINT} が必要です）`,
      )
    }

    void run()
  }, [searchParams, navigate])

  return (
    <div className="oauth-callback-page">
      {status === 'exchanging' && <p>Twitch 認証を処理しています…</p>}
      {status === 'success' && (
        <p>認証に成功しました。トークンは Supabase に保存されました。トップへ戻ります…</p>
      )}
      {status === 'error' && (
        <>
          <p className="oauth-callback-error">認証に失敗しました</p>
          <p>{errorMessage}</p>
        </>
      )}
    </div>
  )
}

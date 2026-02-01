/**
 * Twitch OAuth コールバック
 * 認証後にリダイレクトされ、code をトークンに交換して localStorage に保存する
 */

import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getTwitchClientId, getTwitchClientSecret, setTwitchOAuthTokens } from '../config/auth'
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

    const clientId = getTwitchClientId()
    const clientSecret = getTwitchClientSecret()
    if (!clientSecret) {
      setStatus('error')
      setErrorMessage('.env に VITE_TWITCH_CLIENT_SECRET を設定してください。')
      return
    }

    const redirectUri = `${window.location.origin}/oauth/callback`

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    })

    // 開発時は Vite プロキシ経由で CORS を回避
    const tokenUrl = import.meta.env.DEV ? '/api/oauth/token' : 'https://id.twitch.tv/oauth2/token'
    fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.message || data.error_description || `HTTP ${res.status}`)
        }
        const accessToken = data.access_token
        const refreshToken = data.refresh_token
        if (!accessToken || !refreshToken) {
          throw new Error('トークンが取得できませんでした。')
        }
        setTwitchOAuthTokens(accessToken, refreshToken)
        setStatus('success')
        setTimeout(() => {
          navigate('/?oauth=success', { replace: true })
        }, 2000)
      })
      .catch((err) => {
        setStatus('error')
        setErrorMessage(err.message || String(err))
      })
  }, [searchParams, navigate])

  return (
    <div className="oauth-callback-page">
      {status === 'exchanging' && (
        <div className="oauth-callback-box">
          <h1>トークンを取得しています...</h1>
          <p>しばらくお待ちください。</p>
        </div>
      )}
      {status === 'success' && (
        <div className="oauth-callback-box oauth-callback-success">
          <h1>✅ 認証完了</h1>
          <p>トークンを保存しました。ホームに戻ります。</p>
        </div>
      )}
      {status === 'error' && (
        <div className="oauth-callback-box oauth-callback-error">
          <h1>❌ エラー</h1>
          <p>{errorMessage}</p>
          <p className="oauth-callback-hint">
            .env に VITE_TWITCH_CLIENT_ID と VITE_TWITCH_CLIENT_SECRET を設定し、
            Twitch 開発者コンソールでリダイレクト URL に
            <code>{window.location.origin}/oauth/callback</code>
            を追加してください。
          </p>
          <a href="/" className="oauth-callback-link">ホームに戻る</a>
        </div>
      )}
    </div>
  )
}

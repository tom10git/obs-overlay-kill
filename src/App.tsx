import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink, useSearchParams } from 'react-router-dom'
import { UserDetails } from './components/UserDetails'
import { OverlayPage } from './pages/OverlayPage'
import { OverlaySettings } from './components/settings/OverlaySettings'
import { OAuthCallbackPage } from './pages/OAuthCallbackPage'
import { getAdminUsername } from './config/admin'
import { getTwitchClientId } from './config/auth'
import './App.css'

const TWITCH_OAUTH_SCOPES = 'channel:read:redemptions+channel:manage:redemptions+user:write:chat'

function TwitchOAuthSection() {
  const [searchParams, setSearchParams] = useSearchParams()
  const oauthSuccess = searchParams.get('oauth') === 'success'

  useEffect(() => {
    if (oauthSuccess) {
      const t = setTimeout(() => {
        const next = new URLSearchParams(searchParams)
        next.delete('oauth')
        setSearchParams(next, { replace: true })
      }, 5000)
      return () => clearTimeout(t)
    }
  }, [oauthSuccess, searchParams, setSearchParams])

  const handleStartOAuth = () => {
    const clientId = getTwitchClientId()
    if (!clientId) {
      alert('.env に VITE_TWITCH_CLIENT_ID を設定してください。')
      return
    }
    const redirectUri = `${window.location.origin}/oauth/callback`
    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(TWITCH_OAUTH_SCOPES)}`
    window.location.href = authUrl
  }

  return (
    <div className="twitch-oauth-section" style={{ marginBottom: '20px' }}>
      {oauthSuccess && (
        <p style={{ padding: '10px', marginBottom: '10px', background: '#1a2f1a', borderRadius: '6px', color: '#8f8' }}>
          ✅ Twitch の認証が完了しました。トークンはこのブラウザに保存されています。
        </p>
      )}
      <p style={{ margin: '0 0 10px', fontSize: '14px', color: '#ccc' }}>
        チャンネルポイント・PvPチャット送信には Twitch の OAuth トークンが必要です。
      </p>
      <button
        type="button"
        onClick={handleStartOAuth}
        className="twitch-oauth-button"
        style={{
          padding: '10px 20px',
          fontSize: '14px',
          background: '#9146ff',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        Twitch で認証（トークン取得）
      </button>
      <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#888' }}>
        初回のみ .env に VITE_TWITCH_CLIENT_ID と VITE_TWITCH_CLIENT_SECRET を設定し、
        Twitch 開発者コンソールでリダイレクト URL に <code>{window.location.origin}/oauth/callback</code> を追加してください。
        開発サーバー（<code>npm run dev</code>）で開いている場合のみボタンから取得できます。本番ビルドの場合は <code>get-oauth-token.bat</code> を使用してください。
      </p>
    </div>
  )
}

function MainApp() {
  // 管理者設定からデフォルトユーザー名を取得
  const defaultUsername = getAdminUsername() || ''
  const [userLogin, setUserLogin] = useState(defaultUsername)
  const [searchLogin, setSearchLogin] = useState(defaultUsername)

  const handleSearch = () => {
    if (userLogin.trim()) {
      setSearchLogin(userLogin.trim().toLowerCase())
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // 環境変数からデフォルトユーザー名が設定されている場合、自動的に検索
  useEffect(() => {
    if (defaultUsername && !searchLogin) {
      setSearchLogin(defaultUsername)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div>
        <h1>OBS Overlay Kill</h1>
        <nav className="main-nav">
          <NavLink to="/" end>ホーム</NavLink>
          <NavLink to="/overlay">オーバーレイ</NavLink>
          <NavLink to="/settings">設定</NavLink>
        </nav>
        <div className="card">
          <TwitchOAuthSection />
          <div className="search-section">
            <h2>Twitchユーザー検索</h2>
            <div className="search-input-group">
              <input
                type="text"
                placeholder="Twitchユーザー名を入力 (例: ninja)"
                value={userLogin}
                onChange={(e) => {
                  // ユーザー名の検証（英数字とアンダースコアのみ、4-25文字）
                  const value = e.target.value.trim()
                  if (value === '' || /^[a-zA-Z0-9_]{0,25}$/.test(value)) {
                    setUserLogin(value)
                  }
                }}
                onKeyPress={handleKeyPress}
                className="search-input"
              />
              <button onClick={handleSearch} className="search-button">
                検索
              </button>
            </div>
            <p className="search-hint">
              Twitch APIを使用してユーザー情報とストリーム状態を取得します
            </p>
          </div>

          {searchLogin && <UserDetails login={searchLogin} />}

          {!searchLogin && (
            <div className="info-section">
              <p>
                <strong>使い方:</strong>
              </p>
              <ol>
                <li>
                  <code>.env</code> ファイルに Twitch Client ID と Client
                  Secret を設定してください
                </li>
                <li>
                  Twitch Developer Console (
                  <a
                    href="https://dev.twitch.tv/console/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    https://dev.twitch.tv/console/apps
                  </a>
                  ) でアプリケーションを作成
                </li>
                <li>上記の検索ボックスにユーザー名を入力して検索</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="/overlay" element={<OverlayPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function SettingsPage() {
  return (
    <>
      <div>
        <h1>OBS Overlay Kill - 設定</h1>
        <nav className="main-nav">
          <NavLink to="/" end>ホーム</NavLink>
          <NavLink to="/overlay">オーバーレイ</NavLink>
          <NavLink to="/settings">設定</NavLink>
        </nav>
        <div className="card">
          <OverlaySettings />
        </div>
      </div>
    </>
  )
}

export default App

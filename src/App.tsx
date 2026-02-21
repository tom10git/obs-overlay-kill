import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { UserDetails } from './components/UserDetails'
import { OverlayPage } from './pages/OverlayPage'
import { OverlaySettings } from './components/settings/OverlaySettings'
import { OAuthCallbackPage } from './pages/OAuthCallbackPage'
import { getAdminUsername } from './config/admin'
import './App.css'

function TwitchOAuthSection() {
  return (
    <div className="twitch-oauth-section" style={{ marginBottom: '20px' }}>
      <p style={{ margin: '0 0 10px', fontSize: '14px', color: '#ccc' }}>
        チャンネルポイント・PvPチャット送信には Twitch の OAuth トークンが必要です。
      </p>
      <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#888' }}>
        <code>.env</code> にトークンジェネレーター用の認証情報（<code>VITE_TWITCH_TOKEN_APP_*</code> または <code>VITE_TWITCH_CLIENT_ID</code> / <code>VITE_TWITCH_CLIENT_SECRET</code>）を設定し、
        トークンは Twitch 公式のトークンジェネレーター（
        <a href="https://twitchtokengenerator.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#9146ff' }}>twitchtokengenerator.com</a> 等）で取得して
        <code>VITE_TWITCH_ACCESS_TOKEN</code> に設定してください。
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

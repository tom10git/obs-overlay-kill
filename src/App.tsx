import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink, useSearchParams } from 'react-router-dom'
import { UserDetails } from './components/UserDetails'
import { OverlayPage } from './pages/OverlayPage'
import { OverlaySettings } from './components/settings/OverlaySettings'
import { getAdminUsername } from './config/admin'
import './App.css'

function OAuthCodeDisplay() {
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // codeパラメーターがある場合、URLから削除してクリーンなURLにする
    if (code) {
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.delete('code')
      const newUrl = window.location.pathname + (newSearchParams.toString() ? '?' + newSearchParams.toString() : '')
      window.history.replaceState({}, '', newUrl)
    }
  }, [code, searchParams])

  if (!code) {
    return null
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('コピーに失敗しました:', err)
      // フォールバック: テキストエリアを使用
      const textarea = document.createElement('textarea')
      textarea.value = code
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="oauth-code-display" style={{
      margin: '20px 0',
      padding: '15px',
      backgroundColor: '#1a1a1a',
      borderRadius: '8px',
      border: '2px solid #ffffff'
    }}>
      <h3 style={{ marginTop: 0, color: '#ffffff' }}>✅ OAuth認証コードを取得しました</h3>
      <p style={{ margin: '10px 0', fontSize: '14px', color: '#cccccc' }}>
        以下の認証コードをコピーして、PowerShellコマンドで使用してください。
      </p>
      <div style={{
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        marginTop: '10px'
      }}>
        <input
          type="text"
          value={code}
          readOnly
          style={{
            flex: 1,
            padding: '10px',
            fontSize: '14px',
            border: '1px solid #555555',
            borderRadius: '4px',
            fontFamily: 'monospace',
            backgroundColor: '#2a2a2a',
            color: '#ffffff'
          }}
        />
        <button
          onClick={handleCopy}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            backgroundColor: copied ? '#333333' : '#2a2a2a',
            color: '#ffffff',
            border: '1px solid #555555',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s'
          }}
        >
          {copied ? '✓ コピーしました' : 'コピー'}
        </button>
      </div>
      <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#2a2a2a', borderRadius: '4px', border: '1px solid #555555' }}>
        <p style={{ margin: '5px 0', fontSize: '13px', fontWeight: 'bold', color: '#ffffff' }}>PowerShellコマンド:</p>
        <code style={{
          display: 'block',
          padding: '10px',
          backgroundColor: '#1a1a1a',
          borderRadius: '4px',
          fontSize: '12px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          color: '#ffffff',
          border: '1px solid #555555'
        }}>
          {`$code = "${code}"
$body = @{
    client_id = "wh2nxnneo5c3qv6xaw0jtiauzx3wpo"
    client_secret = "r3lfrpzdp5kdvt7auhcsyo1chdsevr"
    code = $code
    grant_type = "authorization_code"
    redirect_uri = "http://localhost:5173"
}
$response = Invoke-RestMethod -Uri "https://id.twitch.tv/oauth2/token" -Method Post -Body $body -ContentType "application/x-www-form-urlencoded"
$response | ConvertTo-Json`}
        </code>
      </div>
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
          <OAuthCodeDisplay />
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

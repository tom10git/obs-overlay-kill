import { useState, useEffect } from 'react'
import { UserDetails } from './components/UserDetails'
import { getAdminUsername } from './config/admin'
import './App.css'

function App() {
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
        <div className="card">
          <div className="search-section">
            <h2>Twitchユーザー検索</h2>
            <div className="search-input-group">
              <input
                type="text"
                placeholder="Twitchユーザー名を入力 (例: ninja)"
                value={userLogin}
                onChange={(e) => setUserLogin(e.target.value)}
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

export default App

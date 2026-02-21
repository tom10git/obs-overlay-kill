/**
 * OAuth認証コードを取得してトークンを取得するスクリプト
 */

import http from 'http'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import axios from 'axios'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')
const envPath = join(projectRoot, '.env')

// .envファイルからClient IDとClient Secretを読み込む
function loadEnvConfig() {
  try {
    const envContent = readFileSync(envPath, 'utf-8')
    const config = {}

    for (const line of envContent.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          config[key.trim()] = valueParts.join('=').trim()
        }
      }
    }

    return {
      clientId: config.VITE_TWITCH_CLIENT_ID,
      clientSecret: config.VITE_TWITCH_CLIENT_SECRET,
    }
  } catch (error) {
    console.error('❌ .envファイルの読み込みに失敗しました:', error.message)
    process.exit(1)
  }
}

// .envファイルを更新
function updateEnvFile(accessToken, refreshToken) {
  try {
    let envContent = readFileSync(envPath, 'utf-8')

    // 既存のトークンを更新
    if (envContent.includes('VITE_TWITCH_ACCESS_TOKEN=')) {
      envContent = envContent.replace(
        /VITE_TWITCH_ACCESS_TOKEN=.*/,
        `VITE_TWITCH_ACCESS_TOKEN=${accessToken}`
      )
    } else {
      // 存在しない場合は追加
      envContent += `\nVITE_TWITCH_ACCESS_TOKEN=${accessToken}`
    }

    if (envContent.includes('VITE_TWITCH_REFRESH_TOKEN=')) {
      envContent = envContent.replace(
        /VITE_TWITCH_REFRESH_TOKEN=.*/,
        `VITE_TWITCH_REFRESH_TOKEN=${refreshToken}`
      )
    } else {
      envContent += `\nVITE_TWITCH_REFRESH_TOKEN=${refreshToken}`
    }

    writeFileSync(envPath, envContent, 'utf-8')
    console.log('✅ .envファイルを更新しました')
  } catch (error) {
    console.error('❌ .envファイルの更新に失敗しました:', error.message)
    process.exit(1)
  }
}

// トークンを取得
async function getTokenFromCode(code, clientId, clientSecret) {
  try {
    const params = new URLSearchParams()
    params.append('grant_type', 'authorization_code')
    params.append('code', code)
    params.append('client_id', clientId)
    params.append('client_secret', clientSecret)
    params.append('redirect_uri', 'http://localhost:8888')

    const response = await axios.post(
      'https://id.twitch.tv/oauth2/token',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorData = error.response?.data
      throw new Error(
        `トークンの取得に失敗しました: ${errorData?.message || error.message}`
      )
    }
    throw error
  }
}

// HTTPサーバーを起動して認証コードを受け取る
function startAuthServer(clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`)
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>OAuth認証エラー</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                background: #000;
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: #1a1a1a;
                border: 1px solid #fff;
                border-radius: 8px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ 認証エラー</h1>
              <p>エラー: ${error}</p>
              <p>このウィンドウを閉じてください。</p>
            </div>
          </body>
          </html>
        `)
        server.close()
        reject(new Error(`認証エラー: ${error}`))
        return
      }

      if (code) {
        try {
          console.log('認証コードを取得しました。トークンを取得しています...')
          const { accessToken, refreshToken } = await getTokenFromCode(
            code,
            clientId,
            clientSecret
          )

          updateEnvFile(accessToken, refreshToken)

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>認証成功</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  background: #000;
                  color: #fff;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                }
                .container {
                  text-align: center;
                  padding: 2rem;
                  background: #1a1a1a;
                  border: 1px solid #fff;
                  border-radius: 8px;
                }
                .success {
                  color: #fff;
                  font-size: 1.2rem;
                  margin-bottom: 1rem;
                }
                .info {
                  color: #ccc;
                  font-size: 0.9rem;
                  margin-top: 1rem;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>✅ 認証成功</h1>
                <p class="success">トークンを取得しました！</p>
                <p class="info">.envファイルが自動的に更新されました。</p>
                <p class="info">このウィンドウを閉じて、開発サーバーを再起動してください。</p>
              </div>
            </body>
            </html>
          `)

          server.close()
          resolve({ accessToken, refreshToken })
        } catch (error) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>エラー</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  background: #000;
                  color: #fff;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                }
                .container {
                  text-align: center;
                  padding: 2rem;
                  background: #1a1a1a;
                  border: 1px solid #fff;
                  border-radius: 8px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>❌ エラー</h1>
                <p>${error.message}</p>
                <p>このウィンドウを閉じてください。</p>
              </div>
            </body>
            </html>
          `)
          server.close()
          reject(error)
        }
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>認証待機中</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                background: #000;
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: #1a1a1a;
                border: 1px solid #fff;
                border-radius: 8px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>認証待機中...</h1>
              <p>ブラウザで認証を完了してください。</p>
            </div>
          </body>
          </html>
        `)
      }
    })

    server.listen(8888, () => {
      console.log('✅ 認証サーバーを起動しました (http://localhost:8888)')
      console.log('ブラウザで認証を完了してください...')
    })

    // タイムアウト設定（5分）
    setTimeout(() => {
      server.close()
      reject(new Error('タイムアウト: 5分以内に認証を完了してください'))
    }, 5 * 60 * 1000)
  })
}

// メイン処理
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  OAuth認証トークン取得ツール')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  const { clientId, clientSecret } = loadEnvConfig()

  if (!clientId || !clientSecret) {
    console.error('❌ .envファイルにVITE_TWITCH_CLIENT_IDまたはVITE_TWITCH_CLIENT_SECRETが設定されていません')
    process.exit(1)
  }

  console.log(`Client ID: ${clientId.substring(0, 10)}...`)
  console.log('')

  // OAuth認証URLを生成
  // channel:read:redemptions … チャンネルポイント引き換え取得
  // channel:manage:redemptions … リワード管理
  // user:write:chat … PvP時のチャット自動返信（Send Chat Message API）に必要
  const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=http://localhost:8888&response_type=code&scope=channel:read:redemptions+channel:manage:redemptions+user:write:chat`

  console.log('ブラウザで認証URLを開いています...')
  console.log('')

  // ブラウザで認証URLを開く（Windows）
  const { exec } = await import('child_process')
  exec(`start "" "${authUrl}"`, (error) => {
    if (error) {
      console.error('❌ ブラウザの起動に失敗しました。以下のURLを手動で開いてください:')
      console.log(authUrl)
    }
  })

  // 認証サーバーを起動
  try {
    await startAuthServer(clientId, clientSecret)
    console.log('')
    console.log('✅ トークンの取得が完了しました！')
    console.log('')
    console.log('次のステップ:')
    console.log('1. 開発サーバーを再起動してください')
    console.log('2. アプリケーションが正常に動作することを確認してください')
    console.log('')
  } catch (error) {
    console.error('')
    console.error('❌ エラー:', error.message)
    console.error('')
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('❌ 予期しないエラー:', error)
  process.exit(1)
})

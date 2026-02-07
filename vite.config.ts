import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { Plugin } from 'vite'

// 開発環境用の設定ファイル保存APIプラグイン
function configSavePlugin(): Plugin {
  return {
    name: 'config-save-api',
    configureServer(server) {
      server.middlewares.use('/api/config/save', async (req, res, next) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        try {
          let body = ''
          req.on('data', (chunk) => {
            body += chunk.toString()
          })

          req.on('end', () => {
            try {
              const config = JSON.parse(body)
              const configPath = join(process.cwd(), 'public', 'config', 'overlay-config.json')
              
              // ディレクトリが存在しない場合は作成
              const configDir = join(process.cwd(), 'public', 'config')
              if (!existsSync(configDir)) {
                mkdirSync(configDir, { recursive: true })
              }

              // JSONファイルとして保存（インデント付き）
              writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
              
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(JSON.stringify({ success: true, message: '設定を保存しました' }))
            } catch (error) {
              console.error('設定保存エラー:', error)
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 500
              res.end(JSON.stringify({ success: false, error: String(error) }))
            }
          })
        } catch (error) {
          console.error('設定保存APIエラー:', error)
          res.setHeader('Content-Type', 'application/json')
          res.statusCode = 500
          res.end(JSON.stringify({ success: false, error: String(error) }))
        }
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  // enforce: 'pre' で保存APIをViteの静的ファイルより先に処理し、POST /api/config/save が確実に届くようにする
  plugins: [react(), { ...configSavePlugin(), enforce: 'pre' }],
  server: {
    proxy: {
      // アプリ内OAuth: トークン取得をプロキシ（CORS回避）
      '/api/oauth/token': {
        target: 'https://id.twitch.tv',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/oauth\/token/, '/oauth2/token'),
      },
    },
  },
})

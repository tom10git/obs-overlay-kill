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
      server.middlewares.use('/api/config/save', async (req, res, _next) => {
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

      // 開発環境用: 効果音ファイルを src/sounds に保存し、相対URL（src/sounds/...）を返す
      server.middlewares.use('/api/sounds/save', async (req, res, _next) => {
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
              const payload = JSON.parse(body) as { fileName?: unknown; dataUrl?: unknown }
              const rawName = typeof payload.fileName === 'string' ? payload.fileName : 'sound'
              const dataUrl = typeof payload.dataUrl === 'string' ? payload.dataUrl : ''

              if (!dataUrl.startsWith('data:audio/')) {
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 400
                res.end(JSON.stringify({ success: false, error: 'dataUrl must be data:audio/*' }))
                return
              }

              const comma = dataUrl.indexOf(',')
              if (comma < 0) {
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 400
                res.end(JSON.stringify({ success: false, error: 'invalid dataUrl' }))
                return
              }

              const meta = dataUrl.slice(0, comma)
              const base64 = dataUrl.slice(comma + 1)
              if (!/;base64$/i.test(meta)) {
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 400
                res.end(JSON.stringify({ success: false, error: 'dataUrl must be base64' }))
                return
              }

              const buf = Buffer.from(base64, 'base64')
              if (!buf || buf.length === 0) {
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 400
                res.end(JSON.stringify({ success: false, error: 'empty file' }))
                return
              }

              // Save into src/sounds so package:release will include it (copies src/sounds)
              const soundsDir = join(process.cwd(), 'src', 'sounds')
              if (!existsSync(soundsDir)) {
                mkdirSync(soundsDir, { recursive: true })
              }

              const extGuess = (() => {
                const m = meta.match(/^data:audio\/([a-z0-9.+-]+);base64$/i)
                const sub = m?.[1]?.toLowerCase() ?? ''
                if (sub.includes('mpeg') || sub === 'mp3') return '.mp3'
                if (sub === 'wav' || sub === 'x-wav') return '.wav'
                if (sub === 'ogg') return '.ogg'
                if (sub === 'mp4' || sub === 'm4a' || sub === 'x-m4a') return '.m4a'
                if (sub === 'aac') return '.aac'
                if (sub === 'flac') return '.flac'
                return ''
              })()

              const safeBase = rawName
                .trim()
                .replace(/^.*[\\/]/, '')
                .replace(/\s+/g, '_')
                .replace(/[^a-zA-Z0-9._-]/g, '')
                .slice(0, 80) || 'sound'

              const hasExt = /\.[a-zA-Z0-9]{1,8}$/.test(safeBase)
              const fileName = hasExt ? safeBase : safeBase + (extGuess || '.mp3')

              // Overwrite if the same name already exists.
              const outPath = join(soundsDir, fileName)
              writeFileSync(outPath, buf)

              const relativeUrl = `src/sounds/${fileName}`
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(JSON.stringify({ success: true, relativeUrl }))
            } catch (error) {
              console.error('効果音保存エラー:', error)
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 500
              res.end(JSON.stringify({ success: false, error: String(error) }))
            }
          })
        } catch (error) {
          console.error('効果音保存APIエラー:', error)
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

## OBS Overlay Kill（開発者向け）

このドキュメントは「リポジトリを clone して開発・ビルドする人」向けです。

### まず守ること（重要）

- **インストールは `npm ci`**（`npm install` は lockfile 更新時のみ）
- **`package-lock.json` を必ずコミット**
- `.env` はコミットしない（`VITE_` はビルドに埋め込まれる）

### セットアップ

#### 依存関係

- Windows: `install.bat`
- macOS / Linux: `npm ci && npm run audit:ci`

#### 環境変数（推奨：配布/本番想定）

`.env` を `.env.example` から作成し、最低限これだけを入れます（**公開されてもよい値のみ**）。

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_TWITCH_TOKEN_APP_CLIENT_ID=your_client_id_here
VITE_TWITCH_USERNAME=your_login_name
```

Secret 類（Twitch Client Secret 等）は `VITE_` に置かず **Supabase secrets** へ。

- 詳細: `docs/SECURITY.md`

### 開発・ビルド

- `npm run dev`（`http://localhost:5173`）
- `npm run build`
- `npm run preview`（`http://localhost:4173`）

### Windows のバッチファイル（何のためにある？）

`.bat` は「開発者が手順を間違えにくくする」ためのショートカットです。**配布 exe を使う一般ユーザーは不要**です。

| バッチ | いつ使う | 何をする | 注意点 |
| --- | --- | --- | --- |
| `install.bat` | 初回/クリーン環境 | Node.js が無ければ winget で LTS を導入 → `scripts/npm-ci-deps.bat` | **信頼できる clone だけ**で実行（改ざん対策） |
| `dev.bat` | 開発 | `npm run dev`（無ければ先に `npm ci`） | 停止は `Ctrl + C` |
| `build.bat` | ビルド | `.env` の最低限チェック → `npm run build` | `.env` がサンプル値のままだと止める |
| `preview.bat` | ビルド結果確認 | `dist/` がある前提で `npm run preview` | 先に `build.bat` |
| `package-release.bat` | 配布 exe 生成 | `npm run package:release` を実行 | 同梱元は `%LOCALAPPDATA%\\OBS-Overlay-Kill\\data` |
| `get-oauth-token.bat` | レガシー（推奨しない） | Python で `scripts/get_oauth_token.py` を実行 | 配布/本番は Supabase + 画面内 OAuth 推奨 |
| `convert-gif-to-webm.bat` | 素材作成 | PowerShell で GIF→透過 WebM 変換 | 開発者向け。引数で入力/出力など変更可 |
| `convert-png-sequence.bat` | 素材作成 | PowerShell で PNG連番→WebM/APNG 変換 | 対話モード/CLI両対応 |
| `npx supabase functions deploy twitch-oauth` | Twitch OAuth | Edge Function デプロイ | `npx supabase login` が必要 |

#### `scripts/npm-ci-deps.bat` について

他のバッチから共通で呼ばれる「安全な依存インストール」です。

- `npm ci`（`package-lock.json` 厳守）
- `npm audit --audit-level=high`（`OBS_OVERLAY_KILL_SKIP_AUDIT=1` でスキップ可）

### 配布（exe）

- `npm run package:release`（Windows）
  - `release/OBS-Overlay-Kill.exe` を生成

### 依存更新の安全ガード（CI）

CI では `package-lock.json` に **Git URL 依存** や既知IOCが混入していないかをチェックします。

- 実行: `npm run guard:lockfile`
- スクリプト: `scripts/guard-lockfile-supplychain.mjs`


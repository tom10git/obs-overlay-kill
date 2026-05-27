# OBS Overlay Kill

React + TypeScript + Vite で構築されたプロジェクトです。Twitch API と連携した HP オーバーレイやユーザー／ストリーム情報の表示ができます。

**バージョン:** `package.json` の `version` で管理しています。現在のバージョンはターミナルで `npm pkg get version` を実行するか、`package.json` を開いて確認できます。

## はじめに（利用者向け：何をすればいい？）

「OBSでHPゲージを出したい」人向けの最短手順です（開発はしません）。

- **起動**: 配布物を展開 → `OBS-Overlay-Kill.exe` のみ
- **表示**: ブラウザで **`http://localhost:4173/overlay`** を開く（既定ポート。変更時は表示に合わせる）
- **OBSに取り込み**: OBSで「ブラウザソース」または「ウィンドウキャプチャー」を追加して上記ページをキャプチャ
- **設定**: `/overlay` ページ内の設定パネルで、HP/攻撃/回復/効果音/DOT（出血・毒・炎）などを調整
- **保存**: 設定パネルの「保存」を押す（**exe 配布**は `%LOCALAPPDATA%\OBS-Overlay-Kill\data\config\overlay-config.json` に自動保存。**開発**は `public/config/overlay-config.json`）
- **困ったとき**: [`docs/README-配布.txt`](docs/README-配布.txt) を参照（zip に同梱して渡してもよい）

## 利用規約（使用条件）

**法的な許諾・禁止事項・免責の全文は、リポジトリ直下の [`LICENSE`](LICENSE) にあります。** 以下は読みやすいようにした概要です（未記載事項および更新後の条件は `LICENSE` および本章に従います）。

本ソフトウェア（以下「本アプリ」）を入手して実行するすべての者は、次の条件に同意したものとみなします。

### 再配布・改変

- **再配布（認めない）**: 本アプリ一式（ソース・ビルド成果物・配布 zip・同梱物など）を、**開発者 Adelaide が公式に提供した入手経路を経由せず**、第三者へ**譲渡・再配布・公開・アップロード・ホスト・販売・共有**することは**一切認めません**。ここでいう再配布とは、**あなたが入手した物を、あなたから第三者へ渡す行為**を指します（開発者がリポジトリや公式配布で公開することは対象外です）。
- **改変（設定の範囲内のみ可）**: 本アプリに対する変更は、**本アプリの画面上・設定 UI で可能な範囲に限ります**。ソースコードの改変、成果物の差し替え、スクリプト・設定ファイルの独自改変、デコンパイルや回避を伴う改変、機能の追加・削除・挙動の書き換えなど、**設定でできないことはすべて禁止**です。

### 知的財産権に関する利用制限

本アプリを用いた**配信・動画投稿・アーカイブの公開その他のコンテンツ配信**において、第三者の**知的財産権**（著作権・商標権・意匠権・キャラクター・商業利用権・楽曲・映像・ゲーム映像・ロゴ等を含みますが、これらに限りません）に**抵触する行為、またはそのおそれのある利用**を、**収益の有無を問わず一切認めません**。該当するかどうかの判断・権利処理・許諾の取得は、すべて**利用者自身の責任**で行ってください。

### 免責事項

開発者 **Adelaide** に対し、本アプリの利用（インストール・実行・設定・連携・配信への組み込み・成果物の公開を含みます）に関連して生じた**いかなる損害・不利益・トラブル・法令違反・第三者との紛争・プラットフォーム上の措置**についても、**開発者は一切責任を負いません**。本アプリの利用は、**すべて自己責任の範囲**で行うものとします。

### その他（個人開発ソフトウェアとして一般的な事項）

- **現状有姿・非保証**: 本アプリは特定の用途への適合性・恒久的な動作・セキュリティ・第三者サービスとの互換を**保証しません**。
- **第三者サービス**: Twitch 等の外部サービス利用にあたっては、**各サービスの利用規約・ガイドライン・API 利用条件**を利用者が遵守してください。本アプリはそれらに代わる説明や保証を行いません。
- **禁止される利用の例**: 違法行為の助長、他人への迷惑・権利侵害を目的とした利用、上記「再配布・改変」に反する行為、マルウェアや不正目的での本アプリの利用など（例示にすぎず、法令・公序良俗に反する利用は一切禁止します）。
- **規約の変更**: 本規約は、README の更新等により**予告なく変更**され得ます。変更後に本アプリを継続利用した場合、変更後の規約に同意したものとみなします。

---

## 配布用

開発用の Node / npm を自分で整えず、**ビルド済みの配布物（フォルダ / 圧縮ファイル）だけを扱う人**と、**それを作って渡す人**向けです。リポジトリからコードを触る手順は [開発用](#開発用) を参照してください。

### 受け取った人（実行だけ）

1. 配布 zip を**すべて展開**し、**`OBS-Overlay-Kill.exe`** をダブルクリックする（Node.js 不要）。
2. ウィンドウを開いたまま、OBS でブラウザソースを追加し、次の URL を指定する（既定ポート **4173**。変えた場合は表示に合わせる）。

   **`http://localhost:4173/overlay`**

3. 設定・効果音・画像は **`%LOCALAPPDATA%\OBS-Overlay-Kill\data\`** に保存されます（初回は exe 同梱分がコピーされます）。設定画面の「保存」で `data\config\overlay-config.json` に書き込まれます。
4. 止めるときはそのウィンドウで **Ctrl+C**。

**exe が同梱されていない配布物のみ** [Node.js](https://nodejs.org/)（LTS）が必要です。ポート変更は環境変数 **`OVERLAY_PORT`** を設定してから起動（例: `set OVERLAY_PORT=8080` のあと exe または bat）。トラブル時は同梱の **`README-配布.txt`** を参照してください。

### 配布パッケージを作る人

1. リポジトリを用意し、**`install.bat`**（Windows）または **`npm ci`** で依存関係を入れる（[セットアップ](#1-依存関係をインストール) 参照）。
2. ルートで **`npm run package:release`** を実行するか、Windows なら **`package-release.bat`** を実行する。
3. **`release/OBS-Overlay-Kill.exe` のみ**が生成される（`release/` に dist や .bat は出ません）。この exe を zip で配布する。利用者向け説明は [`docs/README-配布.txt`](docs/README-配布.txt) を同梱可。

**`package-release` 実行時**に **`%LOCALAPPDATA%\OBS-Overlay-Kill\data`**（設定・効果音・画像/WebM）を exe に同梱します。先に配布 exe または dev で AppData に保存してからビルドしてください。実行時は AppData を優先して読み書きします。

> **補足:** `release/` 全体は Git 無視です。clone 直後は exe がありません。必ず上記ビルドを実行してください。

> **exe だけ再ビルド:** `build/pkg-dist` がある状態で `npm run package:exe`（Windows のみ）。通常は `package:release` で一括。

---

## 開発用

リポジトリを clone して Twitch 設定・`npm run dev`・ビルドなどを行う場合は、以下を参照してください。

## セットアップ

### 1. 依存関係をインストール

**公式リポジトリのクローンからのみ**実行してください（改ざんされた `install.bat` や `package-lock.json` は任意コード実行の原因になります）。

#### Windows（推奨）

```batch
install.bat
```

`install.bat` は内部で `scripts\npm-ci-deps.bat` を呼び出し、**`package-lock.json` に厳密に従う `npm ci`** と **`npm audit --audit-level=high`** を行います。Node.js が無い場合は winget で LTS を導入します。

#### macOS / Linux / 手動

```bash
npm ci
npm run audit:ci
```

依存関係を **追加・更新** して lockfile を変えるときだけ `npm install` を使い、変更後は **`package-lock.json` をコミット**してください。日常の再インストールは `npm ci`（または `npm run install:ci`）に統一します。

> **`.npmrc`:** `ignore-scripts=true` により、悪意ある `postinstall` 等のライフサイクルスクリプトは実行されません。詳細は [セキュリティと認証情報の管理](#セキュリティと認証情報の管理) を参照してください。

### 2. Twitch API の認証情報を設定

1. [Twitch Developer Console](https://dev.twitch.tv/console/apps) にアクセス
2. 「Register Your Application」をクリックしてアプリケーションを作成
3. アプリケーション名を入力（例: "OBS Overlay Kill"）
4. OAuth Redirect URLs に次を追加（開発・配布プレビュー・exe で使う URL に合わせる）:
   - `http://localhost:5173/oauth/callback`（`npm run dev`）
   - `http://localhost:4173/oauth/callback`（`npm run preview` / 配布 exe）
5. Category を選択（例: "Website Integration"）
6. 作成後、**Client ID** と **Client Secret** をコピー

### 3. 環境変数を設定

プロジェクトルートに `.env` を作成します（テンプレートは [`.env.example`](.env.example)）。

**推奨（Supabase 連携・配布向け）:**

```env
# Supabase（課金・ログイン・Twitch OAuth のサーバー側）
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Twitch（Client ID のみ .env。Secret は Supabase secrets）
VITE_TWITCH_TOKEN_APP_CLIENT_ID=your_client_id_here

# 任意
VITE_TWITCH_USERNAME=your_login_name
VITE_DEFAULT_CHANNEL=your_channel_login
```

- **Stripe 秘密鍵・Twitch Client Secret** は `VITE_` にせず、`supabase secrets set` で登録します（[`docs/SECURITY.md`](docs/SECURITY.md)）。
- **課金・招待コードの初期設定**は [`docs/BILLING.md`](docs/BILLING.md) を参照してください。
- **管理者向けの読み取り**は `src/config/admin.ts`（環境変数のラッパー）。項目の詳細は `src/config/README.md`。

**レガシー（ローカル専用・`dist` / exe ビルドには Secret / Refresh Token を入れない）:**

`VITE_TWITCH_CLIENT_ID` / `VITE_TWITCH_CLIENT_SECRET`、`VITE_TWITCH_ACCESS_TOKEN` / `VITE_TWITCH_REFRESH_TOKEN` も読み取れますが、配布ビルドでは Supabase + 画面の OAuth を使う構成を推奨します。

> **注意:**
> - `.env` は Git に含めません
> - `VITE_` で始まる値はビルドに埋め込まれ、ブラウザから読めます
> - サプライチェーン・CI は [セキュリティと認証情報の管理](#セキュリティと認証情報の管理) を参照

### 4. OAuth 認証（チャンネルポイント・チャット送信）

チャンネルポイントの監視・チャット自動返信には **OAuth ユーザートークン**が必要です。

#### 方法A: アプリ内 OAuth（推奨・Supabase 設定時）

1. [`docs/BILLING.md`](docs/BILLING.md) の手順で Supabase・Edge Functions（`twitch-oauth` 等）を用意する
2. Twitch Developer Console の **OAuth Redirect URLs** に `http://localhost:5173/oauth/callback` と `http://localhost:4173/oauth/callback` を登録
3. `http://localhost:5173/overlay`（または exe の `http://localhost:4173/overlay`）を開き、設定の **「課金」** タブでメールログイン → **Twitch 連携**
4. トークンは Supabase DB に保存され、リフレッシュは Edge Function 経由（Secret をブラウザに載せない）

開発用に全 PRO を解放する場合: `.env` に `VITE_FEATURE_UNLOCK_DEV_ALL=true`（本番配布には含めない）。

#### 方法B: 手動でトークンを `.env` に書く（レガシー）

Supabase を使わないローカル開発向け。Client ID / Secret とトークンを `.env` に置きます（配布 exe には Secret を埋め込まないこと）。

> **重要:** 外部ツールで生成したトークンは、そのツールの Client ID に紐づきます。`.env` の Client ID と一致しないと 401 になります。

#### 方法C: OAuth 認証 URL を手動で開く（レガシー）

**重要**: この方法を使用する前に、Twitch Developer ConsoleでリダイレクトURIを登録する必要があります。

1. **Twitch Developer ConsoleでリダイレクトURIを登録**
   - [Twitch Developer Console](https://dev.twitch.tv/console/apps) にアクセス
   - 自分のアプリを選択
   - 「OAuth Redirect URLs」に `http://localhost:5173/oauth/callback`（開発）を追加
   - 「Update」または「Save Changes」をクリック
   - **注意**: 変更が反映されるまで数分かかる場合があります

2. **OAuth認証URLを構築**
   - 以下のURLをブラウザで開きます（`YOUR_CLIENT_ID`を自分のClient IDに置き換えてください）:
   ```
   https://id.twitch.tv/oauth2/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:5173/oauth/callback&response_type=code&scope=channel:read:redemptions+channel:manage:redemptions+user:write:chat
   ```

3. **Twitchで認証**
   - ブラウザで認証画面が開きます
   - 「承認」をクリックして認証を完了します
   - リダイレクト先の URL に `code` が含まれます（例: `http://localhost:5173/oauth/callback?code=xxxxx`）

4. **アクセストークンとリフレッシュトークンを取得**
   - リダイレクトURLから`code`パラメータをコピーします
   - 以下のコマンドを実行します（`CODE`を実際のコードに置き換えてください）:

   **PowerShellの場合:**
   ```powershell
   $code = "ここにCODEを貼り付け"
   $body = @{
       client_id = "YOUR_CLIENT_ID"
       client_secret = "YOUR_CLIENT_SECRET"
       code = $code
       grant_type = "authorization_code"
       redirect_uri = "http://localhost:5173/oauth/callback"
   }
   $response = Invoke-RestMethod -Uri "https://id.twitch.tv/oauth2/token" -Method Post -Body $body -ContentType "application/x-www-form-urlencoded"
   $response | ConvertTo-Json
   ```

   **または、curlコマンドの場合:**
   ```bash
   curl -X POST https://id.twitch.tv/oauth2/token ^
     -H "Content-Type: application/x-www-form-urlencoded" ^
     -d "client_id=YOUR_CLIENT_ID" ^
     -d "client_secret=YOUR_CLIENT_SECRET" ^
     -d "code=CODE" ^
     -d "grant_type=authorization_code" ^
     -d "redirect_uri=http://localhost:5173/oauth/callback"
   ```

   > **注意:** `YOUR_CLIENT_ID`と`YOUR_CLIENT_SECRET`を自分の`.env`ファイルに設定した値に置き換えてください。

5. **レスポンスからトークンを取得**
   - レスポンスのJSONから`access_token`と`refresh_token`をコピーします
   - `.env`ファイルの`VITE_TWITCH_ACCESS_TOKEN`と`VITE_TWITCH_REFRESH_TOKEN`に設定します
   - 開発サーバーを再起動してください

#### 方法D: TwitchTokenGenerator.comを使用する場合（レガシー）

TwitchTokenGenerator.comを使用する場合は、**必ず自分のClient ID/Secretを設定**してください:

1. [TwitchTokenGenerator.com](https://twitchtokengenerator.com/) にアクセス
2. ページ下部の「**Use My Client Secret and Client ID Optional NEW**」セクションを探す
3. 自分の Client ID / Client Secret（`.env` の `VITE_TWITCH_TOKEN_APP_CLIENT_ID` 等）を入力
4. **重要:** Twitch Dev Consoleで、アプリの「OAuth Redirect URLs」に`https://twitchtokengenerator.com`を追加する必要があります
5. 必要なスコープ（`channel:read:redemptions`など）を選択して「Generate Token!」をクリック
6. 生成された`ACCESS TOKEN`と`REFRESH TOKEN`を`.env`に設定

> **注意:** TwitchTokenGenerator.comは開発用ツールです。本番環境では必ず自分のTwitch Dev Consoleアプリで生成したトークンを使用してください。

#### 必要なスコープ

チャンネルポイント機能を使用するには、以下のスコープが必要です:
- `channel:read:redemptions` - チャンネルポイントの引き換え履歴を取得
- `channel:manage:redemptions` - チャンネルポイントの引き換えを管理（オプション）

チャットへメッセージを自動送信する機能（PvP の HP 表示・HP0 メッセージなど）を使う場合は、以下のスコープも必要です:
- `user:write:chat` - チャットへメッセージを送信

## PRO 機能・課金（配信者向け）

HP オーバーレイの基本（HP 表示・攻撃/回復・カスタムリワード連携・テストモードなど）は **無料** です。次の設定ブロックは **PRO**（Stripe 月額または開発者が配る招待コード）で解放します。

| PRO ID | 設定タブでの表示 | 内容の目安 |
| ------ | ---------------- | ---------- |
| `probabilities` | 確率（PRO） | ミス・クリ・出血・合わせ技・ルーレット・必殺技確率など |
| `autoReply` | 返信（PRO） | チャット自動返信テンプレート |
| `viewerSettings` | 対人（PRO） | 視聴者 PvP・必殺技・視聴者コマンド一式 |
| `layoutFine` | 表示位置（PRO） | ゲージ・ルーレット・合わせ技などの座標微調整 |

- **配信者の操作**: `/overlay` → 設定 → **「課金」** タブで Supabase にメールログイン → Stripe で契約、または招待コードを入力 → 必要なら **Twitch 連携**
- **開発者（課金基盤の構築）**: 手順は [`docs/BILLING.md`](docs/BILLING.md)。秘密情報の置き場所は [`docs/SECURITY.md`](docs/SECURITY.md)
- **招待コードの一括発行**: `scripts/create-invites.bat`（要 `BILLING_ADMIN_SECRET` と Edge Function のデプロイ）

## セキュリティと認証情報の管理

### 認証情報（Twitch / Supabase / `.env`）

認証情報は `src/config/auth.ts` で読み取り・検証します。Supabase 利用時は Twitch **Client Secret とリフレッシュトークンはブラウザに載せず**、Edge Function と DB に置きます（[`docs/SECURITY.md`](docs/SECURITY.md)）。

| ファイル | 役割 |
| -------- | ---- |
| `.env` | `VITE_SUPABASE_*`、Twitch Client ID、任意の公開に近い設定（**Git に含めない**） |
| `.env.example` | 変数名と説明のテンプレート（コミット対象） |
| `src/config/auth.ts` | 読み取り・検証・メモリ上の OAuth トークン |
| `src/config/admin.ts` | 管理者向け設定のラッパー |
| `src/config/README.md` | 設定項目の詳細 |
| `src/lib/supabaseClient.ts` | Supabase クライアント |
| `src/lib/twitchOAuthApi.ts` | Edge Function 経由の Twitch OAuth |
| `docs/SECURITY.md` | 秘密情報の置き場所・配布時の注意 |
| `docs/BILLING.md` | Stripe / 招待コードの構築手順 |
| `src/utils/security.ts` | XSS 対策（HTML エスケープ・URL 検証など） |

`.env` は `.gitignore` 済みです。シークレットを Issue や PR に貼らないでください。

### サプライチェーン・CI（npm / GitHub Actions）

npm レジストリや GitHub Actions を狙ったサプライチェーン攻撃への対策をリポジトリに組み込んでいます。運用の詳細・参考リンクは [`docs/SUPPLY-CHAIN-SECURITY.md`](docs/SUPPLY-CHAIN-SECURITY.md)、脆弱性の非公開報告は [`SECURITY.md`](SECURITY.md)（ルート）を参照してください。課金・OAuth の秘密情報は [`docs/SECURITY.md`](docs/SECURITY.md) を参照してください。

#### リポジトリ内のセキュリティ関連ファイル

| パス | 必須 | 内容 |
| ---- | :--: | ---- |
| `.npmrc` | ✅ | `ignore-scripts=true`（悪意ある install スクリプト対策）、`audit-level=high` |
| `package-lock.json` | ✅ | 依存の固定・整合性検証（`npm ci` の前提。**コミット必須**） |
| `package.json` | ✅ | 依存宣言、`install:ci` / `audit:ci` スクリプト、`engines`（Node 20+） |
| `scripts/npm-ci-deps.bat` | ✅ | `npm ci` + `npm audit`（`install.bat` / `build.bat` / `dev.bat` から利用） |
| `install.bat` | 推奨 | 上記 + Node.js 未導入時の winget インストール（**信頼できるクローンのみ**） |
| `.github/dependabot.yml` | ✅ | npm・GitHub Actions の週次更新 PR |
| `.github/workflows/ci.yml` | ✅ | lint / build / `npm audit`、PR 時 Dependency Review |
| `.github/workflows/codeql.yml` | ✅ | CodeQL（TypeScript・ワークフロー） |
| `SECURITY.md` | ✅ | 脆弱性報告ポリシー（調整された開示） |
| `docs/SUPPLY-CHAIN-SECURITY.md` | ✅ | 対策一覧・バッチ用環境変数・GitHub 設定メモ |

#### 開発者が守ること

1. 依存のインストールは **`npm ci`**（Windows は **`install.bat`**）。`npm install` は lock を更新するときだけ。
2. **`package-lock.json` を必ずコミット**する（再現可能ビルドと改ざん検知のため）。
3. パッケージ追加時は名前の **タイポスクワッティング** に注意し、PR では CI の **Dependency Review** を通す。
4. **侵害が疑われるバージョン**（例: 報道のあった `axios` の特定版）は即座に避け、Advisory / Dependabot を確認する。
5. GitHub 上で **Dependabot alerts** を有効化し、**branch protection** で CI をマージ必須にする（[`docs/SUPPLY-CHAIN-SECURITY.md`](docs/SUPPLY-CHAIN-SECURITY.md) の「リポジトリ外で必要なこと」参照）。

#### npm スクリプト

| コマンド | 用途 |
| -------- | ---- |
| `npm run install:ci` | `npm ci`（lockfile 厳守） |
| `npm run audit:ci` | `npm audit --audit-level=high`（CI と同じしきい値） |

#### バッチ用環境変数（Windows）

| 変数 | 効果 |
| ---- | ---- |
| `OBS_OVERLAY_KILL_SKIP_AUDIT=1` | インストール時の `npm audit` をスキップ |
| `OBS_OVERLAY_KILL_STRICT_AUDIT=1` | high 以上の脆弱性でインストールを失敗させる |
| `OBS_OVERLAY_KILL_NON_INTERACTIVE=1` | `build.bat` 等の `pause` を省略（CI・自動化向け） |

#### GitHub Actions の方針（要約）

- ワークフローの **`permissions` を最小化**（例: `contents: read`）
- 主要 Action（`checkout` / `setup-node`）は **コミット SHA でピン留め**（タグのみより改ざんリスクを低減）
- **`pull_request_target` は使用しない**
- Actions の更新 PR は **Dependabot 由来か確認**してからマージ

### 認証情報の取得方法

```typescript
import { getTwitchClientId, getTwitchClientSecret } from './config/auth'

const clientId = getTwitchClientId()
const clientSecret = getTwitchClientSecret()
```

## 開発サーバーの起動

### Windows の場合

バッチファイルを使用する場合（推奨）:

```batch
dev.bat
```

または、コマンドプロンプトで:

```bash
npm run dev
```

### その他のOSの場合

```bash
npm run dev
```

開発サーバーが起動したら、ブラウザで `http://localhost:5173` にアクセスしてください。

## OBSオーバーレイ（HPゲージ）

### 表示URL（開発環境）

- オーバーレイ表示・各種設定: `http://localhost:5173/overlay`（同一ページに設定パネルがあります）

### ブラウザウィンドウキャプチャーの設定例

1. **ブラウザでURLを開く**: `http://localhost:5173/overlay` をブラウザで開く
2. **OBSでウィンドウキャプチャーを追加**:
   - OBSで「ウィンドウキャプチャー」ソースを追加
   - キャプチャーするウィンドウ: 上記URLを開いたブラウザウィンドウを選択
   - **幅/高さ**: 1920 x 1080（任意）

### HPゲージの機能

- **設定の概要（短縮版）**:
  - **表示**: HP（最大/現在）、ゲージ数、位置・サイズ、色、フォントなど
  - **攻撃**: 固定/ランダムダメージ、ミス、クリティカル、食いしばり（HP1残り）、効果音
  - **持続ダメージ（DOT）**: 付与確率・ティック設定に加え、**出血/毒/炎のバリエーション**をウェイト抽選で付与（DOTティック音・毒/炎時の攻撃SE置き換えも設定可）
  - **回復**: 固定/ランダム回復、エフェクト、効果音
  - **HP0演出**: 画像/WebM/効果音、HP0時メッセージ
  - **PvP**: 配信者 vs 視聴者（視聴者HP管理、カウンター、視聴者同士攻撃、反転回復、必殺技など）
  - **運用**: EventSub（推奨）/ポーリング、テストモード、チャット自動返信（機能別ON/OFF）

- **HPゲージ表示**: 最大HPと現在のHPを表示（複数のレイヤーで重ねて表示可能）
- **攻撃イベント**:
  - チャンネルポイントの「攻撃」リワードでHPを減少
  - **カスタムテキスト対応**: チャットメッセージで設定したカスタムテキスト（例: `!attack`）でも攻撃を実行可能（App Access Tokenでも使用可能）
  - **ダメージ**: 固定値またはランダム値（回復量と同様）。ランダム時は最小・最大・刻み（50・100など。1のときは連続値）を設定可能。**配信者側通常攻撃**・**配信者（カウンター）攻撃**・**視聴者同士攻撃**の3箇所でそれぞれ設定可能。
  - **ミス判定**: 設定した確率で攻撃がミスになる機能（ミス効果音も設定可能）
  - **クリティカル判定**: 設定した確率でクリティカルヒットが発生し、ダメージが倍率分増加する機能
  - **出血ダメージ**: 設定した確率で出血ダメージが発生し、一定時間継続してダメージを与える機能（ランダムな方向に放射状に表示）
  - **食いしばり（HP1残り）**: 攻撃でHPが0になる場合に、**攻撃前のHPが2以上のときだけ**設定した確率でHPを1残す機能。HPが1の状態で攻撃されたときは発動せず、そのまま0になる。発動時にカスタムメッセージを表示可能。
  - **ダメージ数値表示**: 攻撃時にダメージ値を視覚的に表示（通常ダメージ、クリティカル、出血ダメージで異なる演出）
  - **攻撃効果音**: 攻撃時に効果音を再生（設定可能）
- **回復イベント**:
  - チャンネルポイントの「回復」リワードでHPを回復
  - **カスタムテキスト対応**: チャットメッセージで設定したカスタムテキスト（例: `!heal`）でも回復を実行可能（App Access Tokenでも使用可能）
  - **回復量**: 固定値またはランダム値（設定可能）。**上限はなし**（下限1のみ）。配信者側・視聴者側・リワード回復のそれぞれで設定可能。
  - **ランダム刻み**: ランダム回復時に 50・100 などの刻みを指定可能（例: 最小100・最大500・刻み50 → 100, 150, 200, … のいずれか）。刻みを 1 にすると最小～最大の連続値。
  - **回復エフェクト**: 回復時にキラキラパーティクルエフェクトを表示（設定で有効/無効を切り替え可能）
  - **回復効果音**: 回復時に効果音を再生（設定可能）
- **HPが0になったときのエフェクト**:
  - **動画エフェクト**: 透過WebM動画を再生（確実に最初から再生）
  - **画像表示**: HPが0になったときに画像を表示
  - **効果音**: HPが0になったときに効果音を再生
  - **配信者HP0時のメッセージ**: 配信者HPが0になったときにチャットへ自動送信するメッセージを設定可能。`{attacker}` で攻撃した視聴者名に置換。
- **リトライ・回復コマンド（配信者側）**:
  - **リトライ**（`!retry`）: 配信者HPが0のときのみ全回復（蘇生）。HPが1以上のときは実行されない。蘇生効果音を再生（設定可能）。
  - **全回復**（`!fullheal` など・設定で変更可能）: 配信者が実行すると配信者HPを常に最大まで回復。
  - **全員全回復**（`!resetall` など・設定で変更可能）: 配信者のみ実行可能。配信者HPと全視聴者HPを最大まで回復。
  - **通常回復**（`!heal` など・設定で変更可能）: 配信者が実行すると設定量だけ回復（固定 or ランダム、ランダム刻みも設定可能）。HPが0のときは設定で許可/ブロックを切り替え可能。
- **リアルタイム監視**:
  - **EventSub WebSocket**: チャンネルポイント引き換えイベントをリアルタイムで監視（推奨）
  - **ポーリング方式**: EventSubが使用できない場合のフォールバック（5秒間隔でポーリング）
- **PvPモード（配信者 vs 視聴者）**:
  - 視聴者ごとにHPを管理（画面上のゲージは配信者HPのみ表示。視聴者HPは数値管理のみ）。
  - **攻撃モード（プルダウン）**: 「配信者 vs 視聴者のみ」または「両方（視聴者同士の攻撃も有効）」を選択可能。「配信者 vs 視聴者のみ」のときは視聴者同士の攻撃コマンド（`!attack ユーザー名`）は無効。
  - **カウンター攻撃**: 視聴者が攻撃したとき、攻撃者またはランダムなユーザーに配信者側の攻撃設定でダメージ。カウンターコマンド（`!counter` など）で配信者が任意の視聴者を攻撃可能（ユーザー名指定: `!counter ユーザー名`）。
  - **視聴者攻撃時の反転回復**: 視聴者が攻撃したときに、設定した確率（例: 10%）で配信者HPが回復する機能。**1回の攻撃の流れ**で「まずダメージでHPが減る → 攻撃モーション後（設定した時間後）に回復」が行われる（次の攻撃を待つ条件ではない）。ダメージ・ミス・クリティカル・出血は通常どおり発生し、反転回復に当たった場合のみ、その攻撃のモーション終了後に回復が入る。発生確率と回復量を設定可能。回復量は「固定」または「ランダム（最小・最大・刻み）」で指定できる。
  - **視聴者同士の攻撃**: 攻撃モードが「両方」のときのみ有効。視聴者が別の視聴者を攻撃するコマンド（例: `!attack ユーザー名`）。コマンドとダメージ（固定/ランダム・刻み）・ミス・クリティカル等は設定で変更可能。攻撃者自身がHP0のときは攻撃不可。自分自身や配信者への攻撃は不可。対象はチャットに一度でも発言したユーザー名で指定。攻撃後は「攻撃時自動返信」に従い対象の残りHPをチャットに表示。
  - **視聴者コマンド**: HP確認（`!hp` など）、全回復（`!fullheal` など・実行した視聴者のHPを最大まで）、通常回復（`!heal` など・設定量だけ回復、固定 or ランダム・刻み設定可能・回復量に上限なし）。コマンドは設定で変更可能。
  - **HP0時の制御**: 視聴者HPが0のときは攻撃・回復をブロック可能。ブロック時や視聴者HPが0になったときのメッセージを設定可能。通常回復は「HP0のときも許可」で有効にできる。
  - **必殺技（隠し機能）**: 視聴者側の攻撃で、設定した確率（デフォルト0.001%）で必殺技が発動する機能。発動時は現在のHPの1/2ダメージ（最低1）を与え、確定で出血デバフを付与。派手なエフェクト（画面フラッシュ、シェイク、フィルター、爆発的なパーティクル、テキスト表示）が同時に発動。確率・ダメージ倍率・発動メッセージ・自動返信の有無を設定可能。テストモードに「必殺技テスト」ボタンあり。
- **チャット自動返信のオン・オフ（機能別）**:
  - 設定画面では「**自動返信設定**」タブで配信者側・ユーザー側の自動返信をまとめて編集可能（サブタブで切り替え）。
  - チャットへメッセージを送るかどうかを、機能ごとにチェックボックスで切り替え可能。
  - **配信者側**: 配信者HP0時の自動返信の有無とメッセージ、回復コマンド使用時の自動返信の有無とメッセージテンプレート。
  - **ユーザー側**: 攻撃・カウンター時、視聴者HP0時、HP確認・全回復・通常回復コマンド、HP0ブロック時の自動返信の有無とメッセージ。
- **UI表示制御**:
  - **背景色切り替え**: グリーンバック（クロマキー用）と濃いグレーを切り替え可能
  - **タブ式UI**: 背景色変更ボタンとテストモードボタンをタブで表示/非表示を切り替え可能（OBSキャプチャー時に非表示にできる）
- **設定画面のレイアウト**:
  - **タブ**: 「基本（配信者）」「対人（PRO）」「返信（PRO）」「確率（PRO）」「効果音」「課金・解放」。PRO タブは課金タブで Stripe 契約または招待コード入力後に編集可能。自動返信タブ内は配信者側・ユーザー側のサブタブで自動返信のみを編集可能。
  - **設定行**: 1項目の行は1カラムで全幅表示、2項目以上の行は複数カラムで並べて表示（折り返し時も上揃えで整列）。
  - **チェックボックス**: 左にチェックボックス・右にラベルテキストで統一し、文字が折り返しても揃って見えるように配置。

### 技発動帯（合わせ技・追加攻撃の演出プリセット）

HPゲージ上の技名バー（合わせ技成功・ルーレット追加攻撃など）では、技名に応じて **DOM／CSS／Canvas／斬撃 Canvas** が切り替わる演出プリセット（`TechniqueEffectKind`）が使われます。

- **技名プール**: `src/constants/comboTechniqueNames.ts`（斬撃・魔法・射撃で計 1000 件。ビルド時に `TECHNIQUE_EFFECT_KIND_BY_NAME` へマッピングされる）
- **種別の決定**: `src/constants/techniqueEffectKinds.ts` の `getTechniqueEffectKind`（未登録名は `KINDS` とハッシュでフォールバック）。語彙マーカーは `techniqueNameHitsAny` と **`TECHNIQUE_EFFECT_THEME_MARKERS`** / **`TECHNIQUE_EFFECT_SANCTUM_MARKERS`** / **`TECHNIQUE_EFFECT_CYBER_NAME_PARTS`** などの定数に集約（アクセント用マーカーは同ファイルから `techniqueBurstArtDraw.ts` が import）
- **主な実装ファイル**: `src/components/overlay/TechniqueEffectBurst.tsx`、`TechniqueEffectBurst.css` / `TechniqueEffectBurst-kinds*.css` / `TechniqueEffectBurst-finale-kinds.css`、`techniqueBurstArtDraw.ts`、`SlashElementCanvas.tsx`
- **プリセット例**: `inferno` / `meteor` / `void` / `tempest` / `glacier` / `plasma` / `radiance` / `tremor` / `phantom` / `nova` に加え、`aurora` / `blossom` / `circuit` / `mire` / `bloodtide` / `dune` / `sanctum` / `canopy` / `abyssal` / `cogwork` / `constellation` / `rustbound` など。新しい種別を足すときは上記と `KINDS` 配列の整合を取ること。
- **カスタム技名プール（任意）**: `customTechniqueNames.ts` で斬撃・魔法・射撃の配列を上書き可能。exe では `%LOCALAPPDATA%\OBS-Overlay-Kill\data\config\customTechniqueNames.ts`（設定画面にパス表示）。起動時にローカルサーバー API 経由で読み込みます。

### エフェクト動画の設定

HPが0になったときに表示されるエフェクト動画は、**透過WebM動画**形式を使用します。

- **推奨形式**: WebM（VP9コーデック、透過対応）
- **デフォルトパス**: `src/images/bakuhatsu.webm`
- **設定方法**: `http://localhost:5173/overlay` の「動画 URL（透過WebM推奨）」で設定可能

#### 動画ファイルの変換方法

GIFから透過WebM動画に変換する場合、以下の方法があります：

**FFmpegを使用する場合:**
```bash
ffmpeg -i bakuhatsu.gif -c:v libvpx-vp9 -pix_fmt yuva420p bakuhatsu.webm
```

**オンラインツールを使用する場合:**
- [CloudConvert](https://cloudconvert.com/gif-to-webm)
- [EZGIF](https://ezgif.com/gif-to-webm)

> **注意:** 透過WebM動画を使用することで、`video.currentTime = 0`で確実に最初から再生できます。GIFアニメーションでは再生タイミングのズレが発生する可能性があるため、透過WebM動画の使用を推奨します。

### カスタムテキスト機能（App Access Tokenでも使用可能）

OAuth認証（ユーザートークン）がなくても、チャットメッセージで攻撃・回復を実行できる機能です。

- **設定方法**:
  - `http://localhost:5173/overlay` を開く
  - 「攻撃設定」セクションの「カスタムテキスト（App Access Token用）」にテキストを入力（例: `!attack`）
  - 「回復設定」セクションの「カスタムテキスト（App Access Token用）」にテキストを入力（例: `!heal`）
  - 「設定を保存」を押す
- **動作**:
  - チャットメッセージで設定したカスタムテキストが投稿されると、攻撃または回復が実行されます
  - リワードIDとカスタムテキストのどちらかが一致すれば実行されます
  - カスタムテキストは大文字小文字を区別しません
  - 1つのメッセージで1つのコマンドのみが実行されます（攻撃が優先されます）

### テストモード（チャンネルポイント無しで動作確認）

Twitchの仕様上、**アフィリエイト未参加**などでチャンネルポイントが使えない場合があります。
その場合でも動作確認できるように、オーバーレイには**テストモード**があります。

- **有効化手順**:
  - `http://localhost:5173/overlay` を開く
  - 「テストモードを有効にする」にチェック
  - 「設定を保存」を押す（設定は JSON ファイルのみに保存されます。下記「設定の保存・読み込み」を参照）
- **挙動**:
  - テストモード有効時は、チャンネルポイントAPIの監視を行いません
  - `/overlay` 右下の「テスト」パネル（設定・操作ボタン）は、**開発環境・`npm run build` 後の本番表示のどちらでも表示**されます（テストボタンを押してシミュレーションするには、上記のとおり「テストモードを有効にする」が必要です）。
  - テストモードでもカスタムテキスト（チャットコマンド）は動作します
- **操作**:
  - テストボタンは長押しで連打できます（攻撃・回復）
  - 「全員全回復」ボタン（長押しで連打可能）で配信者HP・全視聴者HPを最大値にリセット
  - テストボタンとカスタムテキストは独立して動作します（競合しません）
- **設定**:
  - テストモード中も設定画面と同様のタブ構成（基本・対人 PRO・返信 PRO・確率 PRO・効果音・課金）で編集可能。
  - 基本: HP・攻撃・回復・リトライなど。対人（PRO）: PvPモード、攻撃モード、視聴者コマンドなど。返信（PRO）・確率（PRO）: 各 PRO 機能の詳細設定。
  - **追加テスト項目**: テストモードでは、以下の高度な挙動についてもシミュレーションが可能です：
    *   **オーバーキルモード (Overkill Mode)**：通常の攻撃とは別に、過剰なダメージを与える特殊な処理をシミュレーションできます。ON/OFF切り替えで動作を確認します。
    *   **合わせ技 (Combo Attack)**：複数のエフェクトや効果音のシーケンスを組み合わせて使用する「合わせ技」のタイミングと挙動がテスト可能です。
    *   **追加ルーレット**: 通常攻撃が発動した際に、ランダムな追加エフェクト（ルーレット）が発生するかどうかをシミュレーションできます。
  - PvPの「攻撃モード」で「配信者 vs 視聴者のみ」を選ぶと、視聴者同士の攻撃（`!attack ユーザー名`）は無効になる（テストモード・本番とも同一挙動）。
  - **設定ウィンドウ**: 上下左右の端をドラッグしてリサイズ可能。横にはみ出る内容（自動返信の長文など）は横スクロールで表示。入力欄・セレクトは行幅の1/3で表示される。

### 設定の保存・読み込み

設定は **JSON ファイルのみ**（ローカルストレージは使いません）。保存先は実行形態で異なります。

| 実行形態 | 保存先 | 「設定を保存」の挙動 |
| -------- | ------ | -------------------- |
| `npm run dev` | `public/config/overlay-config.json` | ファイルに上書き |
| `npm run build` + `preview` / 静的ホスト | 同上、または JSON ダウンロード | 環境による |
| 配布 **exe**（`npm run package:release`） | `%LOCALAPPDATA%\OBS-Overlay-Kill\data\config\overlay-config.json` | ローカル API で自動保存（効果音・画像は `data\src\sounds` / `data\src\images`） |

- **読み込み**: exe は **ユーザーデータの JSON → 同梱の初期設定 → デフォルト**。開発は **`public/config/overlay-config.json` → デフォルト**。
- **設定画面のボタン**:
  - **設定を保存**: 上表の保存先へ書き込み（開発で静的配信のみのときは JSON ダウンロードの案内あり）
  - **設定を再読み込み（ファイル選択）**: 手元の JSON をフォームに反映（保存は「設定を保存」）
  - **JSONファイルから読み込み**: ディスク上の `overlay-config.json` を再読み込み（開発: `public/config/`、exe: AppData）
  - **リセット**: デフォルト設定でフォームを上書き

配布 exe の詳細パスは [`docs/README-配布.txt`](docs/README-配布.txt) を参照してください。

> **補足:** チャットへメッセージを送る機能（自動返信）を使う場合は、OAuth トークンに `user:write:chat` スコープが必要です。

## ビルド

本番用にビルドする場合:

### Windows の場合

バッチファイルを使用する場合（推奨）:

```batch
build.bat
```

または、コマンドプロンプトで:

```bash
npm run build
```

### その他のOSの場合

```bash
npm run build
```

ビルドされたファイルは `dist` ディレクトリに出力されます。

### npm スクリプト（開発・CI）

| コマンド | 内容 |
|----------|------|
| `npm run dev` | Vite 開発サーバー（既定 `http://localhost:5173`） |
| `npm run build` | TypeScript チェック（`tsc`）＋本番ビルド → `dist/` |
| `npm run preview` | ビルド済みのプレビュー（既定 `http://localhost:4173`） |
| `npm run lint` | ESLint（`--max-warnings 0`） |
| `npm run package:release` | `release/OBS-Overlay-Kill.exe` のみ生成（中間 `build/pkg-dist` は削除） |
| `npm run package:exe` | exe のみ再生成（要 `build/pkg-dist`、Windows のみ） |
| `npm run build:release` | 配布向けのみ: Vite `--mode release`（難読化・ソースマップなし） |

## プレビュー

ビルドしたアプリケーションをプレビューする場合:

### Windows の場合

バッチファイルを使用する場合（推奨）:

```batch
preview.bat
```

または、コマンドプロンプトで:

```bash
npm run preview
```

### その他のOSの場合

```bash
npm run preview
```

プレビューサーバーが起動したら、ブラウザで `http://localhost:4173` にアクセスしてください。

## 便利なバッチファイル（Windows）

プロジェクトルートには以下のバッチファイルが用意されています：

| バッチ | 説明 | セキュリティ上の注意 |
| ------ | ---- | -------------------- |
| **`install.bat`** | `scripts\npm-ci-deps.bat` 経由で **`npm ci`** + audit。Node 未導入時は winget で LTS | **公式クローンのみ**実行。`package-lock.json` 必須 |
| **`build.bat`** | ビルド（`node_modules` が無いときも `npm-ci-deps.bat`） | `.env` に本物の認証情報が必要 |
| **`dev.bat`** | 開発サーバー起動 | 同上（初回は `npm ci`） |
| **`preview.bat`** | ビルド済みのプレビュー | — |
| **`package-release.bat`** | `npm run package:release`（`dist` + `OBS-Overlay-Kill.exe`） | Windows・依存関係が入っていること |
| **`get-oauth-token.bat`** | `scripts\get_oauth_token.py` で OAuth トークン取得（レガシー） | **Python 3** が PATH に必要。推奨は `/overlay` の課金タブから Twitch 連携 |

課金・招待（開発者向け）: [`docs/BILLING.md`](docs/BILLING.md) の `scripts\create-invites.bat` / `scripts\deploy-billing-functions.bat`

変換用（開発者向け・任意）: `convert-gif-to-webm.bat` / `convert-png-sequence.bat`（内部で `scripts\` 配下の PowerShell を `-File` 指定で実行）。

これらのバッチファイルをダブルクリックするだけで、対応する操作を実行できます。サプライチェーン対策の全体像は [セキュリティと認証情報の管理](#セキュリティと認証情報の管理) を参照してください。

## バージョン情報

- バージョン番号は **`package.json` の `version` フィールド** のみで管理しています（単一の情報源）。
- **現在のバージョンを確認するには:**
  - ターミナルで `npm pkg get version` を実行する
  - または `package.json` を開いて `"version"` の値を確認する
- リリース時は `package.json` の `version` を更新すれば、プロジェクト全体で「いまのバージョン」を追えます。

## Twitch API の使い方

このプロジェクトには以下の Twitch API 機能が実装されています:

> **注意:**
> - チャンネルポイント関連の機能（リワード取得、引き換え履歴）は、OAuth認証（ユーザートークン）が必要です。App Access Tokenでは使用できません。
> - **カスタムテキスト機能**を使用すれば、App Access Tokenでもチャットメッセージで攻撃・回復を実行できます。
> - チャットメッセージはWebSocketを使用してリアルタイムで取得できます。
> - チャンネルポイント引き換えイベントは、**EventSub WebSocket**を使用してリアルタイムで監視します（推奨）。EventSubが使用できない場合は、ポーリング方式（5秒間隔）にフォールバックします。

### カスタムフック

- **`useTwitchUser(login: string)`** - ユーザー情報を取得
- **`useTwitchStream(userLogin: string)`** - ストリーム情報を取得（30秒ごとに自動更新）
- **`useTwitchChannel(userId: string)`** - チャンネル情報を取得
- **`useTwitchVideos(userId: string, limit?: number)`** - ビデオ情報を取得（ページネーション対応）
- **`useTwitchClips(broadcasterId: string, limit?: number)`** - クリップ情報を取得（ページネーション対応）
- **`useTwitchEmotes(broadcasterId: string)`** - チャンネルエモート情報を取得
- **`useTwitchFollowers(broadcasterId: string, limit?: number)`** - フォロワー情報を取得（ページネーション対応）
- **`useTwitchChatBadges(broadcasterId: string)`** - チャットバッジ情報を取得
- **`useTwitchChat(channel: string, maxMessages?: number)`** - チャットメッセージをリアルタイムで取得（WebSocket使用）
- **`useHPGauge(options)`** - HP オーバーレイ用の設定読み込み・HP 増減・`OverlayConfig` 同期（`src/hooks/useHPGauge.ts`）

チャンネルポイントの **REST（Helix）** は `twitchApi.getChannelPointRewards` / `getChannelPointRedemptions`（下記「API クライアント」）を利用します。オーバーレイの引き換え検知は **EventSub WebSocket**（またはポーリング）で行い、`useTwitchChannelPoints` のような単体フックは現状ありません。

### コンポーネント

Twitch 向けの一部機能がコンポーネント化されています（オーバーレイ専用 UI は `components/overlay/` を参照）:

- **`<TwitchUserInfo login={string} />`** - ユーザー情報を表示
- **`<TwitchStreamStatus userLogin={string} />`** - ストリーム状態を表示
- **`<TwitchChannelInfo userId={string} />`** - チャンネル情報を表示
- **`<TwitchChat channel={string} maxMessages={number} />`** - チャットメッセージをリアルタイム表示
- **`<TwitchVideos userId={string} limit={number} />`** - ビデオ一覧を表示
- **`<TwitchClips broadcasterId={string} limit={number} />`** - クリップ一覧を表示
- **`<TwitchEmotes broadcasterId={string} />`** - エモート一覧を表示
- **`<TwitchFollowers broadcasterId={string} limit={number} />`** - フォロワー一覧を表示
- **`<TwitchChatBadges broadcasterId={string} />`** - チャットバッジ一覧を表示
- **`<UserDetails login={string} />`** - すべての情報を統合表示

### API クライアント

`src/utils/twitchApi.ts` に実装されている `twitchApi` オブジェクトを使用して、以下のメソッドが利用できます:

**基本情報:**
- `getUser(login: string)` - ユーザー情報を取得
- `getUsers(logins: string[])` - 複数のユーザー情報を取得
- `getStream(userLogin: string)` - ストリーム情報を取得
- `getStreams(userLogins: string[])` - 複数のストリーム情報を取得
- `getGame(gameId: string)` - ゲーム情報を取得

**詳細情報:**
- `getChannel(broadcasterId: string)` - チャンネル情報を取得
- `getChannelByUserId(userId: string)` - ユーザーIDからチャンネル情報を取得
- `getVideos(userId: string, limit?: number, cursor?: string)` - ビデオ情報を取得
- `getClips(broadcasterId: string, limit?: number, cursor?: string)` - クリップ情報を取得
- `getEmotes(broadcasterId: string)` - チャンネルエモート情報を取得
- `getGlobalEmotes()` - グローバルエモート情報を取得
- `getFollowers(broadcasterId: string, limit?: number, cursor?: string)` - フォロワー情報を取得
- `getChatBadges(broadcasterId: string)` - チャットバッジ情報を取得
- `getGlobalChatBadges()` - グローバルチャットバッジ情報を取得
- `getChannelPointRewards(broadcasterId: string, onlyManageableRewards?: boolean)` - チャンネルポイントリワード一覧を取得（OAuth認証が必要）
- `getChannelPointRedemptions(broadcasterId: string, rewardId: string, status?: string, limit?: number, cursor?: string)` - チャンネルポイント引き換え履歴を取得（OAuth認証が必要）

**チャット（WebSocket）** — `src/utils/twitchChat.ts`（`twitchChat`）:

- `twitchChat.connect(channel: string)` - チャンネルに接続
- `twitchChat.onMessage(callback: (message: TwitchChatMessage) => void)` - メッセージコールバックを登録
- `twitchChat.disconnect()` - 切断
- `twitchChat.isConnected()` - 接続状態を確認

### 使用例

**API クライアントの使用例:**

```typescript
import { twitchApi } from './utils/twitchApi'

// ユーザー情報を取得
const user = await twitchApi.getUser('ninja')

// ストリーム情報を取得
const stream = await twitchApi.getStream('ninja')

// ビデオ情報を取得
const videos = await twitchApi.getVideos(user.id, 20)
```

**コンポーネントの使用例:**

```typescript
import { TwitchUserInfo } from './components/TwitchUserInfo'
import { TwitchVideos } from './components/TwitchVideos'
import { TwitchChat } from './components/TwitchChat'
import { UserDetails } from './components/UserDetails'

// 個別のコンポーネントを使用
<TwitchUserInfo login="ninja" />
<TwitchVideos userId="123456789" limit={20} />

// チャットメッセージを表示
<TwitchChat channel="ninja" maxMessages={100} />

// すべての情報を一括表示
<UserDetails login="ninja" />
```

## OBS WebSocket 連携（ソースレイヤー操作）

OBS WebSocket 5.x と連携して、**特定ソース（シーン内レイヤー）を揺らす／拡大縮小する／左右に動かす**といったエフェクトをかけられます。

- **前提**
  - OBS 側で WebSocket サーバーを有効化しておく（OBS 28+ は標準搭載）
  - ポート・パスワードを確認（デフォルト: ポート `4455`）
- **設定場所**
  - `/overlay` の「設定」→ **「OBS WebSocket API（ソースレイヤー操作）」**
- **主な設定項目**
  - `有効化` チェックボックス
  - `ホスト`（例: `127.0.0.1`）
  - `ポート`（例: `4455`）
  - `パスワード`（OBSのWebSocket設定で指定したもの）
  - `シーン名`（未指定時は現在のプログラムシーン）
  - `ソース名`（揺らしたり拡大縮小したいソースレイヤー名）
  - ダメージ・回復・必殺技・回避ごとのエフェクトON/OFF・強さ・時間
- **挙動の概要**
  - **ダメージ時**: `shakeSource` によりソースを一定時間ランダムに揺らす（戻りも含めて WebSocket API で制御）
  - **回復時**: `glowSource` によりソースを一時的に拡大＋明るくし、その後元に戻す
  - **必殺技時**: 強めのシェイク＋スケールアップ（設定に応じて両方）
  - **回避（ミス）時**: `moveSource` により左右へ一時的にずらし、一定時間後に元位置へ戻す

> **補足:**
> - OBS WebSocket への接続／認証エラーやタイムアウトが発生しても、ページが真っ黒にならないように UI はそのまま描画されます（ログに警告が出ます）。
> - OBS のブラウザソース「対話」では OS 標準のプルダウン UI が操作できないことがあります。その場合は、設定画面の「候補から選ぶ（OBS対話向け）」ボタンを使って選択してください（手入力も可能）。

## 必殺技エフェクト & 効果音

PvP設定には「視聴者必殺技」機能があり、攻撃時に低確率で派手な演出と大ダメージが発生します。

- **場所**
  - `/overlay` の設定 → 「PvP設定」内の「必殺技設定」
  - `/overlay` テストモード → 「コマンド」タブ内の「必殺技設定」
- **設定できる内容**
  - `必殺技を有効にする`
  - `必殺技発動確率 (%)`（0〜100、小数第2位まで）
  - `必殺技ダメージ倍率`（HPの何倍ダメージか／現在は内部的に1/2HPダメージなどに使用）
  - `必殺技表示テキスト`（画面中央に表示される文字列）
  - `必殺技効果音` ON/OFF・URL・音量
- **演出**
  - 画面フラッシュ
  - 強い画面シェイク
  - 画面全体の色変化フィルター
  - 爆発的なパーティクル（火花・破片・衝撃波）
  - 画面中央にカスタムテキスト（例: 「必殺技！」）を表示

テストモードでは「必殺技テスト」ボタンから、チャンネルポイントなしで必殺技演出だけを確認できます。

## 回復表示と反転回復（見た目の数値）

攻撃・回復・反転回復時には、画面中央に**ダメージ数値**や**回復数値**がフロート表示されます。

- **ダメージ数値**
  - 通常ダメージ／クリティカル／出血ダメージで色とアニメーションが異なる
  - 色は `/overlay` の設定 → 「表示・エフェクト」内の「ダメージ値の色設定」で変更可能
- **回復数値**
  - `+◯◯` の形式で中央付近に表示
  - 色は「回復数値」のカラーとして `healColors.normal` で管理（設定画面から変更可能）
- **反転回復（配信者側）**
  - PvPの「視聴者攻撃時の反転回復」が発動したときも、
    - ダメージ→攻撃モーション終了後に**回復数値**が表示される
    - 回復エフェクト・回復効果音も同じタイミングで発生

## 背景色（クロマキー）のカスタム

ブラウザソース／ウィンドウキャプチャでクロマキーを抜きやすくするために、背景色を切り替え／カスタムできます。

- `/overlay` テストモード → 「基本」タブ → 「背景色」
  - `グリーン（クロマキー用）` … デフォルトの #00ff00
  - `濃いグレー` … プレビュー用のダーク背景
  - `カスタム（任意の色）` … 任意の #RRGGBB を指定可能（カラーピッカー＋テキスト入力）
- 選択した色は `background` / `backgroundColor` に同じ値で適用されるため、OBS側でその色をクロマキーとして設定すれば綺麗に抜けます。

> **注意:** 現時点では背景色のカスタム値は設定ファイルには保存されず、ページをリロードするとリセットされます。
> 恒久的に固定したい場合は、今後 `overlay-config.json` 側に項目を追加することで対応可能です。

## 技術スタック

実際のバージョンは `package.json` / `npm ls` を参照。主要パッケージの目安は次のとおりです。

- **React** 19.x（`react` / `react-dom`）
- **TypeScript** 5.9.x
- **Vite** 8.x
- **TanStack Query** 5.x（データフェッチ）
- **react-router-dom** 7.x
- **Axios** 1.14.x — HTTP クライアント
- **@supabase/supabase-js** — 認証・課金 API（Edge Functions 連携）
- **howler** — 効果音再生
- **obs-websocket-js** 5.x — OBS WebSocket 5.x 連携（ソースレイヤー演出）
- **tmi.js** 1.8.x — Twitch Chat クライアント
- **ESLint** 8.x + **typescript-eslint** 8.x
- **Twitch API**（Helix）— ユーザー・ストリーム等

## プロジェクト構造（主要）

```
src/
├── api/                 # 外部 API のエントリ（re-export。実装は utils）
├── components/          # UI（Twitch 系・overlay/・settings/・DebugLog など）
├── constants/           # オーバーレイ用定数（premiumFeatures, techniqueEffectKinds 等）
├── context/             # AuthContext, FeatureUnlockContext
├── hooks/               # カスタムフック（Twitch / オーバーレイ / チャット等）
├── lib/                 # logger, billingApi, entitlementsClient, supabaseClient, queryKeys
├── pages/               # OverlayPage, OAuthCallbackPage 等
├── types/               # overlay.ts / twitch.ts
├── config/              # auth, admin
├── utils/               # twitchApi, overlayConfig, overlayLocalAssets 等
├── App.tsx
└── main.tsx             # QueryClientProvider + カスタム技名の読み込み

scripts/                 # package-release, overlay-local-server, create-invites 等
supabase/                # migrations, Edge Functions（課金・Twitch OAuth）
docs/                    # BILLING.md, SECURITY.md, README-配布.txt
```

## このリポジトリで反映している React / データ取得まわり

- **コンポーネント分割**: 表示単位を `src/components` に配置（`overlay/`・`settings/` でオーバーレイ専用を分離）。
- **浅い共通層**: `src/{api,components,constants,hooks,lib}`。API クライアントの実体は `utils/twitchApi.ts`、`api/index.ts` から再エクスポート。
- **React 19 の `use`**: ランタイムは **React 19**。フェッチは TanStack Query 中心のため、現時点では `use(promise)` は未使用。必要になったら公式仕様に沿って導入する。
- **fetch 管理**: **TanStack Query v5**（`useQuery` / `useInfiniteQuery`）。Twitch 系フックとオーバーレイ設定の初回読み込み（`useHPGauge`）で利用。キーは `lib/queryKeys.ts` に集約。
- **ログ**: 直接の `console.*` 乱用を避け、アプリコードは `lib/logger.ts` 経由。開発時および `localStorage.setItem('obs-overlay-debug','1')` 時は `DebugLog` コンポーネントでリングバッファを表示可能。

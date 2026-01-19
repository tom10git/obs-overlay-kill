# OBS Overlay Kill

React + TypeScript + Vite で構築されたプロジェクトです。Twitch APIを使用してユーザー情報やストリーム情報を取得できます。

## セットアップ

### 1. 依存関係をインストール

```bash
npm install
```

### 2. Twitch API の認証情報を設定

1. [Twitch Developer Console](https://dev.twitch.tv/console/apps) にアクセス
2. 「Register Your Application」をクリックしてアプリケーションを作成
3. アプリケーション名を入力（例: "OBS Overlay Kill"）
4. OAuth Redirect URLs は `http://localhost:5173` を設定（開発環境の場合）
5. Category を選択（例: "Website Integration"）
6. 作成後、**Client ID** と **Client Secret** をコピー

### 3. 環境変数を設定

プロジェクトルートに `.env` ファイルを作成し、以下の内容を記入:

```env
# Twitch API認証情報（必須）
VITE_TWITCH_CLIENT_ID=your_client_id_here
VITE_TWITCH_CLIENT_SECRET=your_client_secret_here

# Twitch API認証情報（オプション）
VITE_TWITCH_ACCESS_TOKEN=your_access_token_here
VITE_TWITCH_USERNAME=your_username_here  # デフォルトユーザー名

# アプリケーション設定（オプション）
VITE_DEFAULT_CHANNEL=your_channel_name
VITE_AUTO_REFRESH_INTERVAL=30  # 自動更新間隔（秒）
VITE_MAX_CHAT_MESSAGES=100  # チャットメッセージの最大表示数
```

> **注意:**
> - `.env` ファイルは `.gitignore` に含まれているため、Git にコミットされません
> - `.env.example` ファイルを参考にしてください
> - **管理者側の設定情報は `src/config/admin.ts` で一元管理されています**
> - `VITE_TWITCH_USERNAME` を設定すると、アプリ起動時に自動的にそのユーザーの情報を表示します
> - セキュリティに関する詳細は `src/config/README.md` を参照してください

## セキュリティと認証情報の管理

認証情報は `src/config/auth.ts` で一元管理されています。このモジュールは以下の機能を提供します：

- 環境変数からの認証情報の読み取り
- 認証情報の検証
- エラーハンドリング

詳細については、`src/config/README.md` を参照してください。

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

- オーバーレイ表示: `http://localhost:5173/overlay`
- 設定画面: `http://localhost:5173/settings`

### OBS（ブラウザソース）設定の例

- **URL**: `http://localhost:5173/overlay`
- **幅/高さ**: 1920 x 1080（任意）

### テストモード（チャンネルポイント無しで動作確認）

Twitchの仕様上、**アフィリエイト未参加**などでチャンネルポイントが使えない場合があります。
その場合でも動作確認できるように、オーバーレイには**テストモード**があります。

- **有効化手順**:
  - `http://localhost:5173/settings` を開く
  - 「テストモードを有効にする」にチェック
  - 「設定を保存」を押す（開発環境ではローカルストレージに保存されます）
- **挙動**:
  - テストモード有効時は、チャンネルポイントAPIの監視を行いません
  - 開発環境（`npm run dev`）では、`/overlay` 右下にテスト操作ボタンが表示されます
- **操作**:
  - テストボタンは長押しで連打できます（攻撃・回復）

> **補足:** 設定は開発環境ではローカルストレージに保存されます。初期値は `public/config/overlay-config.json` です。

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

- **`dev.bat`** - 開発サーバーを起動
- **`build.bat`** - アプリケーションをビルド
- **`preview.bat`** - ビルド済みアプリケーションをプレビュー
- **`install.bat`** - 依存関係をインストール

これらのバッチファイルをダブルクリックするだけで、対応する操作を実行できます。

## Twitch API の使い方

このプロジェクトには以下の Twitch API 機能が実装されています:

> **注意:** チャンネルポイント関連の機能（リワード取得、引き換え履歴）は、OAuth認証（ユーザートークン）が必要です。App Access Tokenでは使用できません。チャットメッセージはWebSocketを使用してリアルタイムで取得できます。

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
- **`useTwitchChannelPoints(broadcasterId: string, onlyManageableRewards?: boolean)`** - チャンネルポイントリワードを取得（OAuth認証が必要）
- **`useTwitchChannelPointRedemptions(broadcasterId: string, rewardId: string, status?: string, limit?: number)`** - チャンネルポイント引き換え履歴を取得（OAuth認証が必要）

### コンポーネント

すべての情報取得機能がコンポーネント化されており、簡単に使用できます:

- **`<TwitchUserInfo login={string} />`** - ユーザー情報を表示
- **`<TwitchStreamStatus userLogin={string} />`** - ストリーム状態を表示
- **`<TwitchChannelInfo userId={string} />`** - チャンネル情報を表示
- **`<TwitchChat channel={string} maxMessages={number} />`** - チャットメッセージをリアルタイム表示
- **`<TwitchChannelPoints broadcasterId={string} />`** - チャンネルポイントリワードと引き換え履歴を表示（OAuth認証が必要）
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

**チャット（WebSocket）:**
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
import { UserDetails } from './components/UserDetails'

// 個別のコンポーネントを使用
<TwitchUserInfo login="ninja" />
<TwitchVideos userId="123456789" limit={20} />

// チャットメッセージを表示
<TwitchChat channel="ninja" maxMessages={100} />

// チャンネルポイント情報を表示（OAuth認証が必要）
<TwitchChannelPoints broadcasterId="123456789" />

// すべての情報を一括表示
<UserDetails login="ninja" />
```

## 技術スタック

- **React** 18.2.0
- **TypeScript** 5.2.2
- **Vite** 5.0.8
- **Axios** 1.6.2 - HTTP クライアント
- **tmi.js** 1.8.5 - Twitch Chat WebSocket クライアント
- **Twitch API** - ユーザー情報・ストリーム情報の取得

## プロジェクト構造

```
src/
├── components/          # React コンポーネント
│   ├── TwitchUserInfo.tsx      # ユーザー情報表示コンポーネント
│   ├── TwitchStreamStatus.tsx   # ストリーム状態表示コンポーネント
│   ├── TwitchChannelInfo.tsx  # チャンネル情報表示コンポーネント
│   ├── TwitchChat.tsx          # チャットメッセージ表示コンポーネント
│   ├── TwitchChannelPoints.tsx # チャンネルポイント表示コンポーネント
│   ├── TwitchVideos.tsx         # ビデオ一覧表示コンポーネント
│   ├── TwitchClips.tsx          # クリップ一覧表示コンポーネント
│   ├── TwitchEmotes.tsx         # エモート一覧表示コンポーネント
│   ├── TwitchFollowers.tsx      # フォロワー一覧表示コンポーネント
│   ├── TwitchChatBadges.tsx     # チャットバッジ一覧表示コンポーネント
│   └── UserDetails.tsx           # ユーザー詳細情報統合コンポーネント
├── hooks/               # カスタムフック
│   ├── useTwitchUser.ts        # ユーザー情報取得フック
│   ├── useTwitchStream.ts      # ストリーム情報取得フック
│   ├── useTwitchChannel.ts     # チャンネル情報取得フック
│   ├── useTwitchVideos.ts      # ビデオ情報取得フック
│   ├── useTwitchClips.ts       # クリップ情報取得フック
│   ├── useTwitchEmotes.ts      # エモート情報取得フック
│   ├── useTwitchFollowers.ts   # フォロワー情報取得フック
│   ├── useTwitchChatBadges.ts  # チャットバッジ情報取得フック
│   ├── useTwitchChat.ts        # チャットメッセージ取得フック
│   └── useTwitchChannelPoints.ts # チャンネルポイント取得フック
├── types/               # TypeScript 型定義
│   └── twitch.ts               # Twitch API 型定義
├── config/              # 設定ファイル
│   ├── auth.ts                 # 認証情報管理（内部使用）
│   ├── admin.ts                # 管理者設定情報の一元管理（推奨）
│   └── README.md               # 設定に関するドキュメント
├── utils/               # ユーティリティ
│   ├── twitchApi.ts            # Twitch API クライアント
│   └── twitchChat.ts           # Twitch Chat WebSocket クライアント
├── App.tsx              # メインアプリケーション
└── main.tsx             # エントリーポイント
```

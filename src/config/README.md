# 設定管理

このディレクトリには、アプリケーションの設定を管理するファイルが含まれています。

## ファイル構成

- `auth.ts` - Twitch API認証情報の管理（内部使用）
- `admin.ts` - **管理者側の設定情報を一元管理**（推奨）

## 推奨: admin.ts を使用

管理者が設定する情報は、`admin.ts` から取得することを推奨します。このファイルには、管理者が設定するすべての情報が集約されています。

### 管理者設定情報の取得

```typescript
import {
  getAdminClientId,
  getAdminClientSecret,
  getAdminAccessToken,
  getAdminUsername,
  getDefaultChannel,
  getAutoRefreshInterval,
  getMaxChatMessages,
  getAllAdminConfig
} from '../config/admin'

// 個別の設定を取得
const clientId = getAdminClientId()
const username = getAdminUsername()
const refreshInterval = getAutoRefreshInterval() // 秒単位

// すべての設定を一度に取得
const allConfig = getAllAdminConfig()
```

## 設定項目

### Twitch認証情報

- **Client ID** - Twitch API の Client ID（必須）
- **Client Secret** - Twitch API の Client Secret（必須）
- **Access Token** - 事前に取得した Access Token（オプション）
- **Username** - デフォルトで表示する Twitch ユーザー名（オプション）

### アプリケーション設定

- **Default Channel** - デフォルトチャンネル名（オプション）
- **Auto Refresh Interval** - 自動更新間隔（秒単位、デフォルト: 30秒）
- **Max Chat Messages** - チャットメッセージの最大表示数（デフォルト: 100件）

## 環境変数の設定

`.env` ファイルに以下の環境変数を設定してください：

```env
# Twitch API認証情報（必須）
VITE_TWITCH_CLIENT_ID=your_client_id_here
VITE_TWITCH_CLIENT_SECRET=your_client_secret_here

# Twitch API認証情報（オプション）
VITE_TWITCH_ACCESS_TOKEN=your_access_token_here
VITE_TWITCH_USERNAME=your_username_here

# アプリケーション設定（オプション）
VITE_DEFAULT_CHANNEL=your_channel_name
VITE_AUTO_REFRESH_INTERVAL=30
VITE_MAX_CHAT_MESSAGES=100
```

## セキュリティに関する注意事項

1. **環境変数の管理**
   - `.env` ファイルは `.gitignore` に含まれているため、Gitにコミットされません
   - 本番環境では、環境変数を適切に設定してください

2. **認証情報の保護**
   - Client Secret や Access Token は機密情報です
   - これらの情報をコードに直接記述しないでください
   - 環境変数から読み取るようにしてください

3. **OAuth認証**
   - チャンネルポイントなどの一部の機能には、OAuth認証（ユーザートークン）が必要です
   - ユーザートークンは、ユーザーが明示的に認証を行う必要があります

## 使用方法の例

### 基本的な使用

```typescript
import { getAdminUsername, getMaxChatMessages } from './config/admin'

// デフォルトユーザー名を取得
const username = getAdminUsername() || 'default_user'

// チャットメッセージの最大数を取得
const maxMessages = getMaxChatMessages()
```

### すべての設定を取得

```typescript
import { getAllAdminConfig } from './config/admin'

const config = getAllAdminConfig()
console.log(config.twitch.clientId)
console.log(config.app.autoRefreshInterval)
```

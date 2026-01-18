# 認証設定

このディレクトリには、認証情報やセキュリティに関わる設定を管理するファイルが含まれています。

## ファイル構成

- `auth.ts` - Twitch API認証情報の管理

## 使用方法

### 認証情報とユーザー名の取得

```typescript
import {
  getTwitchClientId,
  getTwitchClientSecret,
  getTwitchAccessToken,
  getTwitchUsername
} from '../config/auth'

const clientId = getTwitchClientId()
const clientSecret = getTwitchClientSecret()
const accessToken = getTwitchAccessToken() // オプション
const username = getTwitchUsername() // オプション: デフォルトユーザー名
```

### 認証情報の検証

```typescript
import { isAuthConfigured } from '../config/auth'

if (isAuthConfigured()) {
  // 認証情報が設定されている
} else {
  // 認証情報が設定されていない
}
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

## 環境変数の設定

`.env` ファイルに以下の環境変数を設定してください：

```env
VITE_TWITCH_CLIENT_ID=your_client_id_here
VITE_TWITCH_CLIENT_SECRET=your_client_secret_here
VITE_TWITCH_ACCESS_TOKEN=your_access_token_here  # オプション
VITE_TWITCH_USERNAME=your_username_here  # オプション: デフォルトユーザー名
```

## 設定項目の説明

- **VITE_TWITCH_CLIENT_ID** (必須): Twitch API の Client ID
- **VITE_TWITCH_CLIENT_SECRET** (必須): Twitch API の Client Secret
- **VITE_TWITCH_ACCESS_TOKEN** (オプション): 事前に取得した Access Token
- **VITE_TWITCH_USERNAME** (オプション): デフォルトで表示する Twitch ユーザー名。設定すると、アプリ起動時に自動的にそのユーザーの情報を表示します

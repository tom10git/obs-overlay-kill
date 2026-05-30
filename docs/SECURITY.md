# セキュリティと設定の置き場所

## 原則

| 種類 | 置き場所 | ブラウザから見える？ |
|------|----------|----------------------|
| Twitch Client **Secret** | **Supabase Secrets**（Edge Function のみ）またはローカル `.env`（開発専用） | `.env` の `VITE_` は見える |
| Twitch リフレッシュトークン | `.env` の `VITE_TWITCH_REFRESH_TOKEN` または OAuth 後の localStorage | ビルドに含まれる／localStorage |
| Twitch Client ID | `.env` 可（公開に近い） | ビルドに含まれる |

**配布用 `dist` / exe には Client Secret や Refresh Token を入れないでください。**

## 推奨（配信者）

1. ルート `.env` に `VITE_TWITCH_TOKEN_APP_CLIENT_ID` と `VITE_TWITCH_USERNAME` を設定  
2. `scripts/get-oauth-token.bat`（または Twitch 公式手順）で **Access / Refresh Token** を取得し `.env` に保存  
3. テストパネルの **「Twitch 認証 (.env)」** で設定済みか確認  

## Supabase（任意・上級者）

`VITE_SUPABASE_*` を設定している場合、ログイン済みセッションがあれば `twitch-oauth` Edge Function でトークン更新できます。アプリ内にログイン UI はありません。未使用なら Supabase 関連の `.env` は省略できます。

## レガシー

`.env` の `VITE_TWITCH_*_SECRET` は **ローカル開発専用**・Git 管理外に限り利用できます。

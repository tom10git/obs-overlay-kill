/**
 * ユーザー向けメッセージ用。auth.ts の解決順と一致させる。
 * OAuth / トークンリフレッシュ / Helix（チャット等）に使う「トークン発行アプリ」の認証情報。
 */
export const TWITCH_TOKEN_APP_CLIENT_ID_ENV_HINT =
  'VITE_TWITCH_TOKEN_APP_CLIENT_ID（未設定時は VITE_TWITCH_CLIENT_ID）'

export const TWITCH_TOKEN_APP_CLIENT_SECRET_ENV_HINT =
  'VITE_TWITCH_TOKEN_APP_CLIENT_SECRET（未設定時は VITE_TWITCH_CLIENT_SECRET）'

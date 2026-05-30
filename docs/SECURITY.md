# セキュリティと設定の置き場所

## 原則

| 種類 | 置き場所 | ブラウザから見える？ |
|------|----------|----------------------|
| Stripe 秘密鍵・Webhook | **Supabase Secrets** | 見えない |
| 課金・招待・解放状態 | **Supabase DB**（RLS） | 自分の分だけ（設計どおり） |
| Twitch Client **Secret** | **Supabase Secrets**（Edge Function のみ） | 見えない |
| Twitch リフレッシュトークン | **`user_twitch_credentials` 表**（Edge のみ読取） | 見えない |
| Supabase Anon Key | `.env` の `VITE_SUPABASE_ANON_KEY` | 見える（公開鍵・RLS で保護） |
| Twitch Client ID | `.env` 可（公開に近い） | ビルドに含まれる |

**`.env` を Supabase のテーブルにそのままコピーして、フロントから `select` するだけでは安全になりません。**  
クライアントが読める列に秘密を置くと、`VITE_` と同じく漏洩します。

## 複数配信者への提供

- 各配信者は **別の Supabase アカウント**（メール）でログインする
- 課金・PRO 解放・Stripe 契約はすべて `user_id` 単位で DB に保存（RLS で他人のデータは読めない）
- 無期限の招待コードは **1 人 1 コード** を `invite_tokens` に登録（`allowedEmail` 必須推奨）
- **メールの本人確認**は Supabase Auth のマジックリンクのみ（メール所有の証明）。第三者は `invite_tokens` を RLS で読めず、平文メールも DB に保存しない（`allowed_email_hash` のみ）
- 招待コード適用時のメール照合は **`invite-redeem` Edge Function** が JWT の `email` とハッシュを比較（クライアントや anon キーから DB を読んで認証することはできない）

## いまの推奨構成

1. ルート `.env` … `VITE_SUPABASE_*` と公開設定のみ  
2. `supabase secrets set` … Stripe・Twitch Client Secret・管理者用キー  
3. 課金タブで **Supabase にログイン** → Twitch OAuth → トークンは DB に保存（Edge Function 経由）  
4. リフレッシュは **`twitch-oauth` Edge Function** のみ（Secret をブラウザに載せない）

## レガシー（非推奨）

`.env` の `VITE_TWITCH_*_SECRET` や `VITE_TWITCH_REFRESH_TOKEN` は、**配布用 `dist` ビルドには入れない**でください。ローカル専用・Git 管理外の `.env` に限り利用できます。

詳細手順: [BILLING.md](./BILLING.md)

# 課金の設定ガイド（むずかしい用語なし版）

配信ソフト（obs-overlay-kill）の **有料機能** を、  
「月額契約（Stripe）」または「あなたが配る専用コード」で使えるようにする手順です。

---

## この仕組みを一言で

| 役割 | たとえ |
|------|--------|
| **Supabase** | 会員名簿＋誰が何を使えるかの台帳（クラウド） |
| **Stripe** | クレジットカードの月額引き落とし |
| **招待コード** | あなたが配る「この人だけ使える鍵」 |

配信者は **自分のメールでログイン** → **契約するかコードを入れる** → PRO が使える。  
**A さんと B さんのデータは混ざりません。**

---

## あなたがやること・やらなくていいこと

### やること（ざっくり 4 つ）

1. **Supabase** で「台帳用の表」を最初に 1 回だけ作る  
2. **Stripe** で「月額プラン」を 5 個作る  
3. **Supabase** に Stripe の設定値を貼り付ける（秘密の番号）  
4. **配信者ごと**に招待コードを発行して渡す（無料で使わせたい人向け）

### やらなくていいこと

- 表の中身を Excel のように 1 行ずつ手入力する → **ほぼ不要**（配信者の操作で自動で入る）
- `.env` に Stripe の秘密の番号を書く → **ダメ（漏れる）**
- 全員共通の 1 個のコードを SNS で配る → **非推奨**（メール指定の専用コードを使う）

---

## 準備するアカウント

- [Supabase](https://supabase.com/) … 無料枠で可  
- [Stripe](https://stripe.com/) … テストモードで試せる  

---

## 手順 1：Supabase で「台帳の表」を作る（最初の 1 回）

1. Supabase にログイン → **New project** でプロジェクト作成  
2. 左メニュー **SQL** → **New query**  
3. パソコン上の次のファイルを **上から順に** 開き、中身をすべてコピーして SQL 画面に貼り付け → **Run**  
   - `supabase/migrations/20260321000000_billing.sql`  
   - `supabase/migrations/20260321000001_twitch_credentials.sql`  
   - `supabase/migrations/20260321000002_invites_perpetual_multi.sql`  
4. エラーが出なければ OK（表ができた状態）

### 配信ソフト用の 2 つの番号をメモ

左メニュー **Project Settings** → **API** からコピー:

| メモする名前 | 画面の名前 | 貼る場所 |
|--------------|------------|----------|
| プロジェクト URL | Project URL | あとで `.env` |
| 公開キー | anon public | あとで `.env` |

プロジェクトフォルダの `.env` に次の 2 行を書く（例）:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...（長い文字列）
```

### ログイン用メールの設定

左メニュー **Authentication** → **Providers** → **Email** を ON  

**Authentication** → **URL Configuration** の **Redirect URLs** に、配信者が使う画面の URL を追加（例）:

```text
http://localhost:4173/overlay
http://localhost:5173/overlay
```

（exe 配布は **4173**、`npm run dev` は **5173**。本番 URL が決まったらそれも追加）

---

## 手順 2：Stripe で月額プランを作る

Stripe ダッシュボード → **商品**（Products）で、次の **5 個**の「継続課金」を作ります。  
金額の例：単品は 1 機能 100 円/月、全機能は 400 円/月 など、あなたの料金に合わせて OK。

| 作るプランの意味 | Supabase に後で登録する名前 |
|------------------|----------------------------|
| 確率・抽選 | `STRIPE_PRICE_PROBABILITIES` |
| 自動返信 | `STRIPE_PRICE_AUTO_REPLY` |
| 対人・PvP | `STRIPE_PRICE_VIEWER_SETTINGS` |
| 表示位置 | `STRIPE_PRICE_LAYOUT_FINE` |
| 全機能まとめ | `STRIPE_PRICE_ALL_FEATURES` |

各プランの **Price ID**（`price_` で始まる文字列）をメモ帳に控えておきます。

Stripe の **開発者** → **API キー** から:

- **シークレットキー**（`sk_test_...` など）→ メモ

---

## 手順 3：秘密の設定を Supabase に入れる

ターミナル（黒い画面）で、プロジェクトフォルダに移動してから。

**Supabase CLI** を入れていない場合は、Dashboard の **Edge Functions** → **Secrets** から、下の名前と値を 1 つずつ手で追加しても同じです。

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_あなたのキー
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_あとでWebhook作成後に入れる
supabase secrets set STRIPE_PRICE_PROBABILITIES=price_xxx
supabase secrets set STRIPE_PRICE_AUTO_REPLY=price_xxx
supabase secrets set STRIPE_PRICE_VIEWER_SETTINGS=price_xxx
supabase secrets set STRIPE_PRICE_LAYOUT_FINE=price_xxx
supabase secrets set STRIPE_PRICE_ALL_FEATURES=price_xxx
supabase secrets set BILLING_ADMIN_SECRET=自分で決めた長いパスワード
# exe は 4173、npm run dev は 5173（どちらも Edge Function が自動許可。主 URL は exe 向けに 4173 推奨）
supabase secrets set OVERLAY_ORIGIN=http://localhost:4173
# 例: supabase secrets set OVERLAY_ORIGIN=https://your-app.example.com,http://localhost:4173
```

`BILLING_ADMIN_SECRET` … 招待コードを作るときだけ使う「管理者用パスワード」。推測されない長い文字列にしてください。

### Stripe から「入金通知」を Supabase に送る設定

1. Stripe **開発者** → **Webhook** → エンドポイントを追加  
2. URL（`xxxxx` は Supabase のプロジェクト ID）:

```text
https://xxxxx.supabase.co/functions/v1/stripe-webhook
```

3. イベントで **顧客のサブスクリプション** まわりを選ぶ（作成・更新・削除）  
4. 表示された **署名シークレット**（`whsec_...`）を、上の `STRIPE_WEBHOOK_SECRET` に設定

### クラウド側のプログラムを公開する

開発者向けツール **Supabase CLI** が入っている人は、ターミナルで:

```bash
supabase functions deploy stripe-checkout
supabase functions deploy stripe-portal
supabase functions deploy stripe-confirm-checkout
supabase functions deploy stripe-webhook
supabase functions deploy invite-redeem
supabase functions deploy admin-create-invite
supabase functions deploy admin-create-invites
supabase functions deploy admin-list-invites
supabase functions deploy admin-revoke-invite
```

（CLI が難しい場合は、慣れている人にこの一覧だけ渡してデプロイしてもらう）

**Windows でまとめてデプロイ**:

```cmd
cd /d C:\coding\obs-overlay-kill
npx supabase login
```

ブラウザでログインが終わってから:

```cmd
scripts\deploy-billing-functions.bat
```

（`Access token not provided` と出たら、まだ `login` が終わっていません）

`create-invites.bat` で **404 / Requested function was not found** と出たら、上のデプロイがまだです。特に `admin-create-invites` が必要です。

---

## 手順 4：配信者ごとの「専用コード」を作る（無期限・無料枠）

**誰に何を使わせるか**だけ決めれば OK。DB を直接触る必要はありません。

### コードに書く内容（1 人分）

| 項目 | 例 | 説明 |
|------|-----|------|
| 機能 | `all` | 全部使える（下の表参照） |
| メール | `tarou@gmail.com` | **その人が課金タブでログインするメールと同じ** |
| 無期限 | はい | 期限なし |
| メモ | `太郎さん` | 自分用メモ（配信者には見えない） |

#### 機能の種類（どれか 1 つ）

| 書く文字 | 使えるもの |
|----------|------------|
| `all` | 全部 |
| `probabilities` | 確率・抽選 |
| `autoReply` | 自動返信 |
| `viewerSettings` | 対人・PvP |
| `layoutFine` | 表示位置の調整 |

### やり方 A：1 人だけ（コピペ用）

**Postman** や **Insomnia** がなくても、PowerShell から実行できます（URL と秘密を書き換え）:

```powershell
$secret = "あなたのBILLING_ADMIN_SECRET"
$url = "https://xxxxx.supabase.co/functions/v1/admin-create-invite"
$body = @{
  featureId = "all"
  allowedEmail = "tarou@gmail.com"
  neverExpires = $true
  label = "太郎さん"
} | ConvertTo-Json

Invoke-RestMethod -Uri $url -Method Post `
  -Headers @{ "X-Billing-Admin-Secret" = $secret; "Content-Type" = "application/json" } `
  -Body $body
```

画面に出てきた **`token`** をコピー → 太郎さんに **チャットや DM でだけ**渡す。  
もう一度同じコードは見られません（台帳には暗号化して保存）。

### やり方 B：複数人まとめて

1. `scripts/billing-invites.example.json` をコピーして `私のリスト.json` などに名前を変える  
2. 中身の例:

```json
{
  "invites": [
    {
      "featureId": "all",
      "allowedEmail": "a@gmail.com",
      "neverExpires": true,
      "label": "Aさん"
    },
    {
      "featureId": "all",
      "allowedEmail": "b@gmail.com",
      "neverExpires": true,
      "label": "Bさん"
    }
  ]
}
```

3. **Windows** — まず `.env` に管理者用秘密を書く（**Supabase の Secrets と同じ文字列**）:

```text
BILLING_ADMIN_SECRET=自分で決めた長いパスワード
```

   Supabase にまだ無い場合: ブラウザでプロジェクト → **Edge Functions** → **Secrets** → `BILLING_ADMIN_SECRET` を追加。

   その後 `scripts\create-invites.bat` をダブルクリックするか、コマンドプロンプトで:

```cmd
cd /d C:\coding\obs-overlay-kill
scripts\create-invites.bat scripts\billing-invites.json
```

   （`VITE_SUPABASE_URL` は既に `.env` にあればそのまま使えます）

   すでに `scripts` フォルダにいる場合は `node scripts\...` ではなく次のどちらか:

```cmd
cd ..
scripts\create-invites.bat scripts\billing-invites.json
```

   または `scripts` 内で `node create-invites.mjs billing-invites.json`

4. できた `created-invites-日時.json`（プロジェクト直下）を開く → 各人の **token** をそれぞれ渡す

### 登録したコードを見る・止める

一覧を見る（コードの文字列そのものは出ません）:

```powershell
Invoke-RestMethod -Uri "https://xxxxx.supabase.co/functions/v1/admin-list-invites" `
  -Headers @{ "X-Billing-Admin-Secret" = "あなたの秘密" }
```

止めたいときは、一覧に出た **id** を使う:

```powershell
$body = '{"id":"ここにuuid"}'
Invoke-RestMethod -Uri "https://xxxxx.supabase.co/functions/v1/admin-revoke-invite" `
  -Method Post -Headers @{ "X-Billing-Admin-Secret"="秘密"; "Content-Type"="application/json" } -Body $body
```

---

## 配信者側の流れ（あなたが教えること）

```
① 配信ソフトの「課金」タブを開く
② メールアドレスを入れて「リンクを送信」→ メールのリンクでログイン
③ どちらか:
   ・月額で使う → Stripe の支払いボタン
   ・無料招待 → あなたからもらった code（token）を入力して「適用」
④ 「利用中」になれば PRO 設定が使える
```

**注意:** コードをもらったメールと、ログインするメールは **同じ** にしてください。

---

## よくある質問

**Q. 表に自分でデータを入れる？**  
A. 基本いいえ。招待コードだけ「発行ツール」で登録。あとは自動です。

**Q. 10 人に配りたい**  
A. 10 個のメール用に、招待コードを 10 回（または JSON 一括）作る。各自ログイン。

**Q. 月額とコード、両方？**  
A. どちらか一方で足ります。コードは「課金なしで使わせたい人」向け。

**Q. 設定が動かない**  
A. (1) `.env` の Supabase 2 行 (2) SQL 3 ファイル実行済み (3) Stripe Webhook URL (4) 配信者が課金タブでログイン済み、を確認。

---

## もう少し技術的な一覧（開発者向け）

| テーブル | 誰が書く |
|----------|----------|
| `profiles` | ログイン時に自動 |
| `invite_tokens` | 管理者が発行 API で |
| `feature_entitlements` | 契約 or コード適用で自動 |
| `stripe_*` | Stripe 連携で自動 |

セキュリティの考え方: [SECURITY.md](./SECURITY.md)

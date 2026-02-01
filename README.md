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

### 4. OAuth認証トークンの取得（チャンネルポイント機能を使用する場合）

チャンネルポイントのリワード取得や引き換え履歴を取得するには、**OAuth認証（ユーザートークン）**が必要です。

> **重要:** TwitchTokenGenerator.comなどの外部ツールで生成したトークンは、そのツールのClient IDに紐づいています。`.env`の`VITE_TWITCH_CLIENT_ID`と一致しない場合、401エラーが発生します。**必ず自分のTwitch Dev Consoleアプリで生成したトークンを使用してください。**

#### 方法1: OAuth認証URLを使用（推奨）

**重要**: この方法を使用する前に、Twitch Developer ConsoleでリダイレクトURIを登録する必要があります。

1. **Twitch Developer ConsoleでリダイレクトURIを登録**
   - [Twitch Developer Console](https://dev.twitch.tv/console/apps) にアクセス
   - 自分のアプリを選択
   - 「OAuth Redirect URLs」セクションに以下を追加:
     ```
     http://localhost:5173
     ```
   - 「Update」または「Save Changes」をクリック
   - **注意**: 変更が反映されるまで数分かかる場合があります

2. **OAuth認証URLを構築**
   - 以下のURLをブラウザで開きます（`YOUR_CLIENT_ID`を自分のClient IDに置き換えてください）:
   ```
   https://id.twitch.tv/oauth2/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:5173&response_type=code&scope=channel:read:redemptions+channel:manage:redemptions
   ```

3. **Twitchで認証**
   - ブラウザで認証画面が開きます
   - 「承認」をクリックして認証を完了します
   - リダイレクト先のURLに`code`パラメータが含まれます（例: `http://localhost:5173?code=xxxxx`）

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
       redirect_uri = "http://localhost:5173"
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
     -d "redirect_uri=http://localhost:5173"
   ```
   
   > **注意:** `YOUR_CLIENT_ID`と`YOUR_CLIENT_SECRET`を自分の`.env`ファイルに設定した値に置き換えてください。

5. **レスポンスからトークンを取得**
   - レスポンスのJSONから`access_token`と`refresh_token`をコピーします
   - `.env`ファイルの`VITE_TWITCH_ACCESS_TOKEN`と`VITE_TWITCH_REFRESH_TOKEN`に設定します
   - 開発サーバーを再起動してください

#### 方法2: TwitchTokenGenerator.comを使用する場合

TwitchTokenGenerator.comを使用する場合は、**必ず自分のClient ID/Secretを設定**してください:

1. [TwitchTokenGenerator.com](https://twitchtokengenerator.com/) にアクセス
2. ページ下部の「**Use My Client Secret and Client ID Optional NEW**」セクションを探す
3. 自分の`VITE_TWITCH_CLIENT_ID`と`VITE_TWITCH_CLIENT_SECRET`を入力
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

### ブラウザウィンドウキャプチャーの設定例

1. **ブラウザでURLを開く**: `http://localhost:5173/overlay` をブラウザで開く
2. **OBSでウィンドウキャプチャーを追加**:
   - OBSで「ウィンドウキャプチャー」ソースを追加
   - キャプチャーするウィンドウ: 上記URLを開いたブラウザウィンドウを選択
   - **幅/高さ**: 1920 x 1080（任意）

### HPゲージの機能

- **HPゲージ表示**: 最大HPと現在のHPを表示（複数のレイヤーで重ねて表示可能）
- **攻撃イベント**: 
  - チャンネルポイントの「攻撃」リワードでHPを減少
  - **カスタムテキスト対応**: チャットメッセージで設定したカスタムテキスト（例: `!attack`）でも攻撃を実行可能（App Access Tokenでも使用可能）
  - **ミス判定**: 設定した確率で攻撃がミスになる機能（ミス効果音も設定可能）
  - **クリティカル判定**: 設定した確率でクリティカルヒットが発生し、ダメージが倍率分増加する機能
  - **出血ダメージ**: 設定した確率で出血ダメージが発生し、一定時間継続してダメージを与える機能（ランダムな方向に放射状に表示）
  - **食いしばり（HP1残り）**: 攻撃でHPが0になる場合に、設定した確率でHPを1残す機能。発動時にカスタムメッセージを表示可能。
  - **ダメージ数値表示**: 攻撃時にダメージ値を視覚的に表示（通常ダメージ、クリティカル、出血ダメージで異なる演出）
  - **攻撃効果音**: 攻撃時に効果音を再生（設定可能）
- **回復イベント**: 
  - チャンネルポイントの「回復」リワードでHPを回復
  - **カスタムテキスト対応**: チャットメッセージで設定したカスタムテキスト（例: `!heal`）でも回復を実行可能（App Access Tokenでも使用可能）
  - **回復量**: 固定値またはランダム値（設定可能）
  - **ランダム刻み**: ランダム回復時に 50・100 などの刻みを指定可能（例: 最小100・最大500・刻み50 → 100, 150, 200, … のいずれか）。刻みを 1 にすると従来どおり最小～最大の連続値。配信者側・視聴者側・リワード回復のそれぞれで設定可能。
  - **回復エフェクト**: 回復時にキラキラパーティクルエフェクトを表示（設定で有効/無効を切り替え可能）
  - **回復効果音**: 回復時に効果音を再生（設定可能）
- **HPが0になったときのエフェクト**:
  - **動画エフェクト**: 透過WebM動画を再生（確実に最初から再生）
  - **画像表示**: HPが0になったときに画像を表示
  - **効果音**: HPが0になったときに効果音を再生
  - **配信者HP0時のメッセージ**: 配信者HPが0になったときにチャットへ自動送信するメッセージを設定可能。`{attacker}` で攻撃した視聴者名に置換。
- **リトライ・回復コマンド（配信者側）**:
  - **リトライ**（`!retry`）: HPが最大値未満の場合に配信者HPを全回復。HPが最大値の場合は実行されない。蘇生効果音を再生（設定可能）。
  - **全回復**（`!fullheal` など・設定で変更可能）: 配信者が実行すると配信者HPを常に最大まで回復。
  - **全員全回復**（`!resetall` など・設定で変更可能）: 配信者のみ実行可能。配信者HPと全視聴者HPを最大まで回復。
  - **通常回復**（`!heal` など・設定で変更可能）: 配信者が実行すると設定量だけ回復（固定 or ランダム、ランダム刻みも設定可能）。HPが0のときは設定で許可/ブロックを切り替え可能。
- **リアルタイム監視**: 
  - **EventSub WebSocket**: チャンネルポイント引き換えイベントをリアルタイムで監視（推奨）
  - **ポーリング方式**: EventSubが使用できない場合のフォールバック（5秒間隔でポーリング）
- **PvPモード（配信者 vs 視聴者）**:
  - 視聴者ごとにHPを管理（画面上のゲージは配信者HPのみ表示。視聴者HPは数値管理のみ）。
  - **カウンター攻撃**: 視聴者が攻撃したとき、攻撃者またはランダムなユーザーに配信者側の攻撃設定でダメージ。カウンターコマンド（`!counter` など）で配信者が任意の視聴者を攻撃可能（ユーザー名指定: `!counter ユーザー名`）。
  - **視聴者コマンド**: HP確認（`!hp` など）、全回復（`!fullheal` など・実行した視聴者のHPを最大まで）、通常回復（`!heal` など・設定量だけ回復、固定 or ランダム・刻み設定可能）。コマンドは設定で変更可能。
  - **HP0時の制御**: 視聴者HPが0のときは攻撃・回復をブロック可能。ブロック時や視聴者HPが0になったときのメッセージを設定可能。通常回復は「HP0のときも許可」で有効にできる。
- **チャット自動返信のオン・オフ（機能別）**:
  - チャットへメッセージを送るかどうかを、機能ごとにチェックボックスで切り替え可能。
  - **配信者HPが0になったときの自動返信**: 配信者HP0時に送るメッセージ（例: 「配信者を ○○ が倒しました！」）の送信の有無。
  - **攻撃・カウンター時の自動返信**: 攻撃/カウンター時のHP表示（例: 「○○の残りHP: x/y」）と、視聴者HPが0になったときのメッセージの送信の有無。
  - **視聴者コマンドの自動返信**: HP確認・全回復・通常回復コマンド実行時の返信の送信の有無。
  - **HP0ブロック時の自動返信**: 「HPが0なので攻撃できません。」「HPが0なので回復できません。」の送信の有無。
- **UI表示制御**:
  - **背景色切り替え**: グリーンバック（クロマキー用）と濃いグレーを切り替え可能
  - **タブ式UI**: 背景色変更ボタンとテストモードボタンをタブで表示/非表示を切り替え可能（OBSキャプチャー時に非表示にできる）

### エフェクト動画の設定

HPが0になったときに表示されるエフェクト動画は、**透過WebM動画**形式を使用します。

- **推奨形式**: WebM（VP9コーデック、透過対応）
- **デフォルトパス**: `src/images/bakuhatsu.webm`
- **設定方法**: `http://localhost:5173/settings` の「動画 URL（透過WebM推奨）」で設定可能

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
  - `http://localhost:5173/settings` を開く
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
  - `http://localhost:5173/settings` を開く
  - 「テストモードを有効にする」にチェック
  - 「設定を保存」を押す（開発環境ではローカルストレージに保存されます）
- **挙動**:
  - テストモード有効時は、チャンネルポイントAPIの監視を行いません
  - 開発環境（`npm run dev`）では、`/overlay` 右下にテスト操作ボタンが表示されます
  - テストモードでもカスタムテキスト（チャットコマンド）は動作します
- **操作**:
  - テストボタンは長押しで連打できます（攻撃・回復）
  - 「全員全回復」ボタン（長押しで連打可能）で配信者HP・全視聴者HPを最大値にリセット
  - テストボタンとカスタムテキストは独立して動作します（競合しません）
- **設定**:
  - テストモード中も設定画面と同様に、配信者側・ユーザー側（PvP）の各種設定をタブで切り替えて編集可能（HP、攻撃、回復、リトライ、PvP など）。

> **補足:** 設定は開発環境ではローカルストレージに保存されます。初期値は `public/config/overlay-config.json` です。チャットへメッセージを送る機能（自動返信）を使う場合は、OAuth トークンに `user:write:chat` スコープが必要です。

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

import axios, { AxiosInstance } from 'axios'
import { logger } from '../lib/logger'
import { getTwitchClientId, getTwitchClientSecret, getTwitchConsoleClientId, getTwitchConsoleClientSecret, getTwitchAccessToken, getTwitchRefreshToken, setTwitchOAuthTokens } from '../config/auth'
import type {
  TwitchUser,
  TwitchStream,
  TwitchGame,
  TwitchApiResponse,
  TwitchTokenResponse,
  TwitchChannel,
  TwitchChannelInformation,
  TwitchVideo,
  TwitchClip,
  TwitchEmote,
  TwitchFollowerResponse,
  TwitchChatBadge,
  TwitchApiPaginatedResponse,
  TwitchChannelPointReward,
  TwitchChannelPointRedemption,
} from '../types/twitch'

class TwitchApiClient {
  private client: AxiosInstance
  private accessToken: string | null = null
  private tokenExpiresAt: number = 0
  private consoleAccessToken: string | null = null
  private consoleTokenExpiresAt: number = 0
  private userAccessToken: string | null = null
  private userTokenExpiresAt: number = 0
  private isRefreshing: boolean = false

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.twitch.tv/helix',
      headers: {
        'Client-ID': getTwitchClientId(),
      },
    })
  }

  /**
   * App Access Tokenを取得（Client Credentials Grant）
   */
  async getAppAccessToken(): Promise<string> {
    const clientId = getTwitchClientId()
    const clientSecret = getTwitchClientSecret()

    if (!clientId || !clientSecret) {
      throw new Error(
        'Twitch Client ID and Client Secret must be set in environment variables'
      )
    }

    // トークンが有効な場合は再利用
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken
    }

    try {
      const response = await axios.post<TwitchTokenResponse>(
        'https://id.twitch.tv/oauth2/token',
        null,
        {
          params: {
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'client_credentials',
          },
        }
      )

      this.accessToken = response.data.access_token
      // 有効期限の5分前に期限切れとみなす
      this.tokenExpiresAt =
        Date.now() + (response.data.expires_in - 300) * 1000

      return this.accessToken
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        const errorData = error.response?.data

        if (status === 400) {
          const errorMessage = errorData?.message || 'Invalid client credentials'
          logger.error(
            '❌ Twitch API: アクセストークンの取得に失敗しました - 認証情報が無効です\n' +
            `エラー: ${errorMessage}\n` +
            `Client ID: ${clientId.substring(0, 10)}... (長さ: ${clientId.length})\n` +
            '.envファイルを確認してください:\n' +
            '1. VITE_TWITCH_CLIENT_ID はTwitchアプリケーションのClient ID（30文字以上）である必要があります\n' +
            '2. VITE_TWITCH_CLIENT_SECRET はTwitchアプリケーションのClient Secret（30文字以上）である必要があります\n' +
            '3. これらは以下から取得できます: https://dev.twitch.tv/console/apps\n' +
            '4. Twitchアプリケーションの正しい認証情報を使用していることを確認してください'
          )
        } else if (status === 401) {
          logger.error(
            '❌ Twitch API: アクセストークンの取得に失敗しました - 認証失敗\n' +
            'Client IDまたはClient Secretが正しくない可能性があります。\n' +
            '認証情報を以下で確認してください: https://dev.twitch.tv/console/apps'
          )
        } else if (status === 403) {
          const hint = getTwitchConsoleClientId() && getTwitchConsoleClientSecret()
            ? '（コンソール用アプリでリトライします）'
            : 'フォールバックするには .env に VITE_TWITCH_CONSOLE_CLIENT_ID と VITE_TWITCH_CONSOLE_CLIENT_SECRET を設定してください。'
          logger.error(
            `❌ Twitch API: アクセストークンの取得に失敗しました - HTTP 403 (invalid client secret)\n` +
            `トークン用アプリの Client Secret が無効です。${hint}`
          )
        } else {
          logger.error(
            `❌ Twitch API: アクセストークンの取得に失敗しました - HTTP ${status}\n`,
            errorData || error.message
          )
        }
      } else {
        logger.error('❌ Twitch API: アクセストークンの取得に失敗しました', error)
      }
      throw error
    }
  }

  /**
   * APIリクエスト用のヘッダーを取得（トークンジェネレーター用アプリの Client Credentials）
   * チャンネルポイント・OAuth・EventSub・チャット送信で使用
   */
  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getAppAccessToken()
    return {
      'Client-ID': getTwitchClientId(),
      Authorization: `Bearer ${token}`,
    }
  }

  /**
   * コンソール用アプリの App Access Token を取得（Client Credentials）
   * VITE_TWITCH_CONSOLE_CLIENT_ID と VITE_TWITCH_CONSOLE_CLIENT_SECRET が両方設定されている場合のみ使用
   */
  private async getConsoleAppAccessToken(): Promise<string | null> {
    const consoleClientId = getTwitchConsoleClientId()
    const consoleClientSecret = getTwitchConsoleClientSecret()
    if (!consoleClientId || !consoleClientSecret) {
      return null
    }
    if (this.consoleAccessToken && Date.now() < this.consoleTokenExpiresAt) {
      return this.consoleAccessToken
    }
    try {
      const response = await axios.post<TwitchTokenResponse>(
        'https://id.twitch.tv/oauth2/token',
        null,
        {
          params: {
            client_id: consoleClientId,
            client_secret: consoleClientSecret,
            grant_type: 'client_credentials',
          },
        }
      )
      this.consoleAccessToken = response.data.access_token
      this.consoleTokenExpiresAt = Date.now() + (response.data.expires_in - 300) * 1000
      return this.consoleAccessToken
    } catch {
      return null
    }
  }

  /**
   * ユーザー検索・公開情報取得用ヘッダー（VITE_TWITCH_CONSOLE_CLIENT_ID を優先）
   * Twitchユーザー検索などはコンソール用アプリで取得する必要がある場合がある。
   * コンソール用が設定されている場合はコンソールのみ使用（失敗時は呼び出し元でトークン用にリトライ可能にするため getHeaders にフォールバックしない）
   */
  private async getReadOnlyHeaders(): Promise<Record<string, string>> {
    const consoleClientId = getTwitchConsoleClientId()
    const consoleClientSecret = getTwitchConsoleClientSecret()
    if (consoleClientId && consoleClientSecret) {
      const consoleToken = await this.getConsoleAppAccessToken()
      if (consoleToken) {
        return {
          'Client-ID': consoleClientId,
          Authorization: `Bearer ${consoleToken}`,
        }
      }
      throw new Error(
        'Twitch コンソール用アプリのトークン取得に失敗しました。VITE_TWITCH_CONSOLE_CLIENT_ID / VITE_TWITCH_CONSOLE_CLIENT_SECRET を確認してください。'
      )
    }
    return this.getHeaders()
  }

  /**
   * トークン用アプリで取得に失敗したらコンソール用アプリでリトライする
   * ユーザー検索・ストリーム情報など、読み取り専用API用
   */
  private isRetryableWithConsole(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const data = error.response?.data as { message?: string } | undefined
      const msg = (data?.message ?? error.message ?? '').toLowerCase()
      if (status === 403 || status === 401) return true
      if (msg.includes('invalid client') || msg.includes('unauthorized')) return true
    }
    return false
  }

  /**
   * 読み取り専用API用: コンソール用アプリが設定されていれば先に試し、失敗時はトークン用アプリでリトライ
   */
  private async requestWithConsoleFallback<T>(
    request: (headers: Record<string, string>) => Promise<T>
  ): Promise<T> {
    const hasConsole = !!(getTwitchConsoleClientId() && getTwitchConsoleClientSecret())

    // コンソール用が設定されていれば先に試す（トークン用が無効でもユーザー情報・ストリーム取得が成功しやすくする）
    if (hasConsole) {
      try {
        const headers = await this.getReadOnlyHeaders()
        return await request(headers)
      } catch (firstError) {
        if (import.meta.env.DEV) {
          logger.warn(
            '⚠️ コンソール用アプリでの取得に失敗したため、トークン用アプリでリトライします。',
            firstError
          )
        }
        try {
          const headers = await this.getHeaders()
          return await request(headers)
        } catch (retryError) {
          logger.error('❌ Twitch API: トークン用アプリでのリトライも失敗しました', retryError)
          throw retryError
        }
      }
    }

    // コンソール用が未設定の場合はトークン用のみ
    try {
      const headers = await this.getHeaders()
      return await request(headers)
    } catch (firstError) {
      if (this.isRetryableWithConsole(firstError)) {
        logger.warn(
          '💡 トークン用アプリで認証に失敗しました。.env に次を設定するとコンソール用アプリでユーザー情報・ストリーム取得を試せます:\n' +
          '   VITE_TWITCH_CONSOLE_CLIENT_ID=...\n' +
          '   VITE_TWITCH_CONSOLE_CLIENT_SECRET=...'
        )
      }
      throw firstError
    }
  }

  /**
   * リフレッシュトークンを使って新しいアクセストークンを取得
   */
  private async refreshUserAccessToken(): Promise<string> {
    let refreshToken = getTwitchRefreshToken()
    const clientId = getTwitchClientId()
    const clientSecret = getTwitchClientSecret()

    if (!refreshToken) {
      throw new Error('VITE_TWITCH_REFRESH_TOKEN is not set. Cannot refresh access token.')
    }

    if (!clientId || !clientSecret) {
      throw new Error('Client ID and Client Secret must be set to refresh token.')
    }

    // "oauth:" プレフィックスを削除（Twitch APIでは不要）
    refreshToken = refreshToken.replace(/^oauth:/i, '').trim()

    if (import.meta.env.DEV) {
      logger.debug('🔄 Twitch API: トークンをリフレッシュ中', {
        リフレッシュトークン長: refreshToken.length,
        リフレッシュトークン先頭: refreshToken.substring(0, 10) + '...',
      })
    }

    try {
      // URLSearchParamsを使用して確実にURLエンコード
      // リフレッシュトークンに特殊文字が含まれている場合でも正しくエンコードされる
      const params = new URLSearchParams()
      params.append('grant_type', 'refresh_token')
      params.append('refresh_token', refreshToken) // URLSearchParamsが自動的にエンコード
      params.append('client_id', clientId)
      params.append('client_secret', clientSecret)

      // Twitch APIのトークンリフレッシュエンドポイントは、フォームデータとして送信する必要がある
      const response = await axios.post<TwitchTokenResponse>(
        'https://id.twitch.tv/oauth2/token',
        params.toString(), // URLSearchParamsを文字列に変換（application/x-www-form-urlencoded形式）
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          validateStatus: (status) => status < 500, // 400エラーもキャッチするために
          timeout: 10000, // 10秒のタイムアウトを設定
        }
      )

      // レスポンスがエラーの場合は例外をスロー
      if (response.status >= 400) {
        const errorData = response.data as any
        const error = new Error(errorData?.message || errorData?.error_description || `HTTP ${response.status}`)
          ; (error as any).response = { status: response.status, data: errorData }
          ; (error as any).isAxiosError = true
        throw error
      }

      this.userAccessToken = response.data.access_token
      // 有効期限の5分前に期限切れとみなす
      this.userTokenExpiresAt =
        Date.now() + (response.data.expires_in - 300) * 1000

      if (import.meta.env.DEV) {
        logger.debug('✅ Twitch API: ユーザーアクセストークンのリフレッシュ成功', {
          トークン長: this.userAccessToken.length,
          有効期限: `${response.data.expires_in}秒`,
          期限切れ日時: new Date(this.userTokenExpiresAt).toISOString(),
          スコープ: response.data.scope || '未提供',
        })

        // リフレッシュされたトークンを検証
        const validation = await this.validateOAuthToken(this.userAccessToken)
        if (!validation.valid) {
          logger.error('❌ リフレッシュされたトークンの検証に失敗しました')
        } else {
          logger.debug('✅ Twitch API: リフレッシュされたトークンの検証成功', {
            ユーザーID: validation.userId,
            スコープ: validation.scopes,
          })
        }
      }

      // 新しいトークンを localStorage に保存（getTwitchAccessToken やチャット接続で即反映）
      const newRefresh = response.data.refresh_token?.trim() || refreshToken
      try {
        setTwitchOAuthTokens(this.userAccessToken!, newRefresh)
        if (import.meta.env.DEV && response.data.refresh_token && response.data.refresh_token !== refreshToken) {
          logger.debug('🔄 新しいリフレッシュトークンを localStorage に保存しました')
        }
      } catch {
        // localStorage が使えない環境では無視
      }

      return this.userAccessToken
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // リクエストが中断された場合の処理
        if (error.code === 'ECONNABORTED' || error.message?.includes('aborted') || error.message?.includes('canceled')) {
          const errorMessage = error.message || 'Request aborted'
          logger.error(
            '❌ Twitch API: ユーザーアクセストークンのリフレッシュに失敗しました - リクエストが中断されました\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
            `エラー: ${errorMessage}\n` +
            `エラーコード: ${error.code || 'N/A'}\n\n` +
            '考えられる原因:\n' +
            '1. ネットワーク接続の問題（インターネット接続を確認してください）\n' +
            '2. タイムアウト（リクエストが10秒以内に完了しませんでした）\n' +
            '3. ファイアウォールやプロキシの設定\n' +
            '4. Twitch APIサーバーの一時的な問題\n\n' +
            '対処方法:\n' +
            '1. インターネット接続を確認してください\n' +
            '2. 数秒待ってから再試行してください\n' +
            '3. ファイアウォールやプロキシの設定を確認してください\n' +
            '4. ブラウザの開発者ツールでネットワークタブを確認してください\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          )
          const abortError = new Error(`Request aborted: ${errorMessage}`)
            ; (abortError as any).code = error.code
            ; (abortError as any).isAxiosError = true
          throw abortError
        }

        // ネットワークエラーの場合
        if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
          logger.error(
            '❌ Twitch API: ユーザーアクセストークンのリフレッシュに失敗しました - ネットワークエラー\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
            `エラー: ${error.message}\n` +
            `エラーコード: ${error.code || 'N/A'}\n\n` +
            '考えられる原因:\n' +
            '1. インターネット接続が切断されました\n' +
            '2. Twitch APIサーバーに接続できません\n' +
            '3. CORSエラー（ブラウザのセキュリティ設定）\n' +
            '4. DNS解決の問題\n\n' +
            '対処方法:\n' +
            '1. インターネット接続を確認してください\n' +
            '2. Twitch APIのステータスを確認してください: https://status.twitch.tv/\n' +
            '3. ブラウザの開発者ツールでネットワークタブを確認してください\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          )
          const networkError = new Error(`Network error: ${error.message}`)
            ; (networkError as any).code = error.code
            ; (networkError as any).isAxiosError = true
          throw networkError
        }

        const status = error.response?.status
        const errorData = error.response?.data

        if (status === 400) {
          const errorMessage = errorData?.message || errorData?.error_description || errorData?.error || 'Invalid refresh token'
          const errorType = errorData?.error || 'unknown_error'

          if (import.meta.env.DEV) {
            logger.error('❌ Twitch API: リフレッシュトークンエラー詳細', {
              ステータス: status,
              エラー種別: errorType,
              メッセージ: errorMessage,
              完全なレスポンス: errorData,
            })
          }

          logger.error(
            '❌ Twitch API: ユーザーアクセストークンのリフレッシュに失敗しました - 無効なリフレッシュトークン (400)\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
            `エラー種別: ${errorType}\n` +
            `エラーメッセージ: ${errorMessage}\n\n` +
            '考えられる原因:\n' +
            '1. リフレッシュトークンが無効または期限切れ\n' +
            '2. リフレッシュトークンが別のアプリケーション（Client ID）用のものである\n' +
            '3. リフレッシュトークンに "oauth:" プレフィックスが含まれている（自動的に削除されますが、確認してください）\n' +
            '4. Client ID または Client Secret がリフレッシュトークンと一致していない\n' +
            '5. リフレッシュトークンが正しく設定されていない\n\n' +
            '現在の設定:\n' +
            `  - Client ID: ${clientId ? clientId.substring(0, 10) + '...' : '未設定'}\n` +
            `  - Refresh Token Length: ${refreshToken.length} characters\n` +
            `  - Refresh Token Prefix: ${refreshToken.substring(0, 10)}...\n\n` +
            '対処方法:\n' +
            '1. 新しいリフレッシュトークンを取得してください（同じClient ID/Secretを使用）\n' +
            '2. .env ファイルの VITE_TWITCH_REFRESH_TOKEN を確認してください\n' +
            '3. リフレッシュトークンに "oauth:" プレフィックスが含まれている場合は削除してください\n' +
            '4. Client ID と Client Secret がリフレッシュトークンと一致していることを確認してください\n' +
            '5. OAuth認証フローを再実行して、新しいトークンを取得してください\n\n' +
            'リフレッシュトークンの取得方法:\n' +
            'https://dev.twitch.tv/docs/authentication/getting-tokens-oauth#oauth-authorization-code-flow\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          )

          // リフレッシュトークンに "oauth:" プレフィックスが含まれている場合の警告
          const originalRefreshToken = getTwitchRefreshToken()
          if (originalRefreshToken && /^oauth:/i.test(originalRefreshToken)) {
            logger.warn(
              '⚠️ 警告: VITE_TWITCH_REFRESH_TOKEN に "oauth:" プレフィックスが含まれています。\n' +
              'Twitch APIでは "oauth:" プレフィックスは不要です。.env ファイルから削除してください。\n' +
              '例: oauth:xxxxx → xxxxx'
            )
          }
        } else if (status === 401) {
          logger.error(
            '❌ Twitch API: ユーザーアクセストークンのリフレッシュに失敗しました - 認証失敗 (401)\n' +
            'Client ID または Client Secret が正しくない可能性があります。'
          )
        } else {
          logger.error(
            `❌ Twitch API: ユーザーアクセストークンのリフレッシュに失敗しました - HTTP ${status}\n`,
            errorData || error.message
          )
        }
      } else {
        logger.error('❌ Twitch API: ユーザーアクセストークンのリフレッシュに失敗しました', error)
      }
      throw error
    }
  }

  /**
   * OAuthトークンを検証
   */
  private async validateOAuthToken(token: string): Promise<{ valid: boolean; scopes?: string[]; userId?: string; clientId?: string }> {
    try {
      const response = await axios.get('https://id.twitch.tv/oauth2/validate', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      return {
        valid: true,
        scopes: response.data.scopes || [],
        userId: response.data.user_id,
        clientId: response.data.client_id,
      }
    } catch {
      return { valid: false }
    }
  }

  /**
   * 有効なユーザーアクセストークンを取得（リフレッシュ機能付き）
   */
  private async getUserAccessToken(): Promise<string> {
    // キャッシュされたトークンが有効な場合は再利用
    if (this.userAccessToken && Date.now() < this.userTokenExpiresAt) {
      return this.userAccessToken
    }

    // 既にリフレッシュ中の場合は、完了を待つ
    if (this.isRefreshing) {
      // 簡単な実装：最大5秒待機
      const maxWait = 5000
      const startTime = Date.now()
      while (this.isRefreshing && Date.now() - startTime < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      if (this.userAccessToken && Date.now() < this.userTokenExpiresAt) {
        return this.userAccessToken
      }
    }

    // リフレッシュトークンが設定されている場合は、それを使って新しいトークンを取得
    const refreshToken = getTwitchRefreshToken()
    if (refreshToken) {
      this.isRefreshing = true
      try {
        const newToken = await this.refreshUserAccessToken()
        this.isRefreshing = false
        return newToken
      } catch {
        this.isRefreshing = false
        // リフレッシュに失敗した場合は、環境変数のトークンを使用
        logger.warn(
          '⚠️ Failed to refresh token, using token from environment variable.\n' +
          'This may cause authentication errors if the token is expired.'
        )
        // リフレッシュに失敗した場合は、キャッシュをクリア
        this.userAccessToken = null
        this.userTokenExpiresAt = 0
      }
    }

    // 環境変数からトークンを取得
    let userToken = getTwitchAccessToken()
    if (!userToken) {
      throw new Error(
        'VITE_TWITCH_ACCESS_TOKEN is not set and refresh token is not available.'
      )
    }

    // "oauth:" プレフィックスを削除（Twitch APIでは不要）
    userToken = userToken.replace(/^oauth:/i, '').trim()

    // トークンの長さチェック（通常30文字以上）
    if (userToken.length < 30) {
      logger.warn(
        `⚠️ Warning: OAuth token length is ${userToken.length} characters, which seems too short.\n` +
        'Twitch OAuth tokens are typically 30+ characters long.\n' +
        'Please verify that VITE_TWITCH_ACCESS_TOKEN contains a valid user token.'
      )
    }

    // 環境変数のトークンをキャッシュ（有効期限は不明なため、短めに設定）
    this.userAccessToken = userToken
    this.userTokenExpiresAt = Date.now() + 3600000 // 1時間後に期限切れとみなす

    return userToken
  }

  /**
   * 有効なユーザーアクセストークンを取得（リフレッシュあり・チャット接続用）
   * 期限切れの場合はリフレッシュを試行し、成功時は localStorage にも保存する
   */
  async getValidUserToken(): Promise<string> {
    return this.getUserAccessToken()
  }

  /**
   * OAuth認証（ユーザートークン）用ヘッダー取得
   * チャンネルポイント情報の取得には必ずトークン用アプリ（VITE_TWITCH_TOKEN_APP_CLIENT_ID）を使用すること。
   * コンソール用アプリは使用しない。
   */
  private async getOAuthHeaders(): Promise<Record<string, string>> {
    try {
      const userToken = await this.getUserAccessToken()

      if (import.meta.env.DEV) {
        const isFromRefresh = this.userTokenExpiresAt > Date.now() && this.userAccessToken === userToken
        logger.debug('🔑 Twitch API: OAuthユーザートークンを使用', {
          トークン長: userToken.length,
          トークン先頭: userToken.substring(0, 10) + '...',
          リフレッシュから取得: isFromRefresh,
          期限切れ日時: this.userTokenExpiresAt > 0 ? new Date(this.userTokenExpiresAt).toISOString() : '不明',
        })

        // 開発環境ではトークンを検証（毎回検証して問題を早期発見）
        const validation = await this.validateOAuthToken(userToken)
        if (!validation.valid) {
          logger.error(
            '❌ OAuthトークンの検証に失敗しました。トークンが無効または期限切れの可能性があります。\n' +
            'VITE_TWITCH_REFRESH_TOKEN が設定されている場合、自動的にトークンをリフレッシュします。'
          )
        } else {
          const configuredClientId = getTwitchClientId()
          if (validation.clientId && configuredClientId && validation.clientId !== configuredClientId) {
            logger.error(
              '❌ OAuthトークンのclient_idが一致しません。\n' +
              `トークンは client_id=${validation.clientId} で発行されましたが、VITE_TWITCH_CLIENT_ID=${configuredClientId} です。\n` +
              'Twitchでは、Client-IdヘッダーがOAuthトークン内のclient_idと一致する必要があります。\n' +
              '修正方法: VITE_TWITCH_CLIENT_ID と同じTwitchアプリを使用して、新しいユーザートークン/リフレッシュトークンを生成してください。'
            )
          }
          const hasRequiredScope = validation.scopes?.includes('channel:read:redemptions')
          if (!hasRequiredScope) {
            logger.warn(
              '⚠️ 警告: OAuthトークンに必要なスコープがありません: channel:read:redemptions\n' +
              `現在のスコープ: ${validation.scopes?.join(', ') || 'なし'}\n` +
              '必要なスコープを含む新しいトークンを取得してください。'
            )
          } else {
            logger.debug('✅ Twitch API: OAuthトークンの検証成功', {
              ユーザーID: validation.userId,
              スコープ: validation.scopes,
              クライアントID: validation.clientId,
            })
          }
        }
      }

      return {
        'Client-ID': getTwitchClientId(),
        Authorization: `Bearer ${userToken}`,
      }
    } catch {
      // ユーザートークンが取得できない場合は、App Access Tokenを試す
      // （ただし、チャンネルポイント関連のAPIでは動作しない可能性が高い）
      logger.error(
        '❌ Twitch API: ユーザーアクセストークンの取得に失敗しました\n' +
        'チャンネルポイントの引き換え履歴を取得するには、OAuth認証（ユーザートークン）が必要です。\n' +
        'App Access Tokenでは使用できません。\n' +
        'VITE_TWITCH_ACCESS_TOKEN または VITE_TWITCH_REFRESH_TOKEN に適切な値を設定してください。\n' +
        'ユーザートークンの取得方法: https://dev.twitch.tv/docs/authentication/getting-tokens-oauth#oauth-authorization-code-flow'
      )
      return await this.getHeaders()
    }
  }

  /**
   * ユーザー情報を取得（Twitchユーザー検索）
   * VITE_TWITCH_CONSOLE_CLIENT_ID が設定されていればコンソール用アプリで取得、未設定時はトークン用アプリ
   */
  async getUser(login: string): Promise<TwitchUser | null> {
    try {
      return await this.requestWithConsoleFallback(async (headers) => {
        const response = await this.client.get<TwitchApiResponse<TwitchUser>>(
          '/users',
          { headers, params: { login } }
        )
        return response.data.data[0] || null
      })
    } catch (error) {
      logger.error('❌ Twitch API: ユーザー情報の取得に失敗しました', error)
      throw error
    }
  }

  /**
   * 複数のユーザー情報を取得（Twitchユーザー検索）
   * VITE_TWITCH_CONSOLE_CLIENT_ID が設定されていればコンソール用アプリで取得
   */
  async getUsers(logins: string[]): Promise<TwitchUser[]> {
    try {
      return await this.requestWithConsoleFallback(async (headers) => {
        const response = await this.client.get<TwitchApiResponse<TwitchUser>>(
          '/users',
          { headers, params: { login: logins } }
        )
        return response.data.data
      })
    } catch (error) {
      logger.error('❌ Twitch API: ユーザー情報の取得に失敗しました', error)
      throw error
    }
  }

  /**
   * ストリーム情報を取得
   * トークン用アプリで失敗した場合はコンソール用アプリでリトライ
   */
  async getStream(userLogin: string): Promise<TwitchStream | null> {
    try {
      return await this.requestWithConsoleFallback(async (headers) => {
        const response = await this.client.get<TwitchApiResponse<TwitchStream>>(
          '/streams',
          { headers, params: { user_login: userLogin } }
        )
        return response.data.data[0] || null
      })
    } catch (error) {
      // CORSエラーの場合は、開発環境では警告のみ（オーバーレイページでは使用されない）
      if (axios.isAxiosError(error)) {
        if (error.code === 'ERR_NETWORK' || error.message.includes('CORS')) {
          if (import.meta.env.DEV) {
            logger.warn(
              '⚠️ Twitch API: ストリーム情報取得時のCORSエラー（ブラウザでは正常です - オーバーレイではストリーム情報は使用されません）',
              error.message
            )
          }
          return null
        }
      }
      logger.error(
        '❌ Twitch API: ストリーム情報の取得に失敗しました',
        error
      )
      throw error
    }
  }

  /**
   * 複数のストリーム情報を取得
   * トークン用アプリで失敗した場合はコンソール用アプリでリトライ
   */
  async getStreams(userLogins: string[]): Promise<TwitchStream[]> {
    try {
      return await this.requestWithConsoleFallback(async (headers) => {
        const response = await this.client.get<TwitchApiResponse<TwitchStream>>(
          '/streams',
          { headers, params: { user_login: userLogins } }
        )
        return response.data.data
      })
    } catch (error) {
      logger.error('❌ Twitch API: ストリーム情報の取得に失敗しました', error)
      throw error
    }
  }

  /**
   * ゲーム情報を取得
   * トークン用アプリで失敗した場合はコンソール用アプリでリトライ
   */
  async getGame(gameId: string): Promise<TwitchGame | null> {
    try {
      return await this.requestWithConsoleFallback(async (headers) => {
        const response = await this.client.get<TwitchApiResponse<TwitchGame>>(
          '/games',
          { headers, params: { id: gameId } }
        )
        return response.data.data[0] || null
      })
    } catch (error) {
      logger.error('❌ Twitch API: ゲーム情報の取得に失敗しました', error)
      throw error
    }
  }

  /**
   * チャンネル情報を取得
   * トークン用アプリで失敗した場合はコンソール用アプリでリトライ
   */
  async getChannel(broadcasterId: string): Promise<TwitchChannel | null> {
    try {
      return await this.requestWithConsoleFallback(async (headers) => {
        const response = await this.client.get<TwitchApiResponse<TwitchChannel>>(
          '/channels',
          { headers, params: { broadcaster_id: broadcasterId } }
        )
        return response.data.data[0] || null
      })
    } catch (error) {
      logger.error('❌ Twitch API: チャンネル情報の取得に失敗しました', error)
      throw error
    }
  }

  /**
   * チャンネル情報を取得（ユーザーIDから）
   * トークン用アプリで失敗した場合はコンソール用アプリでリトライ
   */
  async getChannelByUserId(userId: string): Promise<TwitchChannelInformation | null> {
    try {
      return await this.requestWithConsoleFallback(async (headers) => {
        const response = await this.client.get<TwitchApiResponse<TwitchChannelInformation>>(
          '/channels',
          { headers, params: { broadcaster_id: userId } }
        )
        return response.data.data[0] || null
      })
    } catch (error) {
      logger.error('❌ Twitch API: チャンネル情報の取得に失敗しました', error)
      throw error
    }
  }

  /**
   * ビデオ情報を取得
   * トークン用アプリで失敗した場合はコンソール用アプリでリトライ
   */
  async getVideos(
    userId: string,
    limit: number = 20,
    cursor?: string
  ): Promise<TwitchApiPaginatedResponse<TwitchVideo>> {
    try {
      return await this.requestWithConsoleFallback(async (headers) => {
        const params: Record<string, string | number> = {
          user_id: userId,
          first: limit,
        }
        if (cursor) params.after = cursor
        const response = await this.client.get<TwitchApiPaginatedResponse<TwitchVideo>>(
          '/videos',
          { headers, params }
        )
        return response.data
      })
    } catch (error) {
      logger.error('❌ Twitch API: ビデオ情報の取得に失敗しました', error)
      throw error
    }
  }

  /**
   * クリップ情報を取得
   * トークン用アプリで失敗した場合はコンソール用アプリでリトライ
   */
  async getClips(
    broadcasterId: string,
    limit: number = 20,
    cursor?: string
  ): Promise<TwitchApiPaginatedResponse<TwitchClip>> {
    try {
      return await this.requestWithConsoleFallback(async (headers) => {
        const params: Record<string, string | number> = {
          broadcaster_id: broadcasterId,
          first: limit,
        }
        if (cursor) params.after = cursor
        const response = await this.client.get<TwitchApiPaginatedResponse<TwitchClip>>(
          '/clips',
          { headers, params }
        )
        return response.data
      })
    } catch (error) {
      logger.error('❌ Twitch API: クリップ情報の取得に失敗しました', error)
      throw error
    }
  }

  /**
   * エモート情報を取得
   * トークン用アプリで失敗した場合はコンソール用アプリでリトライ
   */
  async getEmotes(broadcasterId: string): Promise<TwitchEmote[]> {
    try {
      return await this.requestWithConsoleFallback(async (headers) => {
        const response = await this.client.get<TwitchApiResponse<TwitchEmote>>(
          '/chat/emotes',
          { headers, params: { broadcaster_id: broadcasterId } }
        )
        return response.data.data
      })
    } catch (error) {
      logger.error('❌ Twitch API: エモート情報の取得に失敗しました', error)
      throw error
    }
  }

  /**
   * グローバルエモート情報を取得
   * トークン用アプリで失敗した場合はコンソール用アプリでリトライ
   */
  async getGlobalEmotes(): Promise<TwitchEmote[]> {
    try {
      return await this.requestWithConsoleFallback(async (headers) => {
        const response = await this.client.get<TwitchApiResponse<TwitchEmote>>(
          '/chat/emotes/global',
          { headers }
        )
        return response.data.data
      })
    } catch (error) {
      logger.error('❌ Twitch API: グローバルエモート情報の取得に失敗しました', error)
      throw error
    }
  }

  /**
   * フォロワー情報を取得
   * トークン用アプリで失敗した場合はコンソール用アプリでリトライ
   */
  async getFollowers(
    broadcasterId: string,
    limit: number = 20,
    cursor?: string
  ): Promise<TwitchFollowerResponse> {
    try {
      return await this.requestWithConsoleFallback(async (headers) => {
        const params: Record<string, string | number> = {
          broadcaster_id: broadcasterId,
          first: limit,
        }
        if (cursor) params.after = cursor
        const response = await this.client.get<TwitchFollowerResponse>(
          '/channels/followers',
          { headers, params }
        )
        return response.data
      })
    } catch (error) {
      logger.error('❌ Twitch API: フォロワー情報の取得に失敗しました', error)
      throw error
    }
  }

  /**
   * チャットバッジ情報を取得
   * トークン用アプリで失敗した場合はコンソール用アプリでリトライ
   */
  async getChatBadges(broadcasterId: string): Promise<TwitchChatBadge[]> {
    try {
      return await this.requestWithConsoleFallback(async (headers) => {
        const response = await this.client.get<TwitchApiResponse<TwitchChatBadge>>(
          '/chat/badges',
          { headers, params: { broadcaster_id: broadcasterId } }
        )
        return response.data.data
      })
    } catch (error) {
      logger.error('Failed to get Twitch chat badges:', error)
      throw error
    }
  }

  /**
   * グローバルチャットバッジ情報を取得
   * トークン用アプリで失敗した場合はコンソール用アプリでリトライ
   */
  async getGlobalChatBadges(): Promise<TwitchChatBadge[]> {
    try {
      return await this.requestWithConsoleFallback(async (headers) => {
        const response = await this.client.get<TwitchApiResponse<TwitchChatBadge>>(
          '/chat/badges/global',
          { headers }
        )
        return response.data.data
      })
    } catch (error) {
      logger.error('❌ Twitch API: グローバルチャットバッジ情報の取得に失敗しました', error)
      throw error
    }
  }

  /**
   * チャンネルポイントリワード一覧を取得
   * OAuth認証（ユーザートークン）必須。Client-ID は VITE_TWITCH_TOKEN_APP_CLIENT_ID（トークン用アプリ）を使用。コンソール用アプリは使用しない。
   */
  async getChannelPointRewards(
    broadcasterId: string,
    onlyManageableRewards: boolean = false
  ): Promise<TwitchChannelPointReward[]> {
    let retryCount = 0
    const maxRetries = 1

    while (retryCount <= maxRetries) {
      try {
        const headers = await this.getOAuthHeaders()
        const response = await this.client.get<TwitchApiResponse<TwitchChannelPointReward>>(
          '/channel_points/custom_rewards',
          {
            headers,
            params: {
              broadcaster_id: broadcasterId,
              only_manageable_rewards: onlyManageableRewards,
            },
          }
        )

        return response.data.data
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status
          const errorData = error.response?.data
          const userToken = getTwitchAccessToken()
          const refreshToken = getTwitchRefreshToken()

          if (status === 401 && retryCount < maxRetries) {
            // 401エラーの場合、トークンを再検証してリフレッシュを試みる
            logger.warn(
              `⚠️ Received 401 error, attempting to refresh token (attempt ${retryCount + 1}/${maxRetries + 1})...`
            )

            // キャッシュをクリアして再取得を試みる
            this.userAccessToken = null
            this.userTokenExpiresAt = 0

            // リフレッシュトークンが設定されている場合は、再リフレッシュを試みる
            if (refreshToken) {
              try {
                await this.refreshUserAccessToken()
                retryCount++
                continue // リトライ
              } catch (refreshError) {
                logger.error('❌ Twitch API: トークンのリフレッシュに失敗しました', refreshError)
              }
            }

            retryCount++
            continue
          }

          if (status === 401) {
            logger.error(
              '❌ Twitch API: チャンネルポイントリワード情報の取得に失敗しました - 認証失敗 (401)\n' +
              '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
              'チャンネルポイントリワードを取得するには、OAuth認証（ユーザートークン）が必要です。\n' +
              'App Access Tokenでは使用できません。\n\n' +
              '現在の設定状態:\n' +
              `  - VITE_TWITCH_ACCESS_TOKEN: ${userToken ? '設定済み (' + userToken.substring(0, 10) + '...)' : '未設定'}\n` +
              `  - VITE_TWITCH_REFRESH_TOKEN: ${refreshToken ? '設定済み' : '未設定'}\n` +
              `  - Client ID: ${getTwitchClientId() ? '設定済み' : '未設定'}\n\n` +
              '対処方法:\n' +
              '1. VITE_TWITCH_ACCESS_TOKEN に有効なユーザートークンを設定してください\n' +
              '2. VITE_TWITCH_REFRESH_TOKEN が設定されている場合は、有効なリフレッシュトークンであることを確認してください\n' +
              '3. トークンに channel:read:redemptions スコープが含まれていることを確認してください\n' +
              '4. トークンが期限切れの場合は、新しいトークンを取得してください\n\n' +
              'ユーザートークンの取得方法:\n' +
              'https://dev.twitch.tv/docs/authentication/getting-tokens-oauth#oauth-authorization-code-flow\n' +
              '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
            )
          } else {
            logger.error(
              `❌ Twitch API: チャンネルポイントリワード情報の取得に失敗しました - HTTP ${status}\n`,
              errorData || error.message
            )
          }
        } else {
          logger.error('❌ Twitch API: チャンネルポイントリワード情報の取得に失敗しました', error)
        }
        throw error
      }
    }

    // すべてのリトライが失敗した場合（到達不可能なコード）
    throw new Error('Failed to get channel point rewards after all retries')
  }

  /**
   * チャンネルポイントリワードの引き換え履歴を取得
   * OAuth認証（ユーザートークン）必須。Client-ID は VITE_TWITCH_TOKEN_APP_CLIENT_ID（トークン用アプリ）を使用。コンソール用アプリは使用しない。
   *
   * 公式API仕様: https://dev.twitch.tv/docs/api/reference#get-custom-reward-redemption
   *
   * @param broadcasterId - ブロードキャスターのID（OAuthトークンのユーザーIDと一致する必要がある）
   * @param rewardId - カスタムリワードのID
   * @param status - リデンプションのステータス（idパラメータが指定されていない場合は必須）
   * @param limit - 1ページあたりの最大アイテム数（1-50、デフォルト20）
   * @param cursor - ページネーション用カーソル
   * @param sort - ソート順（OLDEST, NEWEST） - デフォルトはNEWEST（最新の引き換えを先に取得）
   * @param redemptionIds - 特定のリデンプションIDでフィルタ（最大50個） - この場合、statusは不要
   */
  async getChannelPointRedemptions(
    broadcasterId: string,
    rewardId: string,
    status?: 'UNFULFILLED' | 'FULFILLED' | 'CANCELED',
    limit: number = 20,
    cursor?: string,
    sort: 'OLDEST' | 'NEWEST' = 'NEWEST',
    redemptionIds?: string[]
  ): Promise<TwitchApiPaginatedResponse<TwitchChannelPointRedemption>> {
    let retryCount = 0
    const maxRetries = 1

    while (retryCount <= maxRetries) {
      try {
        const headers = await this.getOAuthHeaders()
        const params: Record<string, string | number | boolean | string[]> = {
          broadcaster_id: broadcasterId,
          reward_id: rewardId,
          first: limit,
        }

        // 公式API仕様に基づくパラメータ設定
        // idパラメータが指定されている場合はstatusは不要、指定されていない場合はstatusが必須
        if (redemptionIds && redemptionIds.length > 0) {
          // 特定のリデンプションIDでフィルタする場合
          if (redemptionIds.length > 50) {
            throw new Error('Maximum 50 redemption IDs allowed')
          }
          // 複数のidパラメータを設定（axiosが自動的に配列を処理）
          params.id = redemptionIds
        } else {
          // idパラメータが指定されていない場合はstatusが必須
          if (!status) {
            throw new Error(
              'status parameter is required when id parameter is not specified. ' +
              'Please specify status: UNFULFILLED, FULFILLED, or CANCELED'
            )
          }
          params.status = status
        }

        // ソート順を設定（デフォルトはNEWESTで最新の引き換えを先に取得）
        params.sort = sort

        if (cursor) {
          params.after = cursor
        }

        if (import.meta.env.DEV) {
          logger.debug('📊 Twitch API: チャンネルポイント引き換え履歴を取得中', {
            配信者ID: broadcasterId,
            リワードID: rewardId,
            ステータス: status || '未指定（IDフィルター使用）',
            取得件数: limit,
            ソート: sort,
            指定ID数: redemptionIds?.length || 0,
            カーソル: cursor || 'なし',
          })
        }

        const response = await this.client.get<TwitchApiPaginatedResponse<TwitchChannelPointRedemption>>(
          '/channel_points/custom_rewards/redemptions',
          {
            headers,
            params,
          }
        )

        if (import.meta.env.DEV) {
          logger.debug('✅ Twitch API: チャンネルポイント引き換え履歴を取得完了', {
            取得件数: response.data.data.length,
            追加データあり: !!response.data.pagination?.cursor,
            ソート: sort,
            ステータス: status || 'IDフィルター',
          })
        }

        return response.data
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status
          const errorData = error.response?.data
          const userToken = getTwitchAccessToken()
          const refreshToken = getTwitchRefreshToken()

          if (status === 401 && retryCount < maxRetries) {
            // 401エラーの場合、トークンを再検証してリフレッシュを試みる
            logger.warn(
              `⚠️ Received 401 error, attempting to refresh token (attempt ${retryCount + 1}/${maxRetries + 1})...`
            )

            // キャッシュをクリアして再取得を試みる
            this.userAccessToken = null
            this.userTokenExpiresAt = 0

            // リフレッシュトークンが設定されている場合は、再リフレッシュを試みる
            if (refreshToken) {
              try {
                await this.refreshUserAccessToken()
                retryCount++
                continue // リトライ
              } catch (refreshError) {
                logger.error('❌ Twitch API: トークンのリフレッシュに失敗しました', refreshError)
              }
            }

            retryCount++
            continue
          }

          if (status === 401) {
            logger.error(
              '❌ Twitch API: チャンネルポイント引き換え履歴の取得に失敗しました - 認証失敗 (401)\n' +
              '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
              'チャンネルポイントの引き換え履歴を取得するには、OAuth認証（ユーザートークン）が必要です。\n' +
              'App Access Tokenでは使用できません。\n\n' +
              '現在の設定状態:\n' +
              `  - VITE_TWITCH_ACCESS_TOKEN: ${userToken ? '設定済み (' + userToken.substring(0, 10) + '...)' : '未設定'}\n` +
              `  - VITE_TWITCH_REFRESH_TOKEN: ${refreshToken ? '設定済み' : '未設定'}\n` +
              `  - Client ID: ${getTwitchClientId() ? '設定済み' : '未設定'}\n\n` +
              '対処方法:\n' +
              '1. VITE_TWITCH_ACCESS_TOKEN に有効なユーザートークンを設定してください\n' +
              '2. VITE_TWITCH_REFRESH_TOKEN が設定されている場合は、有効なリフレッシュトークンであることを確認してください\n' +
              '3. トークンに "oauth:" プレフィックスが含まれている場合は削除してください\n' +
              '4. トークンが有効で、channel:read:redemptions スコープが含まれていることを確認してください\n' +
              '5. トークンが期限切れの場合は、新しいトークンを取得してください\n\n' +
              'ユーザートークンの取得方法:\n' +
              'https://dev.twitch.tv/docs/authentication/getting-tokens-oauth#oauth-authorization-code-flow\n' +
              '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
            )

            // トークンに "oauth:" プレフィックスが含まれている場合の警告
            if (userToken && /^oauth:/i.test(userToken)) {
              logger.warn(
                '⚠️ 警告: VITE_TWITCH_ACCESS_TOKEN に "oauth:" プレフィックスが含まれています。\n' +
                'Twitch APIでは "oauth:" プレフィックスは不要です。.env ファイルから削除してください。\n' +
                '例: oauth:xxxxx → xxxxx'
              )
            }
          } else if (status === 400) {
            // 公式API仕様に基づく400エラーの詳細メッセージ
            const errorMessage = errorData?.message || 'Bad Request'
            logger.error(
              '❌ Twitch API: チャンネルポイント引き換え履歴の取得に失敗しました - 不正なリクエスト (400)\n' +
              '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
              `エラー: ${errorMessage}\n\n` +
              '考えられる原因:\n' +
              '1. broadcaster_id パラメータが必須です\n' +
              '2. reward_id パラメータが必須です\n' +
              '3. status パラメータが必須です（idパラメータが指定されていない場合）\n' +
              '4. status パラメータの値が無効です（UNFULFILLED, FULFILLED, CANCELED のいずれかである必要があります）\n' +
              '5. sort パラメータの値が無効です（OLDEST, NEWEST のいずれかである必要があります）\n' +
              '6. first パラメータの値が範囲外です（1-50の範囲である必要があります）\n' +
              '7. id パラメータが50個を超えています（最大50個まで）\n\n' +
              '公式API仕様: https://dev.twitch.tv/docs/api/reference#get-custom-reward-redemption\n' +
              '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
            )
          } else if (status === 403) {
            logger.error(
              '❌ Twitch API: チャンネルポイント引き換え履歴の取得に失敗しました - アクセス拒否 (403)\n' +
              '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
              'このリワードへのアクセス権限がありません。\n\n' +
              '考えられる原因:\n' +
              '1. リワードIDが正しいか確認してください\n' +
              '2. OAuth認証のスコープに channel:read:redemptions が含まれているか確認してください\n' +
              '3. このリワードを作成したアプリ（Client ID）と一致しているか確認してください\n' +
              '4. ブロードキャスターがパートナーまたはアフィリエイトである必要があります\n\n' +
              '公式API仕様: https://dev.twitch.tv/docs/api/reference#get-custom-reward-redemption\n' +
              '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
            )
          } else if (status === 404) {
            logger.error(
              '❌ Twitch API: チャンネルポイント引き換え履歴の取得に失敗しました - 見つかりません (404)\n' +
              '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
              '指定されたリデンプションが見つかりませんでした。\n\n' +
              '考えられる原因:\n' +
              '1. idパラメータで指定されたリデンプションIDが存在しない\n' +
              '2. リデンプションが削除された、または期限切れになった\n\n' +
              '公式API仕様: https://dev.twitch.tv/docs/api/reference#get-custom-reward-redemption\n' +
              '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
            )
          } else {
            logger.error(
              `❌ Twitch API: チャンネルポイント引き換え履歴の取得に失敗しました - HTTP ${status}\n`,
              errorData || error.message
            )
          }
        } else {
          logger.error('❌ Twitch API: チャンネルポイント引き換え履歴の取得に失敗しました', error)
        }
        throw error
      }
    }

    // すべてのリトライが失敗した場合（到達不可能なコード）
    throw new Error('Failed to get channel point redemptions after all retries')
  }

  /**
   * チャットにメッセージを送信（配信者アカウントで送信）
   * OAuthユーザートークンが必要。sender_id はトークンのユーザーIDと一致する必要がある。
   * @param broadcasterId チャンネル所有者のユーザーID（送信先）
   * @param message 送信するメッセージ（最大500文字）
   */
  async sendChatMessage(broadcasterId: string, message: string): Promise<{ messageId?: string }> {
    try {
      const headers = await this.getOAuthHeaders()
      const body = {
        broadcaster_id: broadcasterId,
        sender_id: broadcasterId,
        message: message.slice(0, 500),
      }
      const response = await this.client.post<{ data: Array<{ message_id: string }> }>(
        '/chat/messages',
        body,
        { headers }
      )
      const messageId = response.data?.data?.[0]?.message_id
      return messageId ? { messageId } : {}
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        logger.error(
          '❌ Twitch チャット送信エラー (401)\n' +
          'チャットにメッセージを送るには OAuth トークンに user:write:chat スコープが必要です。\n' +
          'get-oauth-token.bat を再実行して新しいトークンを取得し、.env を更新してください。'
        )
      }
      throw error
    }
  }
}

// シングルトンインスタンスをエクスポート
export const twitchApi = new TwitchApiClient()

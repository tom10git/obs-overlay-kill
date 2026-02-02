/**
 * 認証情報とセキュリティ設定を管理するモジュール
 * 環境変数から認証情報を読み取り、検証を行います
 */

export interface TwitchAuthConfig {
  /** トークンジェネレーター用アプリの Client ID（TOKEN_APP 未設定時は CLIENT_ID を利用） */
  clientId: string
  /** トークンジェネレーター用アプリの Client Secret（TOKEN_APP 未設定時は CLIENT_SECRET を利用） */
  clientSecret: string
  /** Twitch 公式トークンジェネレーターでトークン取得に使ったアプリの Client ID（任意・設定時は getClientId がこれを返す） */
  tokenAppClientId?: string
  /** トークンジェネレーター用アプリの Client Secret（任意） */
  tokenAppClientSecret?: string
  /** Twitch Developers で「コンソール」用に作成したアプリの Client ID（任意・ユーザー検索で使用） */
  consoleClientId?: string
  /** コンソール用アプリの Client Secret（任意・ユーザー検索でコンソールアプリを使う場合に必要） */
  consoleClientSecret?: string
  accessToken?: string
  refreshToken?: string
  username?: string
}

export interface AuthConfig {
  twitch: TwitchAuthConfig
}

/**
 * 環境変数から認証情報を読み取り、検証を行う
 */
class AuthConfigManager {
  private config: AuthConfig | null = null
  private initialized = false

  /**
   * 認証情報を初期化
   */
  initialize(): AuthConfig {
    if (this.config && this.initialized) {
      return this.config
    }

    const twitchClientId = import.meta.env.VITE_TWITCH_CLIENT_ID?.trim()
    const twitchClientSecret = import.meta.env.VITE_TWITCH_CLIENT_SECRET?.trim()
    const twitchTokenAppClientId = import.meta.env.VITE_TWITCH_TOKEN_APP_CLIENT_ID?.trim()
    const twitchTokenAppClientSecret = import.meta.env.VITE_TWITCH_TOKEN_APP_CLIENT_SECRET?.trim()
    const twitchConsoleClientId = import.meta.env.VITE_TWITCH_CONSOLE_CLIENT_ID?.trim()
    const twitchConsoleClientSecret = import.meta.env.VITE_TWITCH_CONSOLE_CLIENT_SECRET?.trim()
    const twitchAccessToken = import.meta.env.VITE_TWITCH_ACCESS_TOKEN?.trim()
    const twitchRefreshToken = import.meta.env.VITE_TWITCH_REFRESH_TOKEN?.trim()
    const twitchUsername = import.meta.env.VITE_TWITCH_USERNAME?.trim()

    // トークンジェネレーター用: TOKEN_APP_* または CLIENT_ID/SECRET のいずれか必須
    const tokenAppId = twitchTokenAppClientId || twitchClientId
    const tokenAppSecret = twitchTokenAppClientSecret || twitchClientSecret
    if (!tokenAppId || !tokenAppSecret) {
      throw new Error(
        'トークンジェネレーター用の認証情報を設定してください。\n' +
        '次のいずれかを .env に設定:\n' +
        '  VITE_TWITCH_TOKEN_APP_CLIENT_ID と VITE_TWITCH_TOKEN_APP_CLIENT_SECRET（公式トークンジェネレーターで使ったアプリ）\n' +
        '  または VITE_TWITCH_CLIENT_ID と VITE_TWITCH_CLIENT_SECRET\n' +
        '取得先: https://dev.twitch.tv/console/apps / https://twitchtokengenerator.com/'
      )
    }

    // Client IDの形式検証（トークン用アプリ）
    if (tokenAppId.length < 20 || /^[a-z_]+$/.test(tokenAppId)) {
      console.warn(
        `⚠️ Warning: トークン用 Client ID="${tokenAppId}" looks invalid.\n` +
        `Twitch Client IDs are typically 30+ character alphanumeric strings.\n` +
        `Get your Client ID from: https://dev.twitch.tv/console/apps`
      )
    }

    if (tokenAppSecret.length < 20) {
      console.warn(
        `⚠️ Warning: トークン用 Client Secret looks invalid.\n` +
        `Twitch Client Secrets are typically 30+ character alphanumeric strings.\n` +
        `Please check your .env file.`
      )
    }

    // リフレッシュトークンの形式検証（通常30文字以上の英数字）
    if (twitchRefreshToken && twitchRefreshToken.length < 20) {
      console.warn(
        `⚠️ Warning: VITE_TWITCH_REFRESH_TOKEN looks invalid.\n` +
        `Twitch Refresh Tokens are typically 30+ character alphanumeric strings.\n` +
        `Please check your .env file.`
      )
    }

    // リフレッシュトークンに "oauth:" プレフィックスが含まれている場合の警告
    if (twitchRefreshToken && /^oauth:/i.test(twitchRefreshToken)) {
      console.warn(
        `⚠️ Warning: VITE_TWITCH_REFRESH_TOKEN contains "oauth:" prefix.\n` +
        `Twitch API does not require "oauth:" prefix. Please remove it from your .env file.\n` +
        `Example: oauth:xxxxx → xxxxx`
      )
    }

    this.config = {
      twitch: {
        clientId: twitchClientId || '',
        clientSecret: twitchClientSecret || '',
        tokenAppClientId: twitchTokenAppClientId || undefined,
        tokenAppClientSecret: twitchTokenAppClientSecret || undefined,
        consoleClientId: twitchConsoleClientId || undefined,
        consoleClientSecret: twitchConsoleClientSecret || undefined,
        accessToken: twitchAccessToken,
        refreshToken: twitchRefreshToken,
        username: twitchUsername,
      },
    }

    this.initialized = true
    return this.config
  }

  /**
   * Twitch認証情報を取得
   */
  getTwitchConfig(): TwitchAuthConfig {
    if (!this.config) {
      this.initialize()
    }
    return this.config!.twitch
  }

  /**
   * トークンジェネレーター用アプリの Client ID を取得
   * VITE_TWITCH_TOKEN_APP_CLIENT_ID が設定されていればその値、なければ VITE_TWITCH_CLIENT_ID
   */
  getClientId(): string {
    const c = this.getTwitchConfig()
    return c.tokenAppClientId || c.clientId
  }

  /**
   * トークンジェネレーター用アプリの Client Secret を取得
   * VITE_TWITCH_TOKEN_APP_CLIENT_SECRET が設定されていればその値、なければ VITE_TWITCH_CLIENT_SECRET
   */
  getClientSecret(): string {
    const c = this.getTwitchConfig()
    return c.tokenAppClientSecret || c.clientSecret
  }

  /**
   * コンソール用アプリの Client ID を取得（オプション）
   * ユーザー検索などで使用。VITE_TWITCH_CONSOLE_CLIENT_ID が設定されていればその値
   */
  getConsoleClientId(): string | undefined {
    return this.getTwitchConfig().consoleClientId
  }

  /**
   * コンソール用アプリの Client Secret を取得（オプション）
   * ユーザー検索でコンソールアプリの App Access Token 取得時に使用
   */
  getConsoleClientSecret(): string | undefined {
    return this.getTwitchConfig().consoleClientSecret
  }

  /** localStorage のキー（アプリ内OAuthで取得したトークンを保存） */
  private static readonly STORAGE_ACCESS = 'twitch_oauth_access_token'
  private static readonly STORAGE_REFRESH = 'twitch_oauth_refresh_token'

  /**
   * Access Tokenを取得（オプション）
   * アプリ内OAuthで保存したトークンがあれば優先、なければ .env の値
   */
  getAccessToken(): string | undefined {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(AuthConfigManager.STORAGE_ACCESS)?.trim()
      if (stored) return stored
    }
    return this.getTwitchConfig().accessToken
  }

  /**
   * Refresh Tokenを取得（オプション）
   * アプリ内OAuthで保存したトークンがあれば優先、なければ .env の値
   */
  getRefreshToken(): string | undefined {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(AuthConfigManager.STORAGE_REFRESH)?.trim()
      if (stored) return stored
    }
    return this.getTwitchConfig().refreshToken
  }

  /**
   * アプリ内OAuthで取得したトークンを localStorage に保存する
   */
  setTwitchOAuthTokens(accessToken: string, refreshToken: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AuthConfigManager.STORAGE_ACCESS, accessToken)
      localStorage.setItem(AuthConfigManager.STORAGE_REFRESH, refreshToken)
    }
  }

  /**
   * ユーザー名を取得（オプション）
   */
  getUsername(): string | undefined {
    return this.getTwitchConfig().username
  }

  /**
   * 認証情報が設定されているか確認
   */
  isConfigured(): boolean {
    try {
      this.initialize()
      return true
    } catch {
      return false
    }
  }

  /**
   * 認証情報をリセット（テスト用）
   */
  reset(): void {
    this.config = null
    this.initialized = false
  }
}

// シングルトンインスタンスをエクスポート
export const authConfig = new AuthConfigManager()

// 便利な関数をエクスポート
export const getTwitchClientId = () => authConfig.getClientId()
export const getTwitchClientSecret = () => authConfig.getClientSecret()
export const getTwitchConsoleClientId = () => authConfig.getConsoleClientId()
export const getTwitchConsoleClientSecret = () => authConfig.getConsoleClientSecret()
export const getTwitchAccessToken = () => authConfig.getAccessToken()
export const getTwitchRefreshToken = () => authConfig.getRefreshToken()
export const getTwitchUsername = () => authConfig.getUsername()
export const isAuthConfigured = () => authConfig.isConfigured()
export const setTwitchOAuthTokens = (accessToken: string, refreshToken: string) =>
  authConfig.setTwitchOAuthTokens(accessToken, refreshToken)

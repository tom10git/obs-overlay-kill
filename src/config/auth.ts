/**
 * 認証情報とセキュリティ設定を管理するモジュール
 * 環境変数から認証情報を読み取り、検証を行います
 */

export interface TwitchAuthConfig {
  clientId: string
  clientSecret: string
  accessToken?: string
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

    const twitchClientId = import.meta.env.VITE_TWITCH_CLIENT_ID
    const twitchClientSecret = import.meta.env.VITE_TWITCH_CLIENT_SECRET
    const twitchAccessToken = import.meta.env.VITE_TWITCH_ACCESS_TOKEN
    const twitchUsername = import.meta.env.VITE_TWITCH_USERNAME

    // 必須項目の検証
    if (!twitchClientId) {
      throw new Error(
        'VITE_TWITCH_CLIENT_ID is not set. Please set it in your .env file.'
      )
    }

    if (!twitchClientSecret) {
      throw new Error(
        'VITE_TWITCH_CLIENT_SECRET is not set. Please set it in your .env file.'
      )
    }

    this.config = {
      twitch: {
        clientId: twitchClientId,
        clientSecret: twitchClientSecret,
        accessToken: twitchAccessToken,
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
   * Client IDを取得
   */
  getClientId(): string {
    return this.getTwitchConfig().clientId
  }

  /**
   * Client Secretを取得
   */
  getClientSecret(): string {
    return this.getTwitchConfig().clientSecret
  }

  /**
   * Access Tokenを取得（オプション）
   */
  getAccessToken(): string | undefined {
    return this.getTwitchConfig().accessToken
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
export const getTwitchAccessToken = () => authConfig.getAccessToken()
export const getTwitchUsername = () => authConfig.getUsername()
export const isAuthConfigured = () => authConfig.isConfigured()

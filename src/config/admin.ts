/**
 * 管理者側の設定情報を一元管理するモジュール
 * このファイルに管理者が設定するすべての情報を集約します
 */

import { getTwitchClientId, getTwitchClientSecret, getTwitchAccessToken, getTwitchUsername } from './auth'

/**
 * 管理者設定情報の型定義
 */
export interface AdminConfig {
  // Twitch API認証情報
  twitch: {
    clientId: string
    clientSecret: string
    accessToken?: string
    username?: string
  }

  // アプリケーション設定
  app: {
    defaultChannel?: string
    autoRefreshInterval?: number // 秒単位
    maxChatMessages?: number
  }
}

/**
 * 管理者設定情報を取得するクラス
 */
class AdminConfigManager {
  private config: AdminConfig | null = null

  /**
   * 管理者設定情報を初期化
   */
  initialize(): AdminConfig {
    if (this.config) {
      return this.config
    }

    this.config = {
      twitch: {
        clientId: getTwitchClientId(),
        clientSecret: getTwitchClientSecret(),
        accessToken: getTwitchAccessToken(),
        username: getTwitchUsername(),
      },
      app: {
        defaultChannel: import.meta.env.VITE_DEFAULT_CHANNEL,
        autoRefreshInterval: import.meta.env.VITE_AUTO_REFRESH_INTERVAL
          ? parseInt(import.meta.env.VITE_AUTO_REFRESH_INTERVAL, 10)
          : 30, // デフォルト30秒
        maxChatMessages: import.meta.env.VITE_MAX_CHAT_MESSAGES
          ? parseInt(import.meta.env.VITE_MAX_CHAT_MESSAGES, 10)
          : 100, // デフォルト100件
      },
    }

    return this.config
  }

  /**
   * 管理者設定情報を取得
   */
  getConfig(): AdminConfig {
    if (!this.config) {
      this.initialize()
    }
    return this.config!
  }

  /**
   * Twitch認証情報を取得
   */
  getTwitchConfig() {
    return this.getConfig().twitch
  }

  /**
   * アプリケーション設定を取得
   */
  getAppConfig() {
    return this.getConfig().app
  }

  /**
   * 設定をリセット（テスト用）
   */
  reset(): void {
    this.config = null
  }
}

// シングルトンインスタンスをエクスポート
export const adminConfig = new AdminConfigManager()

// ============================================
// 管理者設定情報の取得関数（便利な関数）
// ============================================

/**
 * Twitch Client IDを取得
 */
export const getAdminClientId = () => adminConfig.getTwitchConfig().clientId

/**
 * Twitch Client Secretを取得
 */
export const getAdminClientSecret = () => adminConfig.getTwitchConfig().clientSecret

/**
 * Twitch Access Tokenを取得（オプション）
 */
export const getAdminAccessToken = () => adminConfig.getTwitchConfig().accessToken

/**
 * デフォルトのTwitchユーザー名を取得
 */
export const getAdminUsername = () => adminConfig.getTwitchConfig().username

/**
 * デフォルトチャンネルを取得
 */
export const getDefaultChannel = () => adminConfig.getAppConfig().defaultChannel

/**
 * 自動更新間隔を取得（秒単位）
 */
export const getAutoRefreshInterval = () => adminConfig.getAppConfig().autoRefreshInterval || 30

/**
 * チャットメッセージの最大表示数を取得
 */
export const getMaxChatMessages = () => adminConfig.getAppConfig().maxChatMessages || 100

/**
 * すべての管理者設定情報を取得
 */
export const getAllAdminConfig = () => adminConfig.getConfig()

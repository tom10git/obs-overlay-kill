import axios, { AxiosInstance } from 'axios'
import { getTwitchClientId, getTwitchClientSecret } from '../config/auth'
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
      console.error('Failed to get Twitch access token:', error)
      throw error
    }
  }

  /**
   * APIリクエスト用のヘッダーを取得
   */
  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getAppAccessToken()
    return {
      'Client-ID': getTwitchClientId(),
      Authorization: `Bearer ${token}`,
    }
  }

  /**
   * ユーザー情報を取得
   */
  async getUser(login: string): Promise<TwitchUser | null> {
    try {
      const headers = await this.getHeaders()
      const response = await this.client.get<TwitchApiResponse<TwitchUser>>(
        '/users',
        {
          headers,
          params: { login },
        }
      )

      return response.data.data[0] || null
    } catch (error) {
      console.error('Failed to get Twitch user:', error)
      throw error
    }
  }

  /**
   * 複数のユーザー情報を取得
   */
  async getUsers(logins: string[]): Promise<TwitchUser[]> {
    try {
      const headers = await this.getHeaders()
      const response = await this.client.get<TwitchApiResponse<TwitchUser>>(
        '/users',
        {
          headers,
          params: { login: logins },
        }
      )

      return response.data.data
    } catch (error) {
      console.error('Failed to get Twitch users:', error)
      throw error
    }
  }

  /**
   * ストリーム情報を取得
   */
  async getStream(userLogin: string): Promise<TwitchStream | null> {
    try {
      const headers = await this.getHeaders()
      const response = await this.client.get<TwitchApiResponse<TwitchStream>>(
        '/streams',
        {
          headers,
          params: { user_login: userLogin },
        }
      )

      return response.data.data[0] || null
    } catch (error) {
      console.error('Failed to get Twitch stream:', error)
      throw error
    }
  }

  /**
   * 複数のストリーム情報を取得
   */
  async getStreams(userLogins: string[]): Promise<TwitchStream[]> {
    try {
      const headers = await this.getHeaders()
      const response = await this.client.get<TwitchApiResponse<TwitchStream>>(
        '/streams',
        {
          headers,
          params: { user_login: userLogins },
        }
      )

      return response.data.data
    } catch (error) {
      console.error('Failed to get Twitch streams:', error)
      throw error
    }
  }

  /**
   * ゲーム情報を取得
   */
  async getGame(gameId: string): Promise<TwitchGame | null> {
    try {
      const headers = await this.getHeaders()
      const response = await this.client.get<TwitchApiResponse<TwitchGame>>(
        '/games',
        {
          headers,
          params: { id: gameId },
        }
      )

      return response.data.data[0] || null
    } catch (error) {
      console.error('Failed to get Twitch game:', error)
      throw error
    }
  }

  /**
   * チャンネル情報を取得
   */
  async getChannel(broadcasterId: string): Promise<TwitchChannel | null> {
    try {
      const headers = await this.getHeaders()
      const response = await this.client.get<TwitchApiResponse<TwitchChannel>>(
        '/channels',
        {
          headers,
          params: { broadcaster_id: broadcasterId },
        }
      )

      return response.data.data[0] || null
    } catch (error) {
      console.error('Failed to get Twitch channel:', error)
      throw error
    }
  }

  /**
   * チャンネル情報を取得（ユーザーIDから）
   */
  async getChannelByUserId(userId: string): Promise<TwitchChannelInformation | null> {
    try {
      const headers = await this.getHeaders()
      const response = await this.client.get<TwitchApiResponse<TwitchChannelInformation>>(
        '/channels',
        {
          headers,
          params: { broadcaster_id: userId },
        }
      )

      return response.data.data[0] || null
    } catch (error) {
      console.error('Failed to get Twitch channel:', error)
      throw error
    }
  }

  /**
   * ビデオ情報を取得
   */
  async getVideos(
    userId: string,
    limit: number = 20,
    cursor?: string
  ): Promise<TwitchApiPaginatedResponse<TwitchVideo>> {
    try {
      const headers = await this.getHeaders()
      const params: Record<string, string | number> = {
        user_id: userId,
        first: limit,
      }
      if (cursor) {
        params.after = cursor
      }

      const response = await this.client.get<TwitchApiPaginatedResponse<TwitchVideo>>(
        '/videos',
        {
          headers,
          params,
        }
      )

      return response.data
    } catch (error) {
      console.error('Failed to get Twitch videos:', error)
      throw error
    }
  }

  /**
   * クリップ情報を取得
   */
  async getClips(
    broadcasterId: string,
    limit: number = 20,
    cursor?: string
  ): Promise<TwitchApiPaginatedResponse<TwitchClip>> {
    try {
      const headers = await this.getHeaders()
      const params: Record<string, string | number> = {
        broadcaster_id: broadcasterId,
        first: limit,
      }
      if (cursor) {
        params.after = cursor
      }

      const response = await this.client.get<TwitchApiPaginatedResponse<TwitchClip>>(
        '/clips',
        {
          headers,
          params,
        }
      )

      return response.data
    } catch (error) {
      console.error('Failed to get Twitch clips:', error)
      throw error
    }
  }

  /**
   * エモート情報を取得
   */
  async getEmotes(broadcasterId: string): Promise<TwitchEmote[]> {
    try {
      const headers = await this.getHeaders()
      const response = await this.client.get<TwitchApiResponse<TwitchEmote>>(
        '/chat/emotes',
        {
          headers,
          params: { broadcaster_id: broadcasterId },
        }
      )

      return response.data.data
    } catch (error) {
      console.error('Failed to get Twitch emotes:', error)
      throw error
    }
  }

  /**
   * グローバルエモート情報を取得
   */
  async getGlobalEmotes(): Promise<TwitchEmote[]> {
    try {
      const headers = await this.getHeaders()
      const response = await this.client.get<TwitchApiResponse<TwitchEmote>>(
        '/chat/emotes/global',
        {
          headers,
        }
      )

      return response.data.data
    } catch (error) {
      console.error('Failed to get Twitch global emotes:', error)
      throw error
    }
  }

  /**
   * フォロワー情報を取得
   */
  async getFollowers(
    broadcasterId: string,
    limit: number = 20,
    cursor?: string
  ): Promise<TwitchFollowerResponse> {
    try {
      const headers = await this.getHeaders()
      const params: Record<string, string | number> = {
        broadcaster_id: broadcasterId,
        first: limit,
      }
      if (cursor) {
        params.after = cursor
      }

      const response = await this.client.get<TwitchFollowerResponse>(
        '/channels/followers',
        {
          headers,
          params,
        }
      )

      return response.data
    } catch (error) {
      console.error('Failed to get Twitch followers:', error)
      throw error
    }
  }

  /**
   * チャットバッジ情報を取得
   */
  async getChatBadges(broadcasterId: string): Promise<TwitchChatBadge[]> {
    try {
      const headers = await this.getHeaders()
      const response = await this.client.get<TwitchApiResponse<TwitchChatBadge>>(
        '/chat/badges',
        {
          headers,
          params: { broadcaster_id: broadcasterId },
        }
      )

      return response.data.data
    } catch (error) {
      console.error('Failed to get Twitch chat badges:', error)
      throw error
    }
  }

  /**
   * グローバルチャットバッジ情報を取得
   */
  async getGlobalChatBadges(): Promise<TwitchChatBadge[]> {
    try {
      const headers = await this.getHeaders()
      const response = await this.client.get<TwitchApiResponse<TwitchChatBadge>>(
        '/chat/badges/global',
        {
          headers,
        }
      )

      return response.data.data
    } catch (error) {
      console.error('Failed to get Twitch global chat badges:', error)
      throw error
    }
  }

  /**
   * チャンネルポイントリワード一覧を取得
   * 注意: このメソッドはOAuth認証（ユーザートークン）が必要です
   * App Access Tokenでは使用できません
   */
  async getChannelPointRewards(
    broadcasterId: string,
    onlyManageableRewards: boolean = false
  ): Promise<TwitchChannelPointReward[]> {
    try {
      const headers = await this.getHeaders()
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
      console.error('Failed to get Twitch channel point rewards:', error)
      throw error
    }
  }

  /**
   * チャンネルポイントリワードの引き換え履歴を取得
   * 注意: このメソッドはOAuth認証（ユーザートークン）が必要です
   * App Access Tokenでは使用できません
   */
  async getChannelPointRedemptions(
    broadcasterId: string,
    rewardId: string,
    status?: 'UNFULFILLED' | 'FULFILLED' | 'CANCELED',
    limit: number = 20,
    cursor?: string
  ): Promise<TwitchApiPaginatedResponse<TwitchChannelPointRedemption>> {
    try {
      const headers = await this.getHeaders()
      const params: Record<string, string | number | boolean> = {
        broadcaster_id: broadcasterId,
        reward_id: rewardId,
        first: limit,
      }
      if (status) {
        params.status = status
      }
      if (cursor) {
        params.after = cursor
      }

      const response = await this.client.get<TwitchApiPaginatedResponse<TwitchChannelPointRedemption>>(
        '/channel_points/custom_rewards/redemptions',
        {
          headers,
          params,
        }
      )

      return response.data
    } catch (error) {
      console.error('Failed to get Twitch channel point redemptions:', error)
      throw error
    }
  }
}

// シングルトンインスタンスをエクスポート
export const twitchApi = new TwitchApiClient()

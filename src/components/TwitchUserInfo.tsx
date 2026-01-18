import { useTwitchUser } from '../hooks/useTwitchUser'
import './TwitchUserInfo.css'

interface TwitchUserInfoProps {
  login: string
}

export function TwitchUserInfo({ login }: TwitchUserInfoProps) {
  const { user, loading, error, refetch } = useTwitchUser(login)

  if (loading) {
    return <div className="twitch-user-info loading">読み込み中...</div>
  }

  if (error) {
    return (
      <div className="twitch-user-info error">
        <p>エラーが発生しました: {error.message}</p>
        <button onClick={refetch}>再試行</button>
      </div>
    )
  }

  if (!user) {
    return <div className="twitch-user-info">ユーザーが見つかりませんでした</div>
  }

  return (
    <div className="twitch-user-info">
      <div className="user-header">
        {user.profile_image_url && (
          <img
            src={user.profile_image_url}
            alt={user.display_name}
            className="profile-image"
          />
        )}
        <div className="user-details">
          <h2>{user.display_name}</h2>
          <p className="user-login">@{user.login}</p>
          {user.description && (
            <p className="user-description">{user.description}</p>
          )}
        </div>
      </div>
      <div className="user-stats">
        <div className="stat">
          <span className="stat-label">総視聴回数:</span>
          <span className="stat-value">
            {user.view_count.toLocaleString()}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">作成日:</span>
          <span className="stat-value">
            {new Date(user.created_at).toLocaleDateString('ja-JP')}
          </span>
        </div>
      </div>
    </div>
  )
}

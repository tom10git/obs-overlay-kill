import { useTwitchUser } from '../hooks/useTwitchUser'
import { useTwitchVideos } from '../hooks/useTwitchVideos'
import { useTwitchClips } from '../hooks/useTwitchClips'
import './TwitchUserInfo.css'

interface TwitchUserInfoProps {
  login: string
}

export function TwitchUserInfo({ login }: TwitchUserInfoProps) {
  const { user, loading, error, refetch } = useTwitchUser(login)
  const { videos, loading: videosLoading } = useTwitchVideos(user?.id || '', 1)
  // クリップ数は最大100件まで取得（総数はAPIで直接取得できないため）
  const { clips, loading: clipsLoading } = useTwitchClips(user?.id || '', 100)

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
        <div className="stat">
          <span className="stat-label">最終配信日:</span>
          <span className="stat-value">
            {videosLoading ? (
              '読み込み中...'
            ) : videos.length > 0 ? (
              new Date(videos[0].created_at).toLocaleDateString('ja-JP')
            ) : (
              'なし'
            )}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">総クリップ数:</span>
          <span className="stat-value">
            {clipsLoading ? (
              '読み込み中...'
            ) : clips.length > 0 ? (
              clips.length >= 100 ? `${clips.length}+` : clips.length.toString()
            ) : (
              '0'
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

import { useTwitchFollowers } from '../hooks/useTwitchFollowers'
import './TwitchFollowers.css'

interface TwitchFollowersProps {
  broadcasterId: string
  limit?: number
}

export function TwitchFollowers({ broadcasterId, limit = 20 }: TwitchFollowersProps) {
  const { followers, total, loading, error, hasMore, loadMore, refetch } =
    useTwitchFollowers(broadcasterId, limit)

  if (loading && followers.length === 0) {
    return <div className="twitch-followers loading">読み込み中...</div>
  }

  if (error) {
    return (
      <div className="twitch-followers error">
        <p>エラーが発生しました: {error.message}</p>
        <button onClick={refetch}>再試行</button>
      </div>
    )
  }

  return (
    <div className="twitch-followers">
      <h3>フォロワー ({total.toLocaleString()}人)</h3>
      {followers.length > 0 && (
        <>
          <div className="followers-list">
            {followers.map((follower) => (
              <div key={follower.user_id} className="follower-item">
                <div className="follower-info">
                  <span className="follower-name">{follower.user_name}</span>
                  <span className="follower-login">@{follower.user_login}</span>
                </div>
                <div className="follower-date">
                  {new Date(follower.followed_at).toLocaleDateString('ja-JP')}
                </div>
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="load-more-container">
              <button
                onClick={loadMore}
                disabled={loading}
                className="load-more-button"
              >
                {loading ? '読み込み中...' : 'もっと見る'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

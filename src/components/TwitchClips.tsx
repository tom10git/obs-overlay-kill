import { useTwitchClips } from '../hooks/useTwitchClips'
import './TwitchClips.css'

interface TwitchClipsProps {
  broadcasterId: string
  limit?: number
}

export function TwitchClips({ broadcasterId, limit = 20 }: TwitchClipsProps) {
  const { clips, loading, error, hasMore, loadMore, refetch } = useTwitchClips(broadcasterId, limit)

  if (loading && clips.length === 0) {
    return <div className="twitch-clips loading">読み込み中...</div>
  }

  if (error) {
    return (
      <div className="twitch-clips error">
        <p>エラーが発生しました: {error.message}</p>
        <button onClick={refetch}>再試行</button>
      </div>
    )
  }

  if (clips.length === 0) {
    return <div className="twitch-clips">クリップが見つかりませんでした</div>
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="twitch-clips">
      <h3>クリップ ({clips.length}件)</h3>
      <div className="clips-grid">
        {clips.map((clip) => (
          <div key={clip.id} className="clip-card">
            <a
              href={clip.url}
              target="_blank"
              rel="noopener noreferrer"
              className="clip-link"
            >
              <div className="clip-thumbnail">
                <img src={clip.thumbnail_url} alt={clip.title} />
                <div className="clip-duration">{formatDuration(clip.duration)}</div>
                <div className="clip-play-icon">▶</div>
              </div>
              <div className="clip-info">
                <h4 className="clip-title">{clip.title}</h4>
                <div className="clip-meta">
                  <span className="clip-views">
                    {clip.view_count.toLocaleString()} 回視聴
                  </span>
                  <span className="clip-date">
                    {new Date(clip.created_at).toLocaleDateString('ja-JP')}
                  </span>
                </div>
              </div>
            </a>
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
    </div>
  )
}

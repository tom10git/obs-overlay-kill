import { useTwitchVideos } from '../hooks/useTwitchVideos'
import './TwitchVideos.css'

interface TwitchVideosProps {
  userId: string
  limit?: number
}

export function TwitchVideos({ userId, limit = 20 }: TwitchVideosProps) {
  const { videos, loading, error, hasMore, loadMore, refetch } = useTwitchVideos(userId, limit)

  if (loading && videos.length === 0) {
    return <div className="twitch-videos loading">読み込み中...</div>
  }

  if (error) {
    return (
      <div className="twitch-videos error">
        <p>エラーが発生しました: {error.message}</p>
        <button onClick={refetch}>再試行</button>
      </div>
    )
  }

  if (videos.length === 0) {
    return <div className="twitch-videos">ビデオが見つかりませんでした</div>
  }

  const formatDuration = (duration: string) => {
    const match = duration.match(/^(\d+)h(\d+)m(\d+)s$/)
    if (match) {
      const [, hours, minutes, seconds] = match
      return `${hours}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`
    }
    return duration
  }

  return (
    <div className="twitch-videos">
      <h3>過去の配信 ({videos.length}件)</h3>
      <div className="videos-grid">
        {videos.map((video) => (
          <div key={video.id} className="video-card">
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="video-link"
            >
              <div className="video-thumbnail">
                <img
                  src={video.thumbnail_url.replace('%{width}', '320').replace('%{height}', '180')}
                  alt={video.title}
                />
                <div className="video-duration">{formatDuration(video.duration)}</div>
              </div>
              <div className="video-info">
                <h4 className="video-title">{video.title}</h4>
                <div className="video-meta">
                  <span className="video-views">
                    {video.view_count.toLocaleString()} 回視聴
                  </span>
                  <span className="video-date">
                    {new Date(video.created_at).toLocaleDateString('ja-JP')}
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

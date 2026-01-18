import { useTwitchStream } from '../hooks/useTwitchStream'
import { getAutoRefreshInterval } from '../config/admin'
import './TwitchStreamStatus.css'

interface TwitchStreamStatusProps {
  userLogin: string
}

export function TwitchStreamStatus({ userLogin }: TwitchStreamStatusProps) {
  // 管理者設定から自動更新間隔を取得（useTwitchStream内で使用される）
  const { stream, loading, error, isLive, refetch } = useTwitchStream(userLogin)

  if (loading) {
    return <div className="twitch-stream-status loading">読み込み中...</div>
  }

  if (error) {
    return (
      <div className="twitch-stream-status error">
        <p>エラーが発生しました: {error.message}</p>
        <button onClick={refetch}>再試行</button>
      </div>
    )
  }

  if (!isLive || !stream) {
    return (
      <div className="twitch-stream-status offline">
        <div className="status-indicator offline">オフライン</div>
        <p>現在配信していません</p>
      </div>
    )
  }

  return (
    <div className="twitch-stream-status online">
      <div className="status-indicator online">配信中</div>
      <div className="stream-info">
        <h3>{stream.title}</h3>
        <div className="stream-details">
          <div className="detail-item">
            <span className="detail-label">ゲーム:</span>
            <span className="detail-value">{stream.game_name || 'なし'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">視聴者数:</span>
            <span className="detail-value">
              {stream.viewer_count.toLocaleString()}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">開始時刻:</span>
            <span className="detail-value">
              {new Date(stream.started_at).toLocaleString('ja-JP')}
            </span>
          </div>
        </div>
        {stream.thumbnail_url && (
          <div className="stream-thumbnail">
            <img
              src={stream.thumbnail_url.replace('{width}', '320').replace('{height}', '180')}
              alt="Stream thumbnail"
            />
          </div>
        )}
      </div>
    </div>
  )
}

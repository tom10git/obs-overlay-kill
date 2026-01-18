import { useTwitchChannel } from '../hooks/useTwitchChannel'
import './TwitchChannelInfo.css'

interface TwitchChannelInfoProps {
  userId: string
}

export function TwitchChannelInfo({ userId }: TwitchChannelInfoProps) {
  const { channel, loading, error, refetch } = useTwitchChannel(userId)

  if (loading) {
    return <div className="twitch-channel-info loading">読み込み中...</div>
  }

  if (error) {
    return (
      <div className="twitch-channel-info error">
        <p>エラーが発生しました: {error.message}</p>
        <button onClick={refetch}>再試行</button>
      </div>
    )
  }

  if (!channel) {
    return <div className="twitch-channel-info">チャンネル情報が見つかりませんでした</div>
  }

  return (
    <div className="twitch-channel-info">
      <h3>チャンネル情報</h3>
      <div className="channel-details">
        <div className="detail-row">
          <span className="detail-label">タイトル:</span>
          <span className="detail-value">{channel.title || '未設定'}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">ゲーム:</span>
          <span className="detail-value">{channel.game_name || '未設定'}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">言語:</span>
          <span className="detail-value">{channel.broadcaster_language || '未設定'}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">配信者名:</span>
          <span className="detail-value">{channel.broadcaster_name}</span>
        </div>
      </div>
    </div>
  )
}

import { useTwitchChatBadges } from '../hooks/useTwitchChatBadges'
import './TwitchChatBadges.css'

interface TwitchChatBadgesProps {
  broadcasterId: string
}

export function TwitchChatBadges({ broadcasterId }: TwitchChatBadgesProps) {
  const { badges, loading, error, refetch } = useTwitchChatBadges(broadcasterId)

  if (loading) {
    return <div className="twitch-chat-badges loading">読み込み中...</div>
  }

  if (error) {
    return (
      <div className="twitch-chat-badges error">
        <p>エラーが発生しました: {error.message}</p>
        <button onClick={refetch}>再試行</button>
      </div>
    )
  }

  if (badges.length === 0) {
    return <div className="twitch-chat-badges">チャットバッジが見つかりませんでした</div>
  }

  return (
    <div className="twitch-chat-badges">
      <h3>チャットバッジ ({badges.length}セット)</h3>
      <div className="badges-list">
        {badges.map((badge) => (
          <div key={badge.set_id} className="badge-set">
            <h4 className="badge-set-title">セット ID: {badge.set_id}</h4>
            <div className="badge-versions">
              {badge.versions.map((version) => (
                <div key={version.id} className="badge-item">
                  <img
                    src={version.image_url_4x}
                    alt={version.title || version.id}
                    className="badge-image"
                    title={version.title || version.description}
                  />
                  <div className="badge-info">
                    {version.title && (
                      <div className="badge-title">{version.title}</div>
                    )}
                    {version.description && (
                      <div className="badge-description">{version.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

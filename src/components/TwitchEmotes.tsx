import { useTwitchEmotes } from '../hooks/useTwitchEmotes'
import './TwitchEmotes.css'

interface TwitchEmotesProps {
  broadcasterId: string
}

export function TwitchEmotes({ broadcasterId }: TwitchEmotesProps) {
  const { emotes, loading, error, refetch } = useTwitchEmotes(broadcasterId)

  if (loading) {
    return <div className="twitch-emotes loading">読み込み中...</div>
  }

  if (error) {
    return (
      <div className="twitch-emotes error">
        <p>エラーが発生しました: {error.message}</p>
        <button onClick={refetch}>再試行</button>
      </div>
    )
  }

  if (emotes.length === 0) {
    return <div className="twitch-emotes">エモートが見つかりませんでした</div>
  }

  return (
    <div className="twitch-emotes">
      <h3>チャンネルエモート ({emotes.length}件)</h3>
      <div className="emotes-grid">
        {emotes.map((emote) => (
          <div key={emote.id} className="emote-item">
            <img
              src={emote.images.url_4x}
              alt={emote.name}
              className="emote-image"
              title={emote.name}
            />
            <div className="emote-name">{emote.name}</div>
            {emote.tier && (
              <div className="emote-tier">Tier {emote.tier}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

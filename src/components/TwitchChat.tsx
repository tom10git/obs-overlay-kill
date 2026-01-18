import { useTwitchChat } from '../hooks/useTwitchChat'
import { getMaxChatMessages } from '../config/admin'
import './TwitchChat.css'

interface TwitchChatProps {
  channel: string
  maxMessages?: number
}

export function TwitchChat({ channel, maxMessages }: TwitchChatProps) {
  // 管理者設定からデフォルト値を取得
  const defaultMaxMessages = maxMessages ?? getMaxChatMessages()
  const { messages, isConnected, error, connect, disconnect, clearMessages } =
    useTwitchChat(channel, defaultMaxMessages)

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="twitch-chat">
      <div className="chat-header">
        <h3>チャット ({messages.length}件)</h3>
        <div className="chat-controls">
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '接続中' : '切断中'}
          </div>
          {isConnected ? (
            <button onClick={disconnect} className="chat-button">
              切断
            </button>
          ) : (
            <button onClick={connect} className="chat-button">
              再接続
            </button>
          )}
          <button onClick={clearMessages} className="chat-button">
            クリア
          </button>
        </div>
      </div>

      {error && (
        <div className="chat-error">
          <p>エラー: {error.message}</p>
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">メッセージがありません</div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="chat-message">
              <span className="message-time">{formatTime(message.timestamp)}</span>
              <span
                className="message-username"
                style={{ color: message.user.color }}
              >
                {message.user.displayName}
                {message.user.isMod && <span className="badge mod">MOD</span>}
                {message.user.isSubscriber && (
                  <span className="badge subscriber">SUB</span>
                )}
                {message.user.isVip && <span className="badge vip">VIP</span>}
              </span>
              <span className="message-text">: {message.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

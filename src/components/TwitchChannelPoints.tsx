import { useState } from 'react'
import { useTwitchChannelPoints, useTwitchChannelPointRedemptions } from '../hooks/useTwitchChannelPoints'
import './TwitchChannelPoints.css'

interface TwitchChannelPointsProps {
  broadcasterId: string
}

export function TwitchChannelPoints({ broadcasterId }: TwitchChannelPointsProps) {
  const { rewards, loading, error, refetch } = useTwitchChannelPoints(broadcasterId)
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<'UNFULFILLED' | 'FULFILLED' | 'CANCELED' | undefined>(undefined)

  const {
    redemptions,
    loading: redemptionsLoading,
    error: redemptionsError,
    hasMore,
    loadMore,
    refetch: refetchRedemptions,
  } = useTwitchChannelPointRedemptions(
    broadcasterId,
    selectedRewardId || '',
    selectedStatus,
    20
  )

  if (loading) {
    return <div className="twitch-channel-points loading">読み込み中...</div>
  }

  if (error) {
    return (
      <div className="twitch-channel-points error">
        <p>エラーが発生しました: {error.message}</p>
        <p className="error-note">
          注意: チャンネルポイント情報の取得にはOAuth認証（ユーザートークン）が必要です。
          App Access Tokenでは使用できません。
        </p>
        <button onClick={refetch}>再試行</button>
      </div>
    )
  }

  if (rewards.length === 0) {
    return (
      <div className="twitch-channel-points">
        <h3>チャンネルポイントリワード</h3>
        <p>リワードが見つかりませんでした</p>
      </div>
    )
  }

  return (
    <div className="twitch-channel-points">
      <h3>チャンネルポイントリワード ({rewards.length}件)</h3>

      <div className="rewards-list">
        {rewards.map((reward) => (
          <div
            key={reward.id}
            className={`reward-item ${selectedRewardId === reward.id ? 'selected' : ''}`}
            onClick={() => {
              setSelectedRewardId(reward.id)
              setSelectedStatus(undefined)
            }}
          >
            <div className="reward-header">
              <div className="reward-title">{reward.title}</div>
              <div className="reward-cost">{reward.cost} CP</div>
            </div>
            {reward.prompt && (
              <div className="reward-prompt">{reward.prompt}</div>
            )}
            <div className="reward-status">
              {reward.is_enabled ? (
                <span className="status-badge enabled">有効</span>
              ) : (
                <span className="status-badge disabled">無効</span>
              )}
              {reward.is_paused && (
                <span className="status-badge paused">一時停止</span>
              )}
              {!reward.is_in_stock && (
                <span className="status-badge out-of-stock">在庫切れ</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedRewardId && (
        <div className="redemptions-section">
          <div className="redemptions-header">
            <h4>引き換え履歴</h4>
            <div className="status-filters">
              <button
                className={`filter-button ${selectedStatus === undefined ? 'active' : ''}`}
                onClick={() => setSelectedStatus(undefined)}
              >
                すべて
              </button>
              <button
                className={`filter-button ${selectedStatus === 'UNFULFILLED' ? 'active' : ''}`}
                onClick={() => setSelectedStatus('UNFULFILLED')}
              >
                未処理
              </button>
              <button
                className={`filter-button ${selectedStatus === 'FULFILLED' ? 'active' : ''}`}
                onClick={() => setSelectedStatus('FULFILLED')}
              >
                処理済み
              </button>
              <button
                className={`filter-button ${selectedStatus === 'CANCELED' ? 'active' : ''}`}
                onClick={() => setSelectedStatus('CANCELED')}
              >
                キャンセル
              </button>
            </div>
          </div>

          {redemptionsError && (
            <div className="redemptions-error">
              <p>エラー: {redemptionsError.message}</p>
              <p className="error-note">
                注意: 引き換え履歴の取得にはOAuth認証（ユーザートークン）が必要です。
              </p>
            </div>
          )}

          {redemptionsLoading && redemptions.length === 0 ? (
            <div className="redemptions-loading">読み込み中...</div>
          ) : redemptions.length === 0 ? (
            <div className="redemptions-empty">引き換え履歴がありません</div>
          ) : (
            <>
              <div className="redemptions-list">
                {redemptions.map((redemption) => (
                  <div key={redemption.id} className="redemption-item">
                    <div className="redemption-header">
                      <div className="redemption-user">{redemption.user_name}</div>
                      <div className={`redemption-status ${redemption.status.toLowerCase()}`}>
                        {redemption.status === 'UNFULFILLED' && '未処理'}
                        {redemption.status === 'FULFILLED' && '処理済み'}
                        {redemption.status === 'CANCELED' && 'キャンセル'}
                      </div>
                    </div>
                    {redemption.user_input && (
                      <div className="redemption-input">{redemption.user_input}</div>
                    )}
                    <div className="redemption-date">
                      {new Date(redemption.redeemed_at).toLocaleString('ja-JP')}
                    </div>
                  </div>
                ))}
              </div>
              {hasMore && (
                <div className="load-more-container">
                  <button
                    onClick={loadMore}
                    disabled={redemptionsLoading}
                    className="load-more-button"
                  >
                    {redemptionsLoading ? '読み込み中...' : 'もっと見る'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

import { TwitchUserInfo } from './TwitchUserInfo'
import { TwitchStreamStatus } from './TwitchStreamStatus'
import { TwitchChannelInfo } from './TwitchChannelInfo'
import { TwitchChannelPoints } from './TwitchChannelPoints'
import { useTwitchUser } from '../hooks/useTwitchUser'

interface UserDetailsProps {
  login: string
}

export function UserDetails({ login }: UserDetailsProps) {
  const { user, loading } = useTwitchUser(login)

  if (loading || !user) {
    return (
      <div className="results-section">
        <TwitchUserInfo login={login} />
      </div>
    )
  }

  return (
    <div className="results-section">
      <TwitchUserInfo login={login} />
      <TwitchStreamStatus userLogin={login} />
      <TwitchChannelInfo userId={user.id} />
      <TwitchChannelPoints broadcasterId={user.id} />
    </div>
  )
}

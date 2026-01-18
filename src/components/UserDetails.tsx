import { TwitchUserInfo } from './TwitchUserInfo'
import { TwitchStreamStatus } from './TwitchStreamStatus'
import { TwitchChannelInfo } from './TwitchChannelInfo'
import { TwitchVideos } from './TwitchVideos'
import { TwitchClips } from './TwitchClips'
import { TwitchEmotes } from './TwitchEmotes'
import { TwitchFollowers } from './TwitchFollowers'
import { TwitchChatBadges } from './TwitchChatBadges'
import { TwitchChat } from './TwitchChat'
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
      <TwitchChat channel={login} />
      <TwitchChannelPoints broadcasterId={user.id} />
      <TwitchVideos userId={user.id} />
      <TwitchClips broadcasterId={user.id} />
      <TwitchEmotes broadcasterId={user.id} />
      <TwitchFollowers broadcasterId={user.id} />
      <TwitchChatBadges broadcasterId={user.id} />
    </div>
  )
}

import { TwitchUserInfo } from './TwitchUserInfo'
import { TwitchStreamStatus } from './TwitchStreamStatus'
import './HomeUserResults.css'

interface UserDetailsProps {
  login: string
}

export function UserDetails({ login }: UserDetailsProps) {
  return (
    <div className="results-section results-section--compact">
      <TwitchUserInfo login={login} />
      <TwitchStreamStatus userLogin={login} />
    </div>
  )
}

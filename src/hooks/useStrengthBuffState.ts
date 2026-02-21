import { useEffect, useState } from 'react'
import type React from 'react'

interface UseStrengthBuffStateOptions {
  enabled: boolean
  durationSeconds: number
  target: 'individual' | 'all'
  strengthBuffStartTimeRef: React.MutableRefObject<Map<string, number>>
  strengthBuffAllStartTimeRef: React.MutableRefObject<number | null>
}

/**
 * ストレングスバフの表示状態（残り時間）を1秒ごとに集計する。
 */
export function useStrengthBuffState({
  enabled,
  durationSeconds,
  target,
  strengthBuffStartTimeRef,
  strengthBuffAllStartTimeRef,
}: UseStrengthBuffStateOptions) {
  const [buffedUserIds, setBuffedUserIds] = useState<string[]>([])
  const [isAllBuffed, setIsAllBuffed] = useState(false)
  const [allBuffRemainingSeconds, setAllBuffRemainingSeconds] = useState<number | undefined>(undefined)
  const [buffRemainingSecondsMap, setBuffRemainingSecondsMap] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    if (!enabled) {
      setBuffedUserIds([])
      setIsAllBuffed(false)
      setAllBuffRemainingSeconds(undefined)
      setBuffRemainingSecondsMap(new Map())
      return
    }

    const updateBuffState = () => {
      const buffedUsers: string[] = []
      const remainingMap = new Map<string, number>()

      strengthBuffStartTimeRef.current.forEach((startTime, userId) => {
        const elapsed = (Date.now() - startTime) / 1000
        const remaining = durationSeconds - elapsed
        if (remaining > 0) {
          buffedUsers.push(userId)
          remainingMap.set(userId, remaining)
        }
      })
      setBuffedUserIds(buffedUsers)
      setBuffRemainingSecondsMap(remainingMap)

      if (target === 'all' && strengthBuffAllStartTimeRef.current) {
        const elapsed = (Date.now() - strengthBuffAllStartTimeRef.current) / 1000
        const remaining = durationSeconds - elapsed
        setIsAllBuffed(remaining > 0)
        setAllBuffRemainingSeconds(remaining > 0 ? remaining : undefined)
      } else {
        setIsAllBuffed(false)
        setAllBuffRemainingSeconds(undefined)
      }
    }

    updateBuffState()
    const interval = window.setInterval(updateBuffState, 1000)
    return () => window.clearInterval(interval)
  }, [durationSeconds, enabled, strengthBuffAllStartTimeRef, strengthBuffStartTimeRef, target])

  return {
    buffedUserIds,
    isAllBuffed,
    allBuffRemainingSeconds,
    buffRemainingSecondsMap,
  }
}

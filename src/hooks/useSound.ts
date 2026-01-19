/**
 * Howler.js を使った簡易サウンドフック
 */

import { useCallback, useEffect, useRef } from 'react'
import { Howl } from 'howler'

interface UseSoundOptions {
  src: string
  enabled?: boolean
  volume?: number
}

interface UseSoundResult {
  play: () => void
  stop: () => void
}

export function useSound({ src, enabled = true, volume = 1 }: UseSoundOptions): UseSoundResult {
  const howlRef = useRef<Howl | null>(null)

  useEffect(() => {
    if (!enabled || !src) {
      if (howlRef.current) {
        howlRef.current.unload()
        howlRef.current = null
      }
      return
    }

    const howl = new Howl({
      src: [src],
      volume,
    })

    howlRef.current = howl

    return () => {
      howl.unload()
      if (howlRef.current === howl) {
        howlRef.current = null
      }
    }
  }, [src, enabled])

  useEffect(() => {
    if (howlRef.current) {
      howlRef.current.volume(volume)
    }
  }, [volume])

  const play = useCallback(() => {
    if (!enabled || !src || !howlRef.current) return
    howlRef.current.play()
  }, [enabled, src])

  const stop = useCallback(() => {
    if (!howlRef.current) return
    howlRef.current.stop()
  }, [])

  return { play, stop }
}

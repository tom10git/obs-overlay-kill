/**
 * tmi.js の型定義
 * tmi.js には公式の型定義がないため、必要な型を定義します
 */

declare module 'tmi.js' {
  export interface ChatUserstate {
    'badge-info'?: string
    badges?: Record<string, string>
    color?: string
    'display-name'?: string
    emotes?: Array<{
      id: string
      name: string
      positions: Array<{ start: number; end: number }>
    }>
    flags?: string
    id?: string
    mod?: boolean
    'room-id'?: string
    subscriber?: boolean
    'tmi-sent-ts'?: string
    turbo?: boolean
    'user-id'?: string
    'user-type'?: string
    username?: string
    vip?: boolean
    bits?: string
    'emotes-raw'?: string
    'badges-raw'?: string
    'message-type'?: string
  }

  export interface ClientOptions {
    options?: {
      debug?: boolean
      skipUpdatingEmotesets?: boolean
      skipMembership?: boolean
      updateEmotesetsTimer?: number
    }
    connection?: {
      secure?: boolean
      reconnect?: boolean
      timeout?: number
      reconnectDecay?: number
      reconnectInterval?: number
      maxReconnectAttempts?: number
      maxReconnectInterval?: number
    }
    identity?: {
      username?: string
      password?: string
    }
    channels?: string[]
  }

  export class Client {
    constructor(opts: ClientOptions)
    connect(): Promise<[string, number]>
    disconnect(): Promise<void>
    readyState(): 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED'
    say(channel: string, message: string): void
    on(event: 'message', listener: (channel: string, tags: ChatUserstate, message: string, self: boolean) => void): this
    on(event: 'cheer', listener: (channel: string, userstate: ChatUserstate, message: string) => void): this
    on(
      event: 'subscription',
      listener: (channel: string, username: string, methods: unknown, message: string, userstate: ChatUserstate) => void
    ): this
    on(
      event: 'resub',
      listener: (
        channel: string,
        username: string,
        months: number,
        message: string,
        userstate: ChatUserstate
      ) => void
    ): this
    on(
      event: 'subgift',
      listener: (
        channel: string,
        username: string,
        streakMonths: number,
        recipient: string,
        methods: unknown,
        userstate: ChatUserstate
      ) => void
    ): this
    on(
      event: 'submysterygift',
      listener: (channel: string, username: string, numbOfSubs: number, methods: unknown, userstate: ChatUserstate) => void
    ): this
    on(event: 'connected', listener: (addr: string, port: number) => void): this
    on(event: 'disconnected', listener: (reason: string) => void): this
    on(event: 'join', listener: (channel: string, username: string, self: boolean) => void): this
    on(event: 'part', listener: (channel: string, username: string, self: boolean) => void): this
    on(event: string, listener: (...args: unknown[]) => void): this
  }

  const tmi: {
    Client: typeof Client
  }

  export default tmi
}

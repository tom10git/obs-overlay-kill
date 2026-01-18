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
    'emotes-raw'?: string
    'badges-raw'?: string
    'message-type'?: string
  }

  export interface ClientOptions {
    options?: {
      debug?: boolean
    }
    connection?: {
      secure?: boolean
      reconnect?: boolean
      maxReconnectAttempts?: number
      maxReconnectInterval?: number
      reconnectInterval?: number
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
    on(event: 'message', listener: (channel: string, tags: ChatUserstate, message: string, self: boolean) => void): this
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

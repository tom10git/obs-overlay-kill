/**
 * アプリ共通ログ。直接 console の乱用を避け、DebugLog 用バッファと連携する。
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const MAX_BUFFER = 200

export type LogEntry = {
  ts: number
  level: LogLevel
  message: string
  detail?: string
}

const buffer: LogEntry[] = []
const subscribers = new Set<() => void>()

function isDebugUiEnabled(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem('obs-overlay-debug') === '1'
  } catch {
    return false
  }
}

function shouldMirrorDebugToConsole(): boolean {
  return import.meta.env.DEV || isDebugUiEnabled()
}

function formatArgs(args: unknown[]): { message: string; detail?: string } {
  if (args.length === 0) return { message: '' }
  const [first, ...rest] = args
  const message =
    typeof first === 'string' ? first : safeStringify(first)
  const detail = rest.length > 0 ? rest.map(safeStringify).join(' ') : undefined
  return { message, detail }
}

function safeStringify(v: unknown): string {
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function push(level: LogLevel, args: unknown[]) {
  const { message, detail } = formatArgs(args)
  const entry: LogEntry = {
    ts: Date.now(),
    level,
    message,
    ...(detail ? { detail } : {}),
  }
  buffer.push(entry)
  if (buffer.length > MAX_BUFFER) {
    buffer.splice(0, buffer.length - MAX_BUFFER)
  }
  subscribers.forEach((fn) => fn())
}

function mirrorConsole(level: LogLevel, args: unknown[]) {
  if (level === 'error') {
    console.error(...args)
    return
  }
  if (level === 'warn') {
    console.warn(...args)
    return
  }
  if (shouldMirrorDebugToConsole()) {
    if (level === 'debug') {
      console.debug(...args)
    } else {
      console.log(...args)
    }
  }
}

function logAt(level: LogLevel, ...args: unknown[]) {
  push(level, args)
  mirrorConsole(level, args)
}

export const logger = {
  debug: (...args: unknown[]) => logAt('debug', ...args),
  info: (...args: unknown[]) => logAt('info', ...args),
  warn: (...args: unknown[]) => logAt('warn', ...args),
  error: (...args: unknown[]) => logAt('error', ...args),
}

export function getLogBuffer(): readonly LogEntry[] {
  return buffer
}

export function subscribeLogs(onChange: () => void): () => void {
  subscribers.add(onChange)
  return () => subscribers.delete(onChange)
}

export function clearLogBuffer() {
  buffer.length = 0
  subscribers.forEach((fn) => fn())
}

/**
 * アプリ共通ログ。直接 console の乱用を避け、DebugLog 用バッファと連携する。
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// 解析用にある程度長めに残す（必要なら後で設定化）
const MAX_BUFFER = 2000

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

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatDateForFile(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const mm = pad2(d.getMinutes())
  const ss = pad2(d.getSeconds())
  return `${y}${m}${day}-${hh}${mm}${ss}`
}

export function formatLogBufferJsonl(entries: readonly LogEntry[] = buffer): string {
  // 解析しやすいように JSON Lines で出力する
  return entries
    .map((e) =>
      JSON.stringify({
        ts: e.ts,
        iso: new Date(e.ts).toISOString(),
        level: e.level,
        message: e.message,
        ...(e.detail ? { detail: e.detail } : {}),
      })
    )
    .join('\n')
}

export function downloadLogBufferAsText(options?: { filename?: string; content?: string }) {
  const content = options?.content ?? formatLogBufferJsonl()
  const filename = options?.filename ?? `obs-overlay-debug-${formatDateForFile(Date.now())}.txt`
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    // revoke は少し待った方が安全
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

import './HelixFieldsTable.css'

export interface HelixFieldsTableProps {
  title: string
  hint?: string
  /** GET /helix/* の1オブジェクトをそのまま表示 */
  data: Record<string, unknown>
  /** 表示しないキー（列挙から除外） */
  omitKeys?: string[]
  /** <details> で折りたたみ（ホーム向け） */
  collapsible?: boolean
  /** collapsible 時の初期表示（既定 false） */
  defaultOpen?: boolean
  /** 行・字体を詰める */
  compact?: boolean
}

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s)
}

function isResolvableImageUrlField(key: string): boolean {
  return (
    key === 'profile_image_url' ||
    key === 'offline_image_url' ||
    key === 'thumbnail_url' ||
    key.endsWith('_image_url')
  )
}

function resolveThumbnailSrc(key: string, value: string): string {
  if (key === 'thumbnail_url') {
    return value.replace('{width}', '320').replace('{height}', '180')
  }
  return value
}

function FieldValue({
  fieldKey,
  value,
  compact,
}: {
  fieldKey: string
  value: unknown
  compact?: boolean
}) {
  if (value === null || value === undefined) {
    return <span className="helix-empty">—</span>
  }
  if (typeof value === 'boolean') {
    return <span>{value ? 'true' : 'false'}</span>
  }
  if (typeof value === 'number') {
    return <span>{value.toLocaleString('ja-JP')}</span>
  }
  if (typeof value === 'string') {
    if (value === '') {
      return <span className="helix-empty">（空文字）</span>
    }
    const maybeIso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
    if (maybeIso) {
      const d = new Date(value)
      if (!Number.isNaN(d.getTime())) {
        return (
          <span>
            {d.toLocaleString('ja-JP', { timeZoneName: 'short' })}
            <code className="helix-iso"> ({value})</code>
          </span>
        )
      }
    }
    if (isHttpUrl(value)) {
      return (
        <span className="helix-url-block">
          <a href={value} target="_blank" rel="noopener noreferrer">
            {compact && value.length > 72 ? `${value.slice(0, 72)}…` : value}
          </a>
          {isResolvableImageUrlField(fieldKey) && (
            <img
              src={resolveThumbnailSrc(fieldKey, value)}
              alt=""
              className={compact ? 'helix-thumb helix-thumb--compact' : 'helix-thumb'}
            />
          )}
        </span>
      )
    }
    return <span className="helix-str">{value}</span>
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="helix-empty">[]</span>
    }
    return (
      <pre className={compact ? 'helix-json helix-json--compact' : 'helix-json'}>
        {JSON.stringify(value, null, compact ? 0 : 2)}
      </pre>
    )
  }
  if (typeof value === 'object') {
    return (
      <pre className={compact ? 'helix-json helix-json--compact' : 'helix-json'}>
        {JSON.stringify(value, null, compact ? 0 : 2)}
      </pre>
    )
  }
  return <span>{String(value)}</span>
}

export function HelixFieldsTable({
  title,
  hint,
  data,
  omitKeys,
  collapsible = false,
  defaultOpen = false,
  compact = false,
}: HelixFieldsTableProps) {
  const omit = omitKeys && omitKeys.length > 0 ? new Set(omitKeys) : null
  const entries = Object.keys(data)
    .filter((k) => !omit?.has(k))
    .sort()
    .map((k) => [k, data[k]] as const)

  if (entries.length === 0) {
    return (
      <section className="helix-fields-section helix-fields-section--empty">
        <h3 className="helix-fields-title">{title}</h3>
        {hint && <p className="helix-fields-hint">{hint}</p>}
        <p className="helix-fields-empty-msg">表示するフィールドがありません。</p>
      </section>
    )
  }

  const listClass =
    'helix-fields-list' + (compact ? ' helix-fields-list--compact' : '')
  const dl = (
    <dl className={listClass}>
      {entries.map(([key, value]) => (
        <div key={key} className="helix-field-row">
          <dt>{key}</dt>
          <dd>
            <FieldValue fieldKey={key} value={value} compact={compact} />
          </dd>
        </div>
      ))}
    </dl>
  )

  if (collapsible) {
    return (
      <details
        className={'helix-details' + (compact ? ' helix-details--compact' : '')}
        open={defaultOpen}
      >
        <summary className="helix-details-summary">
          <span className="helix-details-summary-title">{title}</span>
          <span className="helix-details-count">{entries.length} 項目</span>
        </summary>
        <div className="helix-details-body">
          {hint && <p className="helix-fields-hint helix-fields-hint--in-details">{hint}</p>}
          {dl}
        </div>
      </details>
    )
  }

  return (
    <section className="helix-fields-section">
      <h3 className="helix-fields-title">{title}</h3>
      {hint && <p className="helix-fields-hint">{hint}</p>}
      {dl}
    </section>
  )
}

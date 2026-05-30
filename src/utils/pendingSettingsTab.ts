const STORAGE_KEY = 'obs-overlay-pending-settings-tab'

/** Magic link 後に課金タブを開く（Redirect URL はクエリなし `/overlay` のまま） */
export function setPendingSettingsTab(tab: string): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(STORAGE_KEY, tab)
}

export function consumePendingSettingsTab(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  const value = sessionStorage.getItem(STORAGE_KEY)
  if (value) sessionStorage.removeItem(STORAGE_KEY)
  return value
}

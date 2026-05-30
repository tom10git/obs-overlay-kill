/** 招待のメール紐づけ用（平文は DB に保存しない） */
export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function hashInviteEmail(email: string): Promise<string> {
  const normalized = normalizeInviteEmail(email)
  const data = new TextEncoder().encode(normalized)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

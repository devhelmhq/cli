/**
 * Notices about the active API key, shared by `auth me` and `doctor`:
 * a `full`-scope key is a legacy key (replace it with a scoped preset), and
 * expiry is warned 14 and 3 days ahead (doc 32 D-5).
 */
export interface KeyFacts {
  scopes: string[]
  expiresAt?: string | null
}

export function keyNotices(key: KeyFacts, now = Date.now()): string[] {
  const out: string[] = []
  if (key.scopes.includes('full')) {
    out.push('legacy key: replace with a scoped key (devhelm api-keys create --preset ci-deploy|ci-pr|agent-author|agent-responder)')
  }
  if (key.expiresAt) {
    const days = (Date.parse(key.expiresAt) - now) / 86_400_000
    if (days <= 0) out.push(`this key expired on ${key.expiresAt}`)
    else if (days <= 3) out.push(`this key expires in ${Math.ceil(days)} day(s) (${key.expiresAt}); rotate it: devhelm api-keys rotate <id>`)
    else if (days <= 14) out.push(`this key expires in ${Math.ceil(days)} days (${key.expiresAt})`)
  }
  return out
}

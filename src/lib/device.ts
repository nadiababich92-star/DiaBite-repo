/**
 * The random device id the engine counts a signed-out visitor's free answers by (docs/specs/anon-screen.md, section 1).
 *
 * A random version-4 UUID kept in this browser. Sent only as a header and only when the person is signed out; read by
 * nothing but the engine's counters. Every storage access is wrapped: the app must render with no stored value, and when
 * storage is unavailable the id lasts one page load. It is never a constant (the earlier fixed 'anon' fallback was a
 * defect, docs/security/security-plan.md S3), because one shared id would be one shared allowance.
 */
const KEY = 'diabite.device.v1'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let thisLoad: string | null = null

function fresh(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c?.randomUUID) return c.randomUUID()
  // No randomUUID (an old browser): a version-4 shape from random numbers, enough for a counter that is not a secret.
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`
}

export function deviceId(): string {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored && UUID.test(stored)) return stored
    const id = fresh()
    localStorage.setItem(KEY, id)
    return id
  } catch {
    return (thisLoad ??= fresh())
  }
}

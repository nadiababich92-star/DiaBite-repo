/**
 * The id that ties one browser to its parked day state, its conversation and
 * the advisor's memory on the server.
 *
 * It was an eight-character `Math.random()` string, and "anon" whenever storage
 * was unavailable (private browsing): a constant, shared by every such visitor,
 * so they shared a conversation, a parked diary and a memory namespace. Now it
 * is a random UUID, and with no storage it is one per page load, never a
 * constant. Ids already stored by earlier visits keep working: the server
 * accepts any word-character string up to 64 long.
 */
const KEY = 'diabite.session'
let inMemory: string | null = null

export function newSessionId(): string {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()
  const bytes = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function sessionId(): string {
  try {
    let v = localStorage.getItem(KEY)
    if (!v) { v = newSessionId(); localStorage.setItem(KEY, v) }
    return v
  } catch {
    return (inMemory ??= newSessionId())
  }
}

const OWNER_KEY = 'diabite.sessionOwner'

/** A new id, stored in place of the old one. The old one is not reused. */
export function renewSession(): string {
  const v = newSessionId()
  try { localStorage.setItem(KEY, v) } catch { inMemory = v }
  return v
}

/**
 * Tell the session which person is signed in. The server gives an id to the first person who uses it, so
 * when the person changes (signing in, signing out, someone else on the same browser) the browser starts a
 * new session instead of carrying the old one over: the day parked under it, the conversation and the
 * advisor's memory stay with whoever they belonged to. The same person coming back keeps theirs.
 */
export function adoptSessionOwner(userId: string | null): void {
  let known = ''
  try { known = localStorage.getItem(OWNER_KEY) ?? '' } catch { return }
  const now = userId ?? ''
  if (known === now) return
  renewSession()
  try { if (now) localStorage.setItem(OWNER_KEY, now); else localStorage.removeItem(OWNER_KEY) } catch { /* private mode */ }
}

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

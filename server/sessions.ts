/**
 * Per-turn day state, held server-side.
 *
 * Why this exists: in n8n the day's budget and log reached get_day_state
 * through the webhook body, never through the model. A Foundry OpenAPI tool
 * is the opposite — the *model* fills every parameter. Letting it retype the
 * budget would be a silent correctness hole: the engine would compute a
 * perfectly consistent answer from a wrong budget, and the verifier, which
 * only checks that numbers trace to tool results, would pass it.
 *
 * So the client stores the day state under an opaque id before the run, and
 * the agent may only hand that id back. Numbers never round-trip through the
 * model.
 *
 * In-memory with a TTL: day state is per-conversation and cheap to re-send.
 *
 * This is why the service runs on a single replica. The agent's tool call
 * arrives through the public ingress, which would load-balance it to whichever
 * replica it liked — and a day state parked on one replica is a 404 on the
 * other. Redis behind this module is what lifts that limit.
 */
import type { AvoidList } from './avoid'
import type { DayBudget, MealItemInput } from './contract'

export interface SessionState {
  budget: DayBudget
  entries: MealItemInput[]
  /** Allergens and exclusions, parked with the day state for the same reason. */
  avoid?: AvoidList
  /**
   * Phrases of this turn's meal that resolve_foods could not find. A meal
   * costed without them is understated, and the engine, not the model, is what
   * keeps that from being called "fits". Reset whenever a turn parks its day.
   */
  unknownFoods: string[]
  storedAt: number
}

const TTL_MS = 60 * 60 * 1000 // an hour: longer than any single conversation
/**
 * Each map holds at most this many entries, oldest first out. A session id is
 * client-chosen, so without a bound every new one grows memory for an hour.
 */
export const MAX_SESSIONS = 5_000
const store = new Map<string, SessionState>()

/** Insert as newest, then drop from the front (the oldest) while over the cap. */
function setBounded<V>(map: Map<string, V>, key: string, value: V): void {
  map.delete(key)
  map.set(key, value)
  while (map.size > MAX_SESSIONS) map.delete(map.keys().next().value as string)
}

function sweep(now = Date.now()) {
  // Insertion order is age order, so the first live entry ends the walk.
  for (const [id, s] of store) {
    if (now - s.storedAt <= TTL_MS) break
    store.delete(id)
  }
}

export function putSession(
  id: string, budget: DayBudget, entries: MealItemInput[], avoid?: AvoidList,
): SessionState {
  sweep()
  const state: SessionState = { budget, entries, avoid, unknownFoods: [], storedAt: Date.now() }
  setBounded(store, id, state)
  return state
}

/**
 * Record what resolve_foods found and did not find. A phrase that was unknown
 * and later resolves (the model retried with another name) stops counting.
 */
export function noteResolution(id: string, results: { phrase: string; unknown: boolean }[]): void {
  const s = store.get(id)
  if (!s) return
  const unknown = new Set(s.unknownFoods)
  for (const r of results) { if (r.unknown) unknown.add(r.phrase); else unknown.delete(r.phrase) }
  s.unknownFoods = [...unknown]
}

export function getSession(id: string): SessionState | undefined {
  sweep()
  return store.get(id)
}

/** Sizes of the three maps, for the abuse suite. */
export const _sizes = () => ({ store: store.size, lastResponse: lastResponse.size, conversations: conversations.size })

export function sessionCount(): number {
  sweep()
  return store.size
}

// ── Conversation continuity ───────────────────────────────────────────────

/**
 * Where a conversation left off.
 *
 * n8n keyed its memory by the session id. The Responses API continues a
 * conversation by quoting the previous response's id, so that is what we keep
 * — the frontend carries nothing it has no use for.
 */
const lastResponse = new Map<string, { responseId: string; storedAt: number }>()

export function previousResponseFor(sessionId: string): string | undefined {
  const r = lastResponse.get(sessionId)
  if (!r) return undefined
  if (Date.now() - r.storedAt > TTL_MS) { lastResponse.delete(sessionId); return undefined }
  return r.responseId
}

export function rememberResponse(sessionId: string, responseId: string): void {
  setBounded(lastResponse, sessionId, { responseId, storedAt: Date.now() })
}

/**
 * The advisor's conversation, one per session.
 *
 * Its id is what the memory tool's `{{$conversationId}}` resolves to, so it is
 * also the namespace a person's remembered preferences live under. Kept here
 * rather than sent to the browser for the same reason as everything else in
 * this file: the client should not be able to name someone else's.
 */
const conversations = new Map<string, { id: string; storedAt: number }>()

export function conversationFor(sessionId: string): string | undefined {
  const c = conversations.get(sessionId)
  if (!c) return undefined
  if (Date.now() - c.storedAt > TTL_MS) { conversations.delete(sessionId); return undefined }
  return c.id
}

export function rememberConversation(sessionId: string, id: string): void {
  setBounded(conversations, sessionId, { id, storedAt: Date.now() })
}

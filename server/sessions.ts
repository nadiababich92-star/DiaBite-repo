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
import type { DayBudget, MealItemInput } from './contract'

export interface SessionState {
  budget: DayBudget
  entries: MealItemInput[]
  storedAt: number
}

const TTL_MS = 60 * 60 * 1000 // an hour: longer than any single conversation
const store = new Map<string, SessionState>()

function sweep(now = Date.now()) {
  for (const [id, s] of store) if (now - s.storedAt > TTL_MS) store.delete(id)
}

export function putSession(id: string, budget: DayBudget, entries: MealItemInput[]): SessionState {
  sweep()
  const state: SessionState = { budget, entries, storedAt: Date.now() }
  store.set(id, state)
  return state
}

export function getSession(id: string): SessionState | undefined {
  sweep()
  return store.get(id)
}

export function sessionCount(): number {
  sweep()
  return store.size
}

// ── Threads ───────────────────────────────────────────────────────────────

/**
 * Which Foundry thread belongs to a conversation.
 *
 * n8n keyed its memory by the session id; a Foundry thread is the same idea
 * with a different name, so the mapping lives here rather than asking the
 * frontend to carry a thread id it has no use for.
 */
const threads = new Map<string, { threadId: string; storedAt: number }>()

export function threadFor(sessionId: string): string | undefined {
  const t = threads.get(sessionId)
  if (!t) return undefined
  if (Date.now() - t.storedAt > TTL_MS) { threads.delete(sessionId); return undefined }
  return t.threadId
}

export function rememberThread(sessionId: string, threadId: string): void {
  threads.set(sessionId, { threadId, storedAt: Date.now() })
}

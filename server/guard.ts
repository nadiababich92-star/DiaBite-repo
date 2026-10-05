/**
 * Abuse protection for the one public route that spends money.
 *
 * `POST /agent/ask` needs no key because a browser cannot hold one, so every
 * limit that would otherwise be "who is allowed" is here instead "how much".
 * Counters live in memory and reset on a restart, which is the same single
 * replica limit `sessions.ts` documents; Redis behind this module lifts both.
 *
 * The order is the design (docs/engineering/engineering-doc.md §3): size and
 * shape, then the safety gate, then these limits. A refusal and a red-flag
 * reply cost nothing and must never be withheld, so nothing in this file is
 * consulted before the gate has had its say.
 */
import { createHash } from 'node:crypto'

const num = (name: string, fallback: number): number => {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v > 0 ? v : fallback
}

/** Read per call, not at import, so the abuse suite can set them tiny. */
export function limits() {
  return {
    off: process.env.ABUSE_GUARD === 'off',
    ip10min: num('ASK_IP_10MIN', 30),
    ipDay: num('ASK_IP_DAY', 200),
    sessionHour: num('ASK_SESSION_HOUR', 60),
    dailyCeiling: num('ASK_DAILY_CEILING', 1000),
  }
}

export const MAX_MESSAGE = 500
export const MAX_SESSION_ID = 64
export const MAX_ENTRIES = 100
export const MAX_KEYS = 10_000

// ── Size and shape ────────────────────────────────────────────────────────

export type Invalid = { field: string }

const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

/** Returns the first offending field, or null. Never throws on a hostile body. */
export function validateAsk(body: unknown): Invalid | null {
  const b = body as Record<string, unknown> | null
  if (!b || typeof b !== 'object') return { field: 'body' }
  if (typeof b.sessionId !== 'string' || !b.sessionId || b.sessionId.length > MAX_SESSION_ID
      || !/^[\w-]+$/.test(b.sessionId)) return { field: 'sessionId' }
  if (typeof b.message !== 'string' || b.message.length > MAX_MESSAGE) return { field: 'message' }
  if (b.entries !== undefined && (!Array.isArray(b.entries) || b.entries.length > MAX_ENTRIES)) {
    return { field: 'entries' }
  }
  if (b.budget !== undefined) {
    const bud = b.budget as Record<string, unknown> | null
    if (!bud || typeof bud !== 'object') return { field: 'budget' }
    for (const k of ['glBudget', 'carbsG', 'kcal']) {
      if (bud[k] !== undefined && !finite(bud[k])) return { field: 'budget' }
    }
  }
  return null
}

// ── Sliding windows ───────────────────────────────────────────────────────

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** key -> request timestamps, newest last. A Map iterates in insertion order. */
class Windows {
  private hits = new Map<string, number[]>()

  /** Seconds to wait if `key` is over `max` inside `windowMs`; 0 if it may go. Records the hit when it may. */
  take(key: string, max: number, windowMs: number, now: number): number {
    const kept = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs)
    if (kept.length >= max) {
      this.hits.set(key, kept)
      return Math.max(1, Math.ceil((kept[0] + windowMs - now) / 1000))
    }
    kept.push(now)
    // Re-insert so the least recently used key is always first.
    this.hits.delete(key)
    this.hits.set(key, kept)
    while (this.hits.size > MAX_KEYS) this.hits.delete(this.hits.keys().next().value as string)
    return 0
  }

  size() { return this.hits.size }
  clear() { this.hits.clear() }
}

const windows = new Windows()
let ceiling = { day: '', used: 0 }

export type Scope = 'ip' | 'session' | 'daily'
export class RateLimited extends Error {
  constructor(public scope: Scope, public retryAfterSec: number) {
    super(`rate_limited:${scope}`)
  }
}

/** Seconds until 00:00 UTC. */
const secondsToMidnight = (now: number) => Math.max(1, Math.ceil((DAY - (now % DAY)) / 1000))

/**
 * Charge one turn against the person and the day. Throws `RateLimited`.
 * Called after the safety gate and before the router, which is itself a model
 * call. The daily ceiling is read first, so a turn refused at the ceiling
 * does not use up the person's own allowance.
 */
export function chargeTurn(clientKey: string | undefined, sessionId: string, now = Date.now()): void {
  const L = limits()
  if (L.off) return

  const today = new Date(now).toISOString().slice(0, 10)
  if (ceiling.day !== today) ceiling = { day: today, used: 0 }
  if (ceiling.used >= L.dailyCeiling) throw new RateLimited('daily', secondsToMidnight(now))

  if (clientKey) {
    const wait10 = windows.take(`ip10:${clientKey}`, L.ip10min, 10 * MIN, now)
    if (wait10) throw new RateLimited('ip', wait10)
    const waitDay = windows.take(`ipd:${clientKey}`, L.ipDay, DAY, now)
    if (waitDay) throw new RateLimited('ip', waitDay)
  }
  const waitSession = windows.take(`s:${sessionId}`, L.sessionHour, HOUR, now)
  if (waitSession) throw new RateLimited('session', waitSession)

  ceiling.used++
}

/** A short salted hash: enough to tell two sources apart in a log, not to name one. */
const SALT = process.env.LOG_SALT ?? String(process.pid) + String(Date.now() >> 22)
export const sourceTag = (key: string | undefined) =>
  key ? createHash('sha256').update(SALT + key).digest('hex').slice(0, 8) : 'unknown'

/** Test hooks for `npm run eval:abuse`. */
export const _state = () => ({ keys: windows.size(), ceilingUsed: ceiling.used })
export const _reset = () => { windows.clear(); ceiling = { day: '', used: 0 } }

// ── CORS ──────────────────────────────────────────────────────────────────

/** Own origin(s) from ALLOWED_ORIGINS, plus localhost for development. */
export function originAllowed(origin: string | undefined, selfHost?: string): boolean {
  if (!origin) return true // same-origin and non-browser callers send none
  try {
    const u = new URL(origin)
    if (['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) return true
    if (selfHost && u.host === selfHost) return true
  } catch { return false }
  return (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean).includes(origin)
}

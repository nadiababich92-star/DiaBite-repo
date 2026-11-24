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
import { ALLERGEN_PATTERNS, AVOIDED_PATTERNS, PATTERN_PATTERNS } from '../src/lib/dietary'
import { quantityError } from './quantity'

const num = (name: string, fallback: number): number => {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v > 0 ? v : fallback
}

/** A setting where 0 is a real value, not "unset": a feature switch that means off. */
const numOrZero = (name: string, fallback: number): number => {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === '') return fallback
  const v = Number(raw)
  return Number.isInteger(v) && v >= 0 ? v : fallback
}

/** Read per call, not at import, so the abuse suite can set them tiny. */
export function limits() {
  return {
    off: process.env.ABUSE_GUARD === 'off',
    ip10min: num('ASK_IP_10MIN', 30),
    ipDay: num('ASK_IP_DAY', 200),
    sessionHour: num('ASK_SESSION_HOUR', 60),
    dailyCeiling: num('ASK_DAILY_CEILING', 1000),
    userHour: num('ASK_USER_HOUR', 60),
    userDay: num('ASK_USER_DAY', 200),
    deletePerDay: num('ACCOUNT_DELETE_DAY', 5),
    recomputeMin: num('RECOMPUTE_MIN', 60),
    // A free first answer without signing in (docs/specs/anon-engine.md, section 1). Off at 0.
    anonFreeAnswers: numOrZero('ANON_FREE_ANSWERS', 0),
    anonModelCallsDay: num('ANON_MODEL_CALLS_DAY', 10),
    anonAddressAnswersDay: num('ANON_ADDRESS_ANSWERS_DAY', 10),
    anonDailyCeiling: num('ASK_ANON_DAILY_CEILING', 150),
    recomputeAnonMin: num('RECOMPUTE_ANON_MIN', 20),
  }
}

/** How many verdict answers a signed-out visitor may have in 24 hours; 0 means the feature is off. Read per call. */
export const freeAnswers = (): number => limits().anonFreeAnswers

export const MAX_MESSAGE = 500
export const MAX_SESSION_ID = 64
export const MAX_ENTRIES = 100
export const MAX_KEYS = 10_000

// ── Size and shape ────────────────────────────────────────────────────────

export type Invalid = { field: string; foodId?: string; why?: string }

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
  if (b.avoid !== undefined && !validAvoid(b.avoid)) return { field: 'avoid' }
  if (b.carbLimit !== undefined && !validCarbLimit(b.carbLimit)) return { field: 'carbLimit' }
  if (b.units !== undefined && !validUnits(b.units)) return { field: 'units' }
  if (b.portionSwaps !== undefined && b.portionSwaps !== false) return { field: 'portionSwaps' }
  if (b.newTopic !== undefined && typeof b.newTopic !== 'boolean') return { field: 'newTopic' }
  return null
}

/** The person's units: one of two words. */
export function validUnits(v: unknown): boolean { return v === 'imperial' || v === 'metric' }

/** The person's own carbohydrate number for the thing they are about to eat: a meal or a snack, 10 to 150 g. */
export function validCarbLimit(v: unknown): boolean {
  const c = v as Record<string, unknown> | null
  return !!c && typeof c === 'object' && (c.kind === 'meal' || c.kind === 'snack') && finite(c.g) && Number.isInteger(c.g) && (c.g as number) >= 10 && (c.g as number) <= 150
}

/**
 * The person's allergens and exclusions, as the browser sends them.
 *
 * An id the engine has no rule for is not ignored downstream, it throws: the
 * filter fails loudly rather than letting an allergen through. Reached from
 * a public route that turns one bad value into a turn of failing tool calls
 * (five in a row in one test) before the answer is lost, so it is refused here.
 */
function validAvoid(v: unknown): boolean {
  const a = v as Record<string, unknown> | null
  if (!a || typeof a !== 'object' || Array.isArray(a)) return false
  const known = (x: unknown, ok: (s: string) => boolean, max: number) =>
    x === undefined || (Array.isArray(x) && x.length <= max && x.every((s) => typeof s === 'string' && s.length <= 64 && ok(s)))
  return known(a.allergens, (s) => Object.hasOwn(ALLERGEN_PATTERNS, s), 20)
    && known(a.avoided, (s) => Object.hasOwn(AVOIDED_PATTERNS, s), 8)
    && known(a.foodIds, () => true, MAX_ENTRIES)
    && known(a.words, (s) => /^[a-z][a-z ]{1,39}$/i.test(s), 50)
    && (a.pattern === undefined || a.pattern === 'none' || (typeof a.pattern === 'string' && Object.hasOwn(PATTERN_PATTERNS, a.pattern)))
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

  /** Seconds to wait if `key` already has `max` hits inside `windowMs`; 0 if not. Records nothing. */
  peek(key: string, max: number, windowMs: number, now: number): number {
    const kept = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs)
    return kept.length >= max ? Math.max(1, Math.ceil((kept[0] + windowMs - now) / 1000)) : 0
  }

  /** Adds a hit to `key`, bounded like take(). */
  record(key: string, now: number): void {
    const kept = this.hits.get(key) ?? []
    kept.push(now)
    this.hits.delete(key)
    this.hits.set(key, kept)
    while (this.hits.size > MAX_KEYS) this.hits.delete(this.hits.keys().next().value as string)
  }

  size() { return this.hits.size }
  clear() { this.hits.clear() }
}

const windows = new Windows()
let ceiling = { day: '', used: 0 }
let anonCeiling = { day: '', used: 0 }

export type Scope = 'ip' | 'session' | 'daily' | 'user' | 'anon_daily'
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
export function chargeTurn(clientKey: string | undefined, sessionId: string, now = Date.now(), userId?: string): void {
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
  // A signed-in person is a more honest unit than an address: the same person on a phone and
  // a laptop is one, and a clinic behind one address is many.
  if (userId) {
    const waitUserHour = windows.take(`uh:${userId}`, L.userHour, HOUR, now)
    if (waitUserHour) throw new RateLimited('user', waitUserHour)
    const waitUserDay = windows.take(`ud:${userId}`, L.userDay, DAY, now)
    if (waitUserDay) throw new RateLimited('user', waitUserDay)
  }
  const waitSession = windows.take(`s:${sessionId}`, L.sessionHour, HOUR, now)
  if (waitSession) throw new RateLimited('session', waitSession)

  ceiling.used++
}

// ── A free first answer without signing in (docs/specs/anon-engine.md) ───

/** The anonymous visitor: the device the browser says it is, and the address the request came from. */
export interface AnonKey { device: string | undefined; address: string | undefined }

/** A version-4 UUID from the x-diabite-device header, hashed; undefined for anything else. The raw id is never kept or logged. */
export function deviceKeyOf(header: unknown): string | undefined {
  if (typeof header !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(header)) return undefined
  return createHash('sha256').update(SALT + header.toLowerCase()).digest('hex').slice(0, 16)
}

/** Thrown by `chargeAnon`; the route turns it into 401. */
export class SignInNeeded extends Error {
  constructor(public reason: 'free_limit' | 'anonymous_off', public retryAfterSec?: number) { super(`sign_in_needed:${reason}`) }
}

/** One visitor's key: a device, or, with no valid device header, every such visitor on an address shares one allowance, so omitting the header never gives more than sending one. */
const anonDevice = (key: AnonKey) => key.device ?? `nodev:${key.address ?? 'none'}`

/**
 * Charge one model turn to an anonymous visitor, or throw. Called after the safety gate, before the router. The verdict allowance is
 * peeked here and recorded by `countFreeAnswer` once an answer costs a meal; the model-call cap is taken now, so idle spending stops.
 */
export function chargeAnon(key: AnonKey, now = Date.now()): void {
  const L = limits()
  if (L.anonFreeAnswers === 0) throw new SignInNeeded('anonymous_off')
  if (L.off) return
  const today = new Date(now).toISOString().slice(0, 10)
  if (anonCeiling.day !== today) anonCeiling = { day: today, used: 0 }
  if (anonCeiling.used >= L.anonDailyCeiling) throw new RateLimited('anon_daily', secondsToMidnight(now))
  const device = anonDevice(key)
  const wait = Math.max(
    windows.peek(`an:ans:${device}`, L.anonFreeAnswers, DAY, now),
    windows.peek(`an:addr:${key.address ?? 'none'}`, L.anonAddressAnswersDay, DAY, now),
  )
  if (wait) throw new SignInNeeded('free_limit', wait)
  const callWait = windows.take(`an:calls:${device}`, L.anonModelCallsDay, DAY, now)
  if (callWait) throw new SignInNeeded('free_limit', callWait)
  anonCeiling.used++
}

/** Record one verdict answer for the visitor, after the answer was built. */
export function countFreeAnswer(key: AnonKey, now = Date.now()): void {
  if (limits().off) return
  windows.record(`an:ans:${anonDevice(key)}`, now)
  windows.record(`an:addr:${key.address ?? 'none'}`, now)
}

/** Seconds to wait before this address may recompute a portion again without an account; 0 if it may. */
export function chargeRecomputeAnon(address: string, now = Date.now()): number {
  const L = limits()
  return L.off ? 0 : windows.take(`rca:${address}`, L.recomputeAnonMin, MIN, now)
}

/** Seconds to wait before this person may delete an account again; 0 if they may. */
export function chargeDelete(userId: string, now = Date.now()): number {
  const L = limits()
  return L.off ? 0 : windows.take(`del:${userId}`, L.deletePerDay, DAY, now)
}

/**
 * Seconds to wait before this address may recompute a portion again; 0 if it may.
 * No model runs behind it, so the limit is about CPU and noise, not money: 60 a minute.
 */
export function chargeRecompute(clientKey: string, now = Date.now()): number {
  const L = limits()
  return L.off ? 0 : windows.take(`rc:${clientKey}`, L.recomputeMin, MIN, now)
}

export const MAX_RECOMPUTE_ITEMS = 20

/** The shape of a portion change: a session, and at most 20 foods with a weight or a count of servings. */
export function validateRecompute(body: unknown): Invalid | null {
  const b = body as { sessionId?: unknown; items?: unknown } | null
  if (!b || typeof b !== 'object') return { field: 'body' }
  if (!validSessionId(b.sessionId)) return { field: 'sessionId' }
  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > MAX_RECOMPUTE_ITEMS) return { field: 'items' }
  for (const it of b.items as { foodId?: unknown; grams?: unknown; servings?: unknown; quantity?: unknown; theirs?: unknown }[]) {
    if (!it || typeof it !== 'object') return { field: 'items' }
    if (typeof it.foodId !== 'string' || it.foodId.length < 1 || it.foodId.length > 80 || !/^[\w:.\-]+$/.test(it.foodId)) return { field: 'items.foodId' }
    const g = it.grams, sv = it.servings, q = it.quantity
    if ([g, sv, q].filter((v) => v !== undefined).length !== 1) return { field: 'items.grams' } // exactly one of the three
    if (g !== undefined && !(typeof g === 'number' && Number.isFinite(g) && g >= 1 && g <= 3000)) return { field: 'items.grams' }
    if (sv !== undefined && !(typeof sv === 'number' && Number.isFinite(sv) && sv >= 0.1 && sv <= 20)) return { field: 'items.servings' }
    // What the person typed, as a count and a unit: the engine turns it into grams; the bounds are the ones compute_meal has.
    if (q !== undefined) { const why = quantityError(q, it.foodId); if (why !== null) return { field: 'items.quantity', foodId: it.foodId, why } }
    // `theirs` says an amount is the person's own: a boolean, and never on a recipe counted by serving (it has no weight to own).
    if (it.theirs !== undefined && (typeof it.theirs !== 'boolean' || sv !== undefined)) return { field: 'items.theirs' }
  }
  return null
}

/**
 * The shape of a dish to be counted from an assumed recipe (cost_dish). The one number the model
 * supplies is a portion weight, so it is bounded here; nothing else a model could add is allowed
 * through. These are engineering defaults, not medical thresholds. Returns the text of an `error`
 * the model can read and fix (a tool answers 200 even when the call was wrong), or null.
 */
export const MAX_DISH_INGREDIENTS = 20
export const MIN_DISH_GRAMS = 40
export const MAX_DISH_GRAMS = 1500
export function validateDish(body: unknown): string | null {
  const b = body as { dish?: unknown; ingredients?: unknown; totalGrams?: unknown; servings?: unknown } | null
  if (!b || typeof b !== 'object') return 'the request must be { dish, ingredients }.'
  if (typeof b.dish !== 'string' || b.dish.trim().length < 1 || b.dish.length > 80) return 'dish must be the name of the dish, up to 80 characters.'
  if (!Array.isArray(b.ingredients) || b.ingredients.length < 1 || b.ingredients.length > MAX_DISH_INGREDIENTS) {
    return `ingredients must be a list of 1 to ${MAX_DISH_INGREDIENTS} items, each { phrase, grams }.`
  }
  let total = 0
  for (const it of b.ingredients as Record<string, unknown>[]) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) return `ingredients must be a list of 1 to ${MAX_DISH_INGREDIENTS} items, each { phrase, grams }.`
    if (Object.keys(it).some((k) => !['phrase', 'grams', 'gramsStated'].includes(k))) {
      return 'ingredients take only phrase, grams and gramsStated: the engine computes everything else.'
    }
    if (typeof it.phrase !== 'string' || it.phrase.trim().length < 1 || it.phrase.length > 80) return 'each ingredient needs a short phrase, such as "beef chuck".'
    const g = it.grams
    if (!(typeof g === 'number' && Number.isFinite(g) && g >= 1 && g <= 1000)) return `grams for "${String(it.phrase).slice(0, 40)}" must be between 1 and 1000 for one portion.`
    if (it.gramsStated !== undefined && typeof it.gramsStated !== 'boolean') return 'gramsStated must be true or false.'
    total += g
  }
  if (total < MIN_DISH_GRAMS || total > MAX_DISH_GRAMS) return `the whole portion must weigh between ${MIN_DISH_GRAMS} and ${MAX_DISH_GRAMS} grams; this one is ${Math.round(total)}.`
  // What the person said about the whole dish: its weight, or how many portions. One or the other; the engine does the scaling.
  if (b.totalGrams !== undefined && b.servings !== undefined) return 'give totalGrams or servings, not both.'
  if (b.totalGrams !== undefined && !(typeof b.totalGrams === 'number' && Number.isFinite(b.totalGrams) && b.totalGrams >= MIN_DISH_GRAMS && b.totalGrams <= 3000)) return `totalGrams must be the weight of the whole dish the person said, between ${MIN_DISH_GRAMS} and 3000.`
  if (b.servings !== undefined && !(typeof b.servings === 'number' && Number.isFinite(b.servings) && b.servings >= 0.25 && b.servings <= 10)) return 'servings must be the number of portions the person said, between 0.25 and 10.'
  return null
}

/** A short salted hash: enough to tell two sources apart in a log, not to name one. */
const SALT = process.env.LOG_SALT ?? String(process.pid) + String(Date.now() >> 22)
export const sourceTag = (key: string | undefined) =>
  key ? createHash('sha256').update(SALT + key).digest('hex').slice(0, 8) : 'unknown'

/** Test hooks for `npm run eval:abuse`. */
export const _state = () => ({ keys: windows.size(), ceilingUsed: ceiling.used, anonCeilingUsed: anonCeiling.used })
export const _reset = () => { windows.clear(); ceiling = { day: '', used: 0 }; anonCeiling = { day: '', used: 0 } }

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

// ── Who is asking ─────────────────────────────────────────────────────────

/**
 * The address a limit is keyed on. An IPv4 address is itself. An IPv6 home or
 * office is handed a whole /64 (2^64 addresses), so keyed on the full address
 * one person could dodge a per-address limit by rotating through their own
 * block; the first four groups are the person.
 */
export function addressKey(ip?: string): string | undefined {
  if (!ip) return undefined
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  if (mapped) return mapped[1]
  if (!ip.includes(':')) return ip
  const [head, tail = ''] = ip.split('::')
  const h = head ? head.split(':') : []
  const t = tail ? tail.split(':') : []
  const groups = ip.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h
  return `${groups.slice(0, 4).map((g) => g.toLowerCase().padStart(4, '0')).join(':')}::/64`
}

/** An id the client chose: word characters and hyphens, 64 at most. */
export const validSessionId = (id: unknown): id is string =>
  typeof id === 'string' && id.length >= 1 && id.length <= MAX_SESSION_ID && /^[\w-]+$/.test(id)

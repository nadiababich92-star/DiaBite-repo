/**
 * Client for the DiaBite agent, which runs in Azure Foundry behind /agent/ask.
 *
 * The frontend sends the message plus today's state; the agent orchestrates
 * the engine tools and returns an answer, the verifier's verdict, and the tool
 * trace. Nothing here computes a number — the trace carries the engine's.
 *
 * Memory is keyed by sessionId on the server, which maps it to a Foundry
 * thread, so this client sends no thread id of its own.
 */
import type { DiaryEntry, Profile, Targets } from '../types'
import { renewSession } from './session'
import { deviceId } from './device'
import { signInReasonOf, type SignInReason } from './authCore'

/** Dev: proxied by Vite to the Container App (see vite.config.ts). Prod: set VITE_AGENT_URL. */
export const AGENT_URL = import.meta.env?.VITE_AGENT_URL ?? '/agent'

export interface AgentRequest {
  sessionId: string
  message: string
  budget: { glBudget: number; carbsG: number; kcal: number }
  entries: { foodId: string; grams?: number; servings?: number }[]
  /**
   * What must never be offered: allergens from onboarding and foods excluded by
   * hand. Sent with the day state so the engine can filter suggestions itself —
   * an allergy is not something to leave to a prompt.
   */
  avoid?: { allergens?: string[]; foodIds?: string[]; pattern?: string; avoided?: string[]; words?: string[] }
  /** The person's own carbohydrate number for what they are asking about; the engine compares it, the answer only reads the result. */
  carbLimit?: { kind: 'meal' | 'snack'; g: number }
  /** The person's units; parked with the day so the engine says a weight in them ("1 cup (158 g)" or "158 g"). */
  units?: 'imperial' | 'metric'
  /**
   * Set only when the person's profile hides the weekly menu: the engine then offers no smaller portion as a swap. Parked with the day, in
   * memory, and never named after the condition (docs/specs/swaps-engine.md, section 6).
   */
  portionSwaps?: false
  /** A question from the main box: the engine starts a new conversation. The "Your answer" box under a question leaves it out, and continues. */
  newTopic?: true
}

export interface TraceStep {
  tool: string
  input: unknown
  result: unknown
}

export interface AgentResponse {
  answer: string
  /** Present on safety-gate refusals. */
  blocked?: boolean
  /** Which safety rule fired: 'dosing' or 'red_flag'. */
  blockedRule?: string
  verified?: boolean
  matchedNumbers?: number[]
  unmatchedNumbers?: number[]
  verifierError?: string | null
  /** The model's text failed the check and was not shown. */
  withheld?: boolean
  toolCalls?: number
  trace?: TraceStep[]
  /** Which specialist answered: the meal agent, or the advisor with no tools. */
  route?: 'meal' | 'advisor' | 'triage'
  /** Foods the engine's own check found left out of the count: the meal is partial and is never stamped Fits. */
  uncounted?: string[]
  /** The meal answer puts a question to the person (server/agent.ts asksPerson): the field to answer in is shown whatever the stamp. */
  asks?: boolean
}

/** Engine ids for diary entries: locally known foods are `seed:<id>`; agent-logged ones already carry theirs. */
export function engineId(entry: DiaryEntry): string {
  return entry.snapshot ? entry.foodId : `seed:${entry.foodId}`
}

export function budgetOf(t: Targets): AgentRequest['budget'] {
  return { glBudget: t.glBudget, carbsG: t.carbsG, kcal: t.kcal }
}

/** Onboarding answers the engine needs when it ranks alternatives. */
export function avoidOf(p: Profile): AgentRequest['avoid'] {
  // A copy: pushing onto the profile's own array would persist 'gluten' into it.
  const allergens = [...(p.allergens ?? [])]
  // Only the everyday foods are known to the engine; a hand-typed ingredient (`ing:`) is kept out of the menu, not sent here.
  const foodIds = (p.excludedFoodIds ?? []).filter((id) => !id.startsWith('ing:')).map((id) => `seed:${id}`)
  // The engine accepts letters and spaces only (server/guard.ts), so a name like "half & half" is cleaned here, never refused there.
  const words = [...new Set((p.excludedFoodIds ?? []).filter((id) => id.startsWith('ing:')).map((id) => id.slice(4).replace(/[^a-z ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase()).filter((w) => w.length >= 3 && w.length <= 40))].slice(0, 50)
  if (p.comorbidities?.includes('celiac') && !allergens.includes('gluten')) allergens.push('gluten')
  const pattern = p.pattern && p.pattern !== 'none' ? p.pattern : undefined
  const avoided = [...(p.avoided ?? [])]
  return allergens.length || foodIds.length || pattern || avoided.length || words.length ? { allergens, foodIds, pattern, avoided, ...(words.length ? { words } : {}) } : undefined
}

/** The engine said "not now": over a limit, with how long to wait. Not an agent answer. */
export class RateLimitedError extends Error {
  constructor(public scope: 'ip' | 'session' | 'daily' | 'user' | 'anon_daily', public retryAfterSec: number) {
    super('rate_limited')
  }
}

/** The engine could not weigh the amount the person typed for that food (docs/specs/recorrect-engine.md): which food, why, and the units it can be said in. */
export class QuantityRefused extends Error {
  /** `no_measure`: that food has no such measure in USDA's tables. `out_of_range`: the number is too large for that unit. */
  constructor(public foodId: string, public why: string, public units: string[], public kind: 'no_measure' | 'out_of_range' = 'no_measure') { super('quantity_refused') }
}

/** One line of a meal sent to be counted again: exactly one of grams, servings or quantity; `theirs` marks an amount the person changed. */
export interface RecomputeItem {
  foodId: string
  grams?: number
  servings?: number
  quantity?: { count: number; unit: string }
  theirs?: boolean
}

/** The engine wants a signed-in person and was not given a good token. */
export class SignInRequiredError extends Error {
  /** Set only for a signed-out visitor: `free_limit` (the free answers are used) or `anonymous_off` (the feature was switched off). */
  readonly reason?: SignInReason
  /** Seconds until another free answer, when the engine says. */
  readonly retryAfterSec?: number
  constructor(why: { reason?: SignInReason; retryAfterSec?: number } = {}) {
    super('sign_in_required')
    this.reason = why.reason
    this.retryAfterSec = why.retryAfterSec
  }
}

/**
 * The headers of a request to the engine. A person with an access token sends the token and nothing else; a signed-out
 * visitor sends the random device id the engine counts free answers by (docs/specs/anon-screen.md, section 4).
 */
export function requestHeaders(token?: string | null): Record<string, string> {
  return { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : { 'x-diabite-device': deviceId() }) }
}

/** The 401 of the engine as an error: the body, when it is JSON, says why. */
async function signInRequired(res: Response): Promise<SignInRequiredError> {
  const body = await res.json().catch(() => null) as { reason?: unknown; retryAfterSec?: unknown } | null
  return new SignInRequiredError(signInReasonOf(body))
}

/** Longest question the engine accepts; the input stops there rather than failing late. */
export const MAX_QUESTION = 500

/**
 * How long to wait for an answer. A turn takes 6 to 20 seconds; the call has
 * been seen hanging for minutes from inside the container, and the question box
 * is disabled while it waits, so without a limit a hang strands the person.
 */
export const ASK_TIMEOUT_MS = 100_000

export async function askAgent(req: AgentRequest, signal?: AbortSignal, token?: string | null): Promise<AgentResponse> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(new Error('timeout')), ASK_TIMEOUT_MS)
  const onAbort = () => ctl.abort(signal?.reason)
  if (signal?.aborted) onAbort(); else signal?.addEventListener('abort', onAbort, { once: true })
  try {
    return await askOnce(req, ctl.signal, token)
  } catch (e) {
    if (ctl.signal.aborted && !signal?.aborted) throw new Error('That is taking too long. Please try again in a moment.')
    throw e
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

async function askOnce(req: AgentRequest, signal: AbortSignal, token?: string | null, renewed = false): Promise<AgentResponse> {
  const res = await fetch(AGENT_URL, {
    method: 'POST',
    headers: requestHeaders(token),
    body: JSON.stringify(req),
    signal,
  })
  if (res.status === 401) throw await signInRequired(res)
  // The id belongs to someone else, or was used before this person signed in: start a new session, once.
  if (res.status === 403 && !renewed) return askOnce({ ...req, sessionId: renewSession() }, signal, token, true)
  if (res.status === 404) throw new Error('The agent is not reachable — is the engine deployed?')
  if (res.status === 429) {
    const body = await res.json().catch(() => ({})) as { scope?: 'ip' | 'session' | 'daily' | 'user' | 'anon_daily'; retryAfterSec?: number }
    const wait = Number(body.retryAfterSec ?? res.headers.get('retry-after')) || 60
    throw new RateLimitedError(body.scope ?? 'ip', wait)
  }
  if (res.status >= 500) throw new Error('Something slowed down on our side, and nothing was counted. Your question is still here. Please try again.')
  if (!res.ok) throw new Error(`Agent error ${res.status}`)
  const data = (await res.json()) as AgentResponse
  if (typeof data.answer !== 'string') throw new Error('Unexpected reply from the agent')
  return data
}

// ── Reading the trace ───────────────────────────────────────────────────

export interface ReceiptLine {
  foodId: string
  name: string
  portion: string
  /** The engine's household measure for this weight ("1 cup"), when it has one. */
  measure?: string
  /** The unit that measure is in and what one weighs: the portion editor steps in it for a person on US units. */
  measureUnit?: { unit: string; unitGrams: number }
  /** The engine's words for a weight the person gave as a measure, in their units; the screen prints it as it is. */
  said?: string
  /** 'typical' when USDA lists only a regular or whole one and the engine used it: the receipt says so. */
  basis?: string
  /** What the engine echoed for this line; sent again, unchanged, when the person did not touch it (docs/specs/recorrect-screen.md). */
  quantity?: { count: number; unit: string }
  /** The household units this food can be said in beyond weights (the engine's `units`): what the weight field offers. */
  units?: string[]
  availableCarbs: number
  gi: number | null
  /** Null for a branded product: no glycemic index is published, so no load exists. */
  gl: number | null
  kcal: number
  carbs: number
  fiber: number
  protein: number
  fat: number
  grams: number
  servings?: number
}

export interface Receipt {
  lines: ReceiptLine[]
  total: number
  leftBefore: number | null
  leftAfter: number | null
  /** Foods the database lacks, left out of the sum: the total is understated. */
  partial?: string[]
  /** Branded items: carbohydrate counted, load not available. */
  unscored?: string[]
  /** Foods eaten earlier today with no load in our data (not in this meal): what is left of the day may be less (tracker #117). */
  dayUnscored?: string[]
  /** Foods the person named that the answer left out of its count, found by the server (`uncounted`, tracker #129): the total is only part of the meal. */
  uncounted?: string[]
  /** Every item is branded: the card shows carbohydrate, not a load. */
  carbsOnly?: boolean
  /**
   * A dish counted from an assumed recipe (cost_dish): an estimate from typical ingredients, never a
   * record of the meal. `assumedFoodIds` are the lines whose grams the agent assumed.
   */
  assumed?: { dish: string; assumedFoodIds: string[] }
  /** Where the numbers in this receipt came from, and whether anyone checked them (PRD E3). */
  sources: { text: string; verified: boolean }[]
}

/** One swap the engine returned for the heaviest item, as `compute_meal` carries it (docs/specs/swaps-engine.md, section 5). */
export interface AlternativeResult {
  id: string; name: string; unit?: 'g' | 'serving'; portion: number; gl: number; kcal: number
  /** 'swap' is a different food; 'portion' is less of the same food. Absent from an older engine. */
  change?: 'swap' | 'portion'
  /** Load saved against the item being replaced; `fitsMeal` is true when the meal fits the day after it, null when the engine was not told the meal. */
  gain?: number
  fitsMeal?: boolean | null
  /** The engine's phrase for it, with its weight. */
  label?: string
  grams?: number; servings?: number
  /** Portions only: the food it is less of, and the fraction. */
  portionOf?: string; fraction?: number
}

interface MealResult {
  alternatives?: AlternativeResult[]
  alternativesFor?: { foodId: string; name: string; grams: number }
  items: {
    foodId: string; name: string; grams: number; servings?: number
    kcal: number; carbs: number; fiber: number; protein: number; fat: number
    availableCarbs: number; gi: number | null; gl: number | null
    /** The grams said as a household measure the engine found in the food's own USDA table; absent when none fits. */
    measure?: { count: number; unit: string; text: string }
    stepUnit?: { unit: string; unitGrams: number }
    /** What the person said as a measure was turned into this weight by the engine: the words for it and how it was got. */
    said?: string
    basis?: string
    quantity?: { count: number; unit: string }
    units?: string[]
  }[]
  totals: { gl: number; carbs?: number; fiber?: number; availableCarbs?: number }
  /** The budget before this meal; compute_meal returns it when it was given a session. */
  dayState?: { remaining?: { gl: number } }
  afterMeal?: { remaining?: { gl: number }; fits?: boolean | null; partial?: { unknownFoods: string[]; unscored?: string[]; dayUnscored?: string[] }; carbLimit?: CarbLimitResult }
  /** Present on a cost_dish result: the dish was counted from an assumed recipe. */
  assumed?: boolean
  dish?: string
  ingredients?: { foodId: string; assumedGrams: boolean }[]
}

interface DayStateResult { remaining: { gl: number } }

function unwrap(result: unknown): unknown {
  return Array.isArray(result) && result.length === 1 ? result[0] : result
}

/**
 * Foundry names a tool call after the tool *and* the operation, so
 * compute_meal arrives as diabite_engine_compute_meal. n8n used the bare
 * operation. Match either, so a trace from either runtime reads the same.
 */
function isCall(step: TraceStep, operation: string): boolean {
  return step.tool === operation || step.tool.endsWith(`_${operation}`)
}

/**
 * The call that costed the meal: the later of compute_meal and cost_dish. Both return the same
 * items, totals, day and verdict; a cost_dish result also says it was assumed.
 */
export function lastMealCall(trace: TraceStep[] | undefined): TraceStep | undefined {
  return [...(trace ?? [])].reverse().find((t) => isCall(t, 'compute_meal') || isCall(t, 'cost_dish'))
}

/** Build the receipt from the trace: the last meal-costing call, against get_day_state. */
export function receiptFrom(trace: TraceStep[] | undefined): Receipt | null {
  if (!trace) return null
  const meal = lastMealCall(trace)
  if (!meal) return null
  const m = unwrap(meal.result) as MealResult
  if (!m?.items) return null
  // The agent no longer calls get_day_state: the budget rides in the meal's own
  // reply. An older trace that still has the call is read as a fallback.
  const day = trace.find((t) => isCall(t, 'get_day_state'))
  const d = day ? (unwrap(day.result) as DayStateResult) : null
  const before = m.dayState?.remaining?.gl ?? d?.remaining?.gl
  const leftBefore = typeof before === 'number' ? before : null
  // Provenance for exactly the foods in this receipt: resolve_foods carries it
  // on each candidate, and the meal names the ids that were actually used.
  const used = new Set(m.items.map((it) => it.foodId))
  const sources = new Map<string, boolean>()
  for (const step of trace) {
    if (!isCall(step, 'resolve_foods')) continue
    const res = unwrap(step.result) as { results?: { candidates?: { id: string; source?: string; verifiedAt?: string }[] }[] }
    for (const phrase of res?.results ?? []) {
      for (const c of phrase.candidates ?? []) {
        if (!used.has(c.id) || !c.source) continue
        const text = sourceForPerson(c.source)
        sources.set(text, (sources.get(text) ?? false) || !!c.verifiedAt)
      }
    }
  }

  const assumed = m.assumed === true
    ? { dish: m.dish ?? 'dish', assumedFoodIds: (m.ingredients ?? []).filter((i) => i.assumedGrams).map((i) => i.foodId) }
    : undefined
  return buildReceipt(m, leftBefore, [...sources].map(([text, verified]) => ({ text, verified })), assumed)
}

/**
 * A record's source as the person reads it under the receipt: the data's own bookkeeping is left out (tracker #116, finding T). A USDA dish
 * whose computed glycemic index was withdrawn keeps the reason in its record ("withdrawn 20 November 2026: the ingredients with a USDA source
 * hold 69% of this dish's carbohydrate, below the 80% needed…", which the engine suite checks), and the person saw that sentence under their
 * pancakes on 25 November. What they need is already in the sentence before it: no glycemic index, so no glycemic load.
 */
export function sourceForPerson(source: string): string {
  return source.replace(/\s*withdrawn \d{1,2} [A-Z][a-z]+ \d{4}:[^]*$/, '').trim()
}

/** The receipt of one costed meal. The same lines whether the agent asked for the meal or the person changed a portion. */
export function buildReceipt(m: MealResult, leftBefore: number | null, sources: Receipt['sources'], assumed?: Receipt['assumed']): Receipt {
  const lines: ReceiptLine[] = m.items.map((it) => ({
    foodId: it.foodId, name: it.name,
    portion: it.servings ? `${it.servings} serving${it.servings === 1 ? '' : 's'}` : `${it.grams} g`,
    availableCarbs: it.availableCarbs, gi: it.gi, gl: it.gl,
    kcal: it.kcal, carbs: it.carbs, fiber: it.fiber, protein: it.protein, fat: it.fat,
    grams: it.grams, servings: it.servings, ...(it.measure?.text ? { measure: it.measure.text } : {}),
    ...(it.stepUnit ? { measureUnit: it.stepUnit } : {}),
    ...(it.said ? { said: it.said } : {}), ...(it.basis ? { basis: it.basis } : {}),
    ...(it.quantity ? { quantity: it.quantity } : {}), ...(it.units?.length ? { units: it.units } : {}),
  }))
  return {
    lines, total: m.totals.gl, leftBefore,
    // The engine's own figure for what is left, never a second subtraction made here: the comparison is the engine's, and a day
    // with a food that has no load is not the sum of the foods that do (the review of 13 November, finding 5).
    leftAfter: typeof m.afterMeal?.remaining?.gl === 'number' ? m.afterMeal.remaining.gl : null,
    sources,
    ...(m.afterMeal?.partial?.unknownFoods.length ? { partial: m.afterMeal.partial.unknownFoods } : {}),
    ...(m.afterMeal?.partial?.unscored?.length ? { unscored: m.afterMeal.partial.unscored } : {}),
    ...(m.afterMeal?.partial?.dayUnscored?.length ? { dayUnscored: m.afterMeal.partial.dayUnscored } : {}),
    ...(m.items.length > 0 && m.items.every((it) => it.gl === null) ? { carbsOnly: true } : {}),
    ...(assumed ? { assumed } : {}),
  }
}

/**
 * The engine's own comparison of a meal's carbohydrate with the number the person gave for the kind of meal it was parked
 * with when they asked. `over` is the engine's, never worked out in the browser: the screen says "above your number" only
 * when it is true, and it never changes the verdict.
 */
export interface CarbLimitResult { kind: 'meal' | 'snack'; limitG: number; mealG: number; over: boolean }

/** A meal costed again with a portion the person changed: the engine's numbers, and its verdict. */
export interface Recalc {
  receipt: Receipt
  mealGl: number
  before: number | null
  after: number | null
  /** The engine's own comparison: true fits, false does not, null a partial meal, undefined no day held. */
  fits: boolean | null | undefined
  /** The meal is a dish counted from an assumed recipe: the card says "Estimate", never a plain "Fits". */
  assumed?: boolean
  /** The same meal's carbohydrate, in grams, from the same engine result: shown beside the load. */
  carbs?: { carbs?: number; fiber?: number; availableCarbs?: number }
  /** The engine's comparison with the person's own number, for this recalculated meal. */
  carbLimit?: CarbLimitResult
}

const recomputeUrl = () => {
  const u = new URL(AGENT_URL, window.location.origin)
  u.pathname = u.pathname.replace(/\/agent(\/ask)?\/?$/, '/meal/recompute')
  return u.toString()
}

/**
 * Ask the engine to cost the same foods at other weights. No model runs, and no
 * number is worked out here: the browser sends weights and shows what comes back.
 */
export async function recomputeMeal(
  sessionId: string,
  items: RecomputeItem[],
  sources: Receipt['sources'],
  token?: string | null,
  signal?: AbortSignal,
  assumed?: Receipt['assumed'],
): Promise<Recalc> {
  const res = await fetch(recomputeUrl(), {
    method: 'POST',
    headers: requestHeaders(token),
    body: JSON.stringify({ sessionId, items }),
    signal,
  })
  if (res.status === 401) throw await signInRequired(res)
  if (res.status === 429) {
    const body = await res.json().catch(() => ({})) as { retryAfterSec?: number }
    throw new RateLimitedError('ip', Number(body.retryAfterSec ?? res.headers.get('retry-after')) || 60)
  }
  if (res.status === 403) throw new Error('This meal was calculated before you signed in. Ask about it again to change the portions.')
  if (res.status === 400) {
    const body = await res.json().catch(() => ({})) as { field?: string; foodId?: string; why?: string; units?: string[]; kind?: string }
    if (body.field === 'items.quantity' && typeof body.why === 'string') throw new QuantityRefused(String(body.foodId ?? ''), body.why, Array.isArray(body.units) ? body.units : [], body.kind === 'out_of_range' ? 'out_of_range' : 'no_measure')
  }
  if (!res.ok) throw new Error(`Recalculation failed (${res.status})`)
  const m = (await res.json()) as MealResult
  if (!m?.items || typeof m.totals?.gl !== 'number') throw new Error('Unexpected reply from the engine')
  const before = typeof m.dayState?.remaining?.gl === 'number' ? m.dayState.remaining.gl : null
  const after = typeof m.afterMeal?.remaining?.gl === 'number' ? m.afterMeal.remaining.gl : null
  return {
    receipt: buildReceipt(m, before, sources, assumed),
    mealGl: m.totals.gl, before, after,
    fits: m.afterMeal ? m.afterMeal.fits : undefined,
    carbs: { carbs: m.totals.carbs, fiber: m.totals.fiber, availableCarbs: m.totals.availableCarbs },
    ...(m.afterMeal?.carbLimit ? { carbLimit: m.afterMeal.carbLimit } : {}),
    ...(assumed ? { assumed: true } : {}),
  }
}

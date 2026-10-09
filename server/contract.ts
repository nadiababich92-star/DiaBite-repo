/**
 * Engine service API contract.
 *
 * Consumed by two clients: n8n (each endpoint is an HTTP Request tool the agent
 * can call) and the React frontend (which renders what comes back). Every
 * number the product shows originates here. Nothing else computes.
 */
import type { Nutrients } from '../src/types'
import type { Level } from '../src/lib/glycemic'

export type FoodKind = 'ingredient' | 'recipe'

export interface FoodSummary {
  id: string
  kind: FoodKind
  name: string
  /** null = no available carbohydrate, GI undefined */
  gi: number | null
  giLevel: Level | null
  category: string
  cuisine?: string
  /** How this record is portioned: grams for ingredients, servings for recipes. */
  unit: 'g' | 'serving'
  /** Sensible default portion in that unit. */
  defaultPortion: number
  /** Where these numbers came from, in words a user can read (PRD E3). */
  source?: string
  /** When a human last checked them against that source; absent means nobody has. */
  verifiedAt?: string
}

// ── resolve_foods ──────────────────────────────────────────────────────────

export interface ResolveRequest {
  /** Short food phrases the agent extracted from the user's text. */
  phrases: string[]
  topK?: number
  /**
   * The day-state session. Passing it returns today's budget with the
   * resolution, which saves a whole model round trip — and a round trip is
   * four seconds of someone standing in a kitchen.
   */
  sessionId?: string
}

export interface ResolveCandidate extends FoodSummary {
  /** Cosine similarity plus lexical boost, 0..1-ish. */
  score: number
}

export type Confidence = 'high' | 'medium' | 'low'

export interface ResolvedPhrase {
  phrase: string
  confidence: Confidence
  candidates: ResolveCandidate[]
  /** Present when the agent should ask exactly one question before proceeding. */
  clarify?: string
  /** True when nothing in the verified data is close enough to use. */
  unknown: boolean
}

export interface ResolveResponse {
  results: ResolvedPhrase[]
  /** Today's budget, when a session id came with the request. */
  dayState?: DayStateResponse | DayStateUnknown
}

// ── compute_meal / get_day_state ──────────────────────────────────────────

export interface MealItemInput {
  foodId: string
  /** For ingredients. */
  grams?: number
  /** For recipes. Defaults to 1. */
  servings?: number
}

export interface MealItemResult extends Nutrients {
  foodId: string
  name: string
  kind: FoodKind
  grams: number
  servings?: number
  availableCarbs: number
  gi: number | null
  gl: number
  glLevel: Level
}

export interface MealTotals extends Nutrients {
  availableCarbs: number
  gl: number
  /** Carb-weighted mean GI of the meal, null if almost no carbohydrate. */
  gi: number | null
  glLevel: Level
}

export interface ComputeMealRequest {
  items: MealItemInput[]
  /** Returns the day state with the meal, saving another round trip. */
  sessionId?: string
  /**
   * Ask for swaps in the same call. The engine only looks for them when the
   * meal actually needs them — over the remaining budget, or a high load — so
   * asking costs nothing on a meal that fits.
   */
  withAlternatives?: boolean
}

export interface ComputeMealResponse {
  items: MealItemResult[]
  totals: MealTotals
  /** Today's budget, when a session id came with the request. */
  dayState?: DayStateResponse | DayStateUnknown
  /**
   * What would be left of the day if this meal were eaten, and whether it
   * fits. The verdict is the first thing the answer has to state, so the
   * engine states it rather than letting the model subtract — and rather than
   * letting it spend a round trip looking for a number nobody returned.
   */
  afterMeal?: {
    remaining: { gl: number; carbsG: number; kcal: number }
    /**
     * `true` fits, `false` does not. `null` when the meal is partial and what
     * was costed still leaves room: an understated total cannot say the day is
     * safe, so the engine declines to. A partial meal that is already over is
     * still `false` — leaving a food out only makes the real total larger.
     */
    fits: boolean | null
    /** Foods the user named that the database does not have; absent on a whole meal. */
    partial?: { unknownFoods: string[] }
  }
  /** Swaps for the heaviest item, when the meal needed them. */
  alternatives?: Alternative[]
  /** Which item the alternatives replace. */
  alternativesFor?: { foodId: string; name: string; grams: number }
  /** The arithmetic, stated so the UI can show it verbatim. */
  formula: string
}

export interface DayBudget {
  glBudget: number
  carbsG: number
  kcal: number
}

import type { AvoidList } from './avoid'
export type { AvoidList }

export interface DayStateRequest {
  budget: DayBudget
  /** Everything logged today. The server keeps no state. */
  entries: MealItemInput[]
}

/** Returned instead of the day state when the session id is not held. */
export interface DayStateUnknown {
  unknown: true
  sessionId: string
}

export interface DayStateResponse {
  consumed: MealTotals
  remaining: { gl: number; carbsG: number; kcal: number }
  /** Consumed GL judged against the daily budget, not the portion scale. */
  dayLevel: Level
  entries: MealItemResult[]
}

// ── find_alternatives ─────────────────────────────────────────────────────

export interface AlternativesRequest {
  /** Either a record to find neighbours of, or free text describing what the user wants. */
  foodId?: string
  query?: string
  /** Only return options whose GL is at or under this. */
  maxGL: number
  /**
   * Portion of the item being replaced, in grams. Ingredient alternatives are
   * costed at this weight so a like-for-like swap compares like for like;
   * without it each candidate is costed at its own default portion.
   */
  grams?: number
  topK?: number
  /**
   * The day-state session. Passing it lets the engine drop anything the person
   * avoids before an option is ever offered — the filter must not depend on the
   * model remembering an allergy.
   */
  sessionId?: string
  sameCategory?: boolean
}

export interface Alternative extends FoodSummary {
  score: number
  gl: number
  kcal: number
  availableCarbs: number
  /** The portion these numbers are for. */
  portion: number
}

export interface AlternativesResponse {
  alternatives: Alternative[]
}

// ── verify ────────────────────────────────────────────────────────────────

export interface VerifyRequest {
  /** The agent's draft answer. */
  answer: string
  /** Every tool result the agent received this turn, verbatim. */
  toolResults: unknown[]
  /** The user's own message — numbers they typed may be echoed back. */
  userText?: string
}

export interface VerifyResponse {
  ok: boolean
  numbersInAnswer: number[]
  matched: number[]
  unmatched: number[]
}

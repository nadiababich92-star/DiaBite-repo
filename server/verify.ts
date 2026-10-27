/**
 * The verifier: every number in the agent's draft must trace to a tool result
 * (or to the user's own message). Anything else is an unmatched number and the
 * answer is rejected. This is the product's central claim, made mechanical.
 */
import type { VerifyRequest, VerifyResponse } from './contract'

const NUM = /-?\d+(?:[.,]\d+)?/g

/**
 * Digits that are part of a name, not a claim: "type 2 diabetes", "type 1",
 * "A1c", "HbA1c", "omega-3", "GLP-1", "SGLT2". Left in, they are numbers no
 * tool returned, so an advisor answer — which calls no tools at all — failed
 * verification for saying "type 2 diabetes", spent a regenerate, and still
 * reached the user wearing an unverified badge. Naming the drug class a
 * question turns on ("keto needs clinician input on an SGLT2 inhibitor") did
 * the same. The verifier exists to catch invented quantities; a disease's
 * name is not one, and neither is a drug's.
 */
const NAMED = /\b(type\s*)?[12]\b(?=\s*diabet)|\bhba1c\b|\ba1c\b|\bomega[-\s]?[36]\b|\bglp[-\s]?1\b|\bsglt[-\s]?2\b|\bb ?12\b|\bcovid[-\s]?19\b/gi

function numbersIn(text: string): number[] {
  return (text.replace(NAMED, ' ').match(NUM) ?? []).map((t) => parseFloat(t.replace(',', '.'))).filter((n) => Number.isFinite(n))
}

/**
 * Fields whose numbers are the engine's bookkeeping, not facts a person is told:
 * a candidate's search score, a record id, the session id. Counted as sources,
 * "the load is 0.77" would verify against a similarity score, and the digits in
 * "usda:2709464" would license a seven-digit figure. They stay in the trace;
 * they are not quotable.
 */
const BOOKKEEPING_KEYS = new Set(['score', 'id', 'foodId', 'sessionId', 'responseId', 'call_id'])
const LOOKS_LIKE_ID = /^[a-z]+:[\w.-]+$/i

/** Every numeric leaf in a tool result, plus numbers embedded in its strings. */
function collect(value: unknown, out: Set<number>): void {
  if (typeof value === 'number' && Number.isFinite(value)) { out.add(value); return }
  if (typeof value === 'string') { if (!LOOKS_LIKE_ID.test(value)) for (const n of numbersIn(value)) out.add(n); return }
  if (Array.isArray(value)) { for (const v of value) collect(v, out); return }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as object)) if (!BOOKKEEPING_KEYS.has(k)) collect(v, out)
  }
}

/**
 * A number in the answer matches a source number if it equals it, equals it
 * rounded to one decimal or to an integer, or is its negation (a deficit stated
 * as a positive "over by 8"). Nothing looser.
 */
function matches(a: number, src: number): boolean {
  if (Math.abs(a - src) < 1e-9) return true
  if (Math.abs(a - Math.round(src * 10) / 10) < 1e-9) return true
  if (Math.abs(a - Math.round(src)) < 1e-9) return true
  if (Math.abs(a + src) < 1e-9 || Math.abs(a + Math.round(src)) < 1e-9) return true
  return false
}

export function verify(req: VerifyRequest): VerifyResponse {
  const sources = new Set<number>()
  for (const r of req.toolResults ?? []) collect(r, sources)
  if (req.userText) for (const n of numbersIn(req.userText)) sources.add(n)
  // The one derived number the agent may legitimately state: what is left
  // after this meal — a day-state "remaining" minus a meal "totals". Nothing
  // broader: pairwise differences over every number would match anything.
  const remaining = (req.toolResults ?? []).map(r => (r as { remaining?: Record<string, number> })?.remaining).filter(Boolean)
  const totals = (req.toolResults ?? []).map(r => (r as { totals?: Record<string, number> })?.totals).filter(Boolean)
  for (const rem of remaining) for (const tot of totals) {
    for (const [rk, tk] of [['gl', 'gl'], ['carbsG', 'carbs'], ['kcal', 'kcal']] as const) {
      if (typeof rem![rk] === 'number' && typeof tot![tk] === 'number') sources.add(Math.round((rem![rk] - tot![tk]) * 10) / 10)
    }
  }

  const numbersInAnswer = numbersIn(req.answer)
  const matched: number[] = []
  const unmatched: number[] = []
  for (const n of numbersInAnswer) {
    let ok = false
    for (const s of sources) if (matches(n, s)) { ok = true; break }
    ;(ok ? matched : unmatched).push(n)
  }
  return { ok: unmatched.length === 0, numbersInAnswer, matched, unmatched }
}

/**
 * The verdict is the engine's, not the model's. The number check cannot see a wrong verdict, because no
 * number is wrong in "it fits": a meal the engine could only partly score (an unknown food, a branded one,
 * an assumed recipe, a day with unscored food) was once called "fits" in the model's own words. This reads
 * the sentences the model wrote and returns the first that states a verdict the engine did not give.
 *
 * `fits` is the engine's `afterMeal.fits`; `estimate` is true for an assumed recipe (`cost_dish`), where a
 * plain "fits" is never allowed even if the engine's comparison came out true. Conditional sentences ("if
 * your dish is like this, it fits"), questions, swaps and "can't judge" are not claims about this meal.
 */
const FIT_CLAIM = /\bfits\b|within (your |the |today'?s )?(budget|limit)/i
const NO_FIT_CLAIM = /\b(does not|doesn'?t|do not|won'?t|will not) fit\b|\bover (your |the |today'?s )?budget\b|\bover (your |the )?(limit|target)\b/i
const NOT_ABOUT_THIS_MEAL = /\bif\b|\bwould\b|\bcould\b|\bswap|\binstead\b|\balternative|\bbetter\b|\bthan\b|\?|can'?t (?:say|tell|judge)|cannot (?:say|judge)|\bnot\b|n'?t\b/i
const NOT_ABOUT_THIS_MEAL_NO_NEGATION = /\bif\b|\bwould\b|\bcould\b|\bswap|\binstead\b|\balternative|\bbetter\b|\bthan\b|\?/i

export function verdictConflict(answer: string, fits: boolean | null | undefined, estimate = false): string | null {
  const sentences = answer.split(/(?<=[.!?\n])/).map((s) => s.trim()).filter(Boolean)
  if (fits !== true || estimate) {
    // Anything but a plain, fully scored "fits": no sentence may say the meal fits.
    const s = sentences.find((x) => FIT_CLAIM.test(x) && !NOT_ABOUT_THIS_MEAL.test(x))
    if (s) return s
  }
  if (fits === true && !estimate) {
    const s = sentences.find((x) => NO_FIT_CLAIM.test(x) && !NOT_ABOUT_THIS_MEAL_NO_NEGATION.test(x))
    if (s) return s
  }
  return null
}

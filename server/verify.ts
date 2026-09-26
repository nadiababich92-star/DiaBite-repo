/**
 * The verifier: every number in the agent's draft must trace to a tool result
 * (or to the user's own message). Anything else is an unmatched number and the
 * answer is rejected. This is the product's central claim, made mechanical.
 */
import type { VerifyRequest, VerifyResponse } from './contract'

const NUM = /-?\d+(?:[.,]\d+)?/g

function numbersIn(text: string): number[] {
  return (text.match(NUM) ?? []).map((t) => parseFloat(t.replace(',', '.'))).filter((n) => Number.isFinite(n))
}

/** Every numeric leaf in a tool result, plus numbers embedded in its strings. */
function collect(value: unknown, out: Set<number>): void {
  if (typeof value === 'number' && Number.isFinite(value)) { out.add(value); return }
  if (typeof value === 'string') { for (const n of numbersIn(value)) out.add(n); return }
  if (Array.isArray(value)) { for (const v of value) collect(v, out); return }
  if (value && typeof value === 'object') { for (const v of Object.values(value as object)) collect(v, out) }
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

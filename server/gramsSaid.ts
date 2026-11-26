/**
 * A weight the person gave for one food, read from their own message (tracker #131, finding AE, 26 November 2026).
 *
 * "A medium baked potato (about 175 g)" was costed as 1 medium, 285 g: the agent sent the measure and dropped the grams, and the engine never
 * saw them. The person's grams are the most exact thing in the message, so the engine applies them, the way it applies the weight of a whole
 * dish (server/dishWeight.ts) and a count of pieces (server/pieces.ts).
 *
 * Narrow on purpose: only a weight in brackets right after a food ("a baked potato (about 175 g)") or a weight followed by "of" and the food
 * ("175 g of baked potato"). A weight at the end of the message is the whole dish's (dishWeight.ts) and is never read here. Pure.
 */
import { GRAMS_PER_OUNCE } from './quantity'

export interface GramsSaid { grams: number; phrase: string }

const HEDGE = '(?:about|around|roughly|approximately|approx\\.?|~)?\\s*'
const UNIT = '(g|grams?|oz|ounces?)'
const r1 = (x: number) => Math.round(x * 10) / 10
const toGrams = (n: string, u: string) => r1(parseFloat(n.replace(',', '.')) * (/^(oz|ounce)/i.test(u) ? GRAMS_PER_OUNCE : 1))
/** Where a food's words begin: after the last separator before it. */
const lastChunk = (s: string) => (s.split(/,|;|\band\b|\bwith\b|\bplus\b|\bon\b/i).pop() ?? '').trim()
/** Where they end: before the next separator after it. */
const firstChunk = (s: string) => (s.split(/,|;|\band\b|\bwith\b|\bplus\b|\bon\b|\(/i)[0] ?? '').trim()

export function gramsSaid(message: string): GramsSaid[] {
  const out: GramsSaid[] = []
  const m = message.trim()
  // "a medium baked potato (about 175 g)"
  for (const x of m.matchAll(new RegExp(`\\(\\s*${HEDGE}(\\d+(?:[.,]\\d+)?)\\s*${UNIT}\\s*\\)`, 'gi'))) {
    const phrase = lastChunk(m.slice(0, x.index ?? 0))
    if (phrase && /[a-z]{3,}/i.test(phrase)) out.push({ grams: toGrams(x[1], x[2]), phrase })
  }
  // "175 g of baked potato", "about 6 oz of salmon"
  for (const x of m.matchAll(new RegExp(`\\b${HEDGE}(\\d+(?:[.,]\\d+)?)\\s*${UNIT}\\s+of\\s+`, 'gi'))) {
    const phrase = firstChunk(m.slice((x.index ?? 0) + x[0].length))
    if (phrase && /[a-z]{3,}/i.test(phrase)) out.push({ grams: toGrams(x[1], x[2]), phrase })
  }
  return out.filter((g) => g.grams >= 1 && g.grams <= 3000).slice(0, 8)
}

type Item = { foodId: string; grams?: number; servings?: number; quantity?: { count: number; unit: string } }

/**
 * The items of a compute_meal call with the person's grams put on the food they named, where the agent sent a measure or nothing instead.
 * `names(phrase, recordName)` says whether the phrase names that record (resolve.ts phraseNames). A recipe is counted by serving and is left
 * alone; an item already sent as grams is the agent's reading of the same message and is left alone too. Changes the items in place.
 */
export function withGramsSaid(items: Item[], said: GramsSaid[] | undefined, lookup: (id: string) => { name?: string; kind?: string } | undefined,
  names: (phrase: string, name: string) => boolean): void {
  if (!said?.length) return
  for (const it of items) {
    if (it.grams !== undefined) continue
    const rec = lookup(it.foodId)
    if (!rec?.name || rec.kind === 'recipe') continue
    const hit = said.find((g) => names(g.phrase, rec.name!))
    if (!hit) continue
    delete it.servings
    // As a quantity in grams, so the engine marks it as the person's own weight (basis stated) and says it back as they said it.
    it.quantity = { count: hit.grams, unit: 'g' }
  }
}

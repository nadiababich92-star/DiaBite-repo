/**
 * "Two tacos" is a count of the dish's own pieces, not of its servings (tracker #116, finding S, 25 November 2026).
 *
 * "Two beef tacos on corn tortillas" was costed as 2 servings of "Beef Tacos with Corn Tortillas", a recipe of 4 servings holding 240 g of
 * corn tortillas: 60 g, two tortillas, a serving. Four tacos were counted for two, 54.8 g of carbohydrate for about 27.
 *
 * How many pieces a serving holds is read from the recipe's own shell (its tortillas, pitas or buns) and USDA's weight of one of them, never
 * guessed: a recipe whose shell is not in the table below, or whose shell weight is not close to a whole number of pieces, has no answer here,
 * and the engine asks for servings instead. Pure apart from the catalogue lookup passed in.
 */

/** A shell, by the curated ingredient a recipe lists, and the USDA survey row that weighs one of it (the medium one where USDA sizes them). */
export const SHELLS: Record<string, { usda: string; label: string; word: string }> = {
  'ing:corn_tortilla': { usda: 'usda:2707823', label: '1 medium', word: 'tortilla' }, // Tortilla, corn: 28 g
  'ing:flour_tortilla': { usda: 'usda:2707824', label: '1 medium', word: 'tortilla' }, // Tortilla, flour: 45 g
  'ing:whole_wheat_pita': { usda: 'usda:2707730', label: '1 medium pita', word: 'pita' }, // Bread, pita, whole wheat: 57 g
  'ing:hamburger_bun': { usda: 'usda:2707657', label: '1 hamburger bun', word: 'bun' }, // Roll, white, hamburger bun: 52 g
}

/** A serving's shell weight may sit this far from a whole number of shells and still be read as that number (60 g of 28 g tortillas: 2.1). */
const TOLERANCE = 0.25

type Lookup = (id: string) => ({ kind?: string; name?: string; portions?: { label: string; grams: number }[]; parts?: { id: string; grams: number }[] }) | undefined
type Recipe = { kind?: string; parts?: { id: string; grams: number }[] }

/** How many pieces one serving of the recipe holds, read from its shell; null when that cannot be read honestly. */
export function piecesPerServing(rec: Recipe, lookup: Lookup): { per: number; shell: string } | null {
  if (rec.kind !== 'recipe' || !rec.parts?.length) return null
  // The heaviest shell, if a recipe lists two (a pita and a bun is not a dish anyone counts in pieces).
  const shells = rec.parts.filter((p) => SHELLS[p.id]).sort((a, b) => b.grams - a.grams)
  if (shells.length === 0) return null
  const part = shells[0]
  const s = SHELLS[part.id]
  const one = lookup(s.usda)?.portions?.find((p) => p.label === s.label)?.grams
  if (!one || one <= 0) return null
  const ratio = part.grams / one
  const per = Math.round(ratio)
  if (per < 1 || Math.abs(ratio - per) / per > TOLERANCE) return null
  return { per, shell: s.word }
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, couple: 2,
}
/** A count said of a container or a measure, not of the dish's pieces: "two servings of tacos", "a plate of souvlaki", "a cup of soup". */
const NOT_PIECES = /\b(servings?|portions?|helpings?|plates?|platters?|bowls?|cups?|orders?|boxe?s?|trays?|pans?|slices?|halves|half|pieces? of|ounces?|oz|grams?|g|lbs?|pounds?)\b/i
const singular = (w: string) => w.toLowerCase().replace(/(ies)$/, 'y').replace(/(ches|shes|xes|ses|zes)$/, (m) => m.slice(0, -2)).replace(/(?<!s)s$/, '')

/**
 * Every count the person said, with the thing it counts: the message is cut into phrases (at commas, "and", "with", "on"), and in each phrase
 * the last number counts its last word ("two beef tacos" → 2, taco; "chicken souvlaki, two skewers" → 2, skewer). A phrase that names a
 * container or a measure ("two servings of tacos", "two taco plates", "a cup of miso soup", "a 12 oz can of Coke") counts nothing here.
 * Read from the person's own message, never the model's.
 */
export function countsSaid(message: string): { count: number; head: string }[] {
  const out: { count: number; head: string }[] = []
  const NUM = /\b(\d{1,2}|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|couple)\b/gi
  for (const phrase of message.toLowerCase().split(/[,;.!?()]|\band\b|\bwith\b|\bon\b|\bplus\b/)) {
    const nums = [...phrase.matchAll(NUM)]
    if (!nums.length) continue
    const last = nums[nums.length - 1]
    const raw = last[1]
    const rest = phrase.slice((last.index ?? 0) + raw.length).replace(/^\s+of\b/, '').trim()
    const words = rest.split(/\s+/).filter((w) => /^[a-z'-]+$/.test(w))
    if (!words.length || words.length > 4 || NOT_PIECES.test(rest)) continue
    const count = /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS[raw]
    const head = words[words.length - 1]
    if (!count || count > 20 || head.length < 3) continue
    out.push({ count, head: singular(head) })
    if (out.length >= 8) break
  }
  return out
}

/** The count of this recipe's own pieces the person said ("two tacos" of "Beef Tacos with Corn Tortillas"), or null. */
export function piecesOf(recipeName: string, counts: { count: number; head: string }[]): number | null {
  const words = new Set(recipeName.toLowerCase().split(/[^a-z'-]+/).filter((w) => w.length >= 3).map(singular))
  const hit = counts.find((c) => words.has(c.head))
  return hit ? hit.count : null
}

/**
 * The items of a compute_meal call, with a recipe sent as N servings turned into N pieces when the person's own message counted N of that
 * dish's pieces and the recipe says how many a serving holds ("two beef tacos" → 2 pieces → 1 serving). Changes the items in place; anything
 * else is left exactly as the model sent it. The prompt asks for `unit: "piece"` too; this is the rule that does not depend on it.
 */
export function countedAsPieces(
  items: { foodId: string; servings?: number; quantity?: { count: number; unit: string } }[],
  counts: { count: number; head: string }[] | undefined,
  lookup: Lookup,
): void {
  if (!counts?.length) return
  for (const it of items) {
    const rec = lookup(it.foodId)
    if (rec?.kind !== 'recipe' || !rec.name) continue
    const said = piecesOf(rec.name, counts)
    const sent = it.servings ?? (it.quantity && it.quantity.unit === 'default' ? it.quantity.count : undefined)
    if (said === null || sent !== said || !piecesPerServing(rec, lookup)) continue
    delete it.servings
    it.quantity = { count: said, unit: 'piece' }
  }
}

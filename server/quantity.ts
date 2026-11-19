/**
 * A person's measure turned into grams by the engine, not by the model (docs/specs/quantity-engine.md).
 *
 * "A medium apple" was counted at 100 g and "a cup of rice" at 180 g because the model estimated the weight; USDA's own tables say 200
 * g and 158 g. The agent now passes what the person said (a count and a unit) and this file finds the weight: from the food's own
 * USDA household row, from exact constants (an ounce is 28.3495 g), or from another volume row of the same food by the exact US ratios.
 * Where none of those is honest it says so (`needs`) and the agent asks; it never guesses and never borrows a density from another food.
 *
 * Pure: no I/O, no clock.
 */
import { ouncesText } from '../src/lib/measure'
import { householdMeasure, readPortion, type FoodRecord, type PortionRow } from './foods'

export const QUANTITY_UNITS = [
  'g', 'oz', 'lb',
  'cup', 'tbsp', 'tsp', 'fl oz',
  'slice', 'piece',
  'small', 'medium', 'large', 'whole',
  'default',
] as const
export type QuantityUnit = (typeof QUANTITY_UNITS)[number]

export interface Quantity { count: number; unit: QuantityUnit }
export type Basis = 'usda_measure' | 'exact_conversion' | 'typical' | 'default' | 'stated'

export const GRAMS_PER_OUNCE = 28.3495
export const GRAMS_PER_POUND = 453.592
/** Exact US volume ratios, in teaspoons. */
const TSP: Record<'tsp' | 'tbsp' | 'fl oz' | 'cup', number> = { tsp: 1, tbsp: 3, 'fl oz': 6, cup: 48 }
const VOLUME_SOURCES = ['cup', 'tbsp', 'tsp', 'fl oz'] as const

const r1 = (x: number) => Math.round(x * 10) / 10

export type Resolved =
  | { grams: number; basis: Basis; row?: PortionRow; via?: string; servings?: undefined }
  | { servings: number; basis: 'default'; grams?: undefined; row?: undefined; via?: undefined }
  | { needs: string }

/** Validation of what the model sent: null when it is a usable quantity, otherwise the error text. */
export function quantityError(q: unknown, foodId: string): string | null {
  const x = q as { count?: unknown; unit?: unknown } | null
  if (!x || typeof x !== 'object') return `quantity must be { count, unit } for ${foodId}`
  if (typeof x.unit !== 'string' || !(QUANTITY_UNITS as readonly string[]).includes(x.unit)) return `unit must be one of: ${QUANTITY_UNITS.join(', ')}`
  // A typo guard: a hundred cups is a mistake, but 450 g is a bowl. Grams go up to what the diary accepts for one entry (5,000 g).
  const most = x.unit === 'g' ? 5000 : 100
  if (typeof x.count !== 'number' || !Number.isFinite(x.count) || x.count <= 0 || x.count > most) return `quantity.count must be a positive number up to ${most} for ${foodId}`
  return null
}

/**
 * One amount per item. The same weight said twice ("450 g" sent as both `grams` and a `quantity` in grams) is one amount, not two, and
 * the redundant `grams` is dropped; two different amounts, or any two of grams, servings and quantity, are a mistake the agent corrects.
 * Returns the error text, or null when the item has one amount or none.
 */
export function settleAmount(it: { foodId: string; grams?: number; servings?: number; quantity?: unknown }): string | null {
  const q = it.quantity as { count?: unknown; unit?: unknown } | undefined
  if (it.grams !== undefined && it.servings === undefined && q && q.unit === 'g' && q.count === it.grams) delete it.grams
  if ([it.grams, it.servings, it.quantity].filter((v) => v !== undefined).length > 1) return `give exactly one of grams, servings, quantity for ${it.foodId}`
  return null
}

/** The plain household rows of a record (a qualified row, "cup, chopped", is never used here), in the order USDA lists them. */
function plainRows(rec: FoodRecord): PortionRow[] {
  return (rec.portions ?? []).map((p) => readPortion(p.label, p.grams, rec.name)).filter((r): r is PortionRow => r !== null && r.qualifier === '')
}

const largest = (rows: PortionRow[]) => rows.reduce((a, b) => (b.grams > a.grams ? b : a))

/** Which units this record can be said in: what `gramsFor` would accept for one of it. Always includes the exact weights. */
export function unitsFor(rec: FoodRecord): QuantityUnit[] {
  const out = new Set<QuantityUnit>(['g', 'oz', 'lb', 'default'])
  const rows = plainRows(rec)
  if (rows.some((r) => r.unit in TSP)) for (const u of ['cup', 'tbsp', 'tsp', 'fl oz'] as const) out.add(u)
  for (const r of rows) {
    if (r.unit === 'slice' || r.unit === 'piece' || r.unit === 'small' || r.unit === 'medium' || r.unit === 'large') out.add(r.unit)
    if (r.unit === 'whole' || r.unit === 'medium') { out.add('whole'); out.add('medium') }
  }
  return [...out]
}

/** `{ units }` for a candidate when the food can be said in more than weights and its usual portion; `{}` otherwise (so the reply stays small). */
export function householdUnitsFor(rec: FoodRecord): { units?: QuantityUnit[] } {
  const extra = unitsFor(rec).filter((u) => !['g', 'oz', 'lb', 'default'].includes(u))
  return extra.length ? { units: extra } : {}
}

export function gramsFor(rec: FoodRecord, q: Quantity): Resolved {
  const { count, unit } = q
  // A recipe is costed by serving, not by weight: four ounces of "Lemon Herb Grilled Chicken" was costed as a recipe at 0 g (18 November).
  if (rec.kind === 'recipe' && unit !== 'default') return { needs: 'a recipe is counted by serving' }
  // 1. Weights: exact, for any food that has a weight.
  if (unit === 'g') return { grams: r1(count), basis: 'stated' }
  if (unit === 'oz') return { grams: r1(count * GRAMS_PER_OUNCE), basis: 'exact_conversion' }
  if (unit === 'lb') return { grams: r1(count * GRAMS_PER_POUND), basis: 'exact_conversion' }
  // 2. The food's own usual portion, times the count. A recipe is counted by serving.
  if (unit === 'default') {
    if (rec.kind === 'recipe') return { servings: count, basis: 'default' }
    return { grams: r1(rec.defaultPortion * count), basis: 'default' }
  }
  if (rec.kind === 'recipe') return { needs: 'a recipe is counted by serving' }
  const rows = plainRows(rec)
  if (rows.length === 0) return { needs: 'this item has only a serving size' }
  const none = { needs: `no USDA household measure for this food in ${unit}` }

  // 3. Volumes: the food's own row, or exact ratios from another volume row of the same food.
  if (unit === 'cup' || unit === 'tbsp' || unit === 'tsp' || unit === 'fl oz') {
    const own = rows.find((r) => r.unit === unit)
    if (own) return { grams: r1(count * own.grams), basis: 'usda_measure', row: own }
    // The nearest volume row of the same food: USDA rounds each row, so the closest unit carries the least error.
    let best: { row: PortionRow; src: (typeof VOLUME_SOURCES)[number]; d: number } | null = null
    for (const src of VOLUME_SOURCES) {
      const row = rows.find((r) => r.unit === src)
      if (!row) continue
      const d = Math.abs(Math.log(TSP[unit] / TSP[src]))
      if (!best || d < best.d - 1e-9) best = { row, src, d }
    }
    return best ? { grams: r1(count * (TSP[unit] / TSP[best.src]) * best.row.grams), basis: 'usda_measure', row: best.row, via: best.src } : none
  }
  // 4. A part: a slice (the usual size first) or a piece.
  if (unit === 'slice') {
    const slices = rows.filter((r) => r.unit === 'slice')
    // The usual slice first. A table that lists only a small or thin slice (whole-wheat bread: 24 g) is not "a slice": that would understate it.
    for (const size of ['medium', undefined, 'large'] as const) {
      const row = slices.find((r) => r.size === size)
      if (row) return { grams: r1(count * row.grams), basis: 'usda_measure', row }
    }
    return none
  }
  if (unit === 'piece') {
    const row = rows.find((r) => r.unit === 'piece')
    return row ? { grams: r1(count * row.grams), basis: 'usda_measure', row } : none
  }
  // 5. One item. A small or a large needs its own row; a medium falls back to USDA's typical one, and says so.
  if (unit === 'small' || unit === 'large') {
    const row = rows.find((r) => r.unit === unit)
    return row ? { grams: r1(count * row.grams), basis: 'usda_measure', row } : none
  }
  const medium = rows.find((r) => r.unit === 'medium')
  const wholes = rows.filter((r) => r.unit === 'whole')
  if (unit === 'medium') {
    if (medium) return { grams: r1(count * medium.grams), basis: 'usda_measure', row: medium }
    if (wholes.length) { const row = largest(wholes); return { grams: r1(count * row.grams), basis: 'typical', row } }
    return none
  }
  // 'whole'
  if (wholes.length) { const row = largest(wholes); return { grams: r1(count * row.grams), basis: 'typical', row } }
  if (medium) return { grams: r1(count * medium.grams), basis: 'usda_measure', row: medium }
  return none
}

// ── the words ─────────────────────────────────────────────────────────────

const FRACTIONS: [number, string][] = [[0, ''], [1 / 4, '1/4'], [1 / 3, '1/3'], [1 / 2, '1/2'], [2 / 3, '2/3'], [3 / 4, '3/4']]

/** "1", "1/2", "1 1/2", "2/3"; any other count as a decimal of at most two places. */
export function countText(count: number): string {
  const whole = Math.floor(count + 1e-6)
  for (const [f, text] of FRACTIONS) {
    if (Math.abs(count - (whole + f)) <= 0.02 && whole + f > 0) return whole > 0 ? (text ? `${whole} ${text}` : `${whole}`) : text
  }
  return String(Math.round(count * 100) / 100)
}

/** The food's own name as a person says it: "Avocado" -> "avocado", "Banana (small amount)" -> "banana". */
const foodWord = (rec: FoodRecord): string => rec.name.split(/[,(]/)[0].trim().toLowerCase()
/** USDA's word for a whole item; "fruit", "item" and "each" are not things a person says, so the food's own name stands for them. */
const rowWord = (row: PortionRow, rec: FoodRecord): string => (['fruit', 'item', 'each'].includes(row.word) ? foodWord(rec) : row.word)

const gramsText = (g: number) => `${g >= 10 ? Math.round(g) : Math.round(g * 10) / 10} g`
const PLURAL = new Set(['cup', 'slice', 'piece'])

export interface SaidInput {
  grams: number
  basis: Basis
  quantity: Quantity
  row?: PortionRow
  rec: FoodRecord
  units: 'imperial' | 'metric' | undefined
}

/** The words a person reads for a weight: "1 cup (158 g)", "4 oz (113 g)", or just grams for a metric session. */
export function saidText(i: SaidInput): string {
  const g = gramsText(i.grams)
  if (i.units !== 'imperial' || i.basis === 'stated') return g
  if (i.basis === 'exact_conversion') { const oz = ouncesText(i.grams); return oz ? `${oz} (${g})` : g }
  if (i.basis === 'default') {
    const m = householdMeasure(i.rec.portions, i.grams)
    // "1/3 large" is not something a person says; a fraction is for a cup or a spoon, a counted thing is a whole number of them.
    if (m && (!['slice', 'piece', 'small', 'medium', 'large'].includes(m.unit) || Number.isInteger(m.count))) return `${m.text} (${g})`
    // The usual portion is one of the food's own USDA items ("1 banana = 126 g", "1 fruit = 150 g"): say it that way, not in ounces.
    const item = plainRows(i.rec).find((r) => r.unit === 'whole' && Math.abs(r.grams - i.grams) / i.grams <= 0.02)
    if (item) return `1 ${rowWord(item, i.rec)} (${g})`
    const oz = ouncesText(i.grams)
    return oz ? `${oz} (${g})` : g
  }
  // usda_measure or typical: the count said back, with the row's own word.
  const word = i.row && i.row.unit === 'whole' ? rowWord(i.row, i.rec) : i.row && ['small', 'medium', 'large', 'slice', 'piece'].includes(i.row.unit) ? i.row.word : i.quantity.unit
  const plural = i.quantity.count > 1 && (PLURAL.has(word) || word === foodWord(i.rec)) ? `${word}s` : word
  return `${countText(i.quantity.count)} ${plural} (${g})`
}

/** The question the agent asks when nothing honest can be said, in the session's units (the owner's wording). */
export function needsWeightHint(foodName: string, units: 'imperial' | 'metric' | undefined): string {
  const q = units === 'imperial' ? `About how many ounces or cups of ${foodName}?` : `About how many grams of ${foodName}?`
  return `ask the person exactly: "${q}" Do not estimate.`
}

/** The same question with <food> left for the agent to fill: `resolve_foods` carries it, so the agent can ask before any weight is tried. */
export const weightQuestion = (units: 'imperial' | 'metric' | undefined): string =>
  units === 'imperial' ? 'About how many ounces or cups of <food>?' : 'About how many grams of <food>?'

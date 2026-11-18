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
  if (typeof x.count !== 'number' || !Number.isFinite(x.count) || x.count <= 0 || x.count > 100) return `quantity.count must be a positive number up to 100 for ${foodId}`
  if (typeof x.unit !== 'string' || !(QUANTITY_UNITS as readonly string[]).includes(x.unit)) return `unit must be one of: ${QUANTITY_UNITS.join(', ')}`
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

export function gramsFor(rec: FoodRecord, q: Quantity): Resolved {
  const { count, unit } = q
  // 1. Weights: exact, for any food.
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
    for (const size of ['medium', undefined, 'large', 'small'] as const) {
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
    if (m) return `${m.text} (${g})`
    const oz = ouncesText(i.grams)
    return oz ? `${oz} (${g})` : g
  }
  // usda_measure or typical: the count said back, with the row's own word.
  const word = i.row && i.row.unit === 'whole' ? i.row.word : i.row && ['small', 'medium', 'large', 'slice', 'piece'].includes(i.row.unit) ? i.row.word : i.quantity.unit
  const plural = i.quantity.count > 1 && PLURAL.has(word) ? `${word}s` : word
  return `${countText(i.quantity.count)} ${plural} (${g})`
}

/** The question the agent asks when nothing honest can be said, in the session's units (the owner's wording). */
export function needsWeightHint(foodName: string, units: 'imperial' | 'metric' | undefined): string {
  const q = units === 'imperial' ? `About how many ounces or cups of ${foodName}?` : `About how many grams of ${foodName}?`
  return `ask the person exactly: "${q}" Do not estimate.`
}

/**
 * The portion editor for a person on US units: a food that has a household measure in its own USDA table is moved by that
 * measure (a quarter of a cup, one slice), not by ten grams. The weight of one unit comes from the engine (`unitGrams`); the grams
 * that result are still what the engine counts, so nothing is worked out here that the engine does not check again.
 */
export interface MeasureUnit { unit: string; unitGrams: number }

/** How far one tap moves each unit. A cup goes by quarters, a spoon by halves, a slice or an ounce by one. */
const STEP: Record<string, number> = { cup: 0.25, tbsp: 0.5, tsp: 0.5, 'fl oz': 1, oz: 1, slice: 1, piece: 1, medium: 1, small: 1, large: 1 }
/** The most of a unit that is said in it (the engine's own limit). */
const MOST: Record<string, number> = { cup: 8, tbsp: 4, tsp: 3, 'fl oz': 16, oz: 16, slice: 12, piece: 12, medium: 6, small: 6, large: 6 }
const FRACTIONS: [number, string][] = [[0, ''], [1 / 4, '1/4'], [1 / 3, '1/3'], [1 / 2, '1/2'], [2 / 3, '2/3'], [3 / 4, '3/4']]
const MAX_GRAMS = 1500

/** The words a unit is shown with in the weight field's select (docs/specs/recorrect-screen.md). Labels only: nothing here converts a unit. */
export const unitLabel = (unit: string): string => (unit === 'whole' ? 'whole' : unit)

/** How many of the unit the grams are, when that is a whole number or one of the simple fractions; null when it is not. */
export function countOf(grams: number, m: MeasureUnit): number | null {
  if (!(grams > 0) || !(m.unitGrams > 0)) return null
  const raw = grams / m.unitGrams
  const whole = Math.floor(raw)
  for (const [f] of FRACTIONS) {
    const c = whole + f
    if (c > 0 && Math.abs(raw - c) / raw <= 0.03) return c
  }
  const next = whole + 1
  return Math.abs(raw - next) / raw <= 0.03 ? next : null
}

/** "1 1/4 cups", "2 slices", "1 tbsp". */
export function countText(count: number, unit: string): string {
  const whole = Math.floor(count + 1e-6)
  const frac = FRACTIONS.find(([f]) => Math.abs(count - whole - f) < 0.02)?.[1] ?? ''
  const number = whole > 0 ? (frac ? `${whole} ${frac}` : `${whole}`) : frac
  return `${number} ${count > 1 && ['cup', 'slice', 'piece'].includes(unit) ? `${unit}s` : unit}`
}

/** The grams after one tap, in the unit's own steps; null when the unit is not one the editor knows. */
export function nudgeMeasure(grams: number, m: MeasureUnit, dir: 1 | -1): number | null {
  const base = STEP[m.unit]
  if (!base || !(grams > 0) || !(m.unitGrams > 0)) return null
  // A weight that is not a whole measure (180 g of rice, a cup being 158 g) moves to the next stop above or below it.
  const exact = countOf(grams, m)
  const now = exact ?? grams / m.unitGrams
  // From a third (1/3, 2/3) the next stop is the next third, so 1/3 goes to 2/3 and then to 1 rather than to 7/12.
  const third = exact !== null && Math.abs(now * 3 - Math.round(now * 3)) < 0.02 && Math.abs(now * 4 - Math.round(now * 4)) >= 0.02
  const s = third ? 1 / 3 : base
  const n = now / s
  const stops = dir > 0 ? Math.floor(n + 1e-6) + 1 : Math.ceil(n - 1e-6) - 1
  const count = Math.min(MOST[m.unit] ?? 12, Math.max(s, stops * s))
  return Math.min(MAX_GRAMS, Math.max(5, Math.round(count * m.unitGrams)))
}

/** What the stepper shows beside the grams, when the weight is a whole measure of the unit; null otherwise. */
export function measureLabel(grams: number, m: MeasureUnit | undefined): string | null {
  if (!m) return null
  const c = countOf(grams, m)
  return c === null ? null : countText(c, m.unit)
}

const GRAMS_PER_OUNCE = 28.3495
const GRAMS_PER_POUND = 453.592

/**
 * A weight said in ounces, for a person on US units, when the food has no household measure in its own USDA table. It only restates
 * the engine's grams, the way feet and inches restate centimetres: the grams stay beside it and are what is counted. One decimal under
 * ten ounces ("1.9 oz"), whole ounces after that, pounds from two (32 oz). Under 10 g it is null: a pinch of spice is not a number of ounces.
 */
/** Grams as a person reads them: whole grams from 10 g up, one decimal below ("113.4" is shown as "113", "4.5" stays). The count itself is never rounded. */
export const gramsShown = (g: number): number => (g >= 10 ? Math.round(g) : Math.round(g * 10) / 10)

export function ouncesText(grams: number): string | null {
  if (!(grams >= 10)) return null
  const oz = grams / GRAMS_PER_OUNCE
  if (oz >= 32) return `${Math.round((grams / GRAMS_PER_POUND) * 10) / 10} lb`
  return `${oz < 10 ? Math.round(oz * 10) / 10 : Math.round(oz)} oz`
}

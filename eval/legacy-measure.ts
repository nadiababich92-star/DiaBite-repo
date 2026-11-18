/**
 * A frozen copy of how `householdMeasure` and `stepUnit` read a USDA table before `readPortion` (18 November 2026). It exists only
 * so `npm run eval` can prove that reading more label shapes took no measure away and changed none a person already sees
 * (docs/specs/quantity-evals.md, Q7). Do not "fix" it: it is the reference.
 */
export interface LegacyHouseholdMeasure { count: number; unit: string; text: string }

// SR Legacy writes "tbsp" and "tsp"; the survey tables write the words. Both are the same measure.
const MEASURE_LABEL = /^(?:1 )?(cup|tablespoon|tbsp|teaspoon|tsp|fl oz|oz|slice|piece|medium|small|large)$/i
/** The most of a unit that is said in it: eleven tablespoons is two thirds of a cup, and nobody says it that way. */
const MOST_OF: Record<string, number> = { cup: 8, tablespoon: 4, teaspoon: 3, 'fl oz': 16, oz: 16, slice: 12, piece: 12, medium: 6, small: 6, large: 6 }
const FRACTIONS: [number, string][] = [[0, ''], [1 / 4, '1/4'], [1 / 3, '1/3'], [1 / 2, '1/2'], [2 / 3, '2/3'], [3 / 4, '3/4']]

/**
 * The household measure that says this many grams, taken from the record's own USDA table of measures and never worked out by
 * density: the grams must be a whole number or a simple fraction (1/4, 1/3, 1/2, 2/3, 3/4) of a listed measure within 3%, or
 * there is no measure and the screen shows grams only. A cup of rice and a cup of flour weigh different amounts, so a measure
 * the table does not list is never guessed. Among measures that fit, the largest unit wins (a cup, not sixteen tablespoons).
 * The grams stay the engine's number; this only says them the way a person in the US would.
 */
/**
 * USDA writes "4 oz" as the measure "oz" with the weight of four: the 4 is lost where the table is read, so a row "oz = 113 g"
 * is not one ounce. An ounce weighs 28.35 g and a fluid ounce of a food 26 to 34 g; any other weight under those labels is a
 * multiple of unknown size, and it is never said as "1 oz".
 */
function plausibleUnit(label: string, grams: number): boolean {
  const l = label.toLowerCase()
  if (l === 'oz') return grams >= 27 && grams <= 29.5
  if (l === 'fl oz') return grams >= 26 && grams <= 34
  return true
}

const STEP_UNITS = ['cup', 'slice', 'piece', 'medium', 'large', 'small', 'tbsp', 'tsp', 'oz', 'fl oz']
const UNIT_SHORT: Record<string, string> = { tablespoon: 'tbsp', teaspoon: 'tsp' }

/**
 * The unit the portion editor moves this food by: from the record's own table, the one the grams are closest to one of (never
 * under half of it: half a banana, not a third of a whole jicama), so a 180 g plate of rice steps by quarters of a 158 g cup
 * and a 100 g chicken breast, whose only measures are a 272 g piece and a four-ounce row that cannot be told from an ounce,
 * steps in grams. Null when none fits. It says nothing about what the portion is called; that is `householdMeasure`.
 */
export function legacyStepUnit(rows: { label: string; grams: number }[] | undefined, grams: number): { unit: string; unitGrams: number } | null {
  if (!rows?.length || !(grams > 0)) return null
  let best: { unit: string; unitGrams: number; d: number } | null = null
  for (const p of rows) {
    const m = MEASURE_LABEL.exec(String(p.label).trim())
    if (!m || !(p.grams > 0) || !plausibleUnit(m[1], p.grams)) continue
    const raw = m[1].toLowerCase()
    const unit = UNIT_SHORT[raw] ?? raw
    if (!STEP_UNITS.includes(unit)) continue
    const count = grams / p.grams
    if (count < 0.5 || count > (MOST_OF[raw] ?? MOST_OF[unit === 'tbsp' ? 'tablespoon' : unit === 'tsp' ? 'teaspoon' : unit] ?? 12)) continue
    const d = Math.abs(Math.log(count))
    if (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) <= 1e-9 && p.grams > best.unitGrams)) best = { unit, unitGrams: p.grams, d }
  }
  return best ? { unit: best.unit, unitGrams: best.unitGrams } : null
}

export function legacyHouseholdMeasure(rows: { label: string; grams: number }[] | undefined, grams: number): LegacyHouseholdMeasure | null {
  if (!rows?.length || !(grams > 0)) return null
  let best: { unitGrams: number; err: number; count: number; unit: string; fraction: string; whole: number } | null = null
  for (const p of rows) {
    const m = MEASURE_LABEL.exec(String(p.label).trim())
    if (!m || !(p.grams > 0) || !plausibleUnit(m[1], p.grams)) continue
    const unit = ({ tbsp: 'tablespoon', tsp: 'teaspoon' } as Record<string, string>)[m[1].toLowerCase()] ?? m[1].toLowerCase()
    for (let whole = 0; whole <= 12; whole++) {
      for (const [f, fraction] of FRACTIONS) {
        const count = whole + f
        if (count === 0 || count > (MOST_OF[unit] ?? 12)) continue
        const err = Math.abs(grams - count * p.grams) / grams
        if (err > 0.03) continue
        if (!best || p.grams > best.unitGrams || (p.grams === best.unitGrams && err < best.err)) best = { unitGrams: p.grams, err, count, unit, fraction, whole }
      }
    }
  }
  if (!best) return null
  const number = best.whole > 0 ? (best.fraction ? `${best.whole} ${best.fraction}` : `${best.whole}`) : best.fraction
  const short = best.unit === 'tablespoon' ? 'tbsp' : best.unit === 'teaspoon' ? 'tsp' : best.unit
  const plural = best.count > 1 && ['cup', 'slice', 'piece'].includes(short) ? `${short}s` : short
  return { count: Math.round(best.count * 1000) / 1000, unit: short, text: `${number} ${plural}` }
}


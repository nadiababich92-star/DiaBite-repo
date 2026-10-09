/**
 * The deterministic core behind compute_meal, get_day_state and find_alternatives.
 * All formulas live in src/lib/glycemic.ts and are shared with the browser.
 */
import { availableCarbs, dayGlLevel, glLevel, glycemicLoad, nutrientsFor } from '../src/lib/glycemic'
import { isAvoided, type AvoidList } from './avoid'
import { asFood, getRecord, loadFoods, summary } from './foods'
import { embed, type VectorStore } from './embeddings'
import { sameFamily, sameFood } from './resolve'
import type {
  Alternative, AlternativesRequest, ComputeMealResponse, DayBudget, DayStateResponse,
  MealItemInput, MealItemResult, MealTotals,
} from './contract'

export const FORMULA =
  'Available carbs = total carbs − fibre. GL = GI × available carbs ÷ 100. ' +
  'Recipes carry GI and GL per serving, computed from their ingredients (carb-weighted mean GI).'

const r1 = (x: number) => Math.round(x * 10) / 10

export function computeItem(input: MealItemInput): MealItemResult {
  const rec = getRecord(input.foodId)
  if (rec.kind === 'ingredient') {
    const food = asFood(rec)
    const grams = input.grams ?? rec.defaultPortion
    const n = nutrientsFor(food, grams)
    const avail = availableCarbs(food, grams)
    const gl = glycemicLoad(food, grams)
    return {
      foodId: rec.id, name: rec.name, kind: 'ingredient', grams,
      kcal: r1(n.kcal), carbs: r1(n.carbs), fiber: r1(n.fiber), protein: r1(n.protein), fat: r1(n.fat),
      availableCarbs: r1(avail), gi: rec.gi, gl: r1(gl), glLevel: glLevel(gl),
    }
  }
  const ps = rec.perServing!
  const servings = input.servings ?? 1
  const gramsPerServing = 0 // recipes are portioned by serving; grams unknown
  return {
    foodId: rec.id, name: rec.name, kind: 'recipe', grams: gramsPerServing, servings,
    kcal: r1(ps.kcal * servings), carbs: r1(ps.carbs * servings), fiber: r1(ps.fiber * servings),
    protein: r1(ps.protein * servings), fat: r1(ps.fat * servings),
    availableCarbs: r1(ps.availableCarbs * servings), gi: rec.gi,
    gl: r1(ps.gl * servings), glLevel: glLevel(ps.gl * servings),
  }
}

export function totalsOf(items: MealItemResult[]): MealTotals {
  const sum = (k: keyof MealItemResult) => r1(items.reduce((s, it) => s + (it[k] as number), 0))
  const gl = sum('gl')
  // Carb-weighted mean GI across items, using the shared helper for ingredients
  // and the recipe's own GI for recipes.
  const parts = items.map((it) => ({ gi: it.gi, carbs: it.availableCarbs }))
  const carbSum = parts.reduce((s, p) => s + (p.gi === null ? 0 : p.carbs), 0)
  const gi = carbSum < 0.5 ? null : Math.round(parts.reduce((s, p) => s + (p.gi === null ? 0 : p.gi * p.carbs), 0) / carbSum)
  return {
    kcal: sum('kcal'), carbs: sum('carbs'), fiber: sum('fiber'), protein: sum('protein'), fat: sum('fat'),
    availableCarbs: sum('availableCarbs'), gl, gi, glLevel: glLevel(gl),
  }
}

export function computeMeal(items: MealItemInput[]): ComputeMealResponse {
  const results = items.map(computeItem)
  return { items: results, totals: totalsOf(results), formula: FORMULA }
}

export function dayState(budget: DayBudget, entries: MealItemInput[]): DayStateResponse {
  const results = entries.map(computeItem)
  const consumed = totalsOf(results)
  return {
    consumed,
    remaining: {
      gl: r1(budget.glBudget - consumed.gl),
      carbsG: r1(budget.carbsG - consumed.carbs),
      kcal: Math.round(budget.kcal - consumed.kcal),
    },
    dayLevel: dayGlLevel(consumed.gl, budget.glBudget),
    entries: results,
  }
}

/** What an alternative "costs": at the requested grams for ingredients, per serving for recipes. */
function costOf(id: string, grams?: number): { gl: number; kcal: number; availableCarbs: number; portion: number } {
  const rec = getRecord(id)
  const input = rec.kind === 'ingredient' && grams ? { foodId: id, grams } : { foodId: id }
  const it = computeItem(input)
  return { gl: it.gl, kcal: it.kcal, availableCarbs: it.availableCarbs, portion: rec.kind === 'ingredient' ? it.grams : (it.servings ?? 1) }
}

export async function findAlternatives(
  store: VectorStore, req: AlternativesRequest, avoid?: AvoidList,
): Promise<Alternative[]> {
  const { byId } = loadFoods()
  const topK = req.topK ?? 5
  let query: Float32Array | undefined
  let anchor = req.foodId ? byId.get(req.foodId) : undefined
  if (anchor) query = await store.vectorOf(anchor.id)
  else if (req.query) [query] = await embed([req.query])
  if (!query) return []

  const filter = (id: string) => {
    if (anchor && id === anchor.id) return false
    const rec = byId.get(id)
    // Dropped before ranking, not after: an allergen is not a tie-breaker.
    if (rec && isAvoided(rec, avoid)) return false
    if (req.sameCategory && anchor) return rec?.category === anchor.category
    return true
  }
  // Over-fetch, then keep only what fits the budget.
  // Fetch wide. The coverage layer holds a dozen rows per staple, so the first
  // two dozen neighbours of white rice are all white rice with something on
  // it — filter those out of a small basket and nothing is left to suggest.
  const raw = await store.search(query, Math.max(topK * 8, 80), filter)
  // Curated first, coverage second — not a bonus on the score but a partition,
  // because a bonus was not enough: brown rice sits 48 neighbours away from
  // white rice while yellow rice sits 10, so the swap we offered for white
  // rice was yellow rice. The curated table is a few hundred staples chosen
  // for exactly this job; the coverage layer exists to recognise foods we
  // lack, not to recommend them. Within each half the vector order stands, so
  // a suggestion still resembles the thing it replaces.
  const curated = raw.filter((h) => !h.id.startsWith('usda:'))
  const coverage = raw.filter((h) => h.id.startsWith('usda:'))
  const hits = [...curated, ...coverage]
  const out: Alternative[] = []
  for (const h of hits) {
    // Same reason as in resolve: the store may know an id this build does not.
    const rec = byId.get(h.id)
    if (!rec) continue
    // A variation of the same food is not an alternative to it. The coverage
    // layer holds a dozen rows per staple, so the nearest vectors to white rice
    // are other white rices — and the product offered "swap the white rice for
    // rice, white, with vegetables and gravy", which is the same food with
    // gravy on it. Suggesting a swap means suggesting a different food.
    if (anchor && (sameFood(rec.name, anchor.name) || sameFamily(anchor.name, rec.name))) continue
    const cost = costOf(rec.id, req.grams)
    if (cost.gl > req.maxGL) continue
    // And a swap should be worth making: at least a fifth less load than the
    // thing it replaces, or it is noise dressed as advice.
    if (anchor) {
      const anchorCost = costOf(anchor.id, req.grams)
      if (anchorCost.gl > 0 && cost.gl > anchorCost.gl * 0.8) continue
    }
    // The curated table and the ingredient table both hold an Apple, so a list
    // of three swaps could be Apple, Apple, Watermelon.
    if (out.some((o) => sameFood(o.name, rec.name))) continue
    out.push({ ...summary(rec), score: Math.round(h.score * 1000) / 1000, ...cost })
    if (out.length >= topK) break
  }
  return out
}



/**
 * What is left of the day after a meal, and whether it fits.
 *
 * A food the database lacks was left out of the sum, so the total is
 * understated: "fits" is off the table (`null`), while "does not fit" is still
 * true, because leaving a food out can only make the real total larger.
 */
export function afterMealFor(
  remaining: { gl: number; carbsG: number; kcal: number },
  meal: { gl: number; carbs: number; kcal: number },
  unknownFoods: string[] = [],
) {
  const after = {
    gl: Math.round((remaining.gl - meal.gl) * 10) / 10,
    carbsG: Math.round((remaining.carbsG - meal.carbs) * 10) / 10,
    kcal: Math.round(remaining.kcal - meal.kcal),
  }
  const partial = unknownFoods.length > 0
  return {
    remaining: after,
    fits: partial ? (after.gl >= 0 ? null : false) : after.gl >= 0,
    ...(partial ? { partial: { unknownFoods } } : {}),
  }
}

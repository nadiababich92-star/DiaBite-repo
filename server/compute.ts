/**
 * The deterministic core behind compute_meal, get_day_state and find_alternatives.
 * All formulas live in src/lib/glycemic.ts and are shared with the browser.
 */
import { availableCarbs, dayGlLevel, glLevel, glycemicLoad, nutrientsFor } from '../src/lib/glycemic'
import { isAvoided, type AvoidList } from './avoid'
import { asFood, getRecord, hasNoLoad, householdMeasure, loadFoods, stepUnit, summary, type PortionRow } from './foods'
import { gramsFor, householdUnitsFor, saidText, unitsFor } from './quantity'
import { embed, type VectorStore } from './embeddings'
import { resolvePhrases, sameFamily, sameFood } from './resolve'
import type {
  Alternative, AlternativesRequest, ComputeMealResponse, CostDishRequest, DayBudget, DayStateResponse,
  DishIngredientResult, DishScale, MealItemInput, MealItemResult, MealTotals, UnresolvedIngredient,
} from './contract'

export const FORMULA =
  'Available carbs = total carbs − fibre. GL = GI × available carbs ÷ 100. ' +
  'Recipes carry GI and GL per serving, computed from their ingredients (carb-weighted mean GI).'

const r1 = (x: number) => Math.round(x * 10) / 10

export function computeItem(input: MealItemInput): MealItemResult {
  const rec = getRecord(input.foodId)
  if (rec.kind === 'branded' || rec.kind === 'unrated' || rec.kind === 'restaurant') {
    // Carbohydrate, fibre and energy are real; the glycemic load is not available
    // and is not estimated (the promise, and PLAN's option three). A branded product
    // gets them from its label, an unrated food from USDA's survey table, a restaurant
    // item from the chain's own published table.
    const grams = input.grams ?? rec.defaultPortion
    const p = rec.per100!
    const k = grams / 100
    return {
      foodId: rec.id, name: rec.name, kind: rec.kind, grams,
      kcal: r1(p.kcal * k), carbs: r1(p.carbs * k), fiber: r1(p.fiber * k), protein: r1(p.protein * k), fat: r1(p.fat * k),
      availableCarbs: r1(Math.max(0, p.carbs - p.fiber) * k), gi: null, gl: null, glLevel: null, loadAvailable: false,
    }
  }
  if (rec.kind === 'ingredient') {
    const food = asFood(rec)
    const grams = input.grams ?? rec.defaultPortion
    const n = nutrientsFor(food, grams)
    const avail = availableCarbs(food, grams)
    const gl = glycemicLoad(food, grams)
    return {
      foodId: rec.id, name: rec.name, kind: 'ingredient', grams,
      kcal: r1(n.kcal), carbs: r1(n.carbs), fiber: r1(n.fiber), protein: r1(n.protein), fat: r1(n.fat),
      availableCarbs: r1(avail), gi: rec.gi, gl: r1(gl), glLevel: glLevel(gl), loadAvailable: true,
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
    gl: r1(ps.gl * servings), glLevel: glLevel(ps.gl * servings), loadAvailable: true,
  }
}

export function totalsOf(items: MealItemResult[]): MealTotals {
  // A null load (a branded or unrated item) adds nothing: the total is the scored part, and
  // afterMeal.partial.unscored says that it is only that.
  const sum = (k: keyof MealItemResult) => r1(items.reduce((s, it) => s + ((it[k] as number | null) ?? 0), 0))
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

/** An item with its grams said as a household measure, when the record's own USDA table has one that fits. Nothing else changes. */
const withMeasure = (r: MealItemResult): MealItemResult => {
  const rows = getRecord(r.foodId).portions
  const m = r.grams > 0 ? householdMeasure(rows, r.grams) : null
  const step = r.grams > 0 ? stepUnit(rows, r.grams) : null
  const { units } = householdUnitsFor(getRecord(r.foodId))
  return { ...r, ...(m ? { measure: m } : {}), ...(step ? { stepUnit: step } : {}), ...(units ? { units } : {}) }
}

export interface QuantityPlan {
  /** The items with every `quantity` turned into grams (or servings for a recipe). */
  items: MealItemInput[]
  /** Per original item: what the person said and how it was weighed; absent for an item given as grams or servings. */
  meta: ({ quantity: NonNullable<MealItemInput['quantity']>; basis: NonNullable<MealItemResult['basis']>; row?: PortionRow } | undefined)[]
  /** Items that could not honestly be weighed: the meal is not costed. */
  needs: NonNullable<import('./contract').NeedsWeightResponse['needsWeight']>
}

/** Turn what the person said into weights, from the food's own USDA table or exact constants; nothing is guessed (server/quantity.ts). */
export function planQuantities(items: MealItemInput[]): QuantityPlan {
  const out: QuantityPlan = { items: [], meta: [], needs: [] }
  for (const it of items) {
    if (!it.quantity) { out.items.push(it); out.meta.push(undefined); continue }
    const rec = getRecord(it.foodId)
    const r = gramsFor(rec, it.quantity)
    if ('needs' in r) { out.needs.push({ foodId: it.foodId, name: rec.name, quantity: it.quantity, units: unitsFor(rec), why: r.needs }); out.items.push(it); out.meta.push(undefined); continue }
    out.items.push(r.servings !== undefined ? { foodId: it.foodId, servings: r.servings } : { foodId: it.foodId, grams: r.grams })
    out.meta.push({ quantity: it.quantity, basis: r.basis, row: r.row })
  }
  return out
}

/** Attach to each result what the person said, how it was weighed and the words for it (in the session's units). */
export function withSaid(results: MealItemResult[], plan: QuantityPlan, units: 'imperial' | 'metric' | undefined): MealItemResult[] {
  return results.map((r, i) => {
    const m = plan.meta[i]
    if (!m) return r
    const said = r.servings !== undefined && r.grams === 0 ? undefined : saidText({ grams: r.grams, basis: m.basis, quantity: m.quantity, row: m.row, rec: getRecord(r.foodId), units })
    return { ...r, quantity: m.quantity, basis: m.basis, ...(said ? { said } : {}) }
  })
}

/** The person's own amount (they typed it or moved it): the words keep the unit they used, and the basis says it is theirs, not an assumption. */
export function markTheirs(it: MealItemResult, units: 'imperial' | 'metric' | undefined): MealItemResult {
  const said = it.said ?? saidText({ grams: it.grams, basis: 'stated', quantity: { count: it.grams, unit: 'g' }, rec: getRecord(it.foodId), units })
  return { ...it, basis: 'stated', said }
}

/**
 * The same meal costed again with amounts the person changed (POST /meal/recompute): what they typed as a count and a unit is turned into grams here, by
 * the function compute_meal uses; an amount that cannot honestly be weighed refuses the whole call (nothing is costed), naming the item; an amount marked
 * `theirs` comes back `stated`, and every other item keeps the basis the engine gave it.
 */
export function recountMeal(items: MealItemInput[], units: 'imperial' | 'metric' | undefined):
  { refused: QuantityPlan['needs'][number] } | { meal: ComputeMealResponse } {
  const plan = planQuantities(items)
  if (plan.needs.length > 0) return { refused: plan.needs[0] }
  const costed = computeMeal(plan.items)
  return { meal: { ...costed, items: withSaid(costed.items, plan, units).map((it, i) => (items[i].theirs ? markTheirs(it, units) : it)) } }
}

export function computeMeal(items: MealItemInput[]): ComputeMealResponse {
  const results = items.map(computeItem).map(withMeasure)
  return { items: results, totals: totalsOf(results), formula: FORMULA }
}

/**
 * Sort a proposed dish into what can be counted and what cannot.
 *
 * Only a phrase that resolves with HIGH confidence and no clarifying question is counted. A medium
 * or unknown phrase, an ambiguous one, and one that resolves to a whole recipe are returned in
 * `unresolved` and never substituted: a dish may be counted from its own ingredients, but an
 * ingredient the database lacks is still left out and named (rule 3). The model supplied the words
 * and the portion weights; every nutrition figure comes from `computeMeal` over what is returned.
 */
/** The words that say how a food was prepared; USDA writes them last ("Potatoes, boiled"). */
const PREPARED = /^(boiled|hard-boiled|soft-boiled|cooked|raw|baked|roasted|fried|grilled|steamed|dried|canned|stewed|mashed|sauteed|sautéed|poached|drained)$/

/**
 * "potatoes, boiled" -> "boiled potatoes". A model writing in the style of a food table puts the
 * preparation after a comma, and the resolver reads that as a different, ambiguous phrase. The words
 * are the same and only their order changes: nothing is substituted for what was written (rule 3).
 */
export function uninvertPhrase(phrase: string): string {
  const parts = phrase.split(',').map((p) => p.trim())
  if (parts.length !== 2 || !parts[0] || !PREPARED.test(parts[1].toLowerCase())) return phrase
  return `${parts[1]} ${parts[0]}`
}

/**
 * The amount the person said, applied to a dish the model costed from a typical recipe (docs/specs/quantity-agent.md).
 * `totalGrams`: the person gave the weight of the whole dish, so the assumed ingredients are scaled until they add up to it
 * (an amount the person stated for one ingredient stays as it is and counts toward the total). `servings`: the ingredients are for
 * one portion and the dish is multiplied. The model never multiplies or scales; it sends words and one portion.
 */
export function scaleDish(req: CostDishRequest): { req: CostDishRequest; scaled?: DishScale } | { error: string } {
  const { totalGrams, servings } = req
  if (totalGrams === undefined && servings === undefined) return { req }
  if (totalGrams !== undefined && servings !== undefined) return { error: 'give totalGrams or servings, not both.' }
  const stated = req.ingredients.filter((i) => i.gramsStated === true).reduce((s, i) => s + i.grams, 0)
  const assumed = req.ingredients.filter((i) => i.gramsStated !== true).reduce((s, i) => s + i.grams, 0)
  if (assumed <= 0) return { req }
  const factor = totalGrams !== undefined ? (totalGrams - stated) / assumed : (servings as number)
  if (!(factor > 0)) return { error: `totalGrams ${totalGrams} is no more than the ${Math.round(stated)} g the person stated for single ingredients; leave those out of the dish or ask what the dish weighs.` }
  const ingredients = req.ingredients.map((i) => (i.gramsStated === true ? i : { ...i, grams: r1(i.grams * factor) }))
  const f = Math.round(factor * 1000) / 1000
  return { req: { ...req, ingredients }, scaled: totalGrams !== undefined ? { by: 'totalGrams', factor: f, totalG: totalGrams } : { by: 'servings', factor: f, servings } }
}

export async function planDish(store: VectorStore, req: CostDishRequest): Promise<{
  costed: MealItemInput[]
  ingredients: DishIngredientResult[]
  unresolved: UnresolvedIngredient[]
}> {
  const resolved = await resolvePhrases(store, req.ingredients.map((i) => uninvertPhrase(i.phrase)), 3, { asIngredient: true })
  const costed: MealItemInput[] = []
  const ingredients: DishIngredientResult[] = []
  const unresolved: UnresolvedIngredient[] = []
  req.ingredients.forEach((ing, i) => {
    const r = resolved[i]
    const top = r?.candidates[0]
    if (!r || r.unknown || !top) { unresolved.push({ phrase: ing.phrase, reason: 'unknown' }); return }
    if (r.confidence !== 'high' || r.clarify) {
      unresolved.push({ phrase: ing.phrase, reason: 'ambiguous', ...(r.clarify ? { clarify: r.clarify } : {}) })
      return
    }
    if (top.kind === 'recipe') { unresolved.push({ phrase: ing.phrase, reason: 'not_an_ingredient' }); return }
    costed.push({ foodId: top.id, grams: ing.grams })
    ingredients.push({
      phrase: ing.phrase, foodId: top.id, name: top.name, grams: ing.grams,
      assumedGrams: ing.gramsStated !== true, confidence: r.confidence,
    })
  })
  return { costed, ingredients, unresolved }
}

export function dayState(budget: DayBudget, entries: MealItemInput[]): DayStateResponse {
  const results = entries.map(computeItem)
  const consumed = totalsOf(results)
  const unscored = [...new Set(results.filter((r) => !r.loadAvailable).map((r) => r.name))]
  return {
    consumed,
    remaining: {
      gl: r1(budget.glBudget - consumed.gl),
      carbsG: r1(budget.carbsG - consumed.carbs),
      kcal: Math.round(budget.kcal - consumed.kcal),
    },
    dayLevel: dayGlLevel(consumed.gl, budget.glBudget),
    entries: results,
    ...(unscored.length ? { unscored } : {}),
  }
}

/**
 * The meal's unscored items plus the day's. A lunch of pizza has no glycemic load, so the room left at
 * four o'clock is understated, and an answer about an apple built on it is as partial as a meal missing a food.
 */
export function withDayUnscored(mealUnscored: string[], day: DayStateResponse): string[] {
  return [...new Set([...mealUnscored, ...(day.unscored ?? [])])]
}

/** What an alternative "costs": at the requested grams for ingredients, per serving for recipes. */
function costOf(id: string, grams?: number): { gl: number; kcal: number; availableCarbs: number; portion: number } {
  const rec = getRecord(id)
  const input = rec.kind === 'ingredient' && grams ? { foodId: id, grams } : { foodId: id }
  const it = computeItem(input)
  return { gl: it.gl ?? 0, kcal: it.kcal, availableCarbs: it.availableCarbs, portion: rec.kind === 'ingredient' ? it.grams : (it.servings ?? 1) }
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
    // An item with no load (branded, unrated, restaurant) has nothing to compare, so it is never a swap.
    if (hasNoLoad(rec?.kind)) return false
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
  unscored: string[] = [],
  carbLimit?: { kind: 'meal' | 'snack'; g: number },
) {
  const after = {
    gl: Math.round((remaining.gl - meal.gl) * 10) / 10,
    carbsG: Math.round((remaining.carbsG - meal.carbs) * 10) / 10,
    kcal: Math.round(remaining.kcal - meal.kcal),
  }
  const partial = unknownFoods.length + unscored.length > 0
  return {
    remaining: after,
    fits: partial ? (after.gl >= 0 ? null : false) : after.gl >= 0,
    ...(partial ? { partial: { unknownFoods, ...(unscored.length ? { unscored } : {}) } } : {}),
    // Returned only when the meal is above the person's own number. A meal within it is not news, and a number the model can see is a number it
    // may quote: the answer to "An apple" with a 60 g snack number said "It also stays under your 60 g snack target" about one time in six
    // (18 November 2026). With no field there is nothing to quote, so the rule "say nothing" no longer depends on the model obeying it.
    ...(carbLimit && meal.carbs > carbLimit.g ? { carbLimit: { kind: carbLimit.kind, limitG: carbLimit.g, mealG: meal.carbs, over: true as const } } : {}),
  }
}

/**
 * Which foods of this meal the person left out by hand (an excluded record, or a word typed from the recipes' ingredients).
 * The meal is counted as they described it: a person who types "pistachio ice cream" has said what they are eating. The
 * answer is told, so it says so once. Allergens from onboarding are not read here: they filter what is offered, not what was said.
 */
export function excludedIn(items: { foodId: string; name: string }[], avoid?: AvoidList): { foodId: string; name: string }[] {
  if (!avoid || !((avoid.foodIds?.length ?? 0) + (avoid.words?.length ?? 0))) return []
  const only: AvoidList = { foodIds: avoid.foodIds, words: avoid.words }
  const { byId } = loadFoods()
  return items.filter((it) => { const rec = byId.get(it.foodId); return !!rec && isAvoided(rec, only) }).map((it) => ({ foodId: it.foodId, name: it.name }))
}

/** Below this a food is not "driving" anything: a chicken breast (load 0) or half an avocado (0.2) drives no load (owner's decision, 19 November). */
export const DRIVER_MIN_GL = 5

/** The scored item with the largest load, when that load is at least DRIVER_MIN_GL; none when no item has one (branded products) or none is notable. */
export function driverOf(items: MealItemResult[]): { foodId: string; name: string; gl: number } | undefined {
  const scored = items.filter((it) => it.gl !== null)
  if (!scored.length) return undefined
  const top = scored.reduce((a, b) => ((b.gl ?? 0) > (a.gl ?? 0) ? b : a))
  if ((top.gl as number) < DRIVER_MIN_GL) return undefined
  return { foodId: top.foodId, name: top.name, gl: top.gl as number }
}

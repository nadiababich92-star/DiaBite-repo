/**
 * The deterministic core behind compute_meal, get_day_state and find_alternatives.
 * All formulas live in src/lib/glycemic.ts and are shared with the browser.
 */
import { availableCarbs, dayGlLevel, glLevel, glycemicLoad, nutrientsFor } from '../src/lib/glycemic'
import { isAvoided, type AvoidList } from './avoid'
import { asFood, getRecord, hasNoLoad, householdMeasure, loadFoods, stepUnit, summary, type PortionRow } from './foods'
import { mayReplace, potatoKind, standInsFor, swapClass } from './roles'
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

/**
 * Inside a dish, a category word is the member a dish usually holds (the owner's decision of 24 November 2026): "chicken" in a burrito
 * bowl or a stir-fry is chicken breast, "cheese" is cheddar. Alone, "chicken" is still a question (breast, thigh and fried differ too
 * much); in a dish the agent had already chosen the parts, and leaving the chicken out understated a 450 g bowl by a third (CL1).
 * The ingredient comes back with `assumedFood: true`, so the answer can say what was taken.
 */
export const DISH_DEFAULTS: Record<string, string> = {
  chicken: 'seed:chicken', 'cooked chicken': 'seed:chicken', 'grilled chicken': 'seed:chicken', 'chicken meat': 'seed:chicken',
  cheese: 'ing:cheddar', 'shredded cheese': 'ing:cheddar', 'grated cheese': 'ing:cheddar', 'cheddar cheese': 'ing:cheddar', 'shredded cheddar cheese': 'ing:cheddar',
}
const dishKey = (p: string) => p.toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim()

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
    const preset = DISH_DEFAULTS[dishKey(ing.phrase)]
    if (preset) {
      const rec = getRecord(preset)
      costed.push({ foodId: rec.id, grams: ing.grams })
      ingredients.push({ phrase: ing.phrase, foodId: rec.id, name: rec.name, grams: ing.grams, assumedGrams: ing.gramsStated !== true, confidence: 'high', assumedFood: true })
      return
    }
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
 * The foods eaten earlier today that have no load, less this meal's own (tracker #117). They make the room left uncertain, so the meal is
 * still never called a fit; but they are not in this meal, and the answer must not say the meal has them or left them out. Returned apart
 * from the meal's own (`afterMeal.partial.dayUnscored`), so the card can say "Day partly counted" for a meal that was counted whole.
 */
export function dayOnlyUnscored(mealUnscored: string[], day: DayStateResponse): string[] {
  return [...new Set((day.unscored ?? []).filter((n) => !mealUnscored.includes(n)))]
}

/** What an alternative "costs", at one quantity: grams for an ingredient, servings for a recipe. */
function costAt(id: string, q: { grams?: number; servings?: number }): { gl: number; kcal: number; availableCarbs: number; portion: number; grams?: number; servings?: number } | null {
  const rec = getRecord(id)
  const it = rec.kind === 'ingredient' ? computeItem({ foodId: id, grams: q.grams }) : computeItem({ foodId: id, servings: q.servings ?? 1 })
  if (it.gl === null) return null
  if (rec.kind === 'ingredient') return { gl: it.gl, kcal: it.kcal, availableCarbs: it.availableCarbs, portion: it.grams, grams: it.grams }
  const servings = q.servings ?? 1
  return { gl: it.gl, kcal: it.kcal, availableCarbs: it.availableCarbs, portion: servings, servings, ...(rec.servingGrams ? { grams: Math.round(rec.servingGrams * servings) } : {}) }
}

// Swaps worth making (docs/specs/swaps-engine.md). The numbers are the owner's of 23 November 2026; a clinician reviews them (Q33 to Q35).
export const SWAP_MIN_GAIN = 5            // glycemic load units
export const SWAP_MIN_GAIN_SHARE = 0.25   // of the anchor's load
export const SWAP_ENERGY_BAND = 0.30      // ±, of the anchor's energy at the comparison quantity
export const SWAP_SIMILAR_POOL = 12       // best N different foods by similarity, after the filters
export const PORTION_FRACTIONS = [0.75, 0.5] as const

/** "Banana (raw)" is "banana": the way a sentence would name it. Recipes keep their own name. */
const plainName = (rec: { kind: string; name: string }) => {
  const plain = rec.name.replace(/\s*\(.*?\)/g, '').split(',')[0].trim()
  return rec.kind === 'recipe' ? rec.name : plain.toLowerCase()
}
const fullName = (rec: { kind: string; name: string }) => {
  const n = rec.name.replace(/\s*\(.*?\)/g, '').replace(/\s+/g, ' ').trim()
  return rec.kind === 'recipe' || /^[A-Z]{2}/.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1)
}
const weight = (c: { grams?: number }) => (c.grams ? ` (${c.grams} g)` : '')
const FRACTION_WORD: Record<number, string> = { 0.75: 'three quarters of', 0.5: 'half' }

/** The engine's own words for an option, with its weight; the agent repeats them and composes nothing. */
export function swapLabel(rec: { kind: string; name: string }, c: { grams?: number; servings?: number }, fraction?: number): string {
  // A different food keeps the words that tell it from its neighbours ("pasta, whole grain, cooked", not "pasta"); less of the same food keeps the short name the person used.
  const name = fraction === undefined ? fullName(rec) : plainName(rec)
  if (fraction !== undefined) {
    if (rec.kind === 'recipe') return `${fraction === 0.5 ? 'half a serving' : 'three quarters of a serving'} of ${name}${weight(c)}`
    return `${FRACTION_WORD[fraction] ?? `${Math.round(fraction * 100)}% of`} the ${name}${weight(c)}`
  }
  return rec.kind === 'recipe' ? `${name}, ${c.servings === 1 || c.servings === undefined ? '1 serving' : `${c.servings} servings`}${weight(c)}` : `${name}${weight(c)}`
}

const COMPOSITE = /\b(with|and|sauce|casserole|gravy|stuffed|filled|topped)\b/i

export interface AlternativesOpts { allowPortion?: boolean }

export async function findAlternatives(
  store: VectorStore, req: AlternativesRequest, avoid?: AvoidList, opts: AlternativesOpts = {},
): Promise<Alternative[]> {
  const { byId } = loadFoods()
  const topK = req.topK ?? 5
  let query: Float32Array | undefined
  let anchor = req.foodId ? byId.get(req.foodId) : undefined
  if (anchor) query = await store.vectorOf(anchor.id)
  else if (req.query) [query] = await embed([req.query])
  if (!query) return []

  // The anchor, costed at the quantity it is in the meal.
  let anchorGL = 0, anchorKcal = 0
  let anchorQ: { grams?: number; servings?: number } = {}
  if (anchor) {
    anchorQ = anchor.kind === 'ingredient' ? { grams: req.grams ?? anchor.defaultPortion } : { servings: req.servings ?? 1 }
    const a = hasNoLoad(anchor.kind) ? null : costAt(anchor.id, anchorQ)
    // A food with no load, or none to save, has no swap.
    if (!a || a.gl <= 0) return []
    anchorGL = a.gl; anchorKcal = a.kcal
  }
  const fits = (gain: number): boolean | null =>
    req.mealGL !== undefined && req.remainingGL !== undefined ? req.mealGL - gain <= req.remainingGL + 1e-9 : null
  const worth = (gain: number, fitsMeal: boolean | null) =>
    gain > 0 && (fitsMeal === true || (gain >= SWAP_MIN_GAIN && gain >= SWAP_MIN_GAIN_SHARE * anchorGL))

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

  // No anchor, only words: today's rule, the load under the cap, in the store's order.
  if (!anchor) {
    const out: Alternative[] = []
    for (const h of hits) {
      const rec = byId.get(h.id)
      if (!rec) continue
      const c = costAt(rec.id, rec.kind === 'ingredient' ? { grams: req.grams } : { servings: 1 })
      if (!c || c.gl > req.maxGL) continue
      if (out.some((o) => sameFood(o.name, rec.name))) continue
      out.push({ ...summary(rec), score: Math.round(h.score * 1000) / 1000, change: 'swap', gain: 0, fitsMeal: null, label: swapLabel(rec, c), portion: c.portion, gl: c.gl, kcal: c.kcal, availableCarbs: c.availableCarbs, ...(c.grams ? { grams: c.grams } : {}), ...(c.servings ? { servings: c.servings } : {}) })
      if (out.length >= topK) break
    }
    return out
  }

  const anchorClass = swapClass(anchor)
  // The vegetable stand-ins for this food go first, so the pool of twelve cannot cut them off; they are judged by the same rules below.
  const standIns = new Set(standInsFor(anchor))
  for (const id of [...standIns].reverse()) if (byId.has(id) && filter(id) && !hits.some((h) => h.id === id)) hits.unshift({ id, score: 0 })
  const survivors: Alternative[] = []
  for (const h of hits) {
    // Same reason as in resolve: the store may know an id this build does not.
    const rec = byId.get(h.id)
    if (!rec) continue
    // A variation of the same food is not an alternative to it. The coverage
    // layer holds a dozen rows per staple, so the nearest vectors to white rice
    // are other white rices — and the product offered "swap the white rice for
    // rice, white, with vegetables and gravy", which is the same food with
    // gravy on it. Suggesting a swap means suggesting a different food.
    if (sameFood(rec.name, anchor.name) || sameFamily(anchor.name, rec.name)) continue
    // The quantity a candidate is compared at: the anchor's grams for an ingredient; for a recipe, one serving, or as many as the anchor if the anchor is a recipe.
    const q = rec.kind === 'ingredient' ? { grams: anchor.kind === 'ingredient' ? anchorQ.grams : (req.grams ?? rec.defaultPortion) } : { servings: anchor.kind === 'recipe' ? anchorQ.servings : 1 }
    const c = costAt(rec.id, q)
    if (!c || c.gl > req.maxGL) continue
    // The same kind of food, and about the same amount of it.
    const recClass = swapClass(rec)
    if (!mayReplace(anchorClass, recClass)) continue
    // A potato is not swapped for another way of cooking the same potato (canned, mashed, baked), and a survey vegetable nobody orders in place of
    // a starch (burdock, parsnips) is not offered for one: the vegetable that replaces a potato or rice is one of our own.
    const ap = potatoKind(anchor.name)
    if (ap && potatoKind(rec.name) === ap) continue
    if ((anchorClass === 'starch' || anchorClass === 'cooked-grain') && recClass === 'veg' && rec.id.startsWith('usda:')) continue
    // A survey record that is a prepared dish ("pasta, whole grain, with tomato sauce and poultry") is not a swap for a plain food, only for another dish.
    if (rec.id.startsWith('usda:') && COMPOSITE.test(rec.name) && !COMPOSITE.test(anchor.name)) continue
    // A stand-in may hold far less energy (cauliflower rice for rice) but never more than the food it replaces.
    if (!(standIns.has(rec.id) && c.kcal <= anchorKcal) && Math.abs(c.kcal - anchorKcal) > SWAP_ENERGY_BAND * anchorKcal) continue
    const gain = r1(anchorGL - c.gl)
    const fitsMeal = fits(gain)
    if (!worth(gain, fitsMeal)) continue
    // The curated table and the ingredient table both hold an Apple, so a list
    // of three swaps could be Apple, Apple, Watermelon.
    if (survivors.some((o) => sameFood(o.name, rec.name))) continue
    survivors.push({ ...summary(rec), score: Math.round(h.score * 1000) / 1000, change: 'swap', gain, fitsMeal, label: swapLabel(rec, c), portion: c.portion, gl: c.gl, kcal: c.kcal, availableCarbs: c.availableCarbs, ...(c.grams ? { grams: c.grams } : {}), ...(c.servings ? { servings: c.servings } : {}) })
    if (survivors.length >= SWAP_SIMILAR_POOL) break
  }

  const pool = [...survivors]
  if (opts.allowPortion !== false) {
    const portion = portionOption(anchor, anchorQ, anchorGL, req, avoid, fits, worth)
    if (portion) pool.push(portion)
  }
  // Fits the meal first, then the load saved, then likeness; a portion is the same food, so it wins a tie.
  const order = (a: Alternative, b: Alternative) =>
    (b.fitsMeal === true ? 1 : 0) - (a.fitsMeal === true ? 1 : 0) || b.gain - a.gain || b.score - a.score
  return pool.sort(order).slice(0, topK)
}

/** Less of the same food: the largest fraction that is still worth saying. */
function portionOption(
  anchor: ReturnType<typeof getRecord>, anchorQ: { grams?: number; servings?: number }, anchorGL: number, req: AlternativesRequest,
  avoid: AvoidList | undefined, fits: (g: number) => boolean | null, worth: (g: number, f: boolean | null) => boolean,
): Alternative | null {
  // Left out by hand: the engine does not suggest eating even half of it.
  if (isAvoided(anchor, avoid)) return null
  if (anchor.kind === 'ingredient' && (anchorQ.grams ?? 0) < 20) return null
  for (const f of PORTION_FRACTIONS) {
    const q = anchor.kind === 'ingredient' ? { grams: r1((anchorQ.grams ?? 0) * f) } : { servings: (anchorQ.servings ?? 1) * f }
    if (anchor.kind === 'ingredient' && (q.grams ?? 0) < 10) continue
    const c = costAt(anchor.id, q)
    if (!c || c.gl > req.maxGL) continue
    const gain = r1(anchorGL - c.gl)
    const fitsMeal = fits(gain)
    if (!worth(gain, fitsMeal)) continue
    const label = swapLabel(anchor, { grams: c.grams !== undefined ? Math.round(c.grams) : undefined, servings: c.servings }, f)
    return {
      ...summary(anchor), score: 1, change: 'portion', gain, fitsMeal, label, portion: c.portion, gl: c.gl, kcal: c.kcal, availableCarbs: c.availableCarbs,
      ...(c.grams !== undefined ? { grams: Math.round(c.grams) } : {}), ...(c.servings ? { servings: c.servings } : {}), portionOf: anchor.id, fraction: f,
    }
  }
  return null
}

/**
 * Swaps for a meal, when it needs them: over what is left of the day, or heavy on its own. Asking on a meal that fits would spend a search to print nothing.
 * Only a scored item can be "the heaviest": a branded or unrated one has no load to swap on. The route calls it; so do the evals.
 */
export async function alternativesForMeal(store: VectorStore, a: {
  meal: { items: MealItemResult[]; totals: MealTotals }
  remaining: number | undefined
  avoid?: AvoidList
  allowPortion: boolean
}): Promise<{ alternatives?: Alternative[]; alternativesFor?: { foodId: string; name: string; grams: number; servings?: number } }> {
  const { meal, remaining } = a
  const needsHelp = meal.totals.glLevel === 'high' || (remaining !== undefined && meal.totals.gl > remaining)
  if (!needsHelp) return {}
  const heaviest = meal.items.filter((it) => it.gl !== null).sort((x, y) => (y.gl ?? 0) - (x.gl ?? 0))[0]
  if (!heaviest || heaviest.gl === null) return {}
  const alternatives = await findAlternatives(store, {
    foodId: heaviest.foodId, grams: heaviest.grams, servings: heaviest.servings,
    maxGL: remaining !== undefined ? Math.max(0, remaining) : heaviest.gl,
    mealGL: meal.totals.gl, remainingGL: remaining, topK: 3,
  }, a.avoid, { allowPortion: a.allowPortion })
  return { alternatives, alternativesFor: { foodId: heaviest.foodId, name: heaviest.name, grams: heaviest.grams, ...(heaviest.servings ? { servings: heaviest.servings } : {}) } }
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
  notCounted: string[] = [],
  dayUnscored: string[] = [],
) {
  const after = {
    gl: Math.round((remaining.gl - meal.gl) * 10) / 10,
    carbsG: Math.round((remaining.carbsG - meal.carbs) * 10) / 10,
    kcal: Math.round(remaining.kcal - meal.kcal),
  }
  // A food of an earlier meal today with no load makes the room left uncertain just as one in this meal does: never "fits".
  const partial = unknownFoods.length + unscored.length + notCounted.length + dayUnscored.length > 0
  return {
    remaining: after,
    fits: partial ? (after.gl >= 0 ? null : false) : after.gl >= 0,
    ...(partial ? { partial: { unknownFoods, ...(unscored.length ? { unscored } : {}), ...(notCounted.length ? { notCounted } : {}), ...(dayUnscored.length ? { dayUnscored } : {}) } } : {}),
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

/**
 * A recipe that already holds a food the person named beside it (tracker #116, finding Q). "Chicken souvlaki, two skewers, with a whole wheat
 * pita, a quarter cup of tzatziki and a cucumber tomato salad" was costed as two servings of "Chicken Souvlaki Plate" (a plate that already
 * holds a pita, yogurt, cucumber and tomato) and the pita, the tzatziki and a salad beside it (25 November 2026): the pita counted twice.
 * The same food is the same id, or the same words in another order ("Bread, pita, whole wheat" and "Whole wheat pita"). Only a part that
 * carries carbohydrate (5 g or more available per 100 g) counts: two dishes that both hold cucumber are not a double count that matters, and
 * stopping the meal for it would ask a question about nothing. The burrito bowl and sandwich rules above are the same idea for two records
 * that have no ingredient list.
 */
export function recipeWithItsPart(ids: string[]): { dish: string; part: string } | null {
  const by = loadFoods().byId
  const words = (n: string) => n.toLowerCase().split(/[^a-z]+/).filter((w) => w && !['bread', 'plain', 'nfs', 'raw', 'cooked'].includes(w)).sort().join(' ')
  const carbs = (id: string) => { const r = by.get(id); return r?.per100 ? Math.max(0, r.per100.carbs - (r.per100.fiber ?? 0)) : 0 }
  for (const dishId of ids) {
    const dish = by.get(dishId)
    if (dish?.kind !== 'recipe' || !dish.parts) continue
    for (const otherId of ids) {
      if (otherId === dishId) continue
      const other = by.get(otherId)
      if (!other) continue
      const part = dish.parts.find((p) => p.id === otherId || (words(p.name) !== '' && words(p.name) === words(other.name)))
      if (part && carbs(part.id) >= 5) return { dish: dish.name, part: part.name }
    }
  }
  return null
}

/**
 * A sandwich record is the whole sandwich, its bread already in it. "A turkey sandwich on two slices of whole wheat bread" was costed as
 * "Turkey sandwich on white" and the two slices beside it, in 5 of 10 samples after the batch 3 prompt (24 November 2026): the same
 * meal counted twice. Plain sliced bread only: garlic bread or a roll on the side is its own food.
 */
export function sandwichWithItsBread(names: string[]): boolean {
  const sandwich = names.some((n) => /\b(sandwich|sub|wrap|panini|club)\b/i.test(n))
  const bread = names.some((n) => !/\bsandwich\b/i.test(n) && /^(bread\b|white bread|whole wheat bread|whole grain bread|whole-wheat bread|rye bread|multigrain bread|sourdough bread|pumpernickel)/i.test(n.trim()))
  return sandwich && bread
}

/**
 * Scale a meal's assumed amounts to the weight of the whole dish the person said (docs/engineering/dish-weight-cl1.md): every item's
 * amount must be the engine's assumption (no grams, no servings, no quantity other than `default`), there must be two items or more, and
 * the scale must be between a quarter and four times. Otherwise nothing changes and the reason comes back.
 */
export function scaleToDishWeight(original: MealItemInput[], plan: QuantityPlan, totalG: number):
  { plan: QuantityPlan; factor: number } | { notApplied: 'one item' | 'amounts given' | 'a recipe' | 'out of range' | 'already' } {
  if (original.length < 2) return { notApplied: 'one item' }
  if (original.some((it) => it.grams !== undefined || it.servings !== undefined || (it.quantity && it.quantity.unit !== 'default'))) return { notApplied: 'amounts given' }
  if (plan.items.some((it) => it.servings !== undefined || getRecord(it.foodId).kind === 'recipe')) return { notApplied: 'a recipe' }
  const grams = plan.items.map((it) => it.grams ?? getRecord(it.foodId).defaultPortion)
  const sum = grams.reduce((a, b) => a + b, 0)
  if (!(sum > 0)) return { notApplied: 'out of range' }
  if (Math.abs(sum - totalG) / totalG <= 0.02) return { notApplied: 'already' }
  const factor = totalG / sum
  if (factor < 0.25 || factor > 4) return { notApplied: 'out of range' }
  const r1x = (x: number) => Math.round(x * 10) / 10
  return {
    factor: Math.round(factor * 1000) / 1000,
    plan: { ...plan, items: plan.items.map((it, i) => ({ foodId: it.foodId, grams: r1x(grams[i] * factor) })), meta: plan.meta.map(() => undefined) },
  }
}


import { DISHES } from '../data/dishes'
import { dietaryReason } from './dietary'
import { FOODS, getFood } from '../data/foods'
import { addDays, isPlanned, MAX_AHEAD_DAYS } from './diary'
import type { DiaryEntry, Dish, FoodCategory, MealType, Nutrients, Profile, Targets } from '../types'
import { glycemicLoad, nutrientsFor, sumNutrients, weightedGI } from './glycemic'

/** Share of the daily allowance assigned to each meal. */
export const MEAL_SHARE: Record<MealType, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
}

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner']

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** A planned meal: the dish plus the portion scale chosen for it. */
export interface PlannedMeal {
  meal: MealType
  dish: Dish
  /** Weight multiplier applied to every ingredient of the base recipe. */
  scale: number
  nutrients: Nutrients
  gl: number
  gi: number | null
}

export interface PlannedDay {
  weekday: string
  meals: PlannedMeal[]
  totals: Nutrients
  gl: number
}

export interface WeekPlan {
  days: PlannedDay[]
  seed: number
  /** How many dishes survived this person's restrictions, out of the library. */
  pool: { available: number; total: number }
}

/** Deterministic PRNG, so the same seed reproduces the same menu. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Bounds on a plausible serving. The upper bound has to be generous: above a
// 2500 kcal target the base recipes otherwise fall short and the menu
// systematically under-delivers calories.
const MIN_SCALE = 0.6
const MAX_SCALE = 1.75

/** A recipe is served in quarters: half a serving to two, never 0.83 of one. */
const RECIPE_MIN = 0.5
const RECIPE_MAX = 2

function evaluate(dish: Dish, scale: number) {
  if (dish.serving) {
    const s = dish.serving
    return {
      nutrients: { kcal: s.kcal * scale, carbs: s.carbs * scale, fiber: s.fiber * scale, protein: s.protein * scale, fat: s.fat * scale },
      gl: s.gl * scale, gi: s.gi,
    }
  }
  const parts = dish.items.map((it) => ({ food: getFood(it.foodId), grams: it.grams * scale }))
  const nutrients = sumNutrients(parts.map((p) => nutrientsFor(p.food, p.grams)))
  const gl = parts.reduce((sum, p) => sum + glycemicLoad(p.food, p.grams), 0)
  return { nutrients, gl, gi: weightedGI(parts) }
}

/**
 * Picks a portion scale that lands the dish on the meal's energy target
 * without turning it into an implausibly huge or tiny plate.
 */
function fitScale(dish: Dish, targetKcal: number): number {
  const base = evaluate(dish, 1).nutrients.kcal
  if (dish.serving) return base <= 0 ? 1 : Math.min(RECIPE_MAX, Math.max(RECIPE_MIN, Math.round((targetKcal / base) * 4) / 4))
  if (base <= 0) return 1
  const raw = targetKcal / base
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(raw * 20) / 20))
}

/**
 * Penalty for a dish deviating from the targets of a meal.
 *
 * Carbohydrate and glycemic-load deviations are penalised asymmetrically:
 * overshooting costs 4-8x more than undershooting. For this audience eating
 * too few carbs is safer than eating too many, so the generator is biased
 * downward on purpose - a week typically lands well under the ceiling, and
 * that is expected. Calories are penalised symmetrically: undershooting there
 * just means going hungry.
 */
function score(
  meal: { nutrients: Nutrients; gl: number },
  targetKcal: number,
  targetCarbs: number,
  targetGL: number,
): number {
  const kcalDev = Math.abs(meal.nutrients.kcal - targetKcal) / Math.max(1, targetKcal)
  const carbOver = Math.max(0, meal.nutrients.carbs - targetCarbs) / Math.max(1, targetCarbs)
  const carbUnder = Math.max(0, targetCarbs - meal.nutrients.carbs) / Math.max(1, targetCarbs)
  const glOver = Math.max(0, meal.gl - targetGL) / Math.max(1, targetGL)
  const glUnder = Math.max(0, targetGL - meal.gl) / Math.max(1, targetGL)
  return kcalDev * 1.0 + carbOver * 2.0 + carbUnder * 0.5 + glOver * 2.5 + glUnder * 0.3
}

/** How many days a dish must not repeat within. */
const REPEAT_GAP = 3

/**
 * With a large library the best-fitting dishes are few, and picking the single best every time brings the same
 * ones back every third day. So the pick is among the first few by score, favouring the best, and a dish already
 * on this week's plan is passed over for as long as this many fresh ones remain.
 */
const PICK_FROM = 100
/** A dish is only in the running if it scores within this of the best: variety must not cost fit. */
const FIT_MARGIN = 1.0
const FRESH_ENOUGH = 6
/** The dishes in the running, best first, and which one this draw takes (favouring the best). */
const inTheRunning = <T extends { s: number }>(sorted: T[]) => sorted.filter((x) => x.s <= sorted[0].s + FIT_MARGIN).slice(0, PICK_FROM)
const pickIndex = (rnd: () => number, n: number) => Math.floor(rnd() ** 1.2 * n)

/**
 * Profiles a fixed plan of meals and calories is not DiaBite's to write: a
 * history of disordered eating, and kidney disease or dialysis (where protein
 * and potassium decide the plate). Until a clinician says otherwise the menu is
 * not shown to them, and no plan is computed. Deliberately narrow: gout,
 * gastroparesis, "my doctor mentioned my kidneys" and brittle diabetes are
 * questions for the clinicians (Q-W1 in the engineering plan), not decided here.
 */
export function menuHidden(profile: Profile): boolean {
  return profile.comorbidities.includes('eatingDisorder') || profile.kidney === 'ckd' || profile.kidney === 'dialysis'
}

/**
 * The recipes the menu may choose from, once they have been loaded (they are a separate file, fetched
 * when the Menu opens). Until then the library is the curated dishes alone. Set once, in file order, so a
 * week rebuilt from its seed is the week that was built.
 */
let RECIPES: Dish[] = []
export const setRecipes = (list: Dish[]) => { RECIPES = list }
export const recipeCount = () => RECIPES.length
const library = (): Dish[] => (RECIPES.length ? [...DISHES, ...RECIPES] : DISHES)

/** Words that name a food someone excluded by hand, to be looked for in a recipe's ingredients. Over-matching is the cheap mistake. */
const GENERIC = new Set(['white', 'brown', 'red', 'green', 'black', 'cooked', 'raw', 'fresh', 'dried', 'whole', 'plain', 'low', 'fat', 'mixed', 'sweet', 'with', 'and', 'the'])
export function excludedKeywords(foodId: string): string[] {
  const name = (getFood(foodId)?.name ?? '').toLowerCase().split(/[,(]/)[0]
  return [...new Set([...foodId.toLowerCase().split(/[-_ ]/), ...name.split(/[^a-z]+/)].filter((w) => w.length >= 3 && !GENERIC.has(w)))]
}

/** The dishes this person may be offered: the same answers the agent respects. */
function availableDishes(profile: Profile) {
  const excluded = new Set(profile.excludedFoodIds)
  const keywords = [...excluded].flatMap(excludedKeywords)

  // A week of meals has to respect the same answers the agent respects. It did
  // not: onboarding has been collecting allergens and an eating pattern while
  // this filtered on the hand-picked exclusions alone, so a celiac could be
  // handed a week with pasta in it.
  const avoid = { allergens: profile.allergens, pattern: profile.pattern }
  const forbidden = (d: Dish) => {
    if (d.ingredients) {
      // A recipe: its ingredients are names, so the hand-picked exclusions are looked for by word.
      const names = d.ingredients.map((i) => i.name.toLowerCase())
      // The name counts too: "Egg Roll Bowl" is not what someone who left out egg meant to be offered.
      const title = d.name.toLowerCase()
      if (keywords.some((k) => title.includes(k) || names.some((n) => n.includes(k)))) return true
      return dietaryReason([d.name, ...d.ingredients.map((i) => i.name)].join(' '), avoid) !== null
    }
    if (d.items.some((it) => excluded.has(it.foodId))) return true
    const text = [d.name, ...d.items.map((it) => getFood(it.foodId)?.name ?? '')].join(' ')
    return dietaryReason(text, avoid) !== null
  }
  return library().filter((d) => !forbidden(d))
}

export function generateWeek(profile: Profile, targets: Targets, seed = Date.now()): WeekPlan {
  const rnd = mulberry32(seed)
  const available = availableDishes(profile)
  const pool = { available: available.length, total: library().length }

  /** dishId -> index of the day the dish was last used. */
  const lastUsed = new Map<string, number>()
  const days: PlannedDay[] = []

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const meals: PlannedMeal[] = []
    const usedToday = new Set<string>()

    for (const meal of MEAL_ORDER) {
      const share = MEAL_SHARE[meal]
      const targetKcal = targets.kcal * share
      const targetCarbs = targets.carbsG * share
      const targetGL = targets.glBudget * share

      const candidates = available
        .filter((d) => d.meals.includes(meal))
        .filter((d) => !usedToday.has(d.id))
        .filter((d) => {
          const last = lastUsed.get(d.id)
          return last === undefined || dayIndex - last >= REPEAT_GAP
        })

      // If exclusions leave no candidates, relax the repeat rule.
      const fresh = candidates.filter((d) => !lastUsed.has(d.id))
      const pool =
        candidates.length > 0
          ? (fresh.length >= FRESH_ENOUGH ? fresh : candidates)
          : available.filter((d) => d.meals.includes(meal) && !usedToday.has(d.id))

      if (pool.length === 0) continue

      const scored = pool
        .map((dish) => {
          const scale = fitScale(dish, targetKcal)
          const ev = evaluate(dish, scale)
          // A small random nudge, so weeks do not come out identical when
          // several options score about the same.
          return { dish, scale, ev, s: score(ev, targetKcal, targetCarbs, targetGL) + rnd() * 0.15 }
        })
        .sort((a, b) => a.s - b.s)

      const running = inTheRunning(scored)
      const pick = running[pickIndex(rnd, running.length)]
      usedToday.add(pick.dish.id)
      lastUsed.set(pick.dish.id, dayIndex)
      meals.push({
        meal,
        dish: pick.dish,
        scale: pick.scale,
        nutrients: pick.ev.nutrients,
        gl: pick.ev.gl,
        gi: pick.ev.gi,
      })
    }

    days.push({
      weekday: WEEKDAYS[dayIndex],
      meals,
      totals: sumNutrients(meals.map((m) => m.nutrients)),
      gl: meals.reduce((s, m) => s + m.gl, 0),
    })
  }

  return { days, seed, pool }
}

export type ShoppingLine = { name: string; grams: number; category: FoodCategory }

/** One line per food, whichever dish it comes from: "Olive oil" in a curated dish and in a recipe is one line. */
function tally() {
  const totals = new Map<string, ShoppingLine>()
  return {
    add(name: string, grams: number, category: FoodCategory) {
      const key = name.trim().toLowerCase()
      const prev = totals.get(key)
      totals.set(key, { name: prev?.name ?? name, grams: (prev?.grams ?? 0) + grams, category: prev?.category ?? category })
    },
    // To the nearest 5 g: a list of "412 g" claims a precision the plan never had. A pinch of spice is
    // not shopping: under 5 g across the whole span it stays in the recipe.
    lines: (): ShoppingLine[] => [...totals.values()]
      .filter((x) => x.grams >= 5)
      .map((x) => ({ name: x.name, grams: Math.max(5, Math.round(x.grams / 5) * 5), category: x.category }))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
  }
}

/** Aggregated weekly shopping list: food -> total grams. */
export function shoppingList(plan: WeekPlan): ShoppingLine[] {
  const t = tally()
  for (const day of plan.days) {
    for (const m of day.meals) {
      for (const item of m.dish.items) { const f = getFood(item.foodId); t.add(f.name, item.grams * m.scale, f.category) }
      for (const ing of m.dish.ingredients ?? []) t.add(ing.name, ing.grams * m.scale, ing.category)
    }
  }
  return t.lines()
}

/** A recipe by the id a diary entry carries (`rec:DB-0001`), from the library once it is loaded. */
export const recipeForEntry = (foodId: string): Dish | undefined => {
  const id = foodId.startsWith('rec:') ? foodId.slice(4) : undefined
  return id ? RECIPES.find((r) => r.recipeId === id) : undefined
}

/**
 * The shopping list for what the person has planned: planned entries from `today` to the planning limit.
 * An eaten entry, or a plan on a day already gone, is not shopping. A recipe (`rec:`) is expanded into its
 * ingredients at the servings it was planned with; any other entry is the food at its weight, under the
 * category the local table gives it, or "Other" for a food only the engine knows. Grams are the ones already
 * stored or already in the recipe: nothing is estimated here.
 */
export function shoppingFromEntries(entries: DiaryEntry[], today: string, recipes: (foodId: string) => Dish | undefined = recipeForEntry): ShoppingLine[] {
  const last = addDays(today, MAX_AHEAD_DAYS)
  const t = tally()
  for (const e of entries) {
    if (!isPlanned(e) || e.date < today || e.date > last) continue
    const recipe = recipes(e.foodId)
    if (recipe?.ingredients) {
      const servings = e.snapshot?.servings ?? 1
      for (const ing of recipe.ingredients) t.add(ing.name, ing.grams * servings, ing.category)
      continue
    }
    const local = FOODS.find((f) => f.id === e.foodId)
    t.add(e.snapshot?.name ?? local?.name ?? e.foodId, e.grams, local?.category ?? 'other')
  }
  return t.lines()
}

/** The list as plain text, grouped by category, for pasting into a notes app. */
export function shoppingText(list: ShoppingLine[], labels: Record<FoodCategory, string>): string {
  const out: string[] = []
  let last = ''
  for (const item of list) {
    if (item.category !== last) { if (out.length) out.push(''); out.push(labels[item.category]); last = item.category }
    const amount = item.grams >= 1000 ? `${(item.grams / 1000).toFixed(2)} kg` : `${item.grams} g`
    out.push(`${item.name}, ${amount}`)
  }
  return out.join('\n')
}

export interface Replaced { plan: WeekPlan; relaxed: boolean; changed: boolean }

/**
 * Replace one meal and nothing else.
 *
 * Deterministic for a seed. The new dish is not the one being replaced, not
 * already in that day, and not used within REPEAT_GAP days either side in the
 * rest of the week; when exclusions leave nothing, the repeat rule is relaxed
 * (as the generator does) and `relaxed` says so, so the page can tell the
 * person rather than silently repeating.
 */
export function regenerateSlot(
  plan: WeekPlan, dayIndex: number, meal: MealType, profile: Profile, targets: Targets, seed: number,
): Replaced {
  const day = plan.days[dayIndex]
  const slot = day?.meals.findIndex((m) => m.meal === meal) ?? -1
  if (!day || slot < 0) return { plan, relaxed: false, changed: false }

  const rnd = mulberry32(seed)
  const current = day.meals[slot].dish.id
  const available = availableDishes(profile).filter((d) => d.meals.includes(meal) && d.id !== current)
  const inDay = new Set(day.meals.map((m) => m.dish.id))
  const nearby = (id: string) => plan.days.some((d, i) => i !== dayIndex && Math.abs(i - dayIndex) < REPEAT_GAP && d.meals.some((m) => m.dish.id === id))

  let candidates = available.filter((d) => !inDay.has(d.id) && !nearby(d.id))
  // Not a dish that is anywhere else on this week's plan, while enough others remain.
  const onPlan = new Set(plan.days.flatMap((d) => d.meals.map((m) => m.dish.id)))
  const fresh = candidates.filter((d) => !onPlan.has(d.id))
  if (fresh.length >= FRESH_ENOUGH) candidates = fresh
  let relaxed = false
  if (candidates.length === 0) { candidates = available.filter((d) => !inDay.has(d.id)); relaxed = true }
  if (candidates.length === 0) return { plan, relaxed: false, changed: false }

  const share = MEAL_SHARE[meal]
  const targetKcal = targets.kcal * share, targetCarbs = targets.carbsG * share, targetGL = targets.glBudget * share
  const best = candidates
    .map((dish) => {
      const scale = fitScale(dish, targetKcal)
      const ev = evaluate(dish, scale)
      return { dish, scale, ev, s: score(ev, targetKcal, targetCarbs, targetGL) + rnd() * 0.15 }
    })
    .sort((a, b) => a.s - b.s)
  const running = inTheRunning(best)
  const chosen = running[pickIndex(rnd, running.length)]

  const meals = day.meals.map((m, i) => i === slot
    ? { meal, dish: chosen.dish, scale: chosen.scale, nutrients: chosen.ev.nutrients, gl: chosen.ev.gl, gi: chosen.ev.gi }
    : m)
  const days = plan.days.map((d, i) => i === dayIndex
    ? { ...d, meals, totals: sumNutrients(meals.map((m) => m.nutrients)), gl: meals.reduce((t, m) => t + m.gl, 0) }
    : d)
  return { plan: { ...plan, days }, relaxed, changed: true }
}

/**
 * What it takes to bring a week back exactly: the seed it was generated from, and the
 * replacements made since, in order, each with the seed that chose it. Both generators are
 * deterministic for a seed, so this is a few numbers rather than a copy of the plan; and
 * if the person's restrictions change meanwhile, the same week is rebuilt for the new ones.
 */
export interface WeekState { seed: number; edits: { day: number; meal: MealType; seed: number }[] }

export function replayWeek(profile: Profile, targets: Targets, state: WeekState): { plan: WeekPlan; relaxed: boolean } {
  let plan = generateWeek(profile, targets, state.seed)
  let relaxed = false
  for (const e of state.edits) {
    const r = regenerateSlot(plan, e.day, e.meal, profile, targets, e.seed)
    if (r.changed) { plan = r.plan; relaxed = relaxed || r.relaxed }
  }
  return { plan, relaxed }
}

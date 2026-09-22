import { DISHES } from '../data/dishes'
import { getFood } from '../data/foods'
import type { Dish, FoodCategory, MealType, Nutrients, Profile, Targets } from '../types'
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

function evaluate(dish: Dish, scale: number) {
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

export function generateWeek(profile: Profile, targets: Targets, seed = Date.now()): WeekPlan {
  const rnd = mulberry32(seed)
  const excluded = new Set(profile.excludedFoodIds)

  const available = DISHES.filter((d) => !d.items.some((it) => excluded.has(it.foodId)))

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
      const pool =
        candidates.length > 0
          ? candidates
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

      const pick = scored[0]
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

  return { days, seed }
}

/** Aggregated weekly shopping list: food -> total grams. */
export function shoppingList(plan: WeekPlan): { name: string; grams: number; category: FoodCategory }[] {
  const totals = new Map<string, number>()
  for (const day of plan.days) {
    for (const m of day.meals) {
      for (const item of m.dish.items) {
        totals.set(item.foodId, (totals.get(item.foodId) ?? 0) + item.grams * m.scale)
      }
    }
  }
  return [...totals.entries()]
    .map(([id, grams]) => {
      const food = getFood(id)
      return { name: food.name, grams: Math.round(grams), category: food.category }
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
}

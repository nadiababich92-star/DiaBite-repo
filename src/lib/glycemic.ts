import type { Food, Nutrients } from '../types'

/** One bread unit = 12 g of available carbohydrate (a German/Eastern European convention). */
export const CARBS_PER_BREAD_UNIT = 12

/** Nutrients for a given weight of a food. */
export function nutrientsFor(food: Food, grams: number): Nutrients {
  const k = grams / 100
  return {
    kcal: food.per100.kcal * k,
    carbs: food.per100.carbs * k,
    fiber: food.per100.fiber * k,
    protein: food.per100.protein * k,
    fat: food.per100.fat * k,
  }
}

/**
 * Available (net) carbohydrate: total minus fibre.
 * This is what glycemic load and bread units are computed from.
 */
export function availableCarbs(food: Food, grams: number): number {
  const n = nutrientsFor(food, grams)
  return Math.max(0, n.carbs - n.fiber)
}

/**
 * Glycemic load of a portion: GL = GI x available carbohydrate / 100.
 * Foods with no GI (no carbohydrate) score 0.
 */
export function glycemicLoad(food: Food, grams: number): number {
  if (food.gi === null) return 0
  return (food.gi * availableCarbs(food, grams)) / 100
}

/** Bread units for a portion. */
export function breadUnits(food: Food, grams: number): number {
  return availableCarbs(food, grams) / CARBS_PER_BREAD_UNIT
}

export type Level = 'low' | 'medium' | 'high'

/** GI bands: low <=55, medium 56-69, high >=70. */
export function giLevel(gi: number | null): Level | null {
  if (gi === null) return null
  if (gi <= 55) return 'low'
  if (gi <= 69) return 'medium'
  return 'high'
}

/** Portion GL bands: low <=10, medium 11-19, high >=20. */
export function glLevel(gl: number): Level {
  if (gl <= 10) return 'low'
  if (gl < 20) return 'medium'
  return 'high'
}

/**
 * Daily GL bands, measured against the user's own budget rather than the
 * portion scale. The portion thresholds (10/20) do not apply to a daily total:
 * a day at GL 27 against a budget of 54 is half the allowance, not a high load.
 */
export function dayGlLevel(gl: number, budget: number): Level {
  const share = gl / Math.max(1, budget)
  if (share <= 0.6) return 'low'
  if (share <= 1) return 'medium'
  return 'high'
}

export const LEVEL_LABELS: Record<Level, string> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
}

export const GI_LEVEL_LABELS: Record<Level, string> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
}

/** Sum the nutrients of several portions. */
export function sumNutrients(parts: Nutrients[]): Nutrients {
  return parts.reduce<Nutrients>(
    (acc, n) => ({
      kcal: acc.kcal + n.kcal,
      carbs: acc.carbs + n.carbs,
      fiber: acc.fiber + n.fiber,
      protein: acc.protein + n.protein,
      fat: acc.fat + n.fat,
    }),
    { kcal: 0, carbs: 0, fiber: 0, protein: 0, fat: 0 },
  )
}

/**
 * Carb-weighted mean GI across a set of foods.
 * Returns null when the set carries almost no carbohydrate.
 */
export function weightedGI(items: { food: Food; grams: number }[]): number | null {
  let carbSum = 0
  let glSum = 0
  for (const { food, grams } of items) {
    if (food.gi === null) continue
    const c = availableCarbs(food, grams)
    carbSum += c
    glSum += (food.gi * c) / 100
  }
  if (carbSum < 0.5) return null
  return Math.round((glSum * 100) / carbSum)
}

import type { Activity, CarbApproach, Condition, Profile, Targets } from '../types'

/**
 * Daily target calculation.
 *
 * IMPORTANT: this is an educational heuristic built on published formulas
 * (Mifflin-St Jeor plus a macronutrient split). It does not replace a
 * clinician, and it accounts for neither drug therapy, pregnancy, nor kidney
 * or liver disease. Insulin doses must never be derived from these numbers.
 */

const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,  // desk job, no training
  light: 1.375,    // light activity 1-3 times a week
  moderate: 1.55,  // training 3-5 times a week
  high: 1.725,     // training 6-7 times a week, or manual work
}

export const ACTIVITY_LABELS: Record<Activity, string> = {
  sedentary: 'Sedentary',
  light: 'Lightly active (1-3 days a week)',
  moderate: 'Moderately active (3-5 days a week)',
  high: 'Very active (6-7 days a week)',
}

export const CONDITION_LABELS: Record<Condition, string> = {
  t1: 'Type 1 diabetes',
  t2: 'Type 2 diabetes',
  prediabetes: 'Prediabetes',
  ir: 'Insulin resistance',
}

export const GOAL_LABELS: Record<Profile['goal'], string> = {
  lose: 'Lose weight',
  maintain: 'Maintain weight',
  gain: 'Gain weight',
}

/** Share of calories from carbohydrate for each approach. */
const CARB_SHARE: Record<CarbApproach, number> = {
  moderate: 0.4,  // moderate-carbohydrate diet
  low: 0.26,      // low-carbohydrate
  verylow: 0.15,  // very low-carbohydrate
}

export const CARB_APPROACH_LABELS: Record<CarbApproach, string> = {
  moderate: 'Moderate (~40% of calories from carbs)',
  low: 'Low carb (~26%)',
  verylow: 'Very low carb (~15%)',
}

/** Basal metabolic rate, Mifflin-St Jeor. */
export function bmr(p: Profile): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age
  return p.sex === 'male' ? base + 5 : base - 161
}

export function tdee(p: Profile): number {
  return bmr(p) * ACTIVITY_FACTOR[p.activity]
}

export function calculateTargets(p: Profile): Targets {
  const maintenance = tdee(p)

  // Keep the deficit or surplus moderate: sharp restriction sits badly with
  // glucose-lowering therapy.
  const kcal =
    p.goal === 'lose' ? maintenance * 0.85 : p.goal === 'gain' ? maintenance * 1.1 : maintenance

  const carbsG = (kcal * CARB_SHARE[p.carbApproach]) / 4

  // Protein: 1.6 g/kg when losing weight (to preserve muscle), else 1.4 g/kg.
  // We do not raise it further on very low carbohydrate - the excess feeds
  // gluconeogenesis.
  const proteinG = p.weightKg * (p.goal === 'lose' ? 1.6 : 1.4)

  // Fat takes up the remaining calories.
  const fatG = Math.max(30, (kcal - carbsG * 4 - proteinG * 4) / 9)

  // Fibre: 14 g per 1000 kcal - a recommendation consistently associated with
  // better glycemic control.
  const fiberG = (kcal / 1000) * 14

  return {
    kcal: Math.round(kcal),
    carbsG: Math.round(carbsG),
    proteinG: Math.round(proteinG),
    fatG: Math.round(fatG),
    fiberG: Math.round(fiberG),
    glBudget: Math.round(glBudget(carbsG, p.condition)),
  }
}

/**
 * Daily glycemic-load ceiling.
 *
 * Derived from the carbohydrate target and an acceptable mean diet GI:
 * GL = carbs x mean_GI / 100. We aim for a mean GI of ~45 in diabetes and
 * ~50 in prediabetes and insulin resistance, then cap the result at 120 -
 * diets above that are consistently associated with worse control.
 */
function glBudget(carbsG: number, condition: Condition): number {
  const targetAvgGI = condition === 't1' || condition === 't2' ? 45 : 50
  return Math.min(120, (carbsG * targetAvgGI) / 100)
}

export const DEFAULT_PROFILE: Profile = {
  sex: 'female',
  age: 35,
  heightCm: 168,
  weightKg: 70,
  activity: 'light',
  condition: 'ir',
  goal: 'lose',
  carbApproach: 'low',
  excludedFoodIds: [],
}

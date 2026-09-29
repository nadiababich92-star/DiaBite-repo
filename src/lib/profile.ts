import type {
  Activity, Allergen, CarbApproach, Comorbidity, Condition, Constraint, Insulin, Kidney, Med,
  Profile, Targets,
} from '../types'

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
  t2: 'Type 2 diabetes',
  prediabetes: 'Prediabetes',
  ir: 'Insulin resistance or PCOS',
  t1: 'Type 1 diabetes or LADA',
  gestational: 'Gestational diabetes',
  unsure: "I'm not sure",
}

export const INSULIN_LABELS: Record<Insulin, string> = {
  none: "I don't take insulin",
  basal: 'Long-acting once a day (Lantus, Basaglar, Tresiba, Toujeo)',
  mealtime_or_pump: 'Before meals, or a pump (Humalog, Novolog, Fiasp, Lyumjev)',
}

export const MED_LABELS: Record<Med, string> = {
  metformin: 'Metformin (Glucophage)',
  sulfonylurea: 'Sulfonylurea or glinide (glipizide, glimepiride, glyburide, repaglinide)',
  sglt2: 'SGLT2 inhibitor (Jardiance, Farxiga, Invokana, Steglatro)',
  glp1: 'GLP-1 or dual agonist (Ozempic, Wegovy, Mounjaro, Zepbound, Trulicity)',
  other: 'Something else for glucose',
}

export const KIDNEY_LABELS: Record<Kidney, string> = {
  none: 'No kidney problems',
  mentioned: 'My doctor has mentioned my kidneys',
  ckd: 'I have chronic kidney disease',
  dialysis: "I'm on dialysis",
}

export const COMORBIDITY_LABELS: Record<Comorbidity, string> = {
  htn: 'High blood pressure',
  ascvd: 'Heart disease, stent, or stroke',
  masld: 'Fatty liver (MASLD)',
  gout: 'Gout',
  gastroparesis: 'Gastroparesis (slow stomach emptying)',
  celiac: 'Celiac disease',
  pcos: 'PCOS',
  eatingDisorder: 'A history of disordered eating',
}

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  milk: 'Milk', egg: 'Egg', fish: 'Fish', shellfish: 'Shellfish', treenuts: 'Tree nuts',
  peanuts: 'Peanuts', wheat: 'Wheat', soy: 'Soy', sesame: 'Sesame',
  gluten: 'Gluten', lactose: 'Lactose',
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

/**
 * Basal metabolic rate, Mifflin-St Jeor.
 *
 * The formula has a sex constant and no third option, so "prefer not to say"
 * takes the midpoint of the two — an honest average rather than a guess about
 * the person.
 */
export function bmr(p: Profile): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age
  if (p.sex === 'male') return base + 5
  if (p.sex === 'female') return base - 161
  return base - 78
}

export function tdee(p: Profile): number {
  return bmr(p) * ACTIVITY_FACTOR[p.activity]
}

/**
 * Who this product is not for.
 *
 * These are safety exits, not preferences: mealtime insulin and pumps mean the
 * person doses against carbohydrate, pregnancy needs a carbohydrate floor and
 * clinical supervision, and paediatric diabetes is a different field. The app
 * says so plainly instead of serving them badly (PRD A5).
 */
export type ExitReason = 'minor' | 'pregnancy' | 'mealtime_insulin'

export function exitReason(p: Profile): ExitReason | null {
  if (p.age < 18) return 'minor'
  if (p.pregnantOrBreastfeeding || p.condition === 'gestational') return 'pregnancy'
  if (p.insulin === 'mealtime_or_pump') return 'mealtime_insulin'
  return null
}

export const EXIT_COPY: Record<ExitReason, { title: string; body: string }> = {
  minor: {
    title: 'DiaBite is for adults',
    body: 'Diabetes in children and teenagers is managed differently, with growth and puberty in the picture. Please use the plan your paediatric team gave you.',
  },
  pregnancy: {
    title: 'Pregnancy needs your care team, not an app',
    body: 'In pregnancy and while breastfeeding, carbohydrate needs go up rather than down, and targets are set with your OB or a diabetes educator. We would rather say so than give you numbers that do not apply.',
  },
  mealtime_insulin: {
    title: 'DiaBite is not built for mealtime insulin',
    body: 'If you dose insulin against what you eat, the numbers that matter are your ratios and correction factors — and this app must never touch those. Your care team and a CGM app are the right tools.',
  },
}

/**
 * Which carbohydrate approaches are safe for this profile.
 *
 * Very low carbohydrate is not a preference when medication is in play: SGLT2
 * inhibitors carry an FDA-labelled risk of euglycaemic DKA that ketosis
 * triggers, sulfonylureas and basal insulin drop glucose whether or not the
 * carbohydrate arrives, ketosis raises urate in gout, and a fibre floor cannot
 * be met on 15% of calories when the stomach empties slowly.
 */
export function carbApproachBlocked(p: Profile, a: CarbApproach): string | null {
  if (a !== 'verylow') return null
  if (p.meds.includes('sglt2')) return 'Not available with an SGLT2 inhibitor — ketosis can trigger DKA even at normal glucose.'
  if (p.meds.includes('sulfonylurea') || p.insulin === 'basal') return 'Needs your clinician first: with insulin or a sulfonylurea, cutting carbs this far risks a hypo.'
  if (p.comorbidities.includes('gout')) return 'Not recommended with gout — ketosis raises uric acid.'
  if (p.comorbidities.includes('eatingDisorder')) return 'We do not offer this given what you told us about disordered eating.'
  if (p.age >= 65) return 'Not recommended over 65 — protein and micronutrient intake usually suffer.'
  return null
}

const BMI = (p: Profile) => p.weightKg / (p.heightCm / 100) ** 2

export function calculateTargets(p: Profile): Targets {
  const constraints: Constraint[] = []
  const add = (id: string, field: Constraint['field'], reason: string) =>
    constraints.push({ id, field, reason })

  const maintenance = tdee(p)

  // Keep the deficit or surplus moderate: sharp restriction sits badly with
  // glucose-lowering therapy.
  let kcal =
    p.goal === 'lose' ? maintenance * 0.85 : p.goal === 'gain' ? maintenance * 1.1 : maintenance

  // No deficit where a deficit is the wrong tool or an active risk.
  if (p.goal === 'lose' && p.comorbidities.includes('eatingDisorder')) {
    kcal = maintenance
    add('ed-no-deficit', 'kcal', 'No calorie deficit, and no "budget left" framing, because you told us about disordered eating.')
  } else if (p.goal === 'lose' && BMI(p) < 18.5) {
    kcal = maintenance
    add('bmi-no-deficit', 'kcal', 'No calorie deficit: your BMI is already below the healthy range.')
  }

  // ADA floors. Below these, meeting protein and micronutrients stops being
  // realistic, whatever the arithmetic says.
  const floor = p.sex === 'male' ? 1500 : 1200
  if (kcal < floor) {
    kcal = floor
    add('kcal-floor', 'kcal', `Raised to ${floor} kcal, the floor below which a day cannot carry enough protein and micronutrients.`)
  }

  const carbsG = (kcal * CARB_SHARE[p.carbApproach]) / 4

  // Protein: 1.6 g/kg when losing weight (to preserve muscle), else 1.4 g/kg.
  // We do not raise it further on very low carbohydrate - the excess feeds
  // gluconeogenesis.
  let proteinG = p.weightKg * (p.goal === 'lose' ? 1.6 : 1.4)

  // Kidneys cap protein; dialysis raises it again, because dialysis removes
  // amino acids.
  if (p.kidney === 'dialysis') {
    proteinG = p.weightKg * 1.1
    add('ckd-dialysis-protein', 'proteinG', 'Protein set to 1.1 g per kg because dialysis removes amino acids.')
  } else if (p.kidney === 'ckd') {
    proteinG = Math.min(proteinG, p.weightKg * 0.8)
    add('ckd-protein', 'proteinG', 'Protein capped at 0.8 g per kg because you told us about chronic kidney disease.')
  } else if (p.kidney === 'mentioned') {
    proteinG = Math.min(proteinG, p.weightKg * 1.0)
    add('ckd-maybe-protein', 'proteinG', 'Protein held at 1.0 g per kg until your kidney numbers are known — ask for your eGFR at your next visit.')
  }

  // A GLP-1 cuts appetite by a fifth or more; the risk stops being too much
  // food and becomes too little protein.
  if (p.meds.includes('glp1')) {
    proteinG = Math.max(proteinG, p.weightKg * 1.2)
    add('glp1-protein', 'proteinG', 'Protein floor raised: on a GLP-1 the usual problem is eating too little of it, not too much.')
  }
  if (p.age >= 65) {
    proteinG = Math.max(proteinG, p.weightKg * 1.0)
    add('older-protein', 'proteinG', 'Protein floor of 1.0 g per kg, because muscle is harder to keep after 65.')
  }

  // Fat takes up the remaining calories.
  const fatG = Math.max(30, (kcal - carbsG * 4 - proteinG * 4) / 9)

  // Fibre: 14 g per 1000 kcal - a recommendation consistently associated with
  // better glycemic control.
  let fiberG = (kcal / 1000) * 14
  if (p.comorbidities.includes('gastroparesis')) {
    fiberG = Math.min(fiberG, 15)
    add('gastroparesis-fiber', 'fiberG', 'Fibre target lowered: with gastroparesis the usual "more fibre" advice makes symptoms worse.')
  }

  let gl = glBudget(carbsG, p.condition)
  if (p.insulin === 'basal' || p.meds.includes('sulfonylurea')) {
    add('hypo-consistency', 'none', 'Keep carbohydrate steady from meal to meal: with insulin or a sulfonylurea, a light meal can drop you low.')
  }
  if (p.meds.includes('sglt2')) {
    add('sglt2-ketosis', 'none', 'Do not fast or go ketogenic on an SGLT2 inhibitor — DKA can happen at normal glucose.')
  }
  if (p.comorbidities.includes('htn')) add('htn-sodium', 'none', 'Aim under 2,300 mg of sodium a day; recipes are ranked with that in mind.')
  if (p.comorbidities.includes('ascvd')) add('ascvd-fat', 'none', 'Keep saturated fat under 10% of calories, and watch LDL if you cut carbs hard.')
  if (p.comorbidities.includes('masld')) add('masld-fructose', 'none', 'Added sugar and sweet drinks matter more than usual with fatty liver.')
  if (p.comorbidities.includes('celiac')) add('celiac-gf', 'none', 'Every suggestion is filtered gluten-free.')
  if (p.comorbidities.includes('eatingDisorder')) {
    gl = Math.round(gl)
    add('ed-framing', 'none', 'Daily ceilings are shown as guidance, never as a score to beat.')
  }
  if (p.condition === 'unsure' || p.condition === 't1') {
    add('conservative-default', 'none', 'Targets use the more cautious setting until your type is confirmed — worth asking your clinician at the next visit.')
  }

  return {
    kcal: Math.round(kcal),
    carbsG: Math.round(carbsG),
    proteinG: Math.round(proteinG),
    fatG: Math.round(fatG),
    fiberG: Math.round(fiberG),
    glBudget: Math.round(gl),
    constraints,
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
  const cautious = condition === 't1' || condition === 't2' || condition === 'unsure'
  const targetAvgGI = cautious ? 45 : 50
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
  insulin: 'none',
  meds: [],
  pregnantOrBreastfeeding: false,
  kidney: 'none',
  comorbidities: [],
  allergens: [],
  units: 'imperial',
  onboarded: false,
}

// ── imperial ↔ metric, for the screens (storage stays metric) ────────────
export const cmToFtIn = (cm: number) => ({ ft: Math.floor(cm / 2.54 / 12), in: Math.round((cm / 2.54) % 12) })
export const ftInToCm = (ft: number, inch: number) => Math.round((ft * 12 + inch) * 2.54)
export const kgToLb = (kg: number) => Math.round(kg * 2.2046)
export const lbToKg = (lb: number) => Math.round((lb / 2.2046) * 10) / 10

/**
 * The content of "Summary for my clinician": a printable page of the person's own diary.
 * Spec: docs/specs/clinician-summary-logic.md (approved 18 November 2026).
 *
 * Pure: no React, no storage, no clock, no network. Every figure comes from `viewEntry` (the code the Diary uses);
 * nothing here looks a number up, estimates one or invents one. Only the fields the owner approved leave this file:
 * condition, insulin yes or no, medicine classes, the targets, and the person's own carbohydrate numbers. Never age,
 * weight, height, kidney, pregnancy, allergens, comorbidities, the email, the consent record, or `targets.constraints`
 * (its sentences can name a kidney or pregnancy rule).
 *
 * SCAFFOLD (Stage 3): the types, the wording tables and the header of the summary are here; the days, the totals, the
 * verdicts and the averages are Stage 4. Until then `days` is empty and `scaffold` is true, and the page says so.
 */
import { addDays } from './diary'
import type { Condition, DiaryEntry, Med, MealType, Profile, Targets } from '../types'

export type SummaryPeriod = 7 | 14 | 28
export const SUMMARY_PERIODS: SummaryPeriod[] = [7, 14, 28]
export const DEFAULT_PERIOD: SummaryPeriod = 7

export type Verdict = 'over' | 'not over'
export type GlVerdict = 'over' | 'not over' | 'not complete'

export interface SummaryItem {
  name: string
  portion: string
  /** Total carbohydrate of the item, one decimal, so the items of a day add up to its figure. */
  carbs: number
  /** One decimal; null when the entry has no glycemic load. */
  gl: number | null
  estimate: boolean
}

export interface SummaryMeal { meal: MealType; items: SummaryItem[] }

export interface SummaryDay {
  date: string
  label: string
  isToday: boolean
  kcal: number
  carbs: number
  fiber: number
  protein: number
  fat: number
  gl: number
  carbsVerdict: Verdict
  kcalVerdict: Verdict
  glVerdict: GlVerdict
  noLoadFoods: number
  estimate: boolean
  slots: number
  meals: SummaryMeal[]
}

export interface SummaryTargets {
  kcal: number
  carbsG: number
  proteinG: number
  fatG: number
  fiberG: number
  glBudget: number
  carbsSetBy: 'person' | 'diabite'
  mealCarbsG: number | null
  snackCarbsG: number | null
}

export interface SummaryAbout {
  condition: string
  insulin: 'takes insulin' | 'does not take insulin'
  medicines: string[]
}

export interface ClinicianSummary {
  periodDays: SummaryPeriod
  from: string
  to: string
  printedOn: string
  about: SummaryAbout
  targets: SummaryTargets
  loggedDays: number
  days: SummaryDay[]
  notLogged: { from: string; to: string }[]
  averages: { kcal: number; carbs: number; fiber: number; protein: number; fat: number; gl: number } | null
}

/** Third person: the app's own labels ("I take …") are first person and are not reused. */
export const CONDITION_TEXT: Record<Condition, string> = {
  t2: 'Type 2 diabetes',
  prediabetes: 'Prediabetes',
  ir: 'Insulin resistance or PMOS (formerly PCOS)',
  t1: 'Type 1 diabetes or LADA',
  gestational: 'Gestational diabetes',
  unsure: 'Not stated',
}

/** Classes only: no brand names. */
export const MEDICINE_TEXT: Record<Med, string> = {
  metformin: 'Metformin',
  sulfonylurea: 'Sulfonylurea or glinide',
  sglt2: 'SGLT2 inhibitor',
  glp1: 'GLP-1 or dual agonist',
  other: 'Another glucose-lowering medicine',
}

/** The keys a summary may have, fixed by a check: adding one is a decision about what a printed page reveals. */
export const SUMMARY_KEYS = ['about', 'averages', 'days', 'from', 'loggedDays', 'notLogged', 'periodDays', 'printedOn', 'targets', 'to'] as const

export function buildSummary(
  _diary: DiaryEntry[],
  profile: Profile,
  targets: Targets,
  today: string,
  period: SummaryPeriod,
): ClinicianSummary & { scaffold: true } {
  const meds = [...new Set(profile.meds)].map((m) => MEDICINE_TEXT[m])
  return {
    scaffold: true,
    periodDays: period,
    from: addDays(today, -(period - 1)),
    to: today,
    printedOn: today,
    about: {
      condition: CONDITION_TEXT[profile.condition],
      insulin: profile.insulin === 'none' ? 'does not take insulin' : 'takes insulin',
      medicines: meds,
    },
    targets: {
      kcal: targets.kcal, carbsG: targets.carbsG, proteinG: targets.proteinG, fatG: targets.fatG, fiberG: targets.fiberG, glBudget: targets.glBudget,
      carbsSetBy: targets.constraints.some((c) => c.id === 'own-carbs') ? 'person' : 'diabite',
      mealCarbsG: profile.mealCarbsG > 0 ? profile.mealCarbsG : null,
      snackCarbsG: profile.snackCarbsG > 0 ? profile.snackCarbsG : null,
    },
    // STAGE 4: the days, their figures and verdicts, the runs not logged, and the averages (spec rules 1 to 11).
    loggedDays: 0,
    days: [],
    notLogged: [],
    averages: null,
  }
}

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
 * Rules, numbered as in the spec: 1 eaten only; 2 the period counted in calendar days; 3 every figure from `viewEntry`;
 * 4 rounding as the Diary prints it; 5 a verdict only on carbohydrate and energy; 6 a load with a food that has none
 * is never "not over"; 9 a day with nothing logged is not zero; 13 nothing else of the profile is read.
 */
import { addDays, eaten, portionText, viewEntry } from './diary'
import { MIN_SLOTS } from './history'
import { sumNutrients } from './glycemic'
import { MEAL_ORDER } from './menu'
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

const round1 = (n: number) => Math.round(n * 10) / 10

/** "Tue, Nov 17": a day in the person's own calendar. */
export const dayName = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function buildSummary(
  diary: DiaryEntry[],
  profile: Profile,
  targets: Targets,
  today: string,
  period: SummaryPeriod,
): ClinicianSummary {
  const from = addDays(today, -(period - 1))
  const dates = Array.from({ length: period }, (_, i) => addDays(from, i))   // oldest first

  // Rules 1 and 2: what was eaten, inside the period. A planned entry never gets this far.
  const byDate = new Map<string, DiaryEntry[]>()
  for (const e of eaten(diary)) {
    if (e.date < from || e.date > today) continue
    const list = byDate.get(e.date)
    if (list) list.push(e); else byDate.set(e.date, [e])
  }

  const raw: { kcal: number; carbs: number; fiber: number; protein: number; fat: number; gl: number }[] = []   // unrounded, for the averages
  const days: SummaryDay[] = []
  const notLogged: { from: string; to: string }[] = []

  for (const date of dates) {
    const entries = byDate.get(date)
    if (!entries || entries.length === 0) {
      // Rule 9: consecutive days with nothing eaten are one run; never a row of zeros.
      const last = notLogged[notLogged.length - 1]
      if (last && addDays(last.to, 1) === date) last.to = date; else notLogged.push({ from: date, to: date })
      continue
    }
    const views = entries.map(viewEntry)                                // rule 3
    const n = sumNutrients(views.map((v) => v.nutrients))
    const gl = round1(views.reduce((sum, v) => sum + v.gl, 0))          // rule 4: as history.ts rounds it
    const noLoadFoods = views.filter((v) => !v.loadAvailable).length
    raw.push({ ...n, gl: views.reduce((sum, v) => sum + v.gl, 0) })
    days.push({
      date, label: dayName(date), isToday: date === today,
      kcal: Math.round(n.kcal), carbs: Math.round(n.carbs), fiber: Math.round(n.fiber), protein: Math.round(n.protein), fat: Math.round(n.fat), gl,
      // Rule 5: the unrounded sum against the target, as the Diary does. Protein, fibre and fat have no verdict.
      carbsVerdict: n.carbs > targets.carbsG ? 'over' : 'not over',
      kcalVerdict: n.kcal > targets.kcal ? 'over' : 'not over',
      // Rule 6: a load already above the budget is over whatever else is true; a day with a food that has no load is never "not over".
      glVerdict: gl > targets.glBudget ? 'over' : noLoadFoods > 0 ? 'not complete' : 'not over',
      noLoadFoods,
      estimate: entries.some((e) => e.snapshot?.assumed === true),
      slots: new Set(entries.map((e) => e.meal)).size,
      meals: MEAL_ORDER.map((meal) => ({
        meal,
        items: entries.filter((e) => e.meal === meal).map((e): SummaryItem => {
          const v = viewEntry(e)
          return {
            name: v.name,
            portion: portionText(v.portion, v.measure, 'imperial'),
            carbs: round1(v.nutrients.carbs),
            gl: v.loadAvailable ? round1(v.gl) : null,
            estimate: e.snapshot?.assumed === true,
          }
        }),
      })).filter((m) => m.items.length > 0),
    })
  }

  // Rule 4: the mean of the unrounded daily sums over the days that were logged, rounded as a day is.
  const mean = (pick: (r: (typeof raw)[number]) => number) => raw.reduce((sum, r) => sum + pick(r), 0) / raw.length
  const averages = raw.length === 0 ? null : {
    kcal: Math.round(mean((r) => r.kcal)), carbs: Math.round(mean((r) => r.carbs)), fiber: Math.round(mean((r) => r.fiber)),
    protein: Math.round(mean((r) => r.protein)), fat: Math.round(mean((r) => r.fat)), gl: round1(mean((r) => r.gl)),
  }

  return {
    periodDays: period,
    from,
    to: today,
    printedOn: today,
    about: {
      condition: CONDITION_TEXT[profile.condition],
      insulin: profile.insulin === 'none' ? 'does not take insulin' : 'takes insulin',
      medicines: [...new Set(profile.meds)].map((m) => MEDICINE_TEXT[m]),
    },
    targets: {
      kcal: targets.kcal, carbsG: targets.carbsG, proteinG: targets.proteinG, fatG: targets.fatG, fiberG: targets.fiberG, glBudget: targets.glBudget,
      carbsSetBy: targets.constraints.some((c) => c.id === 'own-carbs') ? 'person' : 'diabite',
      mealCarbsG: profile.mealCarbsG > 0 ? profile.mealCarbsG : null,
      snackCarbsG: profile.snackCarbsG > 0 ? profile.snackCarbsG : null,
    },
    loggedDays: days.length,
    days: days.reverse(),                    // rule 11: newest first
    notLogged: notLogged.reverse(),
    averages,
  }
}

/** True when the day is thin: fewer than three meal slots (the Diary's own threshold). */
export const isThin = (d: Pick<SummaryDay, 'slots'>): boolean => d.slots < MIN_SLOTS

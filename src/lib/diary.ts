/** One place that knows how to read a diary entry, whether it was hand-logged or agent-logged. */
import { getFood } from '../data/foods'
import { availableCarbs, breadUnits, glycemicLoad, nutrientsFor, CARBS_PER_BREAD_UNIT } from './glycemic'
import type { DiaryEntry, MealType, Nutrients } from '../types'

export interface EntryView {
  name: string
  portion: string
  nutrients: Nutrients
  availableCarbs: number
  gi: number | null
  gl: number
  /** False when no glycemic load exists for this entry (a branded product); `gl` is then 0 and must be shown as unavailable. */
  loadAvailable: boolean
  breadUnits: number
}

export function viewEntry(e: DiaryEntry): EntryView {
  if (e.snapshot) {
    const s = e.snapshot
    return {
      name: s.name,
      portion: s.servings ? `${s.servings} serving${s.servings === 1 ? '' : 's'}` : `${e.grams} g`,
      nutrients: { kcal: s.kcal, carbs: s.carbs, fiber: s.fiber, protein: s.protein, fat: s.fat },
      availableCarbs: s.availableCarbs, gi: s.gi, gl: s.gl, loadAvailable: s.loadAvailable !== false,
      breadUnits: s.availableCarbs / CARBS_PER_BREAD_UNIT,
    }
  }
  const food = getFood(e.foodId)
  return {
    name: food.name,
    portion: `${e.grams} g`,
    nutrients: nutrientsFor(food, e.grams),
    availableCarbs: availableCarbs(food, e.grams), gi: food.gi,
    gl: glycemicLoad(food, e.grams), loadAvailable: true, breadUnits: breadUnits(food, e.grams),
  }
}

/**
 * The foods this person logs again and again, newest first: one per food and weight, at most `n`.
 * Hand-logged entries and ones logged from an answer both count, because an answer's numbers are
 * stored with it and can be logged again as they were.
 */
export function recentEntries(diary: DiaryEntry[], n = 6): DiaryEntry[] {
  const seen = new Set<string>()
  const out: DiaryEntry[] = []
  // Newest day first; within a day the later entry is the more recent.
  const newestFirst = diary.map((e, i) => ({ e, i })).sort((a, b) => (a.e.date === b.e.date ? b.i - a.i : a.e.date < b.e.date ? 1 : -1))
  for (const { e } of newestFirst) {
    const key = `${e.foodId}|${e.grams}|${e.snapshot?.name ?? ''}`
    if (seen.has(key)) continue
    seen.add(key); out.push(e)
    if (out.length >= n) break
  }
  return out
}

/** The step of a weight stepper: a tenth of the weight, in whole fives, never below five grams. */
export const gramStep = (grams: number): number => Math.max(5, Math.round((grams * 0.1) / 5) * 5)

/** A weight moved by one step, kept between five grams and a kilo and a half. */
export const nudgeGrams = (grams: number, dir: 1 | -1): number => Math.min(1500, Math.max(5, grams + dir * gramStep(grams)))

/** Which meal a food is most likely for, by the clock: the default when someone adds one. */
export function mealForNow(hour = new Date().getHours()): MealType {
  return hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 18 ? 'snack' : 'dinner'
}

/** A calendar day moved by `n` days: counted in days, not in 24-hour blocks, so a clock change cannot skip or repeat one. */
export function addDays(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const t = new Date(y, m - 1, d + n)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

/** "Today", "Yesterday", or "Fri, Oct 9": how a day is named on the diary. */
export function dayLabel(isoDate: string, today: string): string {
  if (isoDate === today) return 'Today'
  if (isoDate === addDays(today, -1)) return 'Yesterday'
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

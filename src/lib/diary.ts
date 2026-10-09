/** One place that knows how to read a diary entry, whether it was hand-logged or agent-logged. */
import { getFood } from '../data/foods'
import { availableCarbs, breadUnits, glycemicLoad, nutrientsFor, CARBS_PER_BREAD_UNIT } from './glycemic'
import type { DiaryEntry, Nutrients } from '../types'

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

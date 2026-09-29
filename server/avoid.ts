/**
 * What a person must not be offered, engine side.
 *
 * The rules themselves live in `src/lib/dietary.ts`, shared with the browser
 * so the weekly menu and the agent's alternatives cannot disagree about what a
 * celiac may be shown. This file adds what only the engine knows: a record's
 * ingredients, and the twins the same food has in two tables.
 */
import { dietaryReason, type AvoidList } from '../src/lib/dietary'
import { loadFoods, type FoodRecord } from './foods'
import { sameFood } from './resolve'

export type { AvoidList }
export type { Allergen, Pattern } from '../src/lib/dietary'

const haystack = (rec: FoodRecord): string =>
  [rec.name, ...(rec.aliases ?? []), ...(rec.ingredientNames ?? [])].join(' ')

export function avoidReason(rec: FoodRecord, avoid: AvoidList | undefined): string | null {
  if (!avoid) return null
  const ids = avoid.foodIds ?? []
  if (ids.includes(rec.id)) return 'excluded'
  if (ids.length) {
    const { byId } = loadFoods()
    for (const id of ids) {
      const other = byId.get(id)
      if (other && sameFood(other.name, rec.name)) return 'excluded'
    }
  }
  return dietaryReason(haystack(rec), avoid)
}

export const isAvoided = (rec: FoodRecord, avoid: AvoidList | undefined): boolean =>
  avoidReason(rec, avoid) !== null

/** True when anything at all is being avoided — worth telling the model about. */
export const hasAvoid = (a: AvoidList | undefined): boolean =>
  !!a && ((a.allergens?.length ?? 0) > 0 || (a.foodIds?.length ?? 0) > 0 || (!!a.pattern && a.pattern !== 'none'))

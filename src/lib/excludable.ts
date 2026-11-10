import { FOODS, FOOD_BY_ID } from '../data/foods'
import { recipeList } from './menu'

/**
 * What a person can leave out by hand: the everyday foods DiaBite knows, and every ingredient the recipes use ("pistachios",
 * "tahini"). An ingredient is stored as `ing:<name>`; the weekly menu then keeps out any dish whose name or ingredients
 * contain that word. The agent's own checks know the everyday foods only, so an `ing:` entry is not passed to it.
 */
export const ING_PREFIX = 'ing:'

export interface Excludable { id: string; name: string; hint: string }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "Pistachios, shelled" is "pistachios"; "Egg, large (50 g each)" is "egg": the kind of food, not how it is bought. */
const kindOf = (name: string) => name.replace(/\s*\(.*?\)/g, '').replace(/\s+\d+%(\s+lean)?/gi, '').split(',')[0].trim().toLowerCase()

/** The name to show for an excluded id, whichever kind it is. Never throws. */
export function excludedLabel(id: string): string {
  if (id.startsWith(ING_PREFIX)) return cap(id.slice(ING_PREFIX.length))
  return FOOD_BY_ID.get(id)?.name ?? id
}

export const isIngredientId = (id: string) => id.startsWith(ING_PREFIX)

let cached: { n: number; list: Excludable[] } | null = null

/** The ingredient names of the loaded recipes, once each, without those the everyday list already has under the same name. */
export function ingredientOptions(): Excludable[] {
  const dishes = recipeList()
  if (cached && cached.n === dishes.length) return cached.list
  const have = new Set(FOODS.map((f) => kindOf(f.name)))
  const seen = new Set<string>()
  const list: Excludable[] = []
  for (const d of dishes) for (const i of d.ingredients ?? []) {
    const k = kindOf(i.name)
    if (k.length < 3 || seen.has(k) || have.has(k)) continue
    seen.add(k)
    list.push({ id: `${ING_PREFIX}${k}`, name: cap(k), hint: 'In recipes' })
  }
  list.sort((a, b) => a.name.localeCompare(b.name))
  cached = { n: dishes.length, list }
  return list
}

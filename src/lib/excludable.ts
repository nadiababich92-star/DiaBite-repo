import { FOODS, FOOD_BY_ID } from '../data/foods'
import { recipeList } from './menu'
import { kindOf } from './recipes'

/**
 * What a person can leave out by hand: the everyday foods DiaBite knows, and every ingredient the recipes use ("pistachios",
 * "tahini"). An ingredient is stored as `ing:<name>`; the weekly menu then keeps out any dish whose name or ingredients
 * contain that word. The agent's own checks know the everyday foods only, so an `ing:` entry is not passed to it.
 */
export const ING_PREFIX = 'ing:'

export interface Excludable { id: string; name: string; hint: string }

/** One slip is allowed: a letter added, left out or changed. */
function withinOne(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1)      // one letter changed
  const [long, short] = a.length > b.length ? [a, b] : [b, a]
  return long.slice(i + 1) === short.slice(i)                             // one letter left out
}

/**
 * Does what the person typed point at this name? A part of a word always does ("pistach" for "Pistachios"); a word typed with
 * one slip ("pistacio", "almnd") does too, once it is four letters long, compared with the start of each word of the name.
 */
export function nameMatches(name: string, typed: string, forgiving = true): boolean {
  const n = name.toLowerCase(), q = typed.trim().toLowerCase()
  if (!q) return false
  if (n.includes(q)) return true
  if (!forgiving || q.length < 4) return false
  for (const w of n.split(/[^a-z]+/)) {
    if (w.length < 3) continue
    for (const len of [q.length - 1, q.length, q.length + 1]) if (len >= 3 && w.length >= len && withinOne(w.slice(0, len), q)) return true
  }
  return false
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)


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

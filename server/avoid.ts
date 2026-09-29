/**
 * What a person must not be offered.
 *
 * Two kinds of thing end up here and they are not the same: an allergen or a
 * medical exclusion (celiac, lactose) makes a food unsafe, while "I don't like
 * fish" makes it unwelcome. Both are filtered out of suggestions; only the
 * first is worth naming back to the user.
 *
 * The match is by name and — for recipes — by ingredient names, because the
 * database carries no allergen column. That cuts both ways: it will flag a
 * "coconut milk" curry for milk, and it will miss soy sauce hidden under
 * "seasoning". So this filter removes candidates from what we *offer*; it is
 * never presented as an allergen clearance, and the UI says so.
 */
import { loadFoods, type FoodRecord } from './foods'
import { sameFood } from './resolve'

export type Allergen =
  | 'milk' | 'egg' | 'fish' | 'shellfish' | 'treenuts' | 'peanuts'
  | 'wheat' | 'soy' | 'sesame' | 'gluten' | 'lactose'

export interface AvoidList {
  /** Allergens and intolerances, from onboarding. */
  allergens?: Allergen[]
  /** Record ids the person excluded by hand (`seed:…`, `ing:…`, `rec:…`). */
  foodIds?: string[]
}

/**
 * Word-boundary patterns per allergen. Deliberately generous on the foods a
 * US kitchen actually uses, and deliberately silent on trace contamination,
 * which no name-based rule can see.
 */
const PATTERNS: Record<Allergen, RegExp> = {
  milk: /\b(milk|cream|butter|cheese|yog(h)?urt|kefir|ghee|whey|casein|custard|ricotta|mozzarella|parmesan|feta|paneer)\b/i,
  lactose: /\b(milk|cream|butter|cheese|yog(h)?urt|kefir|ice cream|condensed|evaporated)\b/i,
  egg: /\b(egg|eggs|omelet(te)?|frittata|mayonnaise|meringue|custard)\b/i,
  fish: /\b(fish|salmon|tuna|cod|halibut|trout|sardine|anchovy|anchovies|mackerel|tilapia|herring|bass)\b/i,
  shellfish: /\b(shrimp|prawn|crab|lobster|scallop|clam|mussel|oyster|squid|calamari|crawfish|shellfish)\b/i,
  treenuts: /\b(almond|walnut|pecan|cashew|pistachio|hazelnut|macadamia|brazil nut|pine nut|nutella)\b/i,
  peanuts: /\b(peanut|peanuts|groundnut|satay)\b/i,
  wheat: /\b(wheat|flour|bread|pasta|spaghetti|macaroni|noodle|couscous|bulgur|semolina|cracker|tortilla|bagel|pita|farro|seitan|panko|breadcrumb)\b/i,
  gluten: /\b(wheat|flour|bread|pasta|spaghetti|macaroni|noodle|couscous|bulgur|semolina|barley|rye|malt|seitan|farro|spelt|panko|breadcrumb|soy sauce|beer)\b/i,
  soy: /\b(soy|soya|tofu|edamame|tempeh|miso|tamari)\b/i,
  sesame: /\b(sesame|tahini|hummus|halva|za'?atar)\b/i,
}

const haystack = (rec: FoodRecord): string =>
  [rec.name, ...(rec.aliases ?? []), ...(rec.ingredientNames ?? [])].join(' ')

/**
 * The first reason this record must not be offered, or null.
 *
 * An excluded id also excludes its twins. The same food exists twice — once in
 * the ingredient table, once as a seed food — so excluding "brown rice" by id
 * and then offering the other copy of brown rice would be the kind of bug
 * nobody reports and everybody notices.
 */
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
  const text = haystack(rec)
  for (const a of avoid.allergens ?? []) if (PATTERNS[a].test(text)) return a
  return null
}

export const isAvoided = (rec: FoodRecord, avoid: AvoidList | undefined): boolean =>
  avoidReason(rec, avoid) !== null

/** True when anything at all is being avoided — worth telling the model about. */
export const hasAvoid = (a: AvoidList | undefined): boolean =>
  !!a && ((a.allergens?.length ?? 0) > 0 || (a.foodIds?.length ?? 0) > 0)

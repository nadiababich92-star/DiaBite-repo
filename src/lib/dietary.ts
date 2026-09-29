/**
 * What must be kept out of a suggestion, in one place.
 *
 * Two kinds of rule live here and they are not the same. An **allergen** or an
 * intolerance makes a food unsafe; a **pattern** — vegetarian, vegan, halal,
 * kosher — makes it unwanted for reasons that are the person's own. Both are
 * filtered out of anything the product offers, and neither is ever presented
 * as a clearance: matching is by name and ingredients, which cannot see traces,
 * hidden sources, or how something was slaughtered.
 *
 * Shared on purpose. The engine ranks alternatives with these patterns and the
 * browser builds the weekly menu with them; two copies would drift, and the
 * drift would show up as a celiac being offered pasta in one screen and not in
 * another.
 */

export type Allergen =
  | 'milk' | 'egg' | 'fish' | 'shellfish' | 'treenuts' | 'peanuts'
  | 'wheat' | 'soy' | 'sesame' | 'gluten' | 'lactose'

/**
 * How someone eats. Mediterranean is deliberately absent: it is a style, not a
 * restriction, and a filter that removed food for it would be wrong.
 */
export type Pattern = 'none' | 'vegetarian' | 'vegan' | 'halal' | 'kosher'

export const ALLERGEN_PATTERNS: Record<Allergen, RegExp> = {
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

const MEAT = /\b(beef|pork|bacon|ham|sausage|salami|prosciutto|chorizo|lamb|mutton|veal|venison|chicken|turkey|duck|goose|liver|gelatin|lard|meatball|burger|steak|brisket|pastrami|jerky)\b/i
const SEAFOOD = new RegExp(`${ALLERGEN_PATTERNS.fish.source}|${ALLERGEN_PATTERNS.shellfish.source}`, 'i')
const PORK = /\b(pork|bacon|ham|prosciutto|chorizo|pancetta|lard|pepperoni|salami)\b/i
const ANIMAL_NON_MEAT = new RegExp(`${ALLERGEN_PATTERNS.milk.source}|${ALLERGEN_PATTERNS.egg.source}|\\bhoney\\b`, 'i')

/** What each pattern rules out. Kosher also rules out mixing meat and dairy, which a name cannot see. */
export const PATTERN_PATTERNS: Record<Exclude<Pattern, 'none'>, RegExp> = {
  vegetarian: new RegExp(`${MEAT.source}|${SEAFOOD.source}`, 'i'),
  vegan: new RegExp(`${MEAT.source}|${SEAFOOD.source}|${ANIMAL_NON_MEAT.source}`, 'i'),
  halal: new RegExp(`${PORK.source}|\\b(wine|beer|rum|vodka|whiskey|liqueur)\\b`, 'i'),
  kosher: new RegExp(`${PORK.source}|${ALLERGEN_PATTERNS.shellfish.source}`, 'i'),
}

export interface AvoidList {
  allergens?: Allergen[]
  /** Record ids the person excluded by hand. */
  foodIds?: string[]
  pattern?: Pattern
}

/**
 * The first reason this text must not be offered, or null.
 *
 * `text` is whatever names the food: a record name, plus its ingredients when
 * they are known. More text means fewer misses and a few more false positives,
 * and in this direction a false positive is the cheaper mistake.
 */
export function dietaryReason(text: string, avoid: AvoidList | undefined): string | null {
  if (!avoid) return null
  for (const a of avoid.allergens ?? []) if (ALLERGEN_PATTERNS[a].test(text)) return a
  const p = avoid.pattern
  if (p && p !== 'none' && PATTERN_PATTERNS[p].test(text)) return p
  return null
}

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  milk: 'Milk', egg: 'Egg', fish: 'Fish', shellfish: 'Shellfish', treenuts: 'Tree nuts',
  peanuts: 'Peanuts', wheat: 'Wheat', soy: 'Soy', sesame: 'Sesame',
  gluten: 'Gluten', lactose: 'Lactose',
}

export const PATTERN_LABELS: Record<Pattern, string> = {
  none: 'No preference',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  halal: 'Halal',
  kosher: 'Kosher',
}

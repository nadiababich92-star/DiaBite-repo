/**
 * What kind of food a record is, for one purpose: deciding whether it may stand in for another when a meal does not fit the day.
 *
 * "Apple Cinnamon Baked Oatmeal Cups" was offered for a bowl of porridge because the two are close by name and lower by load. A dietitian objects
 * first: a baked breakfast cake is not a way to have oatmeal. So a swap must be the same kind of food, with a short list of kinds that may replace
 * one another (a vegetable for a potato, cauliflower rice for rice), and a baked or sweet thing may only replace a baked or sweet thing.
 * docs/specs/swaps-engine.md, section 3.
 */
import type { FoodRecord } from './foods'

export type SwapClass =
  | 'fruit' | 'veg' | 'starch' | 'cooked-grain' | 'bread' | 'breakfast-cooked' | 'baked' | 'sweet' | 'drink'
  | 'dairy' | 'nut' | 'protein-main' | 'savoury-snack' | 'mixed-dish' | 'other'

const BAKED = /\b(muffins?|cupcakes?|cakes?|cookies?|brownies?|scones?|pastry|pastries|doughnuts?|donuts?|croissants?|danish(es)?|pies?|tarts?|waffles?|pancakes?|(granola|energy|protein|breakfast|oat|cereal|nut) bars?|(oat|oatmeal|baked|apple|banana) cups)\b/i
const ENGLISH_MUFFIN = /english muffin/i
const BAKED_OAT = /\bbaked\b/i
const BAKED_OAT_WITH = /oat|apple|banana|berry|cinnamon/i
const SWEET = /\b(candy|candies|chocolates?|snickers|caramels?|ice cream|ice-cream|popsicles?|gelato|sorbet|puddings?|jams?|jell(y|ies)|syrups?|honey|sugars?|marshmallows?|frosting|gumm(y|ies))\b/i
const BABY = /\b(baby|babies|toddler|infant)\b/i
const DRINK_NAME = /\b(drinks?|juices?|sodas?|smoothies?|beverages?)\b/i
const DRINK_WWEIA = /drinks?\b|beverages?|juice|coffee|^tea|^water|smoothie/i
const STARCH = /\b(potato|potatoes|sweet potato|corn|yam|plantain|cassava)\b/i
const BREAD = /\b(bread|bagel|tortilla|bun|roll|pita|toast|english muffin)\b/i
const BREAKFAST_GRAIN = /\b(oat|oats|oatmeal|porridge|grits|farina)\b/i

/** USDA's survey categories, first match wins. */
const WWEIA: [RegExp, SwapClass][] = [
  [/banana|apple|berr|citrus|melon|grape|peach|fruit/i, 'fruit'],
  [/potato|corn|plantain/i, 'starch'],
  [/rice|pasta|noodle|grain/i, 'cooked-grain'],
  [/bread|roll|bagel|tortilla|toast|biscuit/i, 'bread'],
  [/oatmeal|cereal, cooked|grits|porridge/i, 'breakfast-cooked'],
  [/cookie|cake|pie|pastry|donut|brownie/i, 'baked'],
  [/candy|ice cream|frozen dairy|dessert/i, 'sweet'],
  [/milk|yogurt|cheese/i, 'dairy'],
  [/nut|seed/i, 'nut'],
  [/vegetable|salad|leafy/i, 'veg'],
  [/beef|pork|poultry|chicken|turkey|fish|seafood|egg|bean|legume|tofu/i, 'protein-main'],
  [/sandwich|soup|stew|pizza|burrito|taco|casserole|mixed/i, 'mixed-dish'],
  [/snack|chip|pretzel|popcorn/i, 'savoury-snack'],
]

/** Recipe categories, by the menu's own category names. */
const RECIPE_CLASS: Record<string, SwapClass> = {
  'Breakfast': 'breakfast-cooked', 'Snack & Appetizer': 'savoury-snack', 'Dessert': 'sweet', 'Drinks & Smoothies': 'drink',
  'Poultry': 'mixed-dish', 'Beef, Pork & Lamb': 'mixed-dish', 'Seafood': 'mixed-dish', 'Soup & Stew': 'mixed-dish',
  'Vegetarian & Vegan': 'mixed-dish', 'Sandwiches & Wraps': 'mixed-dish', 'Salad': 'mixed-dish', 'Side Dish': 'mixed-dish',
}

/** An ingredient's category as the catalogue stores it (the group is mapped to it, so condiments and pantry items are 'sweets' and 'grains'). */
const CATEGORY_CLASS: Record<string, SwapClass> = {
  fruits: 'fruit', vegetables: 'veg', legumes: 'protein-main', protein: 'protein-main', dairy: 'dairy', nuts: 'nut', drinks: 'drink',
}

export function swapClass(rec: Pick<FoodRecord, 'kind' | 'name' | 'category' | 'wweia'>): SwapClass {
  const name = rec.name
  // 1. The names that matter most come first, so a baked or sweet thing is never taken for anything else; baby food is nobody's swap.
  if (BABY.test(name) || (rec.wweia && BABY.test(rec.wweia))) return 'other'
  if (!ENGLISH_MUFFIN.test(name) && (BAKED.test(name) || (BAKED_OAT.test(name) && BAKED_OAT_WITH.test(name) && (rec.category === 'Breakfast' || rec.category === 'Dessert')))) return 'baked'
  if (SWEET.test(name)) return 'sweet'
  if (rec.category === 'Drinks & Smoothies' || rec.category === 'drinks' || DRINK_NAME.test(name) || (rec.wweia && DRINK_WWEIA.test(rec.wweia))) return 'drink'
  // 2. USDA survey records: their own category.
  if (rec.wweia) {
    const hit = WWEIA.find(([rx]) => rx.test(rec.wweia!))
    return hit ? hit[1] : 'other'
  }
  // 3. Recipes, by the menu's category.
  if (rec.kind === 'recipe') return RECIPE_CLASS[rec.category] ?? 'other'
  // 4. Curated ingredients and everyday foods, by the category the catalogue stores, with the name deciding among the grains and the vegetables.
  if (rec.category === 'vegetables') return STARCH.test(name) ? 'starch' : 'veg'
  if (rec.category === 'grains') return BREAD.test(name) ? 'bread' : BREAKFAST_GRAIN.test(name) ? 'breakfast-cooked' : /\b(rice|pasta|quinoa|barley|noodle|couscous|bulgur|farro|spaghetti|macaroni)\b/i.test(name) ? 'cooked-grain' : 'other'
  return CATEGORY_CLASS[rec.category] ?? 'other'
}

/** The candidate's class must be in the anchor's list. A fruit never becomes a sweet; a sweet may become a fruit. */
export const ALLOWED: Record<SwapClass, SwapClass[]> = {
  'fruit': ['fruit'],
  'veg': ['veg'],
  'starch': ['starch', 'veg', 'cooked-grain'],
  'cooked-grain': ['cooked-grain', 'veg', 'starch'],
  'bread': ['bread'],
  'breakfast-cooked': ['breakfast-cooked'],
  'baked': ['baked'],
  'sweet': ['sweet', 'fruit'],
  'drink': ['drink'],
  'dairy': ['dairy'],
  'nut': ['nut', 'savoury-snack'],
  'protein-main': ['protein-main'],
  'savoury-snack': ['savoury-snack', 'nut'],
  'mixed-dish': ['mixed-dish'],
  'other': [],
}

export const mayReplace = (anchor: SwapClass, candidate: SwapClass): boolean => candidate !== 'other' && ALLOWED[anchor].includes(candidate)

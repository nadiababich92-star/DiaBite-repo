import type { Dish, FoodCategory, MealType } from '../types'
import { getFood } from '../data/foods'
import { setRecipes } from './menu'

/** One recipe as `scripts/build-menu-recipes.py` writes it. */
export interface RawRecipe {
  id: string; name: string; cat: string; cuisine: string; meals: string[]
  kcal: number; protein: number; fat: number; carbs: number; fiber: number; gl: number; gi: number | null
  min: number; ing: [string, number, string][]; steps: string[]; tags: string[]
}

/** The menu's own shape for them. The numbers are copied, never recomputed: they are the engine's. */
export function toDishes(raw: RawRecipe[]): Dish[] {
  return raw.map((r) => ({
    id: `r-${r.id}`, recipeId: r.id, name: r.name, meals: r.meals as MealType[], items: [],
    recipe: r.steps.join('\n'), cuisine: r.cuisine, minutes: r.min,
    serving: { kcal: r.kcal, protein: r.protein, fat: r.fat, carbs: r.carbs, fiber: r.fiber, gl: r.gl, gi: r.gi },
    ingredients: r.ing.map(([name, grams, category]) => ({ name, grams, category: category as FoodCategory })),
  }))
}

let loading: Promise<number> | null = null

/** Fetch the recipe file once (it is a separate chunk, about 700 KB before compression) and hand it to the menu. */
export function loadMenuRecipes(): Promise<number> {
  loading ??= import('../data/menu-recipes.json').then((m) => {
    const list = toDishes((m.default ?? m) as unknown as RawRecipe[])
    setRecipes(list)
    return list.length
  }).catch((e) => { loading = null; throw e })
  return loading
}

/** A seasoning, a sweetener or a stock cube is in the recipe but is not what the dish is. */
const NOT_THE_DISH = /\b(salt|pepper|vinegar|seasoning|sweetener|stevia|erythritol|extract|paprika|cumin|oregano|cinnamon|turmeric|cayenne|nutmeg|powder|flakes|spice|sauce)\b/i

/** "Egg, large (50 g each)" is "egg"; "Greek yogurt, plain 2%" is "greek yogurt"; "Ground beef 90% lean" is "ground beef". The kind of food, not how it is bought. */
export const kindOf = (name: string) => name.replace(/\s*\(.*?\)/g, '').replace(/\s+\d+%(\s+lean)?/gi, '').split(',')[0].trim().toLowerCase()

/**
 * One short line under a dish: its main ingredients, from the recipe's own list, heaviest first
 * ("Egg whites, spinach, feta cheese"). Nothing is written by a model and no number is in it.
 * Oil, seasoning and the small amounts are left out: they are in the full list below.
 */
export function describeDish(dish: Dish, max = 4): string {
  const parts = dish.ingredients
    ? dish.ingredients.map((i) => ({ name: i.name, grams: i.grams, fat: i.category === 'fats' }))
    : dish.items.map((i) => ({ name: getFood(i.foodId).name, grams: i.grams, fat: false }))
  const main = (min: number) => parts.filter((i) => !i.fat && !NOT_THE_DISH.test(i.name) && i.grams >= min).sort((a, b) => b.grams - a.grams)
  const chosen = main(20).length >= 2 ? main(20) : main(0)
  const seen = new Set<string>()
  const names = chosen.map((i) => kindOf(i.name)).filter((n) => n && !seen.has(n) && seen.add(n)).slice(0, max)
  if (names.length === 0) return ''
  const line = names.join(', ')
  return line[0].toUpperCase() + line.slice(1)
}

import type { Dish, FoodCategory, MealType } from '../types'
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

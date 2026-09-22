/**
 * Unified food index from three sources:
 *   - 350 ingredients (per 100 g) from data/recipes-db — curated for cooking, so it
 *     deliberately lacks white rice, regular pasta, pizza, sweets;
 *   - 86 seed foods from src/data/foods.ts — the everyday foods people actually
 *     log, including the high-GI ones the core loop exists to answer about;
 *   - 1,000 recipes (per serving).
 * Ingredients and seed foods are priced per gram, recipes per serving.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { Food, FoodCategory, Nutrients } from '../src/types'
import { giLevel } from '../src/lib/glycemic'
import { FOODS as SEED_FOODS } from '../src/data/foods'
import type { FoodKind, FoodSummary } from './contract'

const here = dirname(fileURLToPath(import.meta.url))
const DATA = join(here, '..', 'data', 'recipes-db')

interface IngredientRow {
  id: string
  name: string
  group: string
  per100: Nutrients
  gi: number
}

interface RecipeRow {
  id: string
  name: string
  category: string
  cuisine: string
  servings: number
  ingredients: { ingredient_id: string; name: string; grams: number }[]
  kcal: number
  protein_g: number
  fat_g: number
  carbs_g: number
  fiber_g: number
  net_carbs_g: number
  glycemic_index: number
  glycemic_load: number
  diet_tags: string
}

/**
 * Everyday names people actually type, for the seed foods. They feed both the
 * embedding text and an exact-phrase match in resolve.ts. Without them
 * "spaghetti" lands on spaghetti squash and "toast" finds nothing.
 */
const ALIASES: Record<string, string[]> = {
  'rice-white': ['rice', 'white rice', 'steamed rice', 'jasmine rice', 'sushi rice', 'fried rice'],
  'rice-brown': ['brown rice'],
  'rice-basmati': ['basmati'],
  'pasta-durum': ['spaghetti', 'pasta', 'penne', 'linguine', 'fettuccine', 'noodles', 'macaroni', 'rigatoni'],
  'pasta-whole': ['whole wheat pasta', 'whole wheat spaghetti', 'whole grain pasta'],
  'bread-white': ['bread', 'toast', 'white toast', 'sandwich bread', 'bun', 'roll', 'bagel'],
  'bread-rye': ['rye bread', 'rye toast', 'pumpernickel'],
  'bread-sprout': ['ezekiel bread', 'sprouted bread'],
  'potato-boil': ['potato', 'potatoes', 'boiled potatoes', 'baked potato'],
  'potato-mash': ['mashed potatoes', 'mash'],
  'sweetpotato': ['sweet potato', 'yam'],
  'oats': ['oatmeal', 'porridge', 'oats'],
  'oats-instant': ['instant oats', 'quick oats'],
  'egg': ['eggs', 'scrambled eggs', 'fried egg', 'boiled egg', 'omelette', 'omelet'],
  'chicken': ['chicken', 'grilled chicken', 'chicken breast'],
  'beef': ['steak', 'beef'],
  'cheese': ['cheddar', 'cheese', 'cheese slice', 'swiss cheese'],
  'cola': ['coke', 'soda', 'pepsi', 'soft drink', 'pop'],
  'orangejuice': ['oj', 'orange juice'],
  'sugar': ['sugar', 'white sugar', 'sweetener'],
  'honey': ['honey'],
  'milkchoc': ['chocolate', 'chocolate bar', 'candy bar', 'milk chocolate'],
  'darkchoc': ['dark chocolate'],
  'greekyogurt': ['greek yogurt'],
  'yogurt': ['yogurt', 'yoghurt'],
  'milk': ['milk', 'glass of milk'],
  'banana': ['banana', 'bananas'],
  'apple': ['apple', 'apples'],
  'grapes': ['grapes'],
  'watermelon': ['watermelon'],
  'corn': ['corn', 'corn on the cob', 'sweetcorn'],
  'avocado': ['avocado', 'avocados'],  // guacamole is its own ingredient record
  'peanuts': ['peanuts', 'peanut'],
  'almonds': ['almonds', 'almond'],
}

export interface FoodRecord extends FoodSummary {
  /** Text the embedding is built from. */
  searchText: string
  /** Exact phrases that name this record; see resolve.ts. */
  aliases?: string[]
  /** Ingredients: nutrients per 100 g. */
  per100?: Nutrients
  /** Recipes: nutrients per serving, plus its computed GL. */
  perServing?: Nutrients & { availableCarbs: number; gl: number }
  ingredientNames?: string[]
}

/** Map the ingredient table's groups onto the app's coarser categories. */
const GROUP_TO_CATEGORY: Record<string, FoodCategory> = {
  grain: 'grains', veg: 'vegetables', fruit: 'fruits', legume: 'legumes',
  protein: 'protein', seafood: 'protein', egg: 'protein', dairy: 'dairy',
  plant_milk: 'dairy', nut: 'nuts', seed: 'nuts', fat: 'fats', drink: 'drinks',
  condiment: 'sweets', spice: 'vegetables', herb: 'vegetables', pantry: 'grains',
  supplement: 'nuts',
}

let cache: { records: FoodRecord[]; byId: Map<string, FoodRecord> } | null = null

export function loadFoods() {
  if (cache) return cache
  const ingredients = JSON.parse(readFileSync(join(DATA, 'ingredients.json'), 'utf8')) as IngredientRow[]
  const recipesRaw = JSON.parse(readFileSync(join(DATA, 'recipes_db.json'), 'utf8'))
  const recipes = (Array.isArray(recipesRaw) ? recipesRaw : recipesRaw.recipes) as RecipeRow[]

  const records: FoodRecord[] = []

  for (const r of ingredients) {
    // GI 0 in the table means "no available carbohydrate" — the app models that as null.
    const gi = r.gi > 0 ? r.gi : null
    records.push({
      id: `ing:${r.id}`, kind: 'ingredient', name: r.name, gi, giLevel: giLevel(gi),
      category: r.group, unit: 'g', defaultPortion: 100,
      searchText: `${r.name}. ${r.group}. ${r.id.replace(/_/g, ' ')}`,
      per100: r.per100,
    })
  }

  for (const f of SEED_FOODS) {
    const aliases = ALIASES[f.id] ?? []
    records.push({
      id: `seed:${f.id}`, kind: 'ingredient', name: f.name, gi: f.gi, giLevel: giLevel(f.gi),
      category: f.category, unit: 'g', defaultPortion: f.portion.grams,
      searchText: `${f.name}. ${aliases.join(', ')}. ${f.category}. ${f.id.replace(/-/g, ' ')}`,
      per100: f.per100, aliases,
    })
  }

  for (const r of recipes) {
    const names = r.ingredients.map((i) => i.name)
    const availableCarbs = Math.max(0, r.carbs_g - r.fiber_g)
    const gi = availableCarbs >= 0.5 ? r.glycemic_index : null
    records.push({
      id: `rec:${r.id}`, kind: 'recipe', name: r.name, gi, giLevel: giLevel(gi),
      category: r.category, cuisine: r.cuisine, unit: 'serving', defaultPortion: 1,
      searchText: `${r.name}. ${r.cuisine} ${r.category}. ${names.slice(0, 8).join(', ')}. ${r.diet_tags}`,
      perServing: {
        kcal: r.kcal, protein: r.protein_g, fat: r.fat_g, carbs: r.carbs_g, fiber: r.fiber_g,
        availableCarbs, gl: r.glycemic_load,
      },
      ingredientNames: names,
    })
  }

  cache = { records, byId: new Map(records.map((x) => [x.id, x])) }
  return cache
}

export function getRecord(id: string): FoodRecord {
  const rec = loadFoods().byId.get(id)
  if (!rec) throw new Error(`Unknown food: ${id}`)
  return rec
}

export function summary(rec: FoodRecord): FoodSummary {
  const { id, kind, name, gi, giLevel: lvl, category, cuisine, unit, defaultPortion } = rec
  return { id, kind, name, gi, giLevel: lvl, category, cuisine, unit, defaultPortion }
}

/** Ingredient record as the `Food` shape the shared glycemic maths expects. */
export function asFood(rec: FoodRecord): Food {
  if (!rec.per100) throw new Error(`${rec.id} is not an ingredient`)
  return {
    id: rec.id, name: rec.name,
    category: (GROUP_TO_CATEGORY[rec.category] ?? rec.category) as FoodCategory,
    gi: rec.gi, per100: rec.per100,
    portion: { label: 'serving', grams: rec.defaultPortion },
  }
}

export function kindOf(id: string): FoodKind {
  return id.startsWith('rec:') ? 'recipe' : 'ingredient'
}

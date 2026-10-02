/**
 * Unified food index from three sources:
 *   - 350 ingredients (per 100 g) from data/recipes-db — curated for cooking, so it
 *     deliberately lacks white rice, regular pasta, pizza, sweets;
 *   - 86 seed foods from src/data/foods.ts — the everyday foods people actually
 *     log, including the high-GI ones the core loop exists to answer about;
 *   - 1,000 recipes (per serving).
 * Ingredients and seed foods are priced per gram, recipes per serving.
 */
import { existsSync, readFileSync } from 'node:fs'
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
  /** Where the numbers came from, in words a user can read (PRD E3). */
  source?: string
  /** When a human last checked them against that source; absent means nobody has. */
  verifiedAt?: string
}

/** A record as `public.foods` stores it. */
interface FoodRow {
  id: string; kind: FoodKind; name: string; category: string | null; cuisine: string | null
  gi: number | string | null; unit: string | null; default_portion: number | string | null
  aliases: string[] | null; ingredient_names: string[] | null; search_text: string
  per100: Nutrients | null
  per_serving: (Nutrients & { availableCarbs: number; gl: number }) | null
  source: string | null; verified_at: string | null
}

const num = (v: number | string | null): number | null => (v === null ? null : Number(v))

function fromRow(r: FoodRow): FoodRecord {
  const gi = num(r.gi)
  return {
    id: r.id, kind: r.kind, name: r.name, gi, giLevel: giLevel(gi),
    category: (r.category ?? '') as FoodRecord['category'], cuisine: r.cuisine ?? undefined,
    unit: (r.unit ?? 'g') as FoodRecord['unit'], defaultPortion: num(r.default_portion) ?? 100,
    searchText: r.search_text,
    aliases: r.aliases ?? undefined,
    ingredientNames: r.ingredient_names ?? undefined,
    per100: r.per100 ?? undefined,
    perServing: r.per_serving ?? undefined,
    source: r.source ?? undefined,
    verifiedAt: r.verified_at ?? undefined,
  }
}

/**
 * Take the catalogue from the database instead of the files in the image.
 *
 * The point of the table is that food can be added without a deploy, and that
 * only works if the records live there too — vectors alone find an id the
 * build cannot describe. Called once at startup; anything wrong with the
 * answer leaves the file-built catalogue in place, because a half-loaded food
 * table is worse than an old one.
 */
export async function adoptCatalogue(rows: unknown[], log = console.log): Promise<boolean> {
  const inImage = loadFoods().records.length
  const built = (rows as FoodRow[]).filter((r) => r && r.id && r.search_text).map(fromRow)
  // Fewer records than the image holds means a truncated read, not a smaller
  // database — the file version is the safer of the two.
  if (built.length < inImage) {
    log(`[foods] the database returned ${built.length} records against ${inImage} in the image — keeping the image's`)
    return false
  }
  cache = { records: built, byId: new Map(built.map((r) => [r.id, r])) }
  log(`[foods] catalogue from the database: ${built.length} records`)
  return true
}

/** Map the ingredient table's groups onto the app's coarser categories. */
const GROUP_TO_CATEGORY: Record<string, FoodCategory> = {
  grain: 'grains', veg: 'vegetables', fruit: 'fruits', legume: 'legumes',
  protein: 'protein', seafood: 'protein', egg: 'protein', dairy: 'dairy',
  plant_milk: 'dairy', nut: 'nuts', seed: 'nuts', fat: 'fats', drink: 'drinks',
  condiment: 'sweets', spice: 'vegetables', herb: 'vegetables', pantry: 'grains',
  supplement: 'nuts',
}

/**
 * The USDA coverage layer: foods as people eat them, rather than as they cook.
 *
 * `data/foods-usda/foods_usda.json` was built in September and never loaded.
 * It is why "grits", "fried rice" and "pepperoni pizza" came back as foods we
 * do not have while the file holding all three sat in the repository. We take
 * the FNDDS half — 5,431 "foods as eaten" from NHANES, which is what someone
 * types into a diary — and leave SR Legacy's base ingredients out, because the
 * 351-ingredient table already covers that ground and duplicates cost
 * resolution more than they add.
 *
 * Nothing here is computed by us: nutrients are USDA's, and the glycemic index
 * carries the level and the plain-English basis the build assigned it, so a
 * category-median estimate reaches the user labelled as one.
 */
interface UsdaRow {
  fdc_id: string; name: string; dataset: string; category: string
  per100: Nutrients & { sugar?: number }
  portions?: { label: string; grams: number }[]
  gi: number | null; gi_level: number | string | null; gi_basis?: string
}

/** The portion a person would say, not the one a lab would weigh. */
function householdPortion(rows: { label: string; grams: number }[] | undefined): number {
  const usable = (rows ?? []).filter((p) => p.grams > 10 && p.grams <= 600 && !/\bdry\b|yields|not specified/i.test(p.label))
  const cup = usable.find((p) => /\bcup\b/i.test(p.label))
  return Math.round(cup?.grams ?? usable[0]?.grams ?? 100)
}

/** "Grits, NFS" is how a nutritionist codes it, not how anyone says it. */
const readableName = (name: string) =>
  name.replace(/,\s*(NFS|NS as to [^,]+)/gi, '').replace(/\s{2,}/g, ' ').replace(/,\s*$/, '').trim()

function usdaRecords(): FoodRecord[] {
  const path = join(here, '..', 'data', 'foods-usda', 'foods_usda.json')
  if (!existsSync(path)) return []
  const rows = (JSON.parse(readFileSync(path, 'utf8')) as { foods: UsdaRow[] }).foods
  const out: FoodRecord[] = []
  for (const r of rows) {
    if (r.dataset !== 'survey_fndds') continue
    // GI 0 means no available carbohydrate, the same convention the ingredient
    // table uses; level 5 means the build refused to guess, and both reach the
    // user as "I do not have a glycemic index for this".
    const gi = typeof r.gi === 'number' && r.gi > 0 ? r.gi : null
    // A carbohydrate food with no glycemic index cannot be costed, and the
    // engine's load helper answers 0 for a missing GI — which is true of
    // cheese and false of pizza. Deployed for an hour, the layer told someone
    // that two slices of pepperoni pizza carried a glycemic load of zero.
    // Until "carbs known, load unknown" is an answer this product can give,
    // a row we cannot cost does not enter the catalogue: not having the food
    // is the honest failure, and the one the agent already handles.
    const available = Math.max(0, (r.per100.carbs ?? 0) - (r.per100.fiber ?? 0))
    if (gi === null && available >= 5) continue
    const name = readableName(r.name)
    out.push({
      id: `usda:${r.fdc_id}`, kind: 'ingredient', name, gi, giLevel: giLevel(gi),
      category: 'grains', unit: 'g', defaultPortion: householdPortion(r.portions),
      searchText: `${name}. ${r.name}. ${r.category}.`,
      per100: { kcal: r.per100.kcal, protein: r.per100.protein, fat: r.per100.fat, carbs: r.per100.carbs, fiber: r.per100.fiber },
      source: `USDA FoodData Central, Survey (FNDDS)${r.gi_basis ? `; glycemic index ${r.gi_basis}` : ''}.`,
    })
  }
  return out
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
      // Mapped here, not only in asFood. The ingredient table says "grain" and
      // "veg" where everything else in the app says "grains" and "vegetables",
      // and `find_alternatives` filters by equal category — so a swap for
      // white rice could never be a curated ingredient, because 'grains' never
      // equalled 'grain'. The pool was smaller than it looked for every food.
      category: GROUP_TO_CATEGORY[r.group] ?? (r.group as FoodCategory),
      unit: 'g', defaultPortion: 100,
      searchText: `${r.name}. ${r.group}. ${r.id.replace(/_/g, ' ')}`,
      // The id is the everyday word for the food and the name is the precise
      // one — "miso" for White miso paste, "black beans" for Black beans,
      // cooked. Treating it as an exact name is what keeps a curated record
      // from losing its own word to a coverage row that happens to be titled
      // with it.
      aliases: [r.id.replace(/_/g, ' ')],
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

  // On, because the measurement says the curated categories are untouched by
  // it — everyday 32/32, ingredients 28/28, cuisines 9/9 with the layer loaded,
  // exactly as without — while ten of the twelve foods the suite had recorded
  // as "we do not have this" are now found, with the right dish. Set
  // USDA_FOODS=off to measure without it.
  if (process.env.USDA_FOODS !== 'off') records.push(...usdaRecords())

  cache = { records, byId: new Map(records.map((x) => [x.id, x])) }
  return cache
}

export function getRecord(id: string): FoodRecord {
  const rec = loadFoods().byId.get(id)
  if (!rec) throw new Error(`Unknown food: ${id}`)
  return rec
}

export function summary(rec: FoodRecord): FoodSummary {
  const { id, kind, name, gi, giLevel: lvl, category, cuisine, unit, defaultPortion, source, verifiedAt } = rec
  // Provenance travels with the record rather than being looked up later: the
  // claim "these numbers are not invented" is only as good as the user's
  // ability to see where each one came from.
  return { id, kind, name, gi, giLevel: lvl, category, cuisine, unit, defaultPortion, source, verifiedAt }
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

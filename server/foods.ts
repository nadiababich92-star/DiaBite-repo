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
/**
 * What one serving of an ingredient weighs, where 100 g is plainly wrong.
 *
 * Every ingredient defaulted to 100 g, so "a slice of rye bread" was costed as
 * three slices (a glycemic load of 20.6 where one slice is about 7.8) and the
 * answer said, honestly, that it had used the database default. A default that
 * is disclosed and three times too big is still a wrong number. Only the
 * breads, so far, because a slice is the unit people say; the rest are to be
 * set as the sessions show which ones are asked about.
 */
const INGREDIENT_PORTION_G: Record<string, number> = {
  // The owner's decisions, 26 November 2026 (tracker #131): a cheese named without an amount is 1 oz; a dressing, a sauce put on food or a
  // spread is its label serving, 2 tablespoons (ketchup 1); pasta sauces stay near half a cup. Gruyère on a salad was 132 g, Italian dressing 100 g.
  mozzarella: 28,
  american_cheese_reduced_fat: 28,
  italian_dressing: 30,
  bbq_sauce: 30,
  pesto: 30,
  salsa_verde: 30,
  peanut_butter_reduced_fat: 32,
  ketchup: 17,
  // White bread was 100 g, three and a half slices: "a slice of bread" was costed as 3 1/2 (a glycemic load of 33.8 for one). A slice is 29 g in the record's own table.
  white_bread: 29,
  rye_bread: 35,
  whole_grain_bread: 35,
  ezekiel_bread: 34,
  // The record is "Egg, large (50 g each)": the default is one egg, so "two eggs" is two of it.
  egg: 50,
  // A food eaten in a spoonful or a handful is not 100 g: "grits with butter" was a hundred grams of butter. These are the
  // household amounts (a tablespoon, an ounce, a teaspoon) that the label reference amounts use; a stated amount still wins.
  butter: 14, ghee: 14, olive_oil: 14, avocado_oil: 14, coconut_oil: 14, sesame_oil: 5, mayo: 14,
  cream_cheese: 28, sour_cream: 30, heavy_cream: 15, hummus: 30,
  cheddar: 28, feta: 28, goat_cheese: 28, swiss_cheese: 28, blue_cheese: 28, pepper_jack: 28, cotija: 28, parmesan: 10,
  almonds: 28, walnuts: 28, pecans: 28, cashews: 28, peanuts: 28, macadamia: 28, hazelnuts: 28, pine_nuts: 28,
  peanut_butter: 32, almond_butter: 32, tahini: 15,
  chia_seeds: 15, flaxseed: 10, hemp_seeds: 10, sunflower_seeds: 28, pumpkin_seeds: 28, sesame_seeds: 9,
  sugar_white: 4, honey: 21, maple_syrup: 20,
  dijon: 5, yellow_mustard: 5, soy_sauce: 15, tamari: 15, fish_sauce: 15, hot_sauce: 5, salsa: 30,
  rice_vinegar: 15, apple_cider_vinegar: 15, red_wine_vinegar: 15, white_wine_vinegar: 15, balsamic_vinegar: 15,
  cocoa_powder: 5, dark_chocolate: 28, salt: 1,
  // Added 18 November (worklist 65, the owner's choice: "only the base"). What a person says for these is a cup, half a cup,
  // a teaspoon: the USDA household measure of the record itself, so 100 g was neither a portion nor a number anyone could check.
  // Cooked grains and rice, a cup; cooked beans and lentils, half a cup (the label serving); milk, a cup; dried spices, a
  // teaspoon; fresh herbs, a tablespoon (rosemary and thyme by the teaspoon they are sold in). Meat, fish, vegetables and fruit stay 100 g.
  white_rice: 158, brown_rice: 195, wild_rice: 164, quinoa: 185, barley: 157, bulgur: 182, buckwheat: 168, soba: 114, egg_noodles: 160,
  rolled_oats: 40,
  lentils: 99, red_lentils: 99, chickpeas: 82, black_beans: 86, kidney_beans: 89, pinto_beans: 86, white_beans: 90, navy_beans: 91, lima_beans: 94, split_peas: 98,
  milk: 246,
  chili_powder: 3, paprika: 2, turmeric: 3, cinnamon: 3, nutmeg: 2, cayenne: 2, red_pepper_flakes: 2, garlic_powder: 3, onion_powder: 2, curry_powder: 2,
  dried_dill: 1, dried_rosemary: 1, mustard_seed: 2,
  parsley: 4, rosemary: 2, thyme: 1, ginger: 2,
  // Added 18 November (worklist 20/US measures, the owner's yes to the default-portion list in docs/specs/quantity-defaults.md): the household
  // amount a person says, from USDA's own rows (survey tables, "foods as eaten"): one medium apple, one orange, a peach, one regular pepper,
  // one tomato, half an avocado, a cup of cucumber and of strawberries; meat and fish by the exact ounce (4 oz cooked chicken or turkey, 3 oz
  // cooked salmon, shrimp or beef). A stated amount still wins.
  apple: 200, orange: 154, peach: 150, bell_pepper: 120, tomato: 125, avocado: 75, cucumber: 120, strawberries: 150,
  chicken_breast: 113, turkey_breast: 113, salmon: 85, shrimp: 85, beef_sirloin: 85,
}

const ALIASES: Record<string, string[]> = {
  // Not 'fried rice': it has oil, egg and a different glycemic index, and naming it white rice
  // would cost one food under another's name. It is a dish of its own (USDA's 'Rice, fried').
  'rice-white': ['rice', 'white rice', 'steamed rice', 'jasmine rice', 'sushi rice'],
  'rice-brown': ['brown rice'],
  'rice-basmati': ['basmati'],
  'pasta-durum': ['spaghetti', 'pasta', 'penne', 'linguine', 'fettuccine', 'noodles', 'macaroni', 'rigatoni', 'cooked spaghetti', 'spaghetti pasta', 'spaghetti noodles', 'cooked pasta', 'cooked penne', 'penne pasta', 'rigatoni pasta', 'linguine pasta', 'fettuccine pasta', 'cooked fettuccine', 'cooked linguine', 'macaroni pasta', 'cooked macaroni', 'elbow macaroni', 'rotini', 'rotini pasta', 'rotelle', 'farfalle', 'bowtie pasta', 'ziti pasta', 'cooked ziti', 'ziti noodles'],
  'pasta-whole': ['whole wheat pasta', 'whole wheat spaghetti', 'whole grain pasta'],
  'bread-white': ['bread', 'toast', 'white toast', 'sandwich bread', 'bun', 'roll', 'bagel'],
  'bread-rye': ['rye bread', 'rye toast', 'pumpernickel'],
  'bread-sprout': ['ezekiel bread', 'sprouted bread'],
  // 'potato' stays as the default to name when a meal has one among several foods;
  // resolve.ts keeps it from being certain (CATEGORY_WORDS). 'baked potato' is gone: a
  // baked potato is not a boiled one, and the records we hold say GI 83 against 78.
  'potato-boil': ['potato', 'potatoes', 'boiled potatoes', 'boiled potato'],
  'potato-mash': ['mashed potatoes', 'mash'],
  'sweetpotato': ['sweet potato', 'yam'],
  'oats': ['oatmeal', 'porridge', 'oats'],
  'oats-instant': ['instant oats', 'quick oats'],
  'egg': ['eggs', 'scrambled eggs', 'fried egg', 'boiled egg', 'boiled eggs', 'hard-boiled egg', 'hard-boiled eggs', 'hard boiled egg', 'hard boiled eggs', 'soft-boiled egg', 'omelette', 'omelet'],
  // "Cooked chicken breast" found fried coated chicken, and was left out of a 450 g burrito bowl as ambiguous (CL1, 24 November 2026).
  'chicken': ['chicken', 'grilled chicken', 'chicken breast', 'cooked chicken breast', 'chicken breast, cooked', 'grilled chicken breast', 'baked chicken breast', 'boneless chicken breast', 'skinless chicken breast', 'boneless skinless chicken breast'],
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
  'apple': ['apple', 'apples', 'gala apple', 'gala apples', 'fuji apple', 'honeycrisp apple', 'granny smith apple', 'red delicious apple', 'red apple', 'green apple'],
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
  /** The record's own USDA household measures ("cup", "slice"), where we hold a table that matches it. */
  portions?: { label: string; grams: number }[]
  /** Recipes: what one serving weighs, whole grams, from the recipe's own ingredients (water counted). Absent for every other kind. */
  servingGrams?: number
  /**
   * Recipes: what is in one serving, from the recipe's own ingredient list (`ing:<id>`, its name, grams per serving). Read by the rule that a
   * plate already holding a pita is not counted beside another pita, and by "two tacos" (how many shells one serving holds). Never shown.
   */
  parts?: { id: string; name: string; grams: number }[]
  /** USDA survey records: the survey's own food category ("Bananas", "Yeast breads"), which the swap rules read; `category` is 'grains' for all of them. Never shown. */
  wweia?: string
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

/**
 * The kinds that are costed for carbohydrate, fibre and energy and never for a glycemic load: a packaged
 * product, an everyday food USDA gives no index to, and a chain restaurant's menu item. One list, so a fourth
 * place cannot forget one of them (the swap filter once did).
 */
export function hasNoLoad(kind: string | undefined): boolean {
  return kind === 'branded' || kind === 'unrated' || kind === 'restaurant'
}

/**
 * Rule 4 of CLAUDE.md, for every path a record can enter by: a record with real
 * carbohydrate and no glycemic index stays out. The load helper answers 0 for a
 * missing GI — true of cheese, false of baking powder — and the table path
 * ("food can be added without a deploy") is the one that must not skip it.
 */
export function carbsWithoutLoad(r: { gi: number | null; per100?: Nutrients; perServing?: Nutrients & { availableCarbs: number }; kind?: string }): boolean {
  if (r.gi !== null && r.gi > 0) return false
  // The three exceptions, by design: a branded product, an unrated food and a restaurant item are
  // *labelled* as carbohydrate without a load, costed for carbohydrate only, and
  // never for a glycemic load. Nothing else may hold carbohydrate without a GI.
  if (hasNoLoad(r.kind)) return false
  // A recipe carries its numbers per serving, not per 100 g: a recipe row with carbohydrate and no index is the same fault.
  if (r.perServing) return r.perServing.availableCarbs >= 5
  return !!r.per100 && Math.max(0, r.per100.carbs - (r.per100.fiber ?? 0)) >= 5
}

function fromRow(r: FoodRow): FoodRecord {
  const gi = num(r.gi)
  return {
    id: r.id, kind: r.kind, name: r.name, gi, giLevel: giLevel(gi),
    category: (r.category ?? '') as FoodRecord['category'], cuisine: r.cuisine ?? undefined,
    unit: (r.unit ?? 'g') as FoodRecord['unit'],
    // The table holds 100 for every ingredient; a slice of bread is not 100 g, and a row
    // read from it must say so as well as the file the table was built from does.
    defaultPortion: (r.id.startsWith('ing:') ? INGREDIENT_PORTION_G[r.id.slice(4)] : undefined) ?? num(r.default_portion) ?? 100,
    searchText: r.search_text,
    aliases: r.aliases ?? undefined,
    ingredientNames: r.ingredient_names ?? undefined,
    per100: r.per100 ?? undefined,
    perServing: r.per_serving ?? undefined,
    source: r.source ?? undefined,
    verifiedAt: r.verified_at ?? undefined,
    // The table has no column for household measures: they live in the files (portion_mapping.json and USDA's own tables). A record read from
    // the table without them says every portion is "only a serving size", so a cup, a medium and a slice stop meaning anything, and the engine
    // answered needsWeight for every food the day the catalogue came from the database (18 November).
    portions: loadFoods().byId.get(r.id)?.portions,
    // Same for what the swap rules read: the table has no column for them, and a record without them is a food of unknown kind.
    servingGrams: loadFoods().byId.get(r.id)?.servingGrams,
    parts: loadFoods().byId.get(r.id)?.parts,
    wweia: loadFoods().byId.get(r.id)?.wweia,
  }
}

/** `fromRow`, for the test that proves a record read from the table keeps its household measures. */
export const recordFromRow = (r: Parameters<typeof fromRow>[0]) => fromRow(r)

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
  const built = (rows as FoodRow[]).filter((r) => r && r.id && r.search_text).map(fromRow).filter((r) => !carbsWithoutLoad(r))
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

/**
 * Where a record's numbers come from, and when anyone last checked them. The one place this is decided: the receipt shows it
 * ("checked" or "unverified" beside the source line), and the sync script writes the same text into the table, so the files
 * in the image and the table never disagree. A record that carries its own source (a USDA survey food, a branded product)
 * keeps it; this is only the default for the curated ingredients, the everyday foods and the recipes.
 *
 * The cross-check file is the only real verification this data has had: 88 ingredient glycemic index values compared against
 * published tables, 51 of which agreed. Everything else is unverified and says so, rather than borrowing the credibility of
 * the ones that were checked. Before 17 November the files in the image carried no source for these records at all, so a
 * meal of curated foods printed a receipt with no source line (worklist 16).
 */
export const GI_CROSSCHECKED_ON = '2026-09-30'
let crossChecked: Set<string> | null = null
function checkedIds(): Set<string> {
  if (crossChecked) return crossChecked
  crossChecked = new Set()
  const path = join(DATA, 'gi_crosscheck.json')
  if (existsSync(path)) {
    for (const row of JSON.parse(readFileSync(path, 'utf8')) as { key: string; flag: string }[]) if (row.flag === '') crossChecked.add(`ing:${row.key}`)
  }
  return crossChecked
}
export function provenance(id: string): { source: string; verified_at: string | null } {
  if (id.startsWith('rec:')) {
    return { source: 'Computed from its ingredients: nutrients summed, glycemic index as a carbohydrate-weighted mean (Wolever & Jenkins).', verified_at: null }
  }
  if (id.startsWith('seed:')) return { source: 'Seed food table: published averages for everyday US foods.', verified_at: null }
  return {
    source: 'Nutrients from USDA FoodData Central; glycemic index from the International Tables of Glycemic Index (2021).',
    verified_at: checkedIds().has(id) ? GI_CROSSCHECKED_ON : null,
  }
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

/** Sweets are eaten by the piece or the pouch, never by the cup, and a piece can weigh 2 g. */
const CONFECTIONERY = /^(candy|chewing gum|gum\b|lollipop|marshmallow|jelly bean)/i

/** Names whose usual portion is one piece by the rule in `householdPortion` (a candy, a slice of pizza, a piece of cornbread), not a row of the table. */
export const ONE_PIECE_DEFAULT = (name: string): boolean => CONFECTIONERY.test(name) || /^pizza\b(?!\s+rolls)|^cornbread, made from home recipe/i.test(name)

/** Foods said by the spoonful when nothing else is said: sweeteners, creams and creamers, butters and fats, sour cream, cream cheese, dressings. */
export const SPOONFUL = /^(sugar\b(?!, (cane|beet)\b)|brown sugar|cream\b(?! of\b)|half and half|coffee creamer|creamer|whipped (cream|topping)|butter\b(?!milk|scotch|fly)|margarine|ghee|lard\b|shortening|sour cream|cream cheese|ranch|italian dressing|caesar dressing|thousand island|blue cheese dressing|french dressing|honey mustard|[a-z' -]*\bdressing\b(?!, bread))/i

/** The portion a person would say, not the one a lab would weigh. */
export function householdPortion(rows: { label: string; grams: number }[] | undefined, name = ''): number {
  if (CONFECTIONERY.test(name)) {
    // "1 cup" of hard candy is 160 g and made "two hard candies" 320 g; the first listed piece-sized
    // portion is what someone means. Nothing under a gram, nothing over a pouch.
    const sweet = (rows ?? []).filter((p) => p.grams >= 1 && p.grams <= 100 && !/\bcup\b|\bdry\b|yields|not specified|sharing|movie/i.test(p.label))
    if (sweet.length) return Math.round(sweet[0].grams)
  }
  // A pizza is said in slices. The first portion USDA lists for most pizzas is a whole small one (516 g), which made
  // "two slices of pepperoni pizza" 1,032 g. A listed piece is the portion; a pizza with none keeps the old rule.
  // Cornbread is said in pieces too: the first portion USDA lists is a cup of crumbs.
  if (/^pizza\b(?!\s+rolls)|^cornbread, made from home recipe/i.test(name)) {
    const piece = (rows ?? []).find((p) => /^1 piece\b/i.test(p.label) && p.grams >= 30 && p.grams <= 300)
    if (piece) return Math.round(piece.grams)
  }
  // "Smothered chicken" is a piece of chicken in gravy, not the wing the table lists first.
  if (/^chicken with gravy$/i.test(name)) {
    const breast = (rows ?? []).find((p) => /breast/i.test(p.label))
    if (breast) return Math.round(breast.grams)
  }
  // A named sandwich is the one in its name: USDA lists "1 McDonald's Mac Jr" (135 g) first for "Big Mac (McDonalds)", which counted a
  // Big Mac as a Mac Jr (24 November 2026). For a chain's item (its chain in brackets), a portion whose label carries the item's own name is the portion.
  if (/\((mcdonalds|burger king|wendys|taco bell|kfc|subway|chick-fil-a)\)\s*$/i.test(name)) {
    const own = name.replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase()
    const named = (rows ?? []).find((p) => p.label.toLowerCase().includes(own))
    if (named) return Math.round(named.grams)
  }
  // Garlic bread is said by the slice, and "garlic bread" alone is the same slice "a slice of garlic bread" is (quantity.ts): the medium one, or the
  // small one where USDA lists only a small and a large (#131). USDA lists a large slice (111 g) first for several.
  if (/^garlic bread/i.test(name)) {
    const slice = (rows ?? []).find((p) => /^1 medium slice$/i.test(p.label)) ?? (rows ?? []).find((p) => /^1 small slice$/i.test(p.label))
      ?? (rows ?? []).find((p) => /^1 large slice$/i.test(p.label))
    if (slice) return Math.round(slice.grams)
  }
  // A cheese named without an amount is 1 oz (the owner's decision, 26 November 2026, #131): USDA lists a cup first for most (gruyère 132 g, Brie
  // 144 g, Camembert 246 g), which counted a topping as a bowl. Cottage cheese and ricotta are eaten by the spoon or the bowl and keep their rule.
  if (/^cheese, /i.test(name) && !/cottage|ricotta/i.test(name)) return 28
  // A sandwich or sub is one sandwich: USDA lists a slider first for some (65 g turkey, 60 g steak on wheat), a large one for others. Its own
  // "1 regular or 6\" submarine" row is the same thing for all seventeen, and a 6-inch sub is what "a turkey sub" means (#130, 26 November 2026).
  if (/sandwich or sub/i.test(name)) {
    const six = (rows ?? []).find((p) => /^1 regular or 6" submarine$/i.test(p.label))
    if (six) return Math.round(six.grams)
  }
  // A burrito bowl is said by the bowl. USDA lists "1 cup" first, 120 g, which made "a burrito bowl" a fifth of a bowl and
  // 20 g of carbohydrate with a plain "fits" (a dietitian's test, 15 November); the listed item is the portion.
  if (/^burrito bowl\b/i.test(name)) {
    const bowl = (rows ?? []).find((p) => /^1 item\b/i.test(p.label) && p.grams >= 150 && p.grams <= 600)
    if (bowl) return Math.round(bowl.grams)
  }
  // A sauce, a dressing or a spread is said by the spoonful: "1 cup" of barbecue sauce is 272 g, and nobody pours that on
  // brisket. USDA lists a guideline amount for a regular sandwich, or a tablespoon; a gravy lists only a cup, of which a ladle is a quarter.
  if (/^(barbecue sauce|ketchup|catsup|mayonnaise|salad dressing|tartar sauce|salsa|soy sauce|cheese sauce|syrup|honey|jelly|jam\b|preserves|mustard$)/i.test(name)) {
    const spoon = (rows ?? []).find((p) => /^guideline amount (on regular|per sandwich)|^1 tablespoon/i.test(p.label))
    if (spoon) return Math.round(spoon.grams)
  }
  // The same for what is put on or in something: sugar in coffee, cream, butter, sour cream, a dressing. USDA lists a cup first (butter 224 g, sugar
  // 200 g, cream 240 g), and "oatmeal with brown sugar" and "coffee with cream" were costed with the cup (100-dish test, 19 November). The portion is a
  // tablespoon, from the table's own tablespoon, guideline amount or teaspoon (three to the tablespoon) or fluid ounce (two).
  if (SPOONFUL.test(name)) {
    const r = rows ?? []
    const tbsp = r.find((p) => /^1 tablespoon|^guideline amount (on regular|per sandwich)/i.test(p.label))
    const tsp = r.find((p) => /^1 teaspoon/i.test(p.label))
    const floz = r.find((p) => /^1 fl oz/i.test(p.label))
    const g = tbsp?.grams ?? (tsp ? tsp.grams * 3 : floz ? floz.grams / 2 : undefined)
    if (g && g >= 1) return Math.round(g * 10) / 10
  }
  if (/^gravy\b/i.test(name)) {
    const cup = (rows ?? []).find((p) => /^1 cup/i.test(p.label))
    if (cup) return Math.round(cup.grams / 4)
  }
  // An egg is said by the egg, not by a cup of chopped egg.
  if (/^egg\b/i.test(name)) {
    const egg = (rows ?? []).find((p) => /^1 egg\b/i.test(p.label) && p.grams >= 30 && p.grams <= 120)
    if (egg) return Math.round(egg.grams)
  }
  const usable = (rows ?? []).filter((p) => p.grams > 10 && p.grams <= 600 && !/\bdry\b|yields|not specified/i.test(p.label))
  const cup = usable.find((p) => /\bcup\b/i.test(p.label))
  return Math.round(cup?.grams ?? usable[0]?.grams ?? 100)
}

/**
 * USDA's household measures for a curated ingredient or everyday food, from `data/recipes-db/portion_mapping.json`: made by
 * `scripts/map-portions.py`, which matches each food to the USDA SR Legacy record whose nutrients and name agree, and keeps only
 * the close matches (distance 0.10 or less, 60% of the words). A food that is not in the file simply has no household measure.
 */
let PORTION_MAP: Record<string, { label: string; grams: number }[]> | null = null
function portionMap(): Record<string, { label: string; grams: number }[]> {
  if (PORTION_MAP) return PORTION_MAP
  PORTION_MAP = {}
  const path = join(DATA, 'portion_mapping.json')
  if (existsSync(path)) {
    const file = JSON.parse(readFileSync(path, 'utf8')) as { foods?: Record<string, { measures?: { label: string; grams: number }[] }> }
    for (const [key, v] of Object.entries(file.foods ?? {})) if (v.measures?.length) PORTION_MAP[key] = v.measures
  }
  return PORTION_MAP
}

/** A weight in a household measure the record's own table lists ("1 cup", "1/2 cup", "2 slices"), and how it is said. */
export interface HouseholdMeasure { count: number; unit: string; text: string }

// SR Legacy writes "tbsp" and "tsp"; the survey tables write the words. Both are the same measure.
/** The most of a unit that is said in it: eleven tablespoons is two thirds of a cup, and nobody says it that way. */
const MOST_OF: Record<string, number> = { cup: 8, tablespoon: 4, teaspoon: 3, 'fl oz': 16, oz: 16, slice: 12, piece: 12, medium: 6, small: 6, large: 6 }
const FRACTIONS: [number, string][] = [[0, ''], [1 / 4, '1/4'], [1 / 3, '1/3'], [1 / 2, '1/2'], [2 / 3, '2/3'], [3 / 4, '3/4']]

/**
 * The household measure that says this many grams, taken from the record's own USDA table of measures and never worked out by
 * density: the grams must be a whole number or a simple fraction (1/4, 1/3, 1/2, 2/3, 3/4) of a listed measure within 3%, or
 * there is no measure and the screen shows grams only. A cup of rice and a cup of flour weigh different amounts, so a measure
 * the table does not list is never guessed. Among measures that fit, the largest unit wins (a cup, not sixteen tablespoons).
 * The grams stay the engine's number; this only says them the way a person in the US would.
 */
/**
 * USDA writes "4 oz" as the measure "oz" with the weight of four: the 4 is lost where the table is read, so a row "oz = 113 g"
 * is not one ounce. An ounce weighs 28.35 g and a fluid ounce of a food 26 to 34 g; any other weight under those labels is a
 * multiple of unknown size, and it is never said as "1 oz".
 */
function plausibleUnit(label: string, grams: number): boolean {
  const l = label.toLowerCase()
  if (l === 'oz') return grams >= 27 && grams <= 29.5
  if (l === 'fl oz') return grams >= 26 && grams <= 34
  return true
}

/**
 * One household row of a USDA table, read from its label (docs/specs/quantity-labels-and-links.md). The tables we hold have 26,977
 * rows in 2,143 label shapes; a bare unit word ("cup") was the only shape read before, so most survey tables were invisible.
 * `qualifier` is what the label says beyond the unit ("chopped", "ice"): a qualified row is kept but never used for a plain measure.
 */
export interface PortionRow {
  unit: 'cup' | 'tbsp' | 'tsp' | 'fl oz' | 'oz' | 'lb' | 'slice' | 'piece' | 'small' | 'medium' | 'large' | 'whole'
  /** Only for a slice: "medium or regular slice", "large or thick slice", "small or thin/very thin slice". */
  size?: 'small' | 'medium' | 'large'
  qualifier: string
  /** The word to say: "cup", "medium", "regular", "banana". */
  word: string
  grams: number
  /** USDA's own label, kept for provenance and display. */
  label: string
  /** The unit as the label wrote it, lower case ("tablespoon", "tbsp"): the old readers keyed on it. */
  rawUnit: string
}

const WHOLE_WORDS = new Set(['regular', 'whole', 'fruit', 'item', 'each'])
const stemWord = (w: string) => w.toLowerCase().replace(/ies$/, 'y').replace(/s$/, '')

/** The qualifier of a unit row: what follows the unit word, with the harmless parts ("(8 fl oz)", "nfs") removed. */
function qualifierOf(rest: string): string {
  let r = rest.trim().toLowerCase()
  r = r.replace(/\((?:8 fl oz|nfs|yield after cooking)\)/g, ' ').replace(/^,?\s*nfs\b/, ' ').replace(/^,\s*/, ' ')
  if (/\(1 nlea serving\)/.test(r)) return 'nlea'
  if (/\((?:no|with) ice\)/.test(r)) return 'ice'
  r = r.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
  return r
}

export function readPortion(label: string, grams: number, recordName: string): PortionRow | null {
  if (!(grams > 0)) return null
  const raw = String(label).trim()
  const lead = /^(\d+(?:\.\d+)?(?:\/\d+)?)\s+(.*)$/.exec(raw)
  const rest = (lead ? lead[2] : raw).trim()
  if (lead && Number(lead[1].includes('/') ? 0 : lead[1]) !== 1) return null   // a count other than 1 is a multiple of unknown size
  const low = rest.toLowerCase()
  const row = (unit: PortionRow['unit'], rawUnit: string, qualifier: string, word: string, size?: PortionRow['size']): PortionRow | null =>
    ((unit === 'oz' || unit === 'fl oz') && !plausibleUnit(unit, grams)) ? null : { unit, ...(size ? { size } : {}), qualifier, word, grams, label: raw, rawUnit }
  let m: RegExpExecArray | null
  if ((m = /^(medium or regular|large or thick|small or thin\/very thin) slice\b(.*)$/.exec(low))) {
    return row('slice', 'slice', qualifierOf(m[2]), 'slice', m[1].startsWith('medium') ? 'medium' : m[1].startsWith('large') ? 'large' : 'small')
  }
  // 19 November, from the 100-dish test: the natural American phrasings were left unread because USDA qualifies them.
  // A slice of bacon: "1 medium slice (yield after cooking)", "1 thin slice". A slice of pizza: "1 piece, medium pizza". A size of fries: "1 medium fast food order".
  if ((m = /^(small|medium|large|thin|thick)(?: or \w+)? slice\b(.*)$/.exec(low))) {
    return row('slice', 'slice', qualifierOf(m[2]), 'slice', m[1] === 'thin' ? 'small' : m[1] === 'thick' ? 'large' : (m[1] as 'small' | 'medium' | 'large'))
  }
  if ((m = /^piece,? (small|medium|large) pizza\b(.*)$/.exec(low))) return row('slice', 'slice', qualifierOf(m[2]), 'slice', m[1] as 'small' | 'medium' | 'large')
  if ((m = /^(small|medium|large|kid'?s?) (?:fast food )?(?:order|serving)\b(.*)$/.exec(low)) && /fast food|order/.test(low)) {
    const size = m[1].startsWith('kid') ? 'small' : (m[1] as 'small' | 'medium' | 'large')
    return row(size, size, qualifierOf(m[2]), size)
  }
  if ((m = /^(cup|tablespoon|tbsp|teaspoon|tsp|fl oz|oz|lb|slice|piece|medium|small|large)\b(.*)$/.exec(low))) {
    const w = m[1]
    const unit = (w === 'tablespoon' ? 'tbsp' : w === 'teaspoon' ? 'tsp' : w) as PortionRow['unit']
    // "1 cup, cooked" on a record that is cooked ("Pasta, cooked", "Durum wheat pasta, al dente") is just the cup; on a dry, raw or mix record it would be another food's weight.
    const q = qualifierOf(m[2])
    return row(unit, w, q === 'cooked' && unit === 'cup' && !/\b(dry|raw|uncooked|mix)\b/i.test(recordName) ? '' : q, w === 'tablespoon' ? 'tbsp' : w === 'teaspoon' ? 'tsp' : w)
  }
  // "One of it": a "regular", a "fruit", or the food's own word ("1 banana"). Not a whole turkey breast (1,769 g) or a whole pineapple:
  // a "typical" item that weighs more than 600 g is a different kind of "whole", and no one means it by "a medium".
  if ((m = /^(\w+)$/.exec(low)) && grams <= 600 && (WHOLE_WORDS.has(m[1]) || recordName.toLowerCase().split(/[^a-z]+/).filter(Boolean).map(stemWord).includes(stemWord(m[1])))) {
    return row('whole', m[1], '', m[1])
  }
  return null
}

/** The rows `householdMeasure` and `stepUnit` have always read: a plain row in one of the old units. Everything new is additive. */
const OLD_UNITS = new Set(['cup', 'tbsp', 'tsp', 'fl oz', 'oz', 'slice', 'piece', 'medium', 'small', 'large'])
/** The label shape read before 18 November: a bare unit word, with or without "1". */
const BARE_LABEL = /^(?:1 )?(cup|tablespoon|tbsp|teaspoon|tsp|fl oz|oz|slice|piece|medium|small|large)$/i
/**
 * A plain row in one of the old units. `strict` is the old reading (a bare unit word only); without it, the new label shapes count too.
 * A measure is looked for in the strict rows first and in the wider reading only when they say nothing, so a food a person already
 * sees in slices is not renamed in cups: what the wider reading adds is new, it does not replace.
 */
function plainRow(p: { label: string; grams: number }, strict: boolean): PortionRow | null {
  if (strict && !BARE_LABEL.test(String(p.label).trim())) return null
  const r = readPortion(p.label, p.grams, '')
  return r && !r.qualifier && OLD_UNITS.has(r.unit) ? r : null
}

const STEP_UNITS = ['cup', 'slice', 'piece', 'medium', 'large', 'small', 'tbsp', 'tsp', 'oz', 'fl oz']
const UNIT_SHORT: Record<string, string> = { tablespoon: 'tbsp', teaspoon: 'tsp' }

/**
 * The unit the portion editor moves this food by: from the record's own table, the one the grams are closest to one of (never
 * under half of it: half a banana, not a third of a whole jicama), so a 180 g plate of rice steps by quarters of a 158 g cup
 * and a 100 g chicken breast, whose only measures are a 272 g piece and a four-ounce row that cannot be told from an ounce,
 * steps in grams. Null when none fits. It says nothing about what the portion is called; that is `householdMeasure`.
 */
export function stepUnit(rows: { label: string; grams: number }[] | undefined, grams: number): { unit: string; unitGrams: number } | null {
  return stepUnitFrom(rows, grams, true) ?? stepUnitFrom(rows, grams, false)
}
function stepUnitFrom(rows: { label: string; grams: number }[] | undefined, grams: number, strict: boolean): { unit: string; unitGrams: number } | null {
  if (!rows?.length || !(grams > 0)) return null
  let best: { unit: string; unitGrams: number; d: number } | null = null
  for (const p of rows) {
    const pr = plainRow(p, strict)
    if (!pr) continue
    const raw = pr.rawUnit
    const unit = UNIT_SHORT[raw] ?? raw
    if (!STEP_UNITS.includes(unit)) continue
    const count = grams / p.grams
    if (count < 0.5 || count > (MOST_OF[raw] ?? MOST_OF[unit === 'tbsp' ? 'tablespoon' : unit === 'tsp' ? 'teaspoon' : unit] ?? 12)) continue
    const d = Math.abs(Math.log(count))
    if (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) <= 1e-9 && p.grams > best.unitGrams)) best = { unit, unitGrams: p.grams, d }
  }
  return best ? { unit: best.unit, unitGrams: best.unitGrams } : null
}

export function householdMeasure(rows: { label: string; grams: number }[] | undefined, grams: number): HouseholdMeasure | null {
  return householdMeasureFrom(rows, grams, true) ?? householdMeasureFrom(rows, grams, false)
}
function householdMeasureFrom(rows: { label: string; grams: number }[] | undefined, grams: number, strict: boolean): HouseholdMeasure | null {
  if (!rows?.length || !(grams > 0)) return null
  let best: { unitGrams: number; err: number; count: number; unit: string; fraction: string; whole: number } | null = null
  for (const p of rows) {
    const pr = plainRow(p, strict)
    if (!pr) continue
    const unit = ({ tbsp: 'tablespoon', tsp: 'teaspoon' } as Record<string, string>)[pr.rawUnit] ?? pr.rawUnit
    for (let whole = 0; whole <= 12; whole++) {
      for (const [f, fraction] of FRACTIONS) {
        const count = whole + f
        if (count === 0 || count > (MOST_OF[unit] ?? 12)) continue
        const err = Math.abs(grams - count * p.grams) / grams
        if (err > 0.03) continue
        if (!best || p.grams > best.unitGrams || (p.grams === best.unitGrams && err < best.err)) best = { unitGrams: p.grams, err, count, unit, fraction, whole }
      }
    }
  }
  if (!best) return null
  const number = best.whole > 0 ? (best.fraction ? `${best.whole} ${best.fraction}` : `${best.whole}`) : best.fraction
  const short = best.unit === 'tablespoon' ? 'tbsp' : best.unit === 'teaspoon' ? 'tsp' : best.unit
  const plural = best.count > 1 && ['cup', 'slice', 'piece'].includes(short) ? `${short}s` : short
  return { count: Math.round(best.count * 1000) / 1000, unit: short, text: `${number} ${plural}` }
}

/** "Grits, NFS" is how a nutritionist codes it, not how anyone says it. */
const readableName = (name: string) =>
  name.replace(/,\s*(NFS|NS as to [^,]+)/gi, '').replace(/\s{2,}/g, ' ').replace(/,\s*$/, '').trim()

/**
 * Everyday names for USDA records, where the survey table is the only record we
 * hold and the name people use is not the one it carries. Without these,
 * "fries" asked whether someone meant yuca or sweet-potato fries.
 */
const USDA_ALIASES: Record<string, string[]> = {
  // 26 November 2026, the owner's choice (tracker #130): a turkey sub is USDA's restaurant turkey sandwich or sub, not "Turkey Meatball Sub
  // (Open-Faced)", which the search put first for plain "turkey sub". "Subway" before it is dropped by the resolver (resolve.ts, withoutChain).
  // A baguette is French bread: "baguette" and "a slice of baguette" were not found, and the bread left the meal (sofia, 26 November, finding Z).
  'usda:2707610': ['baguette', 'french baguette', 'baguette bread'],
  'usda:2706985': ['turkey sub', 'turkey sub sandwich', 'turkey hoagie'],
  'usda:2706986': ['turkey and cheese sub', 'turkey cheese sub', 'turkey sub with cheese'],
  // 24 November 2026, the owner's choice: fries as people buy them are USDA's restaurant / fast-food fries (37.2 and 41.4 g carbohydrate per
  // 100 g), not fries cooked from fresh at home (18.5 g), which counted a medium order at half its carbohydrate. GI 78 by fix_fries_gi.py.
  'usda:2709462': ['french fries', 'french fry', 'fries', 'fast food fries', 'mcdonalds fries', "mcdonald's fries"], // Potato, french fries, restaurant: the record whose USDA portions are fast-food orders (medium 145 g, large 180 g), so "medium fries" needs no question
  // Findings of 24 November 2026 (the owner's live questions): each phrase found a different food; each now names the record that is it.
  'usda:2706916': ['big mac', 'big macs', 'mcdonalds big mac', "mcdonald's big mac"],                 // Big Mac (McDonalds); "big mac" found macadamia nuts
  'usda:2706442': ['chicken parmesan', 'chicken parmigiana', 'chicken parm', 'chicken parmesan cutlet'], // Chicken or turkey parmigiana; found a meatball skillet
  'usda:2705855': ['beef patty', 'hamburger patty', 'burger patty', 'ground beef patty'],              // Beef, ground, patty; found corned beef patty
  'usda:2706983': ['turkey sandwich on whole wheat', 'turkey sandwich on wheat bread', 'turkey sandwich on whole wheat bread'], // Turkey sandwich on wheat (carbohydrate only); found "on white"
  'usda:2708563': ['chicken burrito bowl', 'chipotle chicken burrito bowl', 'chipotle burrito bowl', 'chipotle chicken bowl'], // Burrito bowl, chicken, with beans and rice (a Chipotle bowl has rice); found a meal kit
  'usda:2708461': ['granola', 'granola cereal'],                                                      // Cereal, granola (carbohydrate only); found a granola bar
  'usda:2710011': ['fajita veggies', 'fajita vegetables', 'sauteed peppers and onions', 'sautéed peppers and onions', 'peppers and onions'], // Peppers and onions, cooked, fat added; "fajita veggies" found chicken fajita
  // Worklist 63, the owner's yes on 17 November: words people used that found nothing, each given the record that is that food.
  'usda:2708025': ['apple fritter', 'apple fritters', 'fruit fritter', 'fruit fritters'], // Fritter, fruit
  'usda:2708058': ['toaster pastry', 'toaster pastries'],                   // Breakfast pastry
  'usda:2708482': ['cold cereal', 'breakfast cereal', 'ready to eat cereal', 'ready-to-eat cereal'], // Cereal, other, plain
  // Found by eval/coverage: everyday names that resolved to nothing, or to a
  // neighbour that is a different food (taco -> taco seasoning, chili -> chili
  // powder, donut -> an iced-coffee drink). Each points at a record that was
  // already in the catalogue with its own glycemic index; no number is new.
  'usda:2708062': ['donut', 'donuts', 'doughnut', 'doughnuts'],           // Doughnut, NFS
  'usda:2707654': ['dinner roll', 'dinner rolls'],                        // Roll, white, soft
  'usda:2706399': ['pulled pork', 'bbq pork', 'barbecue pork'],           // Barbecue pork, with sauce
  'usda:2708299': ['pancake', 'pancakes', 'buttermilk pancakes'],         // Pancakes, plain, fast food / restaurant
  'usda:2706499': ['meatloaf', 'meat loaf'],                              // Meat loaf made with beef
  // "Steak and salad" on 24 November 2026 counted the salad as "Beef salad": a bare "salad" had no record, and the nearest vector was a meat dish.
  // A salad with no other word is what a US menu calls a side or garden salad.
  'usda:2709822': ['garden salad', 'side salad', 'house salad', 'tossed salad', 'green salad', 'salad', 'salads', 'vegetable salad', 'veggie salad', 'mixed salad', 'salad with vegetables', 'fresh salad'], // Lettuce, salad with assorted vegetables including tomatoes and/or carrots, no dressing
  // "Steak and veggies" counted "Veggie-Loaded Scrambled Eggs" (24 November 2026): the words for plain cooked mixed vegetables name the record that is that.
  'usda:2710015': ['veggies', 'mixed veggies', 'mixed vegetables', 'steamed vegetables', 'steamed veggies', 'cooked vegetables', 'boiled vegetables'], // Classic mixed vegetables, cooked
  'usda:2706375': ['chili con carne', 'beef chili'],                     // Chili with meat and beans
  'usda:2708352': ['egg noodles', 'noodles'],                             // Noodles, cooked
  'usda:2705949': ['fried chicken'],                                      // Chicken, NS as to part, fried, coated, skin eaten
  'usda:2709552': ['potato pancake', 'potato pancakes', 'latke', 'latkes', 'potato latkes'], // Potato pancake (no GI: carbohydrate only)
  'usda:2710359': ['gummy bears', 'gummy bear', 'gummies', 'gummy candy', 'gummy worms'],      // Candy, gummy (no GI: carbohydrate only)
  'usda:2706071': ['buffalo wings', 'buffalo wing', 'hot wings'],            // Chicken wings with sauce, from fast food / restaurant
  'usda:2705848': ['pot roast'],                                          // Beef, pot roast
  // 20 November 2026: both lost their computed GI (a missing ingredient made it unreliable) and were then outranked by a neighbour.
  'usda:2707139': ['clam chowder', 'new england clam chowder'],              // Soup, New England clam chowder (carbohydrate only)
  'usda:2708607': ['fajita vegetables', 'grilled fajita vegetables'],     // Fajita, vegetable (carbohydrate only)
  'usda:2706979': ['blt', 'blt sandwich', 'bacon lettuce tomato sandwich'], // Bacon, lettuce, tomato sandwich on white
  // "Pepperoni pizza" matched twelve survey pizzas and nine brands within a hair of each other, so the agent asked
  // 'stuffed crust or Tombstone?'. The plain restaurant or fast-food pizza is the one people mean; a crust, a freezer
  // or a school lunch is still reachable by naming it. Carbohydrate only: this survey food has no glycemic index.
  'usda:2708638': ['pepperoni pizza', 'pizza with pepperoni', 'pepperoni pizza slice', 'slice of pepperoni pizza'], // Pizza with pepperoni, from restaurant or fast food
  // A margherita is a cheese pizza with tomato and basil. It was found nowhere ("unknown"), so the dish was costed
  // from sauce and cheese with the dough left out, the one part that carries the carbohydrate. "Cheese pizza" went
  // to a white pizza with no tomato. Both mean the plain restaurant or fast-food cheese pizza; naming a crust still works.
  'usda:2708614': ['cheese pizza', 'margherita pizza', 'pizza margherita', 'margherita', 'cheese pizza slice', 'slice of cheese pizza', 'margherita pizza slice', 'slice of margherita pizza', 'pizza with cheese'], // Pizza, cheese, from restaurant or fast food
  'usda:2708615': ['thin crust cheese pizza', 'thin crust margherita pizza', 'thin crust margherita'], // Pizza, cheese, from restaurant or fast food, thin crust
  'usda:2708617': ['thick crust cheese pizza', 'thick crust margherita pizza', 'thick crust margherita'], // Pizza, cheese, from restaurant or fast food, thick crust
  // A pizza crust is not in the database, so a typical pizza costed from its parts left the dough out, the one part
  // that carries the carbohydrate (GL 0.4 to 1.4 for a whole pizza). The owner decided on 6 November 2026 that the
  // crust of an assumed pizza is counted as white bread, as an assumption the answer names, never a plain "fits".
  'usda:2707600': ['pizza crust', 'pizza dough', 'pizza base', 'pizza shell', 'thin pizza crust', 'thick pizza crust'], // Bread, white, made from home recipe or purchased at a bakery
  // The 300 dishes, reviewed by the owner on 3 November 2026: common foods that were "not in the database", or asked about.
  'usda:2705829': ['ribeye', 'rib eye', 'ribeye steak', 'grilled ribeye', 'rib-eye', 'rib eye steak'], // Beef, steak, ribeye, lean and fat eaten
  'usda:2705824': ['filet mignon', 'filet', 'tenderloin steak', 'beef tenderloin', 'grilled steak'], // Beef, steak, NFS
  'usda:2707155': ['eggs over easy', 'egg over easy', 'over easy eggs', 'over easy', 'eggs sunny side up', 'sunny side up eggs', 'eggs over medium', 'eggs over hard'], // Egg, whole, fried
  'usda:2705878': ['country ham', 'ham slice', 'ham steak'], // Ham
  'usda:2707003': ['crispy chicken sandwich', 'fried chicken sandwich', 'chicken sandwich', 'chicken fillet sandwich', 'spicy chicken sandwich', 'chick-fil-a sandwich'], // Chicken fillet sandwich, fried, from fast food
  'usda:2705894': ['baby back ribs', 'pork ribs', 'barbecue ribs', 'spare ribs', 'ribs'], // Pork, ribs
  // From the 300 familiar dishes of 27 October and a dietitian's own list (3 November 2026): each was asked about or
  // counted as a different food. The plain survey record is the one people mean; naming a variant still finds it.
  'usda:2708325': ['waffle', 'waffles', 'a waffle', 'belgian waffle', 'belgian waffles', 'plain waffle'], // Waffle, plain
  'usda:2708313': ['toaster waffle', 'toaster waffles', 'frozen waffle', 'frozen waffles'], // Waffle, plain, frozen
  'usda:2707811': ['cornbread', 'corn bread', 'piece of cornbread', 'slice of cornbread', 'homemade cornbread'], // Cornbread, made from home recipe
  'usda:2708811': ['mac and cheese', 'macaroni and cheese', 'mac & cheese', 'mac n cheese', 'baked mac and cheese', 'homemade mac and cheese'], // Macaroni or noodles with cheese
  'usda:2706428': ['smothered chicken', 'smothered chicken with gravy', 'chicken smothered in gravy', 'chicken and gravy'], // Chicken with gravy
  'usda:2706191': ['breakfast sausage', 'sausage links', 'sausage patties'], // Pork sausage (the same phrase also names turkey and chicken sausage, so the engine asks which)
  // Found by eval/coverage with community-phrases.txt (22 October 2026): the same food under the name people use.
  // Dishes with no record at all (arroz con pollo, tostones, dosa, lumpia, pancit, sancocho, tzimmes...) stay holes on
  // purpose: a neighbour's record under their name would be the substitution the engine never makes; the agent
  // costs those from their ingredients, as an estimate.
  'usda:2707124': ['pho', 'beef pho', 'pho soup'],                         // Soup, pho, with meat
  'usda:2709704': ['candied yams', 'candied sweet potatoes'],            // Sweet potato, candied
  'usda:2705843': ['oxtail', 'oxtails'],                                  // Beef, oxtails
  'usda:2708346': ['idli', 'idlis', 'idly'],                             // Idli
  'usda:2709559': ['fried plantain', 'fried plantains'],                  // Plantain, cooked with oil
}

/**
 * Names that more than one ingredient answers to. "Breakfast sausage" is pork, turkey or chicken, so all three carry
 * it and the engine asks which, instead of picking a recipe that merely has the words in its title (a first outside
 * user typed it and got "Breakfast Sausage Patties with Apple"). Keyed by the ingredient table's id.
 */
const INGREDIENT_ALIASES: Record<string, string[]> = {
  // "1 oz shredded cheese" found "Blue cheese, crumbled" (24 November 2026): shredded cheese, as sold in the US, is cheddar unless named.
  cheddar: ['shredded cheese', 'shredded cheddar', 'grated cheddar'],
  // "Shredded chicken" found a tostada recipe (24 November 2026); it is cooked chicken pulled apart.
  rotisserie_chicken: ['shredded chicken', 'pulled chicken'],
  turkey_sausage: ['breakfast sausage', 'sausage links', 'sausage patties', 'turkey breakfast patties', 'turkey sausage patties', 'turkey breakfast sausage', 'turkey breakfast links'],
  chicken_sausage: ['breakfast sausage', 'sausage links', 'sausage patties'],
  // 'pizza sauce' matched fish sauce, a neighbour by the word 'sauce'; on a pizza it is tomato sauce.
  tomato_sauce: ['pizza sauce', 'pizza tomato sauce'],
  // Butter beans are lima beans; the nearest record to the phrase was green beans cooked with butter.
  lima_beans: ['butter beans', 'butter bean', 'baby lima beans'],
}

/**
 * Everyday names for recipes whose own name is longer than the phrase people
 * use. A recipe's search text carries its cuisine, category and eight
 * ingredients, which dilutes a three-word phrase: "fish and chips" never
 * reached "Fish and Chips (Oven-Baked)". Keyed by recipe name, not id, so the
 * alias survives a rebuild that renumbers the library.
 */
const RECIPE_ALIASES: Record<string, string[]> = {
  'Fish and Chips (Oven-Baked)': ['fish and chips', 'fish & chips'],
  // 24 November 2026, the owner's choice: the side people mean by grilled or roasted vegetables is our own recipe, not pumpkin (what "roasted vegetables" found).
  'Grilled Vegetables': ['grilled vegetables', 'roasted vegetables', 'grilled veggies', 'roasted veggies', 'sauteed vegetables', 'sautéed vegetables', 'sauteed veggies', 'grilled vegetable', 'roasted vegetable'],
  'Black-Eyed Pea Salad (Texas Caviar)': ['texas caviar', 'cowboy caviar'],
  'Bratwurst-Style Turkey Sausage with Sauerkraut and Apple': ['brats', 'bratwurst'],
  "Oyster Po' Boy on a Bun": ['po boy', "po' boy", 'poboy'],
  "Shrimp Po' Boy Lettuce Boats": ['po boy', "po' boy", 'poboy'],
  'Cucumber Lime Agua Fresca': ['agua fresca', 'cucumber agua fresca'],
  'Shrimp Fra Diavolo over Spaghetti': ['fra diavolo', 'shrimp fra diavolo'],
  'Carne Guisada, Slow-Simmered Beef': ['carne guisada'],
  'Miso-Glazed Cod with Bok Choy': ['miso cod', 'miso glazed cod'],
  'Tom Kha Gai-Style Coconut Chicken Soup': ['tom kha', 'tom kha gai'],
  'Cauliflower and Potato Curry (Aloo Gobi)': ['aloo gobi', 'gobi aloo'],
  'Vietnamese Banh Mi Bowls with Pork': ['banh mi'],
  'Pineapple Mint Granita': ['granita', 'fruit granita'],
  'Slow Cooker Pork Chili Verde': ['chili verde', 'pork chili verde'],
  'Chicken Paprikash with Cauliflower': ['paprikash', 'chicken paprikash'],
  'Spaghetti Aglio e Olio with Broccoli': ['aglio e olio', 'spaghetti aglio e olio'],
  'Iced Chai Latte with Almond Milk': ['chai', 'chai latte', 'iced chai latte'],
}

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
    // A carbohydrate food with no glycemic index cannot be given a load, and the
    // engine's load helper answers 0 for a missing GI, which is true of cheese
    // and false of pizza. Deployed for an hour, the layer once told someone that
    // two slices of pepperoni pizza carried a glycemic load of zero. Such a row
    // now enters as kind `unrated`: carbohydrate, fibre and energy are costed,
    // the load is not available and is not estimated (see compute.ts), and a
    // meal that contains one is partial and never "fits".
    const available = Math.max(0, (r.per100.carbs ?? 0) - (r.per100.fiber ?? 0))
    const unrated = gi === null && available >= 5
    const name = readableName(r.name)
    out.push({
      id: `usda:${r.fdc_id}`, kind: unrated ? 'unrated' : 'ingredient', name, gi, giLevel: giLevel(gi),
      aliases: USDA_ALIASES[`usda:${r.fdc_id}`], wweia: r.category,
      category: 'grains', unit: 'g', defaultPortion: householdPortion(r.portions, r.name), portions: r.portions,
      searchText: `${name}. ${r.name}. ${r.category}.${USDA_ALIASES[`usda:${r.fdc_id}`] ? ` ${USDA_ALIASES[`usda:${r.fdc_id}`].join(', ')}.` : ''}`,
      per100: { kcal: r.per100.kcal, protein: r.per100.protein, fat: r.per100.fat, carbs: r.per100.carbs, fiber: r.per100.fiber },
      source: unrated
        ? `USDA FoodData Central, Survey (FNDDS): nutrients only. No glycemic index is assigned to this food, so no glycemic load is computed.${/withdrawn \d/.test(r.gi_basis ?? '') ? ` ${r.gi_basis!.slice(r.gi_basis!.indexOf('withdrawn'))}.` : ''}`
        : `USDA FoodData Central, Survey (FNDDS)${r.gi_basis ? `; glycemic index ${r.gi_basis}` : ''}.`,
    })
  }
  return out
}

/**
 * Packaged products from USDA's Branded Foods, chosen by scripts/build-branded.py.
 *
 * Label data only: carbohydrate, fibre, energy, protein and fat per 100 g and one
 * serving. No glycemic index exists for them and none is invented, which is why
 * they are their own kind: the only records allowed to hold carbohydrate without
 * a GI, and costed for carbohydrate but never for a load.
 */
interface BrandedRow {
  id: string; name: string; brand: string; category: string
  per100: Nutrients; serving: { grams: number; label: string }
  source: string; published?: string
}

function brandedRecords(): FoodRecord[] {
  if (process.env.BRANDED_FOODS === 'off') return []
  const path = join(here, '..', 'data', 'foods-usda', 'branded_common.json')
  if (!existsSync(path)) return []
  const rows = JSON.parse(readFileSync(path, 'utf8')) as BrandedRow[]
  return rows.map((r) => ({
    id: r.id, kind: 'branded' as const, name: r.name, gi: null, giLevel: giLevel(null),
    category: r.category as FoodRecord['category'], unit: 'g' as const, defaultPortion: r.serving.grams,
    searchText: `${r.name}. ${r.brand}. ${r.category}.`,
    per100: r.per100, source: r.source,
  }))
}

/**
 * A chain restaurant's menu item, as the chain itself publishes it.
 *
 * Costed exactly like a branded product: carbohydrate, fibre, energy, protein and fat for the serving the chain
 * names, no glycemic index and none invented, so a meal that holds one is partial and is never "fits". Two things
 * make it a kind of its own. The figure is the chain's, not a laboratory's (a 2011 JAMA study found one item in
 * five off by more than 100 kcal, most in carbohydrate-rich sides, soups, salads and desserts), and a restaurant
 * portion varies between locations. So every row must say where it was read and when, and the source line
 * the person sees says the figure is published, not measured.
 */
export interface RestaurantRow {
  id: string; name: string; chain: string; category: string
  per100: Nutrients; serving: { grams: number; label: string }
  /** The page or file of the chain's own nutrition table the row was read from. */
  url: string
  /** The day it was read, YYYY-MM-DD: a menu changes, and the line shown to the person carries the date. */
  read: string
}

/** Why a row may not enter the catalogue; empty when it may. Loud on purpose: a wrong carbohydrate figure is the worst fault this kind can have. */
export function restaurantFaults(r: RestaurantRow): string[] {
  const out: string[] = []
  if (!/^rest:[a-z0-9-]+$/.test(r.id ?? '')) out.push('id must be rest: and a lowercase slug')
  if (!r.name?.trim() || !r.chain?.trim()) out.push('name and chain are required')
  if (!/^https:\/\//.test(r.url ?? '')) out.push('url must be the chain\'s own https page or file')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.read ?? '') || Number.isNaN(Date.parse(r.read))) out.push('read must be a date, YYYY-MM-DD')
  const s = r.serving
  if (!s || !(s.grams > 0) || !s.label?.trim()) out.push('serving needs grams above 0 and a label')
  const p = r.per100
  if (!p || ![p.kcal, p.carbs, p.fiber, p.protein, p.fat].every((x) => Number.isFinite(x) && x >= 0)) out.push('per100 needs kcal, carbs, fiber, protein and fat, none negative')
  else {
    if (p.fiber > p.carbs) out.push('fibre is more than total carbohydrate')
    if (p.carbs + p.protein + p.fat > 100.5) out.push('carbohydrate, protein and fat add up to more than 100 g per 100 g')
  }
  if (!r.category) out.push('category is required')
  return out
}

export function restaurantRecordsFrom(rows: RestaurantRow[]): FoodRecord[] {
  const seen = new Set<string>()
  return rows.map((r) => {
    const faults = restaurantFaults(r)
    if (seen.has(r.id)) faults.push('duplicate id')
    seen.add(r.id)
    if (faults.length) throw new Error(`restaurant item ${r.id ?? '(no id)'} is not allowed in: ${faults.join('; ')}`)
    return {
      id: r.id, kind: 'restaurant' as const, name: `${r.chain} ${r.name}`, gi: null, giLevel: giLevel(null),
      category: r.category as FoodRecord['category'], unit: 'g' as const, defaultPortion: r.serving.grams,
      searchText: `${r.chain} ${r.name}. ${r.chain}. restaurant. ${r.category}.`,
      per100: r.per100,
      source: `${r.chain}'s own published nutrition table (${r.url}), read ${r.read}. A restaurant's published figures are not laboratory-checked and portions vary between locations. No glycemic index exists for it.`,
    }
  })
}

function restaurantRecords(): FoodRecord[] {
  if (process.env.RESTAURANT_FOODS === 'off') return []
  const path = join(here, '..', 'data', 'foods-usda', 'restaurant_items.json')
  if (!existsSync(path)) return []
  return restaurantRecordsFrom(JSON.parse(readFileSync(path, 'utf8')) as RestaurantRow[])
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
    if (carbsWithoutLoad({ gi, per100: r.per100 })) continue // vanilla extract, baking powder: see carbsWithoutLoad
    records.push({
      id: `ing:${r.id}`, kind: 'ingredient', name: r.name, gi, giLevel: giLevel(gi),
      // Mapped here, not only in asFood. The ingredient table says "grain" and
      // "veg" where everything else in the app says "grains" and "vegetables",
      // and `find_alternatives` filters by equal category — so a swap for
      // white rice could never be a curated ingredient, because 'grains' never
      // equalled 'grain'. The pool was smaller than it looked for every food.
      category: GROUP_TO_CATEGORY[r.group] ?? (r.group as FoodCategory),
      unit: 'g', defaultPortion: INGREDIENT_PORTION_G[r.id] ?? 100,
      searchText: `${r.name}. ${r.group}. ${r.id.replace(/_/g, ' ')}${INGREDIENT_ALIASES[r.id] ? `. ${INGREDIENT_ALIASES[r.id].join(', ')}` : ''}`,
      // The id is the everyday word for the food and the name is the precise
      // one — "miso" for White miso paste, "black beans" for Black beans,
      // cooked. Treating it as an exact name is what keeps a curated record
      // from losing its own word to a coverage row that happens to be titled
      // with it.
      aliases: [r.id.replace(/_/g, ' '), ...(INGREDIENT_ALIASES[r.id] ?? [])],
      per100: r.per100,
      portions: portionMap()[`ing:${r.id}`],
    })
  }

  for (const f of SEED_FOODS) {
    const aliases = ALIASES[f.id] ?? []
    records.push({
      id: `seed:${f.id}`, kind: 'ingredient', name: f.name, gi: f.gi, giLevel: giLevel(f.gi),
      category: f.category, unit: 'g', defaultPortion: f.portion.grams,
      searchText: `${f.name}. ${aliases.join(', ')}. ${f.category}. ${f.id.replace(/-/g, ' ')}`,
      per100: f.per100, aliases,
      portions: portionMap()[`seed:${f.id}`],
    })
  }

  for (const r of recipes) {
    const names = r.ingredients.map((i) => i.name)
    const availableCarbs = Math.max(0, r.carbs_g - r.fiber_g)
    const gi = availableCarbs >= 0.5 ? r.glycemic_index : null
    records.push({
      id: `rec:${r.id}`, kind: 'recipe', name: r.name, gi, giLevel: giLevel(gi),
      category: r.category, cuisine: r.cuisine, unit: 'serving', defaultPortion: 1,
      searchText: `${r.name}. ${(RECIPE_ALIASES[r.name] ?? []).join(', ')}${RECIPE_ALIASES[r.name] ? '. ' : ''}${r.cuisine} ${r.category}. ${names.slice(0, 8).join(', ')}. ${r.diet_tags}`,
      aliases: RECIPE_ALIASES[r.name],
      perServing: {
        kcal: r.kcal, protein: r.protein_g, fat: r.fat_g, carbs: r.carbs_g, fiber: r.fiber_g,
        availableCarbs, gl: r.glycemic_load,
      },
      ingredientNames: names,
      ...(r.servings > 0 && r.ingredients.length ? { servingGrams: Math.round(r.ingredients.reduce((t, i) => t + i.grams, 0) / r.servings) } : {}),
      ...(r.servings > 0 && r.ingredients.length ? { parts: r.ingredients.map((i) => ({ id: `ing:${i.ingredient_id}`, name: i.name, grams: Math.round((i.grams / r.servings) * 10) / 10 })) } : {}),
    })
  }

  // On, because the measurement says the curated categories are untouched by
  // it — everyday 32/32, ingredients 28/28, cuisines 9/9 with the layer loaded,
  // exactly as without — while ten of the twelve foods the suite had recorded
  // as "we do not have this" are now found, with the right dish. Set
  // USDA_FOODS=off to measure without it.
  if (process.env.USDA_FOODS !== 'off') records.push(...usdaRecords())
  records.push(...brandedRecords())
  records.push(...restaurantRecords())
  for (const r of records) {
    if (r.source) continue
    const p = provenance(r.id)
    r.source = p.source
    if (p.verified_at) r.verifiedAt = p.verified_at
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
  return id.startsWith('rec:') ? 'recipe' : id.startsWith('branded:') ? 'branded' : id.startsWith('rest:') ? 'restaurant' : 'ingredient'
}

# Spec — Swaps worth making: what the engine does

*Stage 2, from `docs/engineering/engineering-doc.md` (approved 23 November 2026, with the recommended answers to its open questions Q1 to Q4). Companion specs: `swaps-screen.md`, `swaps-agent.md`, `swaps-evals.md`. Read `server/compute.ts` (`findAlternatives`, `costOf`, `computeItem`), `server/engine.ts` (the `compute_meal` block that calls it, `/tools/find_alternatives`, `/session/:id`) and `server/sessions.ts` first. The promise: **every number is the engine's**, including the smaller portion's.*

**No migration, no new table, no new environment variable** (`.env.example` is unchanged: every threshold below is a named constant in `server/compute.ts`, not a setting). Nothing is stored about a person beyond one boolean in the session's memory (section 6).

## Files

| File | Change |
|---|---|
| `server/compute.ts` | `findAlternatives` v2: the rules of section 2, `portionOptions`, the sort; new constants |
| `server/roles.ts` | **new**: `swapClass(record)` and the allow-list |
| `server/foods.ts` | `FoodRecord.servingGrams` (recipes) and `FoodRecord.wweia` (USDA survey records) |
| `server/contract.ts` | `AlternativesRequest` and `Alternative` fields; `ComputeMealRequest` unchanged |
| `server/engine.ts` | `compute_meal` passes `mealGL`, `remainingGL`, `portionSwaps`; `/tools/find_alternatives` reads `portionSwaps` from the session; `/session/:id` accepts it |
| `server/sessions.ts` | `SessionState.portionSwaps?: false`; `putSession` gains a seventh parameter |
| `server/guard.ts` | `validateAsk` accepts `portionSwaps` (a boolean) |
| `server/agent.ts` | `AskRequest.portionSwaps`; `parkDayState` forwards it |
| `server/openapi.ts` | the new optional request fields and the response description of `find_alternatives` |

## 1. Constants (`server/compute.ts`, exported for the evals)

```ts
export const SWAP_MIN_GAIN = 5            // glycemic load units
export const SWAP_MIN_GAIN_SHARE = 0.25   // of the anchor's load
export const SWAP_ENERGY_BAND = 0.30      // ±, of the anchor's energy at the comparison quantity
export const SWAP_SIMILAR_POOL = 12       // best N different foods by similarity, after the filters
export const PORTION_FRACTIONS = [0.75, 0.5] as const
```

## 2. `findAlternatives(store, req, avoid, opts)`: the rules

The signature gains nothing positional; `req` carries the new fields (section 5) and the engine passes `opts = { allowPortion: boolean }` (false when the session says `portionSwaps === false` or the request does).

Definitions, for one call:

- `anchor`: the record of `req.foodId` (if `req.query` only, there is no anchor: only rules 2, 3 (no role check), 5-clause-2 and the sort apply, and **no portion option**).
- `anchorItem = computeItem({ foodId: anchor.id, grams: req.grams })` for an ingredient; for a recipe `computeItem({ foodId, servings: req.servings ?? 1 })`. `anchorGL = anchorItem.gl`, `anchorKcal = anchorItem.kcal`.
- If `anchorGL === null` or `anchorGL <= 0`: **return `[]`** (a food with no load, or none to save, has no swap; today a zero-load anchor skipped the worth test, which let anything through).
- **Comparison quantity of a candidate** (`costFor(candidate)`): an ingredient, `req.grams` (the anchor's grams when the anchor is an ingredient; its own `defaultPortion` when the anchor is a recipe and `req.grams` is absent); a recipe, `servings = anchor is a recipe ? (req.servings ?? 1) : 1`. The result is `{ gl, kcal, availableCarbs, grams?, servings? }` where `grams` for a recipe is `round(servingGrams × servings)` when `servingGrams` exists.
- `gain = r1(anchorGL − cost.gl)`; `fitsMeal = (req.mealGL !== undefined && req.remainingGL !== undefined) ? (req.mealGL − gain <= req.remainingGL + 1e-9) : null`.

**The rules, in this order; the first that fails drops the candidate:**

1. **Pool.** `store.search(vector, max(topK × 8, 80), filter)` as today. The filter keeps what it keeps today (the anchor itself, avoid list via `isAvoided`, `hasNoLoad(kind)`, `sameCategory`). Order inside the pool is the store's similarity order; `score` is carried.
2. **Same food or family, and the existing cap.** `sameFood` / `sameFamily` against the anchor as today; `cost.gl > req.maxGL` drops (the existing rule: an option that alone exceeds the day's remaining load is not a swap).
3. **Role.** `ALLOWED[swapClass(anchor)].includes(swapClass(candidate))`. A candidate of class `other` is never offered (section 3). **And also** a USDA survey record whose name has `with|and|sauce|casserole|gravy|stuffed|filled|topped` (a prepared dish: "pasta, whole grain, with tomato sauce and poultry") is not a swap for an anchor whose name has none of those words (found 23 November 2026: a cup of plain pasta was offered three pasta-and-poultry dishes).
4. **Energy.** `|cost.kcal − anchorKcal| <= SWAP_ENERGY_BAND × anchorKcal`.
5. **Worth.** `fitsMeal === true || (gain >= SWAP_MIN_GAIN && gain >= SWAP_MIN_GAIN_SHARE × anchorGL)`. With `fitsMeal === null` only the second clause counts. `gain` must also be `> 0`.
6. **Dedupe** by `sameFood` among already kept (the Apple in two tables), as today.

**Keep the best `SWAP_SIMILAR_POOL` (12) survivors by `score`**, then add the portion option (below), then **sort** by `(fitsMeal === true first, gain descending, score descending)` and return `topK` (default 3). A portion option carries `score: 1`, so it wins ties. The first element is the one the agent names.

**The portion option** (`portionOptions(anchor, anchorItem, req, ctx)`), built only when `allowPortion` and the anchor exists:

- For each `f` in `PORTION_FRACTIONS` (0.75, then 0.5): an ingredient anchor at `grams = r1(anchorItem.grams × f)`; a recipe anchor at `servings = anchorItem.servings × f` (a recipe anchor of 1 serving gives 0.75 and 0.5 servings; the menu already serves in quarters).
- Skipped when the anchor is avoided (`isAvoided(anchor, avoid)`: the person left it out by hand; the engine does not suggest eating even half of it), and when the anchor's grams are under 20 g (a spice, a spoon of oil), or the grams of the portion would be under 10.
- Costed by `computeItem` at that quantity: `gl`, `kcal`, `availableCarbs`. `gain` and `fitsMeal` as above. **Rules 3 and 4 do not apply** (same food, smaller on purpose); rule 5 does.
- **At most one is kept: the largest fraction that passes rule 5** (the least reduction that is worth saying). If 0.75 passes it is the one; otherwise 0.5; otherwise none.
- Fields: `change: 'portion'`, `portionOf: anchor.id`, `fraction: f`, `name: anchor.name`, `id: anchor.id`, `grams` (ingredient) or `servings` (recipe), `label` (below).

**Labels** (the engine's own words, in `labelFor(candidate, cost)`; the agent repeats them, never composes them):

| Case | Label |
|---|---|
| portion, 0.5, ingredient | `half the banana (59 g)` |
| portion, 0.75, ingredient | `three quarters of the banana (89 g)` |
| portion, 0.5, recipe | `half a serving of Oat Muffins (48 g)` (grams only if `servingGrams` known; else `half a serving of Oat Muffins`) |
| swap, ingredient | `pear (118 g)` |
| swap, recipe | `Oat Muffins, 1 serving (96 g)` (grams omitted if unknown) |

`plain name` is the record's name with anything in brackets removed and cut at the first comma, lower-cased for an ingredient (`"Banana"` → `banana`) and kept as written for a recipe. Grams are whole numbers.

**Where it is called (`server/engine.ts`, in `compute_meal`, today lines ~462 to 475):**

```ts
const sess = body.sessionId ? getSession(body.sessionId) : undefined
out.alternatives = await findAlternatives(store, {
  foodId: heaviest.foodId, grams: heaviest.grams, servings: heaviest.servings,
  maxGL: remaining !== undefined ? Math.max(0, remaining) : heaviest.gl,
  mealGL: meal.totals.gl, remainingGL: remaining, topK: 3,
}, avoid, { allowPortion: sess?.portionSwaps !== false })
```

**The decision and the call move out of the route** into one function, so the evals can run them without a server:

```ts
export async function alternativesForMeal(store: VectorStore, a: {
  meal: { items: MealItemResult[]; totals: { gl: number } }
  remaining: number | undefined          // day.remaining.gl, undefined when no day state
  avoid?: AvoidList
  allowPortion: boolean
}): Promise<{ alternatives: Alternative[]; alternativesFor: { foodId: string; name: string; grams: number; servings?: number } } | {}>
```

It holds today's three decisions unchanged: `needsHelp = totals.glLevel === 'high' || (remaining !== undefined && totals.gl > remaining)` (from `meal.totals`), "only a scored item can be the heaviest" (`gl !== null`), then the call above. It returns `{}` when no help is needed or nothing is scored. `compute_meal` spreads its result into the reply (`out.alternatives`, `out.alternativesFor`).

`heaviest.servings` exists on a recipe line and is undefined on an ingredient. `/tools/find_alternatives` passes the same `opts` from the session; it has no meal, so `mealGL` and `remainingGL` are whatever the model sent (optional).

## 3. `server/roles.ts`

```ts
export type SwapClass =
  | 'fruit' | 'veg' | 'starch' | 'cooked-grain' | 'bread' | 'breakfast-cooked' | 'baked' | 'sweet' | 'drink'
  | 'dairy' | 'nut' | 'protein-main' | 'savoury-snack' | 'mixed-dish' | 'other'
export function swapClass(rec: FoodRecord): SwapClass
export const ALLOWED: Record<SwapClass, SwapClass[]>
```

**`swapClass`: the first rule that matches wins** (the safety-critical name rules come first, so a baked or sweet thing is never taken for anything else):

1. **Name rules (any kind).** Case-insensitive on `rec.name`; **each word also in its plural** (`muffin`/`muffins`, `candy`/`candies`); baby food (`baby|babies|toddler|infant` in the name or the survey category) is class `other` before anything else:
   - `baked`: `\b(muffin|cupcake|cake|cookie|brownie|scone|pastry|doughnut|donut|croissant|danish|pie|tart|waffle|pancake|(granola|energy|protein|breakfast|oat|cereal|nut) bars?|(oat|oatmeal|baked|apple|banana) cups)\b` **or** `\bbaked\b` combined with `oat|apple|banana|berry|cinnamon` in a recipe of category Breakfast or Dessert.
   - (A bare "bar" is not `baked`: a candy bar or an ice cream bar is `sweet`, below.)
   - `sweet`: `\b(candy|chocolate|snickers|caramel|ice cream|ice-cream|popsicle|gelato|sorbet|pudding|jam|jelly|syrup|honey|sugar|marshmallow|frosting|gummy|gummies)\b`.
   - `drink`: category `Drinks & Smoothies` or `drinks`; a name with `drink|juice|soda|smoothie|beverage`; or the `wweia` string contains `drink`, `beverage`, `juice`, `coffee`, `smoothie` or starts with `tea` or `water`.
2. **USDA survey records (`wweia` set).** First match: `/banana|apple|berr|citrus|melon|grape|peach|fruit/i` → `fruit`; `/potato|corn|plantain/i` → `starch`; `/rice|pasta|noodle|grain/i` → `cooked-grain`; `/bread|roll|bagel|tortilla|toast|biscuit/i` → `bread`; `/oatmeal|cereal, cooked|grits|porridge/i` → `breakfast-cooked`; `/cookie|cake|pie|pastry|donut|brownie/i` → `baked`; `/candy|ice cream|frozen dairy|dessert/i` → `sweet`; `/milk|yogurt|cheese/i` → `dairy`; `/nut|seed/i` → `nut`; `/vegetable|salad|leafy/i` → `veg`; `/beef|pork|poultry|chicken|turkey|fish|seafood|egg|bean|legume|tofu/i` → `protein-main`; `/sandwich|soup|stew|pizza|burrito|taco|casserole|mixed/i` → `mixed-dish`; `/snack|chip|pretzel|popcorn/i` → `savoury-snack`.
3. **Curated ingredients and everyday foods, by the category the catalogue stores** (the group is mapped to it: `condiment` is `sweets`, `pantry` is `grains`, `spice` and `herb` are `vegetables`, so the category is what the rule can read): `fruits` → `fruit`; `vegetables` → `veg`; names matching `potato|sweet potato|corn|yam|plantain|cassava` override `veg` to `starch`; `grain` → `bread` when the name matches `bread|bagel|tortilla|bun|roll|pita|toast|muffin` (English muffin is `bread`, checked before the baked rule: see the exception below), `breakfast-cooked` when it matches `oat|porridge|grits|farina`, else `cooked-grain`; `dairy` → `dairy`; `nut`, `seed` → `nut`; `protein`, `seafood`, `egg`, `legume` → `protein-main`; `condiment`, `pantry`, `supplement`, `fat` → `other`.
4. **Recipes by category.** `Breakfast` → `breakfast-cooked` (the `baked` name rule has already caught muffins and bars); `Snack & Appetizer` → `savoury-snack`; `Dessert` → `sweet`; `Poultry`, `Beef, Pork & Lamb`, `Seafood`, `Soup & Stew`, `Vegetarian & Vegan`, `Sandwiches & Wraps`, `Salad`, `Side Dish` → `mixed-dish`; `Drinks & Smoothies` → `drink`.
5. Anything else → `other`.

*Exception:* "English muffin" is a bread; the `baked` rule excludes names matching `english muffin`.

**`ALLOWED` (the candidate's class must be in the anchor's list; directional where stated):**

```ts
fruit:            ['fruit']
veg:              ['veg']
starch:           ['starch', 'veg', 'cooked-grain']      // a potato for rice, a vegetable for a potato
cooked-grain:     ['cooked-grain', 'veg', 'starch']      // cauliflower rice for rice
bread:            ['bread']
'breakfast-cooked': ['breakfast-cooked']
baked:            ['baked']                              // an oat muffin for a muffin
sweet:            ['sweet', 'fruit']                     // a sweet may become a fruit; a fruit never becomes a sweet
drink:            ['drink']
dairy:            ['dairy']
nut:              ['nut', 'savoury-snack']
'protein-main':   ['protein-main']
'savoury-snack':  ['savoury-snack', 'nut']
'mixed-dish':     ['mixed-dish']
other:            []                                      // an anchor of class other gets a portion option only
```

**Consequence to test:** the porridge (`seed:oats`, `breakfast-cooked`) is offered other `breakfast-cooked` things (egg dishes, "Cauliflower Oatmeal") and never a muffin, bar or "baked oatmeal cups" (`baked`).

## 4. `server/foods.ts`

- `FoodRecord.servingGrams?: number`: for `kind: 'recipe'`, `Math.round(Σ ingredients[i].grams ÷ servings)` from `RecipeRow.ingredients` (water counted). Absent for every other kind.
- `FoodRecord.wweia?: string`: for USDA survey records, the row's `category` string (today dropped, because every survey record carries `category: 'grains'`). Not shown anywhere.
- Neither field enters `searchText`, so **no vector is stale and `sync-foods` is not needed** (`npm run eval`'s "index current" must stay ok).

## 5. `server/contract.ts`

```ts
export interface AlternativesRequest {
  // existing fields unchanged …
  /** Servings of the anchor when it is a recipe. */
  servings?: number
  /** The whole meal's glycemic load, so the engine can say whether the swap makes the meal fit. */
  mealGL?: number
  /** The day's remaining glycemic load before this meal. */
  remainingGL?: number
}

export interface Alternative extends FoodSummary {
  score: number
  gl: number
  kcal: number
  availableCarbs: number
  /** Grams for `unit: 'g'`, servings for a recipe. Unchanged meaning. */
  portion: number
  /** NEW. 'swap' is a different food; 'portion' is less of the same food. */
  change: 'swap' | 'portion'
  /** NEW. Load saved against the anchor at the comparison quantity, one decimal. */
  gain: number
  /** NEW. True when the meal fits the day after this swap; null when the engine was not told the meal. */
  fitsMeal: boolean | null
  /** NEW. The engine's phrase for it, with its weight (section 2). The agent repeats it. */
  label: string
  /** NEW. Whole grams; for a recipe `servingGrams × servings`, absent when unknown. */
  grams?: number
  servings?: number
  /** NEW, portions only: the food it is less of, and the fraction (0.75 or 0.5). */
  portionOf?: string
  fraction?: number
}
```

`portionSwaps` is **not** in `AlternativesRequest`: it is read from the session only, so a model cannot turn it back on.

## 6. `portionSwaps` end to end (the owner's decision Q1)

The browser sends `portionSwaps: false` **only** when `menuHidden(profile)` is true (an eating-disorder history, or kidney disease, the same rule that hides the weekly menu); otherwise it sends nothing. The field never names a condition.

| Step | Change |
|---|---|
| `src/lib/agent.ts` `AskRequest` | `portionSwaps?: false` |
| `server/guard.ts` `validateAsk` | `if (b.portionSwaps !== undefined && b.portionSwaps !== false) return { field: 'portionSwaps' }` (only `false` is a valid value) |
| `server/agent.ts` `AskRequest` and `parkDayState` | carried to `putSession` (in process) or into the `PUT /session/:id` body |
| `server/engine.ts` `PUT /session/:id` | `if (portionSwaps !== undefined && portionSwaps !== false) return 400 { error: 'invalid portionSwaps' }`; passed to `putSession` |
| `server/sessions.ts` | `SessionState.portionSwaps?: false`; `putSession(…, units, portionSwaps?)` stores `...(portionSwaps === false ? { portionSwaps: false } : {})` |
| `findAlternatives` | `allowPortion = sess?.portionSwaps !== false` |

**It lives in memory for the session's hour, like `avoid` and `units`. It is never written to the turn log, never to Supabase, never in a response body.** `logTurn` is read to confirm it logs no request field but the question; a test greps the log line (evals SW15).

## 7. Errors

None new. `/tools/find_alternatives` still answers 200 with `{ alternatives: [], error }` for a missing session or `maxGL`. `/agent/ask` answers 400 `{ error: 'invalid_request', field: 'portionSwaps' }` for any value but `false` (the shape `validateAsk` already uses). A request without the new fields behaves as before **except** for the rules themselves.

## Verifiable

`swaps-evals.md`: SW1 to SW15 read `alternatives[].change`, `gain`, `fitsMeal`, `kcal`, `label`, `grams`, `portionOf`, the sort order and `swapClass` of every returned alternative; mutations remove each rule in turn; the owner's four examples are run and reported.

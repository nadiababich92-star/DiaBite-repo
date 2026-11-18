# Spec — US household measures: the engine converts a person's measure into grams

*Stage 2, from `docs/engineering/engineering-doc.md` (approved 18 November 2026; open questions answered: volumes may be derived across rows of the same food by the exact US ratios; the question wording is "About how many ounces or cups?"). Companion specs: `quantity-labels-and-links.md`, `quantity-defaults.md`, `quantity-session-and-screen.md`, `quantity-agent.md`, `quantity-evals.md`.*

**No migration, no new table, nothing in `.env.example`, nothing stored about a person.** The engine's image gains one line in the Dockerfile (below). A change to the engine's code is a change that needs `npm run eval` and `npm run eval:abuse` before anything else.

## What it is

One pure function, `gramsFor`, in a new file `server/quantity.ts`, and the wiring that lets `compute_meal` take what the person said instead of grams. **The model no longer produces a weight from a household word.** The engine does, from the food's own USDA table, or from exact constants, or it says it cannot.

## Files

| File | Change |
|---|---|
| `server/quantity.ts` | **new**: `gramsFor`, `saidText`, `QuantityUnit`, `QUANTITY_UNITS`, constants |
| `server/contract.ts` | `MealItemInput.quantity`; `MealItemResult.quantity/said/basis`; `NeedsWeightResponse` |
| `server/compute.ts` | `computeMeal` resolves each `quantity` to grams before `computeItem`; passes `units` |
| `server/engine.ts` | `/tools/compute_meal`: validation of the three-way choice, `needsWeight`, reads the session's `units` |
| `server/openapi.ts` | the item schema and the operation description (the model's only view of the tool) |
| `Dockerfile` | server stage: `COPY src/lib/measure.ts ./src/lib/measure.ts` (for `ouncesText`, shared with the browser; sits with the other `COPY src/lib/*.ts` lines) |
| `server/foods.ts` | reads household rows through `readPortion` (`quantity-labels-and-links.md`); no change to what it exports |

## Types (`server/contract.ts` and `server/quantity.ts`)

```ts
export const QUANTITY_UNITS = [
  'g', 'oz', 'lb',                              // a weight: exact, any food
  'cup', 'tbsp', 'tsp', 'fl oz',                // a volume: the food's own row, or exact ratios from another volume row of the same food
  'slice', 'piece',                             // a count of a part
  'small', 'medium', 'large', 'whole',          // one item; 'whole' means one of it
  'default',                                    // the food's own default portion, times count
] as const
export type QuantityUnit = (typeof QUANTITY_UNITS)[number]

export interface Quantity { count: number; unit: QuantityUnit }

export interface MealItemInput {
  foodId: string
  grams?: number
  servings?: number
  quantity?: Quantity          // exactly one of grams, servings, quantity
}

export type Basis = 'usda_measure' | 'exact_conversion' | 'typical' | 'default' | 'stated'
// on MealItemResult, all optional so nothing old changes:
//   quantity?: Quantity       the person's measure, echoed
//   said?: string             "1 medium (200 g)", "4 oz (113 g)", "182 g"
//   basis?: Basis             how the grams were got

export interface NeedsWeightResponse {
  needsWeight: { foodId: string; name: string; quantity: Quantity; units: QuantityUnit[]; why: string }[]
  hint: string               // the question in the session's units, below
}
```

`units` in a `needsWeight` entry lists the units this food **can** be said in (the units `gramsFor` would accept for it), always including `g`, `oz` and `lb`.

## `gramsFor(record, quantity)`

Input: a `FoodRecord` (its `portions`, `defaultPortion`, `kind`) and a validated `Quantity`. Output: `{ grams, basis, row? }` or `{ needs: string }` (the reason text for `why`). Pure: no I/O, no clock.

Constants: `GRAMS_PER_OUNCE = 28.3495`, `GRAMS_PER_POUND = 453.592`; volume ratios in teaspoons: `tsp 1`, `tbsp 3`, `fl oz 6`, `cup 48`.

Rows come from `readPortion` (`quantity-labels-and-links.md`): each usable row is `{ unit, size?, qualifier, grams, label }`. **Only unqualified rows are used** (`qualifier === ''`); a row such as "cup, chopped" is never used here.

**Rule 1: weights.** `g`: `grams = count`, basis `stated`. `oz`: `count × 28.3495`. `lb`: `count × 453.592`. Basis `exact_conversion` (`stated` for `g`). Any record kind.

**Rule 2: `default`.** `record.defaultPortion × count`, basis `default`. For a `recipe` record (counted by serving) this is a number of servings and the item is costed with `servings: count` instead.

**Rule 3: volumes** (`cup`, `tbsp`, `tsp`, `fl oz`). If the record has a row for that unit, `grams = count × row.grams`, basis `usda_measure`. Otherwise take the first available source row in the order `cup`, `tbsp`, `tsp`, `fl oz`, and compute `grams = count × (ratio[requested] / ratio[source]) × row.grams`; basis `usda_measure`, and the item carries `via: "<source unit>"` (informational: it is in the trace and nowhere on screen). A record with no volume row at all: `needs`.

**Rule 4: counted parts** (`slice`, `piece`). The row with that unit; for `slice`, prefer size `medium`, then no size, then `large`, then `small` (a person who says "a slice" means the usual one). `grams = count × row.grams`, `usda_measure`. No row: `needs`.

**Rule 5: one item** (`small`, `medium`, `large`, `whole`).
- `small` or `large`: the row of the same size only; no such row: `needs` (a typical size is not a small one).
- `medium`: the `medium` row (basis `usda_measure`); if none, the single `whole`-class row (USDA's "regular", "whole", "fruit", "each", or a row whose word is part of the food's own name, such as "1 banana"): basis `typical`.
- `whole`: the `whole`-class row, or a `medium` row if that is all there is (basis `usda_measure` for medium, `typical` otherwise). Half of one is `count: 0.5`.
- Two or more `whole`-class rows (for example "regular" and "miniature" are different classes; two plain "whole" rows are not expected): take the one with the larger gram weight and mark `typical`.
Failure: `needs`.

**Rule 6: nothing else.** A unit the record has no row for, a kind of record with no rows (a branded or restaurant item has none, only a serving and a default), a recipe asked for anything but `default`: `needs`. **Never a density from another food, never a guess.**

`why` texts (exact): `"no USDA household measure for this food in <unit>"` (for rows), `"a recipe is counted by serving"`, `"this item has only a serving size"`.

### Rounding

`grams` is rounded to one decimal (`Math.round(x * 10) / 10`). `count` is passed as given.

### `saidText(item, units)` (the words the person reads)

`units` is `'imperial' | 'metric' | undefined`; `undefined` behaves as `'metric'`.

| Case | imperial | metric |
|---|---|---|
| basis `stated` (grams typed) | `"300 g"` | `"300 g"` |
| `usda_measure` or `typical` | `"<count text> <row word> (<grams> g)"`, for example `"1 cup (158 g)"`, `"1 medium (200 g)"`, `"1 regular (120 g)"`, `"2 tbsp (32 g)"` | `"<grams> g"` |
| `exact_conversion`, `oz` or `lb` | `"4 oz (113 g)"` (`ouncesText` for the part before the brackets; a pound count under 2 lb is shown in ounces) | `"113 g"` |
| `default` | the household measure the grams match (`householdMeasure`), else `ouncesText`, else grams; always with the grams in brackets when a household word is used | `"<grams> g"` |

`<count text>` uses the fractions the engine already says (`1/4`, `1/3`, `1/2`, `2/3`, `3/4`, with a whole part: `1 1/2`); any other count is written as a decimal with at most two places. The row word is the row's own (`medium`, `regular`, `slice`, `cup`...), so a `typical` item says the word USDA used and the answer can name it. Grams in `said` are whole numbers from 10 g up and one decimal below.

## `compute_meal` wiring (`server/engine.ts`, `server/compute.ts`)

Order of work in the route, before today's checks:

1. Validate the items (errors below). All answer `200` with an `error` field (model-facing tools never use a 4xx).
2. For each item with `quantity`: `gramsFor(getRecord(foodId), quantity)`. If any item returns `needs`, answer **only** `NeedsWeightResponse` for every item that needs one (no `items`, no `totals`, no `dayState`; the session's unknown-food bookkeeping is not touched), with a `hint` that carries the question in the session's units (owner's wording): imperial, `ask the person exactly: "About how many ounces or cups of <food>?" Do not estimate.`; metric or absent, `ask the person exactly: "About how many grams of <food>?" Do not estimate.` (`<food>` is the item's name; for several items, the first). Costing the other items without it would answer a partial meal the model could present as a whole.
3. Otherwise replace each `quantity` item with `{ foodId, grams }` (or `{ foodId, servings }` for a recipe) and call `computeMeal` as today. After computing, attach to each item `quantity`, `basis` and `said` (using the session's `units`). `measure` and `stepUnit` (`withMeasure`) are still computed from the resulting grams, so the receipt's stepper keeps working.
4. Everything after is unchanged: `dayState`, `afterMeal`, `driver`, `alternatives`, `excluded`, `carbLimit`.

`getSession(sessionId)?.units` supplies `units`; absent means metric text.

### Validation (all `200`, `{ error: <text> }`)

| Condition | `error` |
|---|---|
| none of `grams`, `servings`, `quantity` on an item, or two or more | `"give exactly one of grams, servings, quantity for <foodId>"` |
| `quantity.count` not a finite number, `<= 0`, or `> 100` | `"quantity.count must be a positive number up to 100 for <foodId>"` |
| `quantity.unit` not in `QUANTITY_UNITS` | `"unit must be one of: g, oz, lb, cup, tbsp, tsp, fl oz, slice, piece, small, medium, large, whole, default"` |
| `foodId` unknown | the existing unknown-food error |

The old message that says `items must be a non-empty list of { foodId, grams }` is updated to `{ foodId, grams | servings | quantity }`.

## `server/openapi.ts`

`items[]` gets `quantity` beside `grams` and `servings`:

```
quantity: { type: 'object', required: ['count','unit'], properties: {
  count: { type: 'number', description: 'How many, exactly as the person said it: 1, 2, 0.5 for "half", 1.5.' },
  unit:  { type: 'string', enum: [<QUANTITY_UNITS>], description: 'The unit the person used. "default" for "two eggs" or "a banana" (the food\'s own usual portion); "whole" for one of it ("half an avocado" is count 0.5, unit whole); "g" only when they typed grams.' } } }
```

The operation `description` replaces "Give `grams` for ingredients and `servings`..." with: "Give exactly one per item: `quantity` (what the person said: a count and a unit; the engine finds the weight), `grams` only if you have a weight from a tool, or `servings` for a recipe. Never turn a household measure into grams yourself. If the reply is `needsWeight`, no number came back: ask the person." The reply description adds `said` and `basis`.

## Verifiable

- **Engine block `quantity`** in `eval/run-engine.ts` (spec `quantity-evals.md`): the 40-row conversion table, `needsWeight`, `default`, the exactly-one rule, `said` in both unit systems, and mutations for each rule.
- **A conversion by hand**: `gramsFor` for 1 cup of `ing:white_rice` returns 158 g, basis `usda_measure`; 4 oz of anything returns 113.4 g, basis `exact_conversion`; 2 tbsp of a food whose only volume row is a cup (milk, 246 g) returns 30.8 g by the 1/16 ratio.
- **The live service** after deploy (rule 1): a `compute_meal` with `quantity: { count: 1, unit: 'cup' }` for rice returns `grams: 158` and `said: "1 cup (158 g)"` for an imperial session and `"158 g"` for a metric one.

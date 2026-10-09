# Spec: branded foods, the engine

*Read with `branded-foods-data.md`.*

## Behaviour

A branded item can be costed for carbohydrate, fibre and calories and **cannot be given a glycemic load**. It is the same situation as a food the database lacks, with one difference: we know a part of it. So the verdict machinery is reused, not duplicated.

## `server/contract.ts`

```ts
export interface MealItemResult {
  /* existing fields */
  /** False for a branded item: no glycemic index exists, so no load is computed. */
  loadAvailable: boolean            // true everywhere else
  gl: number | null                 // null when loadAvailable is false
}
export interface MealTotals { /* existing */ gl: number }   // sum of the scored items only
afterMeal?: {
  remaining: { gl: number; carbsG: number; kcal: number }
  fits: boolean | null
  partial?: { unknownFoods: string[]; unscored?: string[] }   // unscored = names of branded items
}
```

`FoodSummary.kind` may be `'branded'`; `ResolveCandidate` carries `brand` through the name only (no new field).

## `server/compute.ts`

- `computeMeal(items)`: for a branded record, `availableCarbs = max(0, carbs - fiber) × grams/100`, `kcal`, `protein`, `fat`, `carbs`, `fiber` as for any ingredient, `gi: null`, `gl: null`, `loadAvailable: false`. `totals.gl`, `totals.gi` and `glLevel` come from the scored items only. A meal of branded items alone has `totals.gl = 0` and `totals.glLevel = null` and the engine says so through `loadAvailable`, not through the number 0 (a 0 here is "no scored item", never "no load").
- `afterMealFor(remaining, meal, unknownFoods, unscored = [])`: `partial = unknownFoods.length + unscored.length > 0`; the rule is unchanged: partial and room left gives `fits: null`, partial and already over gives `false`, otherwise the comparison. `partial` carries both lists.
- The engine reads `unscored` from the items it was just given (names of those with `loadAvailable: false`), not from the session; `unknownFoods` still comes from the session.
- `find_alternatives` never offers a branded item as a swap (its load cannot be compared): filter `kind !== 'branded'`.

## `server/resolve.ts`

- `BRANDED_PENALTY` as specified in the data spec. `band()` is unchanged: an exact name match is still high, a category word still caps at medium.
- Candidates keep `gi: null` for branded; the existing `NO_GI_PENALTY` applies to USDA rows only and is **not** applied to branded rows, or branded rows would be out-ranked by their own noise: the penalty list is `usda:` rows only, as now.

## `server/openapi.ts`

The compute_meal response text gains: "`loadAvailable` is false for a branded product: carbohydrate, fibre and calories are given, a glycemic load is not. `afterMeal.partial.unscored` names those items."

## `server/verify.ts`

No change in logic: the sources are the tool results, and no result carries a load for a branded item, so a stated load for it has nothing to match. One new verify case proves it.

## Verifiable

- Engine eval `partial`: (a) a branded item alone → `fits: null`; (b) scored part over budget + branded → `false`; (c) scored part with room + branded → `null`; (d) a whole meal with no branded or unknown item → unchanged.
- Engine eval `branded` (new section): carbohydrate and calories for 100 g, 40 g and a serving of a known record equal the arithmetic from `per100`; `gl` is null and `loadAvailable` false; `totals.gl` ignores the branded item.
- Engine eval `verify`: an answer that says "a glycemic load of 14" for a branded item is rejected when no tool result contains 14.
- Agent eval (live), new expectation `engineUnscored: true` in `eval/run-cases.ts`: `compute_meal.result.afterMeal.partial.unscored` is non-empty and `fits !== true`. Cases: "A KIND bar" (H15), "A pack of Oreos" (H16), "A bag of Doritos and a salad" (H17: a branded item and a scored one), "A Red Bull" (H18).

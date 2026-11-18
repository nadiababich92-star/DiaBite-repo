# Spec — US household measures: the checks

*Stage 2, from `docs/engineering/engineering-doc.md` (approved 18 November 2026), section 10. A feature without its checks is not finished: everything here goes **in the same change** as the code it checks. Companion specs: `quantity-engine.md`, `quantity-labels-and-links.md`, `quantity-defaults.md`, `quantity-session-and-screen.md`, `quantity-agent.md`.*

**No migration, nothing in `.env.example`.** Checks read **tool results and structures**, never the product's prose (CLAUDE.md rule 7), except where a rendered line is the thing under test. Every engine check names the **mutation** that must make it fail; the build applies each mutation once by hand, sees the failure, and reverts it (as was done for the carbohydrate-limit and summary checks).

Run, in this order: `npm run eval`, `npm run eval:abuse`, `npm run smoke`, then (after the engine is deployed and the agents published) `npm run eval:agent` in the background, then the twelve-run samples.

## 1. Engine block `quantity` (`eval/run-engine.ts`, cases in `eval/cases.json` under `engine.quantity`)

A new block printed as `quantity  ok` / `quantity  WRONG`, with the misses listed. Each case:

```json
{ "id": "rice-cup", "foodId": "ing:white_rice", "quantity": { "count": 1, "unit": "cup" },
  "grams": 158, "basis": "usda_measure", "said_imperial": "1 cup (158 g)", "said_metric": "158 g" }
```

or, where the engine must not guess: `{ "id": "...", "foodId": "...", "quantity": {...}, "needs": true }`. The expected grams are **taken from the USDA row by hand** (the "Row" column), never computed by the function under test. Tolerance: exact to the rounding rule (one decimal).

### 1a. The conversion table (all must pass; 56 rows)

Rows read from `data/recipes-db/portion_mapping.json` as of 18 November 2026 (checked while writing this spec).

| # | Food | Quantity | Row | Expected g | Basis |
|---|---|---|---|---|---|
| 1 | `ing:white_rice` | 1 cup | cup 158 | 158 | usda_measure |
| 2 | `ing:white_rice` | 2 cup | cup 158 | 316 | usda_measure |
| 3 | `ing:white_rice` | 0.5 cup | cup 158 | 79 | usda_measure |
| 4 | `ing:white_rice` | 1.5 cup | cup 158 | 237 | usda_measure |
| 5 | `ing:brown_rice` | 1 cup | cup 195 | 195 | usda_measure |
| 6 | `ing:black_beans` | 1 cup | cup 172 | 172 | usda_measure |
| 7 | `ing:black_beans` | 0.5 cup | cup 172 | 86 | usda_measure |
| 8 | `ing:lentils` | 1 cup | cup 198 | 198 | usda_measure |
| 9 | `ing:lentils` | 1 tbsp | tbsp 12.3 | 12.3 | usda_measure |
| 10 | `ing:lentils` | 3 tsp | tbsp 12.3, ratio 1/3 each | 12.3 | usda_measure (derived) |
| 11 | `ing:milk` | 1 cup | cup 246 | 246 | usda_measure |
| 12 | `ing:milk` | 8 fl oz | cup 246, 8 fl oz = 1 cup | 246 | usda_measure (derived) |
| 13 | `ing:milk` | 1 tbsp | cup 246 ÷ 16 | 15.4 | usda_measure (derived) |
| 14 | `ing:milk` | 1 tsp | cup 246 ÷ 48 | 5.1 | usda_measure (derived) |
| 15 | `ing:butter` | 1 tbsp | tbsp 14.2 | 14.2 | usda_measure |
| 16 | `ing:butter` | 2 tbsp | tbsp 14.2 | 28.4 | usda_measure |
| 17 | `ing:butter` | 1 cup | cup 227 | 227 | usda_measure |
| 18 | `ing:butter` | 1 tsp | tbsp 14.2 ÷ 3 | 4.7 | usda_measure (derived) |
| 19 | `ing:almond_butter` | 2 tbsp | tbsp 16 | 32 | usda_measure |
| 20 | `ing:almond_butter` | 1 tsp | tbsp 16 ÷ 3 | 5.3 | usda_measure (derived) |
| 21 | `ing:carrot` | 1 cup | cup 236 | 236 | usda_measure |
| 22 | `ing:carrot` | 1 tbsp | cup 236 ÷ 16 | 14.8 | usda_measure (derived) |
| 23 | `ing:white_bread` | 1 slice | slice 29 | 29 | usda_measure |
| 24 | `ing:white_bread` | 2 slice | slice 29 | 58 | usda_measure |
| 25 | `ing:egg` | 1 large | large 50 | 50 | usda_measure |
| 26 | `ing:egg` | 2 large | large 50 | 100 | usda_measure |
| 27 | `ing:egg_white` | 1 large | large 33 | 33 | usda_measure |
| 28 | `ing:egg_white` | 1 cup | cup 243 | 243 | usda_measure |
| 29 | `ing:green_onion` | 1 large | large 25 | 25 | usda_measure |
| 30 | `seed:orangejuice` | 1 cup | cup 248 | 248 | usda_measure |
| 31 | `seed:orangejuice` | 8 fl oz | fl oz 31 | 248 | usda_measure |
| 32 | `seed:orangejuice` | 1 fl oz | fl oz 31 | 31 | usda_measure |
| 33 | `seed:sweetpotato` | 1 cup | cup 200 | 200 | usda_measure |
| 34 | `seed:sweetpotato` | 1 large | large 180 | 180 | usda_measure |
| 35 | `seed:sweetpotato` | 1 small | small 60 | 60 | usda_measure |
| 36 | `seed:grapes` | 1 cup | cup 151 | 151 | usda_measure |
| 37 | `seed:cucumber` | 1 cup | cup 120 | 120 | usda_measure |
| 38 | `seed:strawberry` | 1 cup | cup 150 | 150 | usda_measure |
| 39 | `seed:blueberry` | 0.6667 cup *(the person says "two thirds")* | cup 150 | 100 | usda_measure |
| 40 | `ing:chicken_breast` | 4 oz | exact 4 × 28.3495 | 113.4 | exact_conversion |
| 41 | `ing:chicken_breast` | 3 oz | exact | 85.0 | exact_conversion |
| 42 | `ing:chicken_breast` | 1 oz | exact | 28.3 | exact_conversion |
| 43 | `ing:chicken_breast` | 8 oz | exact | 226.8 | exact_conversion |
| 44 | `seed:salmon` | 6 oz | exact | 170.1 | exact_conversion |
| 45 | `ing:chicken_breast` | 1 lb | exact 453.592 | 453.6 | exact_conversion |
| 46 | `ing:chicken_breast` | 0.5 lb | exact | 226.8 | exact_conversion |
| 47 | `ing:white_rice` | 300 g | the person's | 300 | stated |
| 48 | `ing:white_rice` | 1 default | defaultPortion 158 | 158 | default |
| 49 | `ing:egg` | 2 default | defaultPortion 50 × 2 | 100 | default |
| 50 | `seed:egg` | 2 default | defaultPortion × 2 *(55 today; the value in `quantity-defaults.md` once approved)* | 2 × the default | default |
| 51 | `ing:white_bread` | 1 default | defaultPortion 29 | 29 | default |
| 52 | a recipe record (`rec:…`) | 2 default | servings 2 | `servings: 2` | default |
| 53 | `ing:egg` | 1 cup | no volume row | `needs` | — |
| 54 | `ing:chicken_breast` | 1 cup | no volume row | `needs` | — |
| 55 | `ing:chicken_breast` | 1 slice | no slice row | `needs` | — |
| 56 | a branded record | 1 cup | a branded item has only a serving | `needs` | — |

**Rows that must also hold, one assertion each:** `seed:sweetpotato` 1 medium is `needs` (it has small and large rows only; `small`/`large` never stand for a medium); `ing:egg` 1 medium is `needs` (a large row is not a medium); `ing:egg` 1 whole is `needs`; a recipe asked for `1 cup` is `needs` with `why: "a recipe is counted by serving"`.

### 1b. The rows that prove the new links (run only after `quantity-labels-and-links.md`'s links are applied; they are the point of the feature)

| # | Food | Quantity | Row | Expected g | Basis |
|---|---|---|---|---|---|
| L1 | apple (`seed:apple`) | 1 medium | FNDDS `Apple, raw` medium 200 | 200 | usda_measure |
| L2 | apple | 1 whole | the same table has a medium row | 200 | usda_measure |
| L3 | banana (`seed:banana`) | 1 medium | FNDDS "1 banana" 126 (a whole-class row, no medium row) | 126 | **typical** |
| L4 | peach (`seed:peach`) | 1 medium | FNDDS "1 fruit" 150 | 150 | typical |
| L5 | bell pepper (`seed:bellpepper`) | 1 medium | FNDDS "1 regular" 120 | 120 | typical |
| L6 | tomato (`seed:tomato`) | 1 medium | FNDDS "1 whole" 125 | 125 | typical |
| L7 | avocado (`ing:avocado`) | 0.5 whole | FNDDS "1 fruit" 150 × 0.5 | 75 | typical |
| L8 | rye bread (`seed:bread-rye`) | 1 slice | FNDDS "medium or regular slice" 32 | 32 | usda_measure |
| L9 | peanut butter (`ing:peanut_butter`) | 2 tbsp | FNDDS "tablespoon" 16 | 32 | usda_measure |
| L10 | apple | 1 large | FNDDS has no large row (small, medium, extra large) | `needs` | — |

### 1c. Validation and shape

- **Exactly one of** `grams`, `servings`, `quantity`: none, `grams`+`quantity`, `servings`+`quantity`, `grams`+`servings` each return the `error` text of `quantity-engine.md` (200, no `items`).
- **Count:** `0`, `-1`, `101`, `NaN`, `Infinity`, `"2"` (a string) each return the count `error`; `100` and `0.25` are accepted.
- **Unit:** `"handful"`, `"bowl"`, `"cups"`, `""`, `null` return the unit `error` that lists the allowed units.
- **`needsWeight` is all or nothing:** a meal of two items where one needs a weight returns `needsWeight` for that item only and **no `items`, no `totals`, no `dayState`**.
- **`said`:** imperial gives the texts in the table; metric gives `"<grams> g"`; **absent `units` gives the metric text**.
- **`basis`** is present on every item that came from a `quantity`, absent on items given as `grams` or `servings`.

### 1d. Mutations (each must make a named check fail)

| Mutation | Checks that must fail |
|---|---|
| return the model's grams unchanged (ignore `quantity`) | 1a all |
| compute `oz` with 28 or 30 | 40 to 46 |
| derive a tablespoon by a density of another food (use water: 15 g) | 13, 14, 18, 20, 22 |
| allow `medium` to stand for a `large` row | the `ing:egg` 1 medium and `seed:sweetpotato` 1 medium assertions (both must be `needs`) |
| skip the `typical` fallback (treat "regular"/"whole" as unusable) | L3 to L7 |
| use a qualified row ("cup, chopped") for a plain cup | the label checks (section 2), Q5 |
| drop the all-or-nothing rule (cost the items that convert) | 1c `needsWeight` |
| drop the exactly-one rule | 1c |
| ignore the session's units in `said` | `said` checks |

## 2. Labels block `labels` (`quantity-labels-and-links.md`)

- **Q5. Each label form** in the spec's table reads to the stated `PortionRow` (unit, size, qualifier, word) or to `null`: at least one example per row of the table, including `"1 medium or regular slice"` (slice, size medium), `"1 cup, chopped"` (cup, qualifier `chopped`, not used by `gramsFor`), `"1 fl oz (with ice)"` (null for use), `"cup (1 NLEA serving)"` (qualifier `NLEA`), `"1 banana"` for the record `Banana, raw` (whole, word `banana`), `"2 slices"` (dropped: a count other than 1), `"oz"` at 113 g (dropped by `plausibleUnit`).
- **Q6. Units** follow the session: see 1c.
- **Q7. Regression:** for every record in the catalogue and every weight from 5 g to 1,500 g in steps of 5, `householdMeasure` and `stepUnit` return the **same** value as before for every row the old `MEASURE_LABEL` accepted. The block prints the number of records whose result **changed** (new measures only) and fails if any previously-present measure changed or vanished. A sample of 30 of the changed records is printed for the build to read before merging.
- **Q8. Links:** `apply-portion-links.py --dry-run` on the committed CSV reports zero `would_change` entries for the entries accepted by hand (egg, bread, oats, cucumber, strawberries, blueberries), and applies no row with `decision = no` or with both `auto` and `decision` blank; the deny list keeps `sweet potato` away from `potato` and `orange juice` away from `orange` (a unit check on the `auto` rule).

## 3. Defaults and the session (`quantity-defaults.md`, `quantity-session-and-screen.md`)

- **Q9. Defaults:** for each food the owner approves in `quantity-defaults.md`, `computeItem({ foodId })` returns the approved grams exactly, and `gramsFor(record, { count: 1, unit: <the household unit> })` returns the same grams within 3%. Every record **not** in the approved list has an unchanged `defaultPortion` (a before/after comparison over the whole catalogue).
- **Q10. Units on the wire:** `PUT /session/:id` with `units: "imperial"` and `"metric"` is accepted; `units: "feet"`, `units: 1`, `units: null` is a 400 with `{ error: 'invalid units' }`; `/agent/ask` with a bad `units` is a 400 with `{ field: 'units' }`; no `units` is accepted and behaves as metric.
- **Q11. Render:** the receipt-line markup for the six cases in `quantity-session-and-screen.md` prints `said` where it should, the pill **typical size** only for `typical`, and no ounces on metric.

## 4. The verifier

The existing negative case stays: an answer containing one altered number is rejected. Add: **an answer that copies a `said` string passes; an answer with a gram figure that is in no tool result fails** (so a model that goes back to estimating a weight is caught by the verifier as well as by the agent cases).

## 5. Agent cases `US1` to `US12` (`eval/cases.json`, `agent`)

All send `context.units: "imperial"` except `US11`; `eval/run-cases.ts` passes `units` from the case's `context` into the request body (the same way it passes `carbLimit` and `avoid`). New mechanical expectation, read from the `compute_meal` call in the trace (never from the prose):

```json
"quantityGrams": [ { "foodId": "ing:white_rice", "min": 155, "max": 161 } ]
```

meaning: some item in the last `compute_meal` result has that `foodId` and `grams` in `[min, max]` (the tolerance is the owner-approved 3% of the USDA row), **and** that item's `input` was a `quantity`, not `grams`. A second new expectation, `needsWeightAsked: true`, means: no `compute_meal` result with `totals` **and** the answer ends in a question (`answerHasQuestion`, which exists).

| Id | Query | Expectation |
|---|---|---|
| US1 | "A cup of cooked white rice" | `quantityGrams` white rice 155 to 161 |
| US2 | "A medium apple" | `quantityGrams` apple 194 to 206 (the mapped medium, 200 g ± 3%) |
| US3 | "Half an avocado" | avocado 73 to 77 (75 g ± 3%) |
| US4 | "4 oz of grilled chicken breast" | chicken breast 110 to 117; `noCostDish` (it must not become a recipe at 0 g) |
| US5 | "2 tablespoons of peanut butter on 1 slice of bread" | peanut butter 31 to 33; a bread slice 28 to 30 (white) or 31 to 33 (rye) |
| US6 | "3 oz steak and a baked potato" | beef 82 to 88 |
| US7 | "An 8 oz glass of orange juice" | orange juice 240 to 256 |
| US8 | "Two large eggs" | egg 97 to 103 |
| US9 | "A handful of almonds" | `needsWeightAsked: true`, `noToolCalls` is **not** asserted (resolve is called), no `compute_meal` with totals |
| US10 | "A bowl of oatmeal" | `needsWeightAsked: true` |
| US11 | "A cup of cooked white rice" with `context.units: "metric"` | the answer's weight is in grams: `compute_meal` item `said` equals `"158 g"` |
| US12 | "300 g of whole wheat pasta" | the item's input is `quantity: { count: 300, unit: "g" }` and the grams are exactly 300 |

**Existing cases** rerun in full (`npm run eval:agent`), with CL1, CL2, H1, H2, RS1 and RS2 read for any change. The mechanical check `statedGramsKept` is for `cost_dish` and is unchanged.

## 6. Sampling (CLAUDE.md rule 12)

Before and after the prompt change, **twelve runs each with a fresh `uuid` session id** of `US1` to `US12`, `CL1`, `CL2`, `H1`, `H2`, `RS1`, `RS2`, using the sampler pattern of the 18 November comparison (a temporary filtered `cases.json`, the eval files restored afterwards). Report per case: passes out of twelve, and for every failure which tool path it took (compute through `quantity`, `grams`, `cost_dish`, a question). **A case that passes fewer than ten of twelve on the new prompt blocks the deploy of the prompt**; CL1 and CL2 are compared with the 18 November baselines (CL1 6 of 60 failing, CL2 2 of 36) and must not be worse.

## Done means

`npm run eval` and `npm run eval:abuse` pass with the new blocks; every mutation in 1d was applied once and failed its check; `npm run smoke` passes; after deploy the nine phrases of `quantity-agent.md` come back with the engine's weights on the live agent; the samples are reported with their failures named; anything not done is said plainly.

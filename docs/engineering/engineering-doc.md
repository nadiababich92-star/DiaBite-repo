# Engineering document — US household measures, end to end: the engine turns "a cup" into grams, not the model

*Produced by `/engineering-planner` on 18 November 2026. The previous document (the clinician summary) is archived as `docs/engineering/clinician-summary.md`. It continues `docs/engineering/engineering-doc-us-units.md` (17 November), which did the **output** side: show a household measure where USDA lists one. This one does the **input** side, where the real error is. **Not yet approved.***

## 1. Summary

**The problem, found on the live agent on 18 November** (nine ordinary American phrases, asked through the same endpoint the app uses):

| Typed | Counted as | USDA says |
|---|---|---|
| a cup of cooked white rice | 180 g | 1 cup = 158 g |
| a medium apple | **100 g** | medium = 182 to 200 g |
| half an avocado | 50 g | half a fruit is about 70 to 100 g |
| 4 oz of grilled chicken breast | not found; costed as a recipe called "Lemon Herb Grilled Chicken" at **0 g** | 4 oz = 113 g |
| 3 oz steak and a baked potato | 85 g and 130 g | 85 g is right |

The model reads "a cup", "a medium", "half" and **writes the grams itself**. `resolve_foods` throws the quantity away on purpose (`withoutQuantity`, `server/resolve.ts`), and the prompt tells the model to multiply `defaultPortion` by the count and to put an estimate in `grams`. A medium apple counted at 100 g carries about half its real carbohydrate and glycemic load, and the answer states a verdict on it. That is a number the model produced, against the one promise in `CLAUDE.md`. Showing "1 cup (158 g)" afterwards, which is live, only prints a more elegant figure for the same guess.

**What changes.** The agent passes **what the person said** (a count and a unit) with each food. The **engine** finds that food's USDA household measure and returns the grams and the words to say them. Where USDA has no honest measure, nothing is guessed: ounces convert exactly (28.35 g), and anything else makes the agent ask ("About how many ounces or cups?"). More foods get measures (USDA's FNDDS "foods as eaten" tables), a few dozen default portions become household units, and the "Weights I used" line copies the engine's ready text.

**Who it is for.** PRD: "adults with type 2 diabetes, prediabetes and insulin resistance **in the US**" (`CLAUDE.md`), whose own education is in cups, slices and ounces. Two dietitians and a community helper asked for it on 14 and 15 November (`docs/engineering/engineering-doc-us-units.md`, section 1); the owner's decision on 18 November: "Americans do not understand grams, make it accessible."

**Decisions taken by the owner on 18 November 2026**
1. The agent **asks** when there is no honest measure ("a handful of almonds", "a bowl of oatmeal"): "About how many ounces or cups?". It never guesses.
2. New links from our foods to USDA records: **a rule accepts the close ones; the owner reads the doubtful ones** in `data/recipes-db/usda-links.csv`. Nothing is applied without that.
3. The engine **knows the person's units** (feet and pounds, or metric), passed with the session the way the budget and the carbohydrate limit are; the "Weights I used" line follows it.
4. "A medium apple" against a table that lists only "regular", "whole" or "fruit": **count it as the typical one and say so** ("USDA's typical size").
5. **About 30 of the most-eaten foods get default portions in household units** (apple 1 medium, egg 1 large, banana 1 medium, one slice of bread...). The list is shown before any change (section 8).

**Success.** (1) The nine phrases above come out within 3% of the USDA household weight, checked by a test that reads the tool result, not the prose. (2) A phrase with no honest measure produces a question and no `compute_meal` call. (3) The model writes no gram figure that a tool did not return: every weight in an answer is the engine's `said` text. (4) A person on US units sees measures in the answer, the receipt and the diary; a person on metric sees what they see today.

## 2. Scope

**In**
- `compute_meal` items accept `quantity` (count and unit) in place of `grams` or `servings`; the engine converts (`server/quantity.ts`, new).
- A wider reading of USDA's household labels (`server/foods.ts`: `MEASURE_LABEL`, `householdMeasure`, `stepUnit`), so the FNDDS tables the catalogue already holds are usable.
- New links in `data/recipes-db/portion_mapping.json`, produced from the owner's decisions in `data/recipes-db/usda-links.csv` by `scripts/apply-portion-links.py` (new).
- About 30 default portions in household units.
- The person's units parked with the session; `said` text per item.
- Prompt (`agent/prompts/meal.md`) and tool spec (`server/openapi.ts`) changes; engine and agent cases.

**Out**
- Recipes, the menu and the shopping list in cups (a density for 364 ingredients is a data job of its own; unchanged from the earlier plan).
- **`cost_dish`**: the assumed-recipe weights are still the model's estimates, labelled as an estimate. It is the next place with the same flaw; see "Later".
- Pints, quarts, gallons; a density table; barcode and photo logging.
- Changing what a person sees on metric.

**Later**
- `cost_dish` ingredient weights by the same engine conversion.
- Cups and spoons in recipes and the list.
- Hand-size portions ("a palm of chicken"), which dietitians use and which have no table.

## 3. User flows

```
Types "a medium apple and 4 oz of chicken breast, a cup of rice"
  → Ask → POST /agent/ask (message, budget, carbLimit, avoid, units)
  → Engine: safety gate, parks the day under the session id (now with units)
  → Agent (meal): resolve_foods(["apple","chicken breast","white rice"], sessionId)
  → Agent: compute_meal(items = [
        { foodId: "ing:apple",          quantity: { count: 1, unit: "medium" } },
        { foodId: "seed:chicken",       quantity: { count: 4, unit: "oz" } },
        { foodId: "seed:rice-white",    quantity: { count: 1, unit: "cup" } } ])
  → Engine: quantity.ts turns each into grams from the food's own USDA table
        apple 1 medium → 182 g    chicken 4 oz → 113 g (exact)    rice 1 cup → 158 g
      returns, per item: grams, said ("1 medium (182 g)"), basis, quantity; totals; dayState; afterMeal
  → Agent writes the answer; "Weights I used" copies each `said`
  → Verifier: every number matches a tool result (the weights are in the result)

Types "a handful of almonds"
  → compute_meal returns { needsWeight: [ { foodId, quantity } ] } (200, no numbers)
  → Agent asks: "About how many ounces or cups?" and stops; the next turn carries the answer
```

## 4. The promise check

| Number | Computed where | How the verifier covers it |
|---|---|---|
| grams of an item the person gave in a household measure | the engine: the food's own USDA row, or an exact unit conversion (`server/quantity.ts`) | it is in the `compute_meal` result (`items[].grams`) |
| ounces to grams (28.35), pounds to grams (453.6) | the engine, exact constants | same |
| cup, tablespoon, teaspoon, fluid ounce across each other for one food | the engine, exact US volume ratios (1 cup = 16 tbsp = 48 tsp = 8 fl oz) applied to **that food's own** row | same |
| a count the person typed ("2", "half" = 0.5) | the person; the model only copies it into `quantity.count` | the verifier already lets a number that is in the person's message stand; see check E8 |
| the words "1 medium (182 g)" | the engine (`said`) | the model copies; the grams inside are in the result |
| nutrition and glycemic load | unchanged: the engine from grams | unchanged |

**What the model no longer does:** multiply a default portion by a count, or estimate grams from "a cup" or "a medium". The prompt rule "A count is a portion... multiply the `defaultPortion` by the count" is removed and replaced by `unit: "default"` (section 6), which the **engine** multiplies.

**What the model still does, and why it is not a nutrition number:** read the person's words into a count and a unit. "Half an avocado" becomes `{ count: 0.5, unit: "whole" }`. A wrong reading is visible to the person because the answer says the measure it used.

**Two places where a number could still come from outside the tool:** (1) a person who types grams: that is theirs, passed through as `quantity: { count: 300, unit: "g" }`. (2) The units of a recipe ingredient in `cost_dish`, unchanged and labelled an estimate (out of scope).

## 5. Frontend

**Files:** `src/lib/agent.ts` (read `said`, `basis`, `quantity` from the trace; send `units` with the request), `src/components/AskPage.tsx` (receipt line shows `said` when present; the portion editor keeps its grams steps), `src/components/DiaryPage.tsx` and `src/lib/diary.ts` (the diary snapshot already stores the measure text; it stores `said` the same way when present), `src/types.ts` (optional fields).

**States**
- *measure known*: receipt, answer and diary say "1 medium (182 g)" for imperial, "182 g" for metric.
- *typical size used* (`basis: 'typical'`): the receipt line adds the small pill "typical size" (the same pill style as "assumed"); the answer says "USDA's typical size".
- *needs a weight*: no receipt; the screen shows the agent's question; the input box takes the answer.
- *unknown / partial*: unchanged.
- *phone layout*: no new element wider than today's receipt line; the pill wraps.
- *accessibility*: the pill carries text, not colour alone; the question is plain text in the existing answer region.

**No new colour or token.** Nothing in `docs/design.md` changes except one sentence under "Portions": the editor and the receipt say a typed measure the way the person said it.

## 6. Engine and API

**`POST /tools/compute_meal`** (auth: `x-api-key`, as today; model-facing: always 200, errors in an `error` or `needsWeight` field).

Item shape, exactly one of `grams`, `servings`, `quantity`:

```ts
interface MealItemInput {
  foodId: string
  grams?: number
  servings?: number
  quantity?: { count: number; unit: QuantityUnit }
}
type QuantityUnit =
  | 'g' | 'oz' | 'lb'                       // a weight: exact for any food
  | 'cup' | 'tbsp' | 'tsp' | 'fl oz'        // a volume: from this food's own row, or exact ratios from another row of the same food
  | 'slice' | 'piece'                       // a count of a part
  | 'small' | 'medium' | 'large' | 'whole'  // one item; 'whole' is "one of it"
  | 'default'                               // the food's own default portion, multiplied by count (replaces the model's multiplication)
```

Per item in the reply (new fields, all optional so nothing old breaks): `quantity` (echoed), `said` (`"1 medium (182 g)"`, `"4 oz (113 g)"`, or `"182 g"` on metric), `basis`: `'usda_measure' | 'exact_conversion' | 'typical' | 'default'`.

**Conversion rules** (`server/quantity.ts`, one pure function `gramsFor(record, quantity)`):
1. `g` is the count. `oz` is `count × 28.3495`. `lb` is `count × 453.592`. Any food; `basis: 'exact_conversion'`.
2. `default`: `record.defaultPortion × count`; `basis: 'default'`.
3. `cup`, `tbsp`, `tsp`, `fl oz`: the record's row for that unit when there is one; otherwise, **from another volume row of the same record** by the exact US ratios (so "2 tbsp of peanut butter" works from a record that lists only a cup). `basis: 'usda_measure'`. No row of any volume unit: `needsWeight`.
4. `slice`, `piece`, `small`, `medium`, `large`: the row with that word. `medium` with no such row but one "regular", "whole", "fruit" or "each": that row, `basis: 'typical'` (owner decision 4). `small` or `large` with no such row: `needsWeight` (a typical size is not a small one).
5. `whole`: the row labelled "regular", "whole", "fruit", "each", or "medium"; `basis: 'typical'` unless the row says medium. Half of one is `count: 0.5`.
6. Anything else, or a unit the record has no row for: **`needsWeight`**, never a guess, and never a density from another food.

**`needsWeight`** reply: `{ needsWeight: [{ foodId, name, quantity, units: ["cup", "oz"...] }], hint: "ask the person for ounces or cups; do not estimate" }` with no `totals`, so the model has nothing to quote. If some items convert and one does not, the reply costs nothing and says which one needs a weight (a partial meal answered with a guess is the thing this feature removes).

**Household labels** (`server/foods.ts`): `MEASURE_LABEL` accepts FNDDS's descriptive labels by reading the leading unit word, keeping the original label for display: `"1 medium or regular slice"` is a `slice` of medium size; `"1 regular"`, `"1 whole"`, `"1 fruit"` are `whole`; `"1 cup, chopped"` is a `cup` and is **not** used for a plain cup (a chopped cup and a whole cup weigh differently): a qualifier makes it a separate, unused row unless the person said the same qualifier. Labels with a count other than 1 (`"4 oz"`, `"2 slices"`) are read as their per-unit weight only when the label states the count (the existing `plausibleUnit` guard stays: USDA's "oz" rows that are really multiples are rejected).

**Session (`PUT /session/:id`, `server/guard.ts`, `server/sessions.ts`, `server/agent.ts`, `src/lib/agent.ts`)**: new optional `units: 'imperial' | 'metric'`, validated like `carbLimit` (one of two strings), kept in the in-memory session with the same one-hour life, never written to disk, never logged beyond what a session id already is. Absent means metric text for `said`.

**`POST /tools/resolve_foods`**: unchanged. (`withoutQuantity` stays: identity is the resolver's, quantity the new field's.)

**Errors:** `grams`, `servings`, `quantity` together, or none: `error: "give exactly one of grams, servings, quantity"`; `quantity.count` not positive or above 100 (a typo guard): `error`; unknown unit: `error` listing the units. All 200.

## 7. Agents

**`agent/prompts/meal.md`** (meal agent only; triage and advisor unchanged)
- Step 1 (extract): replace "A count is a portion... Multiply the `defaultPortion` by the count" with: for each food pass `quantity` with the count and unit **the person used** (`default` for "two eggs", "a banana"; the unit word for "a cup", "4 oz", "a slice", "a medium"; `g` only when they typed grams). Never turn a measure into grams yourself and never estimate a weight.
- New rule, *and also* the existing assumption rule stays: when `compute_meal` answers `needsWeight`, **ask one question, "About how many ounces or cups?"**, name the food, add no number, call no other tool, and stop. When the session units are metric the question says grams.
- "Weights I used": copy each item's `said`; for `basis: typical` add "(USDA's typical size)"; leave out an item the person gave in grams.
- Remove the paragraph that tells the model how to estimate a default weight.

**`server/openapi.ts`**: the `compute_meal` item schema and its description (the one place the model reads the tool).

**Router:** unchanged. A question like "how many grams is a cup of rice?" still goes to the advisor, which has no tools and gives no number (unchanged).

**Publishing:** `npx tsx agent/provision.ts` with `MODEL_MEAL` and `MODEL_DEPLOYMENT_NAME` unset (rule 11); read each agent's model from the project afterwards.

## 8. Data

**No new table, no migration, nothing stored about a person.** `units` lives in the session's memory only, as the budget does.

**Foods catalogue (Supabase table and the files in the image):** the household measures of a record are part of what `sync-foods` writes, so a change to `data/recipes-db/portion_mapping.json` or a default portion reaches production only after `npx tsx scripts/sync-foods.ts` and a restart of the active revision (rule 10).

**`data/recipes-db/portion_mapping.json`**: new entries, each with `fdc_id`, the USDA name, the measures as USDA lists them, and `accepted_by` ("rule" or "owner, <date>"). `scripts/map-portions.py` is **retired as a writer**: it rewrote this file from the draft and would have dropped the entries accepted by hand; `scripts/apply-portion-links.py` (new) only adds or changes entries the owner's `decision` column accepts, and never deletes one.

**`data/recipes-db/usda-links.csv`** gains one column, `decision` (blank, `yes`, `no`). The rule marks the close ones `yes` itself (distance 0.25 or less and 60% of the words, reproduced in the script); the rest the owner reads and marks. A `candidate` with a blank decision is never applied. (Example in the current table: a sweet potato is offered for a potato at distance 0.11; it is exactly why they are read.)

**Default portions in household units.** The values below are the **current** defaults and the household measure proposed; the grams come from the mapped USDA record when it is written, so nothing is typed from memory here. The owner approves this list before any default changes.

| Food | Default today | Proposed | Food | Default today | Proposed |
|---|---|---|---|---|---|
| apple | 180 g | 1 medium | egg | 55 g | 1 large |
| banana | 120 g | 1 medium | orange | 160 g | 1 medium |
| peach | 150 g | 1 medium | onion | 80 g | 1 medium |
| bell pepper | 120 g | 1 medium | tomato | 120 g | 1 medium |
| avocado | 70 to 100 g | 1/2 whole | carrot, raw | 80 g | 1 medium |
| bread, rye / whole wheat / sprouted | 35 g | 1 slice | white bread | 30 g | 1 slice |
| chicken breast | 150 g | 4 oz cooked | turkey breast | 150 g | 4 oz cooked |
| salmon, shrimp, beef | 85 to 113 g | 3 oz cooked | cheese, hard | 30 g | 1 oz |
| peanut butter | 32 g | 2 tbsp | milk | 246 g | 1 cup |
| cooked rice | 158 g | 1/2 cup | cooked pasta | 100 to 180 g | 1 cup |
| oatmeal, cooked | 200 to 234 g | 1 cup | Greek yogurt | 150 g | 3/4 cup |
| strawberries | 150 g | 1 cup | blueberries | 100 g | 2/3 cup |
| potato, baked | 100 g | 1 medium | sweet potato | 130 g | 1 medium |

Rows where today's number and the household one are within 3% change nothing a person can see. Where they differ, **the default number a person gets for "an apple" changes** (it moves toward USDA's), and so do the figures that follow from it: the engine eval cases that cost a default (for example "two eggs") are re-derived, not left to fail.

## 9. Safety and responsible AI

- **What could mislead a patient:** a wrong weight, because carbohydrate and glycemic load follow it directly. The change lowers that risk (the weights come from USDA, not from a language model) and adds three disclosures: the measure is said back in the answer; "typical size" is named; and an unknown measure becomes a question, never a figure.
- **"A cup of rice" is cooked or dry?** The catalogue's rice is the cooked record, and the item's name says so ("White rice, cooked"); the answer's Why line already names the record used. A dry-rice cup is a different record and a different USDA row. **Nothing is converted between a cooked and a dry record.**
- **The rules gate and dosing refusals:** unchanged; they run before the model. A sentence such as "how many units of insulin for 2 cups of pasta" is still refused by the rule, with no tool and no measure.
- **A clinician should look at** (worklist №39, №60): whether "typical size" for a medium item is acceptable for carbohydrate counting, and whether defaults that move toward USDA household portions are acceptable (a person on a carbohydrate target sees a different number for the same words).
- **Data protection:** no new data is stored; `units` is a display preference held in memory for the session. It is not health data.
- **Security surface:** one more optional field on `PUT /session/:id` with the same validation and rate limits as the rest; `quantity` is validated (positive finite number up to 100, a closed set of units). No new route.

## 10. Evaluation plan

All in the same change; engine checks read tool results (rule 7), agent checks read `compute_meal`'s items, never the prose.

**Engine (`npm run eval`, new block `quantity`, cases in `eval/cases.json` under `engine.quantity`)**
1. **A conversion table**, each row `foodId, quantity, expected grams, basis`, with the expectation taken from the USDA row by hand, not computed by the code under test: 1 cup white rice 158 g; 4 oz chicken 113.4 g; 2 tbsp peanut butter 32 g from a table with a cup row only (exact ratio); 1 medium apple (the mapped record's medium); 1 whole avocado; half a whole avocado; 1 slice white bread 29 g; 8 fl oz orange juice 240-ish from its row; 3 oz steak 85 g; 1 lb 453.6 g; 300 g stays 300 g. At least 40 rows across the units.
2. **Typical size:** `medium` against a table with only "regular" returns that row with `basis: 'typical'` and the said text names it.
3. **`needsWeight`:** `handful`, `bowl` (units the schema does not have, so the model cannot pass them), a `cup` of a food with no volume row, a `large` where only a `regular` exists: all return `needsWeight` with no `totals`.
4. **`default`:** `count: 2` of an egg is exactly twice its default; a count of 0 or 101 or `-1` is an `error`.
5. **Exactly one of** `grams`, `servings`, `quantity`; each pair and none is an `error`.
6. **`said` follows the session's units:** imperial gives "1 medium (182 g)", metric "182 g", absent units give metric.
7. **Labels:** every FNDDS label form named in section 6 reads to the intended unit; `"1 cup, chopped"` is not used for a plain cup; a USDA "oz" row that is really four ounces is still refused.
8. **The verifier:** an answer that copies `said` passes; an answer with a gram figure not in any result still fails (the existing negative case).
9. **Defaults:** each food in the section 8 table, costed with no quantity, returns the weight of its household row within 3%; the old eval cases that cost a default are updated in the same commit.
Each check has a mutation that must make it fail: return the model's grams unchanged; skip the `typical` fallback; guess a density; drop the exactly-one rule; ignore units.

**Agent (`npm run eval:agent`, cases `US1` to `US12` in `eval/cases.json`)** with `toolsCalled`, and a new mechanical expectation `quantityGrams: { foodId, min, max }` read from `compute_meal`:
- US1 "A cup of cooked white rice" (155 to 161 g); US2 "A medium apple" (within the mapped record's medium ±3%); US3 "Half an avocado"; US4 "4 oz of grilled chicken breast" (112 to 115 g, and **not** a recipe at 0 g); US5 "2 tablespoons of peanut butter on 1 slice of bread"; US6 "3 oz steak and a baked potato"; US7 "8 oz glass of orange juice"; US8 "Two large eggs" (2 × the egg row); US9 "A handful of almonds" and US10 "A bowl of oatmeal": **no `compute_meal` call and a question**; US11 the same sentence in a session with metric units (the answer's weights are grams); US12 a person who typed "300 g of pasta" (passed as grams).
- Sampled twelve times each with fresh session ids before and after the prompt change (rule 12); the existing cases are rerun in full and the carbohydrate-limit cases CL1 and CL2 are read as before.

**Smoke:** unchanged except that the existing ask still returns a verdict in under 15 seconds.

## 11. Rollout

1. Build and test locally in this order: `server/quantity.ts` and its engine cases; the label reading; the schema and `units` in the session; the frontend `said`; the data (links and defaults); the prompt last. Each commit passes `npm run eval` and `eval:abuse`.
2. **The engine is backward compatible** (`quantity` and `said` are optional), so it deploys before the prompt: `npm run deploy`, then `sync-foods` and a restart of the active revision, then ask the live service what it returns (rule 1): a `compute_meal` with `quantity: { count: 1, unit: "medium" }` for the apple, and the same with `cup` for the rice.
3. Publish the agents; read each model from the project (rule 11).
4. `npm run eval:agent` (in the background, it takes over ten minutes), then the twelve-run samples of US1 to US12 and CL1, CL2.
5. **Push and deploy only on the owner's "выкладывай".**
6. **Rollback:** the previous revision and the previous agent version (the meal agent's version number is recorded before publishing). The data change is a revert of `portion_mapping.json` and the default-portion commit, then `sync-foods` and a restart. Nothing a person stored depends on any of it.

**Size:** about 5 to 6 working days: the conversion and its tests 1.5, label reading and the FNDDS links 1.5 (plus the owner's reading of the doubtful matches), defaults 0.5, prompt, schema, `units` and frontend 1, agent cases and sampling 1.5.

## 12. Open questions

**For the owner**
1. **Volumes across rows of the same food** (rule 3: tablespoons from a cup row by the exact US ratio). It is one food's own row, not a density from another food, so it stays inside the earlier decision "never converted by density"; say so if you read it differently, and a spoon of a food that lists only a cup becomes a question instead.
2. **The default-portion list** (section 8): approve it, strike rows, or add foods, before any default moves.
3. **Your reading of the doubtful matches** in `usda-links.csv` (the `decision` column). A first batch of the 232 candidates will be about 60 rows that the rule does not accept; the rest of the table is not blocked on them.
4. **The question's wording**: "About how many ounces or cups?" (grams when the person is on metric).

**For a clinician** (№39, №60)
5. Whether a "typical size" substitution for "medium" is acceptable for a carbohydrate-counting product, and whether moved defaults need a note to the person.

**For counsel:** none; nothing new is stored.

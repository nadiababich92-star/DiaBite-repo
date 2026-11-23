# Spec — Swaps worth making: the checks that prove it

*Stage 2, from `docs/engineering/engineering-doc.md` (approved 23 November 2026). Companion specs: `swaps-engine.md`, `swaps-screen.md`, `swaps-agent.md`. A feature is not finished until `npm run eval`, `npm run eval:abuse`, the smoke check and `npm run eval:agent` have run and every case below is added in the same change (CLAUDE.md, stage 5). **Mechanical checks read `alternatives`, `afterMeal`, `change`, `gain`, `fitsMeal`, `label`, never the wording of an answer** (rule 7).*

**Ids:** `SW1` to `SW15` for the engine block, `SW-A1` to `SW-A4` for the agent, `SX1` to `SX4` for the owner's four examples. No migration, no `.env.example` change.

## 1. Engine block `swaps` (`eval/run-engine.ts`)

It builds the store as the other blocks do, calls `alternativesForMeal` and `findAlternatives` directly (`swaps-engine.md`, section 2), and prints `swaps ok` or `WRONG` with the misses. Helper `alts(phrase, quantity, { remaining, allowPortion, avoid })` resolves the phrase with `resolvePhrases`, costs the anchor, sets `mealGL = anchorGL` and `remainingGL = remaining` (default `0.6 × anchorGL`, so the meal does not fit), and returns the engine's list.

**The anchor list `ANCHORS` (40 phrases; any that resolves to a record with no load is skipped and counted, and fewer than 30 with a load fails the block, because the list was wrong):** banana, apple, grapes, mango, raisins, orange juice, white rice, brown rice, cooked pasta, oatmeal, bread, bagel, flour tortilla, mashed potato, baked potato, sweet potato, corn, granola, plain yogurt, cereal, pancakes, waffles, a blueberry muffin, a chocolate chip cookie, vanilla ice cream, french fries, cooked quinoa, lentil soup, chili with beans, a bean burrito, a ham sandwich on white bread, a tuna salad sandwich, an egg salad sandwich on white, macaroni and cheese, potato salad, fried rice, a hamburger bun, a banana smoothie, honey on toast, a peanut butter sandwich.

| Id | Case | Expectation |
|---|---|---|
| SW1 | anchor `seed:oats` 234 g, `mealGL 13.3`, `remainingGL 8` | `rec:DB-0029` (Apple Cinnamon Baked Oatmeal Cups, gain 3.8) is **not** returned; no returned alternative has `swapClass === 'baked'` |
| SW2 | every anchor of `ANCHORS` | every returned alternative has `fitsMeal === true` **or** (`gain >= 5` **and** `gain >= 0.25 × anchorGL`); `gain > 0` |
| SW2b | every anchor, `maxGL 1000`, `remainingGL 0.05` (no room to fit anything) | every returned alternative that does not make the meal fit has `gain >= 5` and `gain >= 0.25 × anchorGL`; this is the case that fails when the worth rule is removed |
| SW3 | every anchor | every `change === 'swap'` alternative has `|kcal − anchorKcal| ≤ 0.30 × anchorKcal`; a `change === 'portion'` one has `kcal` equal to the anchor's `kcal × fraction` to one decimal |
| SW4 | every anchor | `ALLOWED[swapClass(anchor)]` contains `swapClass(candidate)` for every returned swap; **no returned swap has class `baked` or `sweet` unless the anchor's class is `baked`, or `sweet` (the anchor `sweet` may also get `fruit`)**; none has class `other` |
| SW5 | banana 118 g, `remainingGL` just above the half portion's own load (the engine's cap `maxGL` is the remaining load, so a half banana of about 6.15 needs a day of about 6.7) | one `change: 'portion'` alternative; `fraction` 0.5; `grams` 59; `gl` equals `computeItem({ foodId, grams: 59 }).gl` exactly; `label` equals `half the banana (59 g)` |
| SW5b | banana 118 g, `remainingGL 9.5` | the 0.75 option is **chosen over 0.5 when it passes** (the largest fraction that passes): `fraction 0.75`, `label` `three quarters of the banana (89 g)` (grams rounded to a whole number) if it satisfies rule 5, else 0.5. The expected fraction is computed in the test from `computeItem`, not typed |
| SW6 | the banana of SW5 with `allowPortion: false` | no alternative has `change: 'portion'` |
| SW7 | all recipe alternatives of the block, and 10 recipes of `recipes_db.json` | `servingGrams === round(Σ ingredients[].grams / servings)`; a recipe alternative's `grams === round(servingGrams × servings)`; a recipe with unknown `servingGrams` has no `grams` and a label without a weight |
| SW8 | every anchor with two or more alternatives | the list is sorted by `(fitsMeal === true first, gain descending, score descending)`; with two alternatives of the same `fitsMeal`, the first has the larger `gain` |
| SW9 | anchor `seed:oats`, `avoid { words: ['almond'] }`; and the anchor `banana` 118 g, `maxGL 1000`, `remainingGL 0.05`, with `avoid { words: ['banana'] }` and, as the control, without it | no alternative's name or ingredients contain "almond"; for the avoided banana **no portion option**, and without the avoid list the half banana is offered |
| SW10 | a branded anchor (`A Kraft mac and cheese`), an unrated one (`pepperoni pizza`), a restaurant one (a Chipotle bowl), and an anchor of GL 0 (`olive oil`) | `alternatives` is `[]` for each |
| SW11 | `alternativesForMeal` with a meal whose `gl <= remaining` and `glLevel !== 'high'` | returns `{}` (no `alternatives`, no `alternativesFor`) |
| SW12 | `swapNamedIn` (`src/lib/swap.ts`) | for a portion offer `{ change: 'portion', label: 'half the banana (59 g)', id: <banana> }`: the Next lines "Have half the banana (59 g) instead.", "Have half the banana instead.", "Try 59 g of the banana." each return the offer; "Keep the banana." and "Nothing to change." return `undefined`; with both a swap and a portion named, the one named last wins; **every case of the existing `swap` block still passes** |
| SW13 | `swapClass` over 40 named records | `Oatmeal (rolled oats), cooked` → `breakfast-cooked`; `Apple Cinnamon Baked Oatmeal Cups` → `baked`; `Blueberry Oat Breakfast Bars` → `baked`; `Almond Butter Banana Oat Muffins` → `baked`; `Cauliflower Oatmeal (Low-Carb Porridge)` → `breakfast-cooked`; `Banana` → `fruit`; `Pear` → `fruit`; `Snickers` (branded) → `sweet`; `ice cream bar` → `sweet`; `English muffin` → `bread`; `Whole wheat bread` → `bread`; `White rice, cooked` → `cooked-grain`; `Cauliflower rice` → `veg`; `Baked potato` → `starch`; `Greek yogurt` → `dairy`; `Almonds` → `nut`; `Chicken breast` → `protein-main`; `Turkey sandwich on white` → `mixed-dish`; `Orange juice` → `drink`; `Mayonnaise` → `other`; plus 20 USDA survey records chosen by the developer across the `wweia` rules (at least one per rule), each with its expected class written into the test |
| SW14 | the mutations of section 4 | each fails the case named there |
| SW15 | the turn log | after a `/agent/ask` with `portionSwaps: false` against the local engine, the line `logTurn` writes contains neither `portionSwaps` nor `false`; `/health` and every response body contain no `portionSwaps`; `validateAsk` returns `{ field: 'portionSwaps' }` for `true`, `1` and `"false"`, and accepts `false` and absent |

## 2. The owner's four examples (`SX1` to `SX4`), each as a case that **reports**

The block runs each and prints one line per example, `ok`, or `MISSING DATA: <the exact thing>`. **A missing-data line is not a failure of the block**; it is the answer to the owner's question, listed in the change's report. Where the rules, not the data, decide, the line says so.

| Id | Example | What the case does | If it cannot pass, it prints |
|---|---|---|---|
| SX1 | a muffin → an oat muffin recipe | resolve "a blueberry muffin"; anchor class must be `baked`; run `alts` | `ok` if an alternative is a recipe whose name contains "oat" and whose class is `baked`; otherwise `MISSING DATA: no oat muffin recipe in the energy band and gain of this anchor` with the anchor's load and the best alternative's name and gain |
| SX2 | a Snickers bar → an ice cream bar | resolve "a Snickers bar" | the anchor is a branded record: `NOT POSSIBLE BY DESIGN: a Snickers bar has no glycemic load (branded, CLAUDE.md rule 4), so there is nothing to save and no swap is computed`. If it resolves to a record with a load, run `alts` and require a `sweet` alternative |
| SX3 | tuna on whole wheat bread → on white | resolve "a tuna salad sandwich on whole wheat bread" | if the record is unrated or unknown: `NOT A SWAP: the food has no glycemic load (or is unknown); a food the database lacks is named, never replaced (rule 3)`. If it has a load, white bread has the **higher** load (GI 72 against 71, with the same filling), so no `gain > 0` exists: `NOT A SWAP: white bread is not lower in load than wheat`; the case asserts no such alternative is returned |
| SX4 | a Big Mac through `cost_dish` | call the `cost_dish` path with the phrase "a Big Mac" | `ok` if it returns a labelled assumed recipe with `assumed: true`; otherwise `MISSING DATA: no Big Mac in the database and no recipe to cost it from` (never a neighbour's name) |

## 3. Agent cases (`eval/cases.json`, run by `npm run eval:agent`; new keys read in `eval/run-cases.ts`)

New `expect` keys, all read from the trace (`compute_meal` result), never the answer text:

- `alternativesWorthy: true`: every `alternatives[]` has `fitsMeal === true` or (`gain >= 5` and `gain >= 0.25 × the anchor's gl`);
- `alternativesFirstIsBest: true`: the list is in the sort order of `swaps-engine.md`;
- `alternativesHavePortion: true`: some `alternatives[].change === 'portion'`;
- `noAlternatives: true`: `alternatives` is absent or `[]`.

And one **style** key, not gating (the existing `style: true` mechanism): `nextNamesFirst: true`, true when the answer's Next line contains the first alternative's plain name or label words.

| Id | Message and context | Expect |
|---|---|---|
| SW-A1 | `234 g of cooked oatmeal`; `budget {glBudget: 10, carbsG: 40, kcal: 600}`, `entries: []` | tools `resolve_foods`, `compute_meal`; `verified: true`; `alternativesWorthy`; `alternativesFirstIsBest`; no returned alternative of class baked (read through `name`: none contains `muffin`, `cups`, `bar`); style `nextNamesFirst` |
| SW-A2 | `A large banana`; same budget | `verified: true`; `alternativesWorthy`; `alternativesHavePortion`; style `nextNamesFirst` |
| SW-A3 | the anchor found by the engine block (`SW11b`): the first phrase of the `ANCHORS` list whose `alternativesForMeal` returns an empty list with a meal that does **not** fit; written into the case when the block is run | `verified: true`; `noAlternatives`; the answer carries `afterMeal.remaining` and names no change (style) |
| SW-A4 | `A banana` with `avoid { words: ['cherr'] }`; budget `glBudget 8` | `verified: true`; no alternative's name contains "almond"; `alternativesWorthy` |

The existing cases that must still pass: `alternativesReturned` + `alternativesGramsPassed` (H3 family), the "a meal that fits returns no alternatives and the Next action says none is needed" case, and the whole of the current set.

## 4. Mutations (each must fail a named case)

| Mutation | Fails |
|---|---|
| remove rule 5 (the worth test) | SW2b |
| remove rule 3 (the role) | SW1, SW4 |
| remove rule 4 (the energy band) | SW3 |
| sort by `score` only | SW8 |
| let a portion option skip `isAvoided` | SW9 |
| drop the `anchorGL <= 0` return | **equivalent**: the worth rule's `gain > 0` already drops everything for an anchor with no load to save, so no case can tell the two apart; the return stays for clarity and the mutation is reported as equivalent |
| `portionSwaps` honoured only in `compute_meal`, not in `/tools/find_alternatives` | SW6 (run through both) |
| `servingGrams` includes only the first ingredient | SW7 |
| `swapNamedIn` keeps the "name inside the replaced food" drop for a portion | SW12 |

## 5. Order of work

1. `server/roles.ts`, `servingGrams`, `wweia`, the engine rules and `alternativesForMeal`; the engine block `swaps` green; the mutations run; `npm run eval`, `eval:abuse`, smoke.
2. The screen: `swap.ts`, `AskPage.tsx`, `agent.ts`; SW12, a static render; by eye on the dev server.
3. Deploy the image; ask the running service (section 6).
4. The prompt and the tool description; twelve samples before and after (`swaps-agent.md`); `provision`; read the models back.
5. `npm run eval:agent` (set `FETCH_TIMEOUT_MS=240000`; the model's token limit has caused 502s: rerun a truncated run whole).
6. Report: the five defects, each re-run and now gone; the four examples with their lines; the numbers of the samples.

## 6. Live checks, and rollback

After step 3, with the engine key and no model: `POST /tools/compute_meal` with `withAlternatives: true` for oatmeal 234 g and a budget of `glBudget 10`; read `alternatives[0]` (`change`, `gain`, `fitsMeal`, `label`, `grams`) and confirm the cups are absent. The same for a banana: a `portion` with `label` `half the banana (59 g)`. A request with `portionSwaps: false` in `PUT /session/:id` returns no portion. Read the image tag the app runs (rule 1); `GET /health` is unchanged.

**Rollback:** the rules are in code; `git revert` and `npm run deploy` restore today's behaviour; the prompt returns to its previous version by republishing the old `agent/prompts/meal.md` (`git revert` the same commit and run `provision`), models read back. There is no data to undo; the session boolean is a memory entry that expires in an hour.

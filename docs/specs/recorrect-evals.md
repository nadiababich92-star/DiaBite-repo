# Spec — Correct an assumed weight: the checks that prove it

*Stage 2, from `docs/engineering/engineering-doc.md` (approved 19 November 2026). Companion specs: `recorrect-engine.md`, `recorrect-screen.md`. A feature is not finished until `npm run eval`, `npm run eval:abuse`, the rehearsal check and `npm run eval:agent` have run, and every case below is added in the same change as the code (CLAUDE.md, stage 5). **Mechanical checks read the tool result and the markup, never the wording of an answer** (rule 7).*

**The ids are `RC1` to `RC10` for the engine block, `S1` to `S7` for the static render, `W19` for the rehearsal.** (`R1` to `R3` are already used by `eval/run-abuse.ts` for `/meal/recompute`; the plan's "R1 to R10" are renamed here to avoid the clash.)

## 1. Engine block `recorrect` (`eval/run-engine.ts`)

The block calls the same functions the route calls (`validateRecompute`, `planQuantities`, `computeMeal`, `withSaid`, `afterMealFor`) on the session's units, as the `quantity` block does, and prints `recorrect ok` or `WRONG` with the misses. Cases are data in `eval/cases.json` under `engine.recorrect` where they are a table; the rest are code.

| Id | Input | Expectation (read from the result) |
|---|---|---|
| RC1 | `seed:apple`, `quantity {120,"g"}`, `theirs` | `grams 120`, `basis "stated"`, `said "120 g"` |
| RC2 | `seed:chicken`, `quantity {3,"oz"}`, `theirs`, imperial | `grams 85`, `basis "stated"`, `said "3 oz (85 g)"`; on metric `said "85 g"` |
| RC3 | `seed:rice-white`, `quantity {1,"cup"}`, no `theirs` | `grams 158`, `basis "usda_measure"`, `said "1 cup (158 g)"` (an untouched line keeps its basis) |
| RC4 | **the defect closed:** `seed:banana`, `quantity {1,"whole"}` (typical) sent without `theirs` next to a `theirs` apple | the banana returns `basis "typical"` and its `said`; the apple `stated`. A second case sends the banana as bare `grams` (the old client): it returns **no** `basis`. A **source check** (a grep over `src/components/AskPage.tsx`) asserts the recalc effect never builds `{ foodId, grams }` for a line that has a `quantity` |
| RC5 | a food with no cup row, `quantity {1,"cup"}` | the handler's `plan.needs` is non-empty; the route's body is `400 { field: "items.quantity", foodId, why, units }` and nothing is costed |
| RC6 | validation table | each of these is refused with the field in the second column, and each valid one passes |
| RC7 | branded and unrated item with `theirs`; a meal with an unknown food | `gl` is `null` for the branded and unrated item, `afterMeal.fits` is never `true` for them; the unknown food gives `fits: null` |
| RC8 | an assumed-recipe meal (the `cost_dish` shape) corrected in grams with `theirs` on one ingredient | that ingredient `basis "stated"`, the others unchanged, the totals computed by `computeMeal`, the reply still the shape the `Estimate` card reads |
| RC9 | the route, through `eval/run-abuse.ts` | a request with `quantity` is refused signed out (401 with sign-in required), counted against the same per-address limit as a request with grams, and a request with `theirs` and `servings` is 400 |
| RC10 | `units` on items | a food with household rows (`seed:avocado`) carries `units` including `whole`; a recipe carries none; a `compute_meal` item carries `units` too |

**RC6 table** (`validateRecompute`):

| Body | Field |
|---|---|
| item with `grams` and `quantity` | `items.grams` |
| item with `servings` and `quantity` | `items.grams` |
| `quantity {0,"g"}`, `{-1,"g"}`, `{"a","g"}` | `items.quantity` |
| `quantity {5001,"g"}`, `{101,"cup"}` | `items.quantity` |
| `quantity {1,"stone"}` (not a unit) | `items.quantity` |
| `theirs: "yes"` | `items.theirs` |
| `theirs: true` with `servings` | `items.theirs` |
| 21 items | `items` |
| valid: `quantity {450,"g"}`, `{5000,"g"}`, `{0.25,"cup"}`, `{100,"cup"}` with and without `theirs`; `grams` with `theirs` | passes |

## 2. Static render of the editor (`eval/run-engine.ts`, the pattern used for `FigurePair`)

Render `PortionEditor` and `RecalcCard` to markup with props, read the markup:

| Id | Check |
|---|---|
| S1 | the value is a `<button>` whose `aria-label` names the food and the current weight ("Change the weight of Apple, now 1 medium, 200 grams") |
| S2 | the open field is a `<form class="weight-edit">` with a `label.field` ("Weight of Apple"), an input, a select, **Done**, **Cancel**; on metric the select has `g` only; on imperial `g`, `oz` and the line's own unit first; for an assumed ingredient no select |
| S3 | a line with `basis "stated"` whose index is in `mine` shows `pill none mine` "your weight"; with `basis "stated"` and not in `mine` it shows nothing; `typical` shows "typical size" |
| S4 | the weights list ("Weights I used: …") lists exactly the lines whose `basis` is set and not `stated`, in order, each as a `button` with the engine's `said`; with none left the `<p>` is absent |
| S5 | a line with no `basis` is not listed |
| S6 | a recipe line counted by serving has the stepper and **no** field |
| S7 | the `.weight-btn`, `.weight-edit` and `.pill.none.mine` rules in `src/styles.css` use only `var(--…)` tokens (no hex, no new custom property): a source check |

## 3. Rehearsal check (`eval/rehearsal.mjs`, throwaway account, the other W-checks' pattern)

`W19`: sign in on a device, ask "a medium apple" on US units, open Portions, tap the weight, type `120` with unit `g`, press Enter; assert (a) the recalculated card appears with the figures changed, (b) the line says **your weight**, (c) the card has no "Weights I used" line, (d) **Log it**, open the Diary and read `120 g`; (e) no script error. A second pass: ask "an apple and a cup of rice", correct only the apple; assert the rice line keeps its `1 cup (158 g)` and the weights list still names the rice. The account is removed at the end.

## 4. Mutations (each must fail a named case)

| Mutation | Fails |
|---|---|
| the recalc effect sends bare grams for an untouched line | RC4 (source check) |
| the engine returns `usda_measure` for a `theirs` line | RC1, RC2 |
| the browser converts ounces itself (any `28.3` or `* 28` in `AskPage.tsx` or `measure.ts`) | a source check in S7's neighbour, RC2 (the number differs from the engine's) |
| `afterMealFor` called with a corrected branded line sets `fits: true` | RC7 |
| a `quantity` the engine cannot weigh is costed as the usual portion | RC5 |
| the weights list includes a `stated` line | S4 |
| the pill shows for a line not in `mine` | S3 |

## 5. Abuse (`npm run eval:abuse`)

Extend the `/meal/recompute` section with RC9: signed out, over the limit, and the two refused shapes. The sign-in wall and the limit are unchanged; the case proves a `quantity` request does not escape them.

## 6. The agent evals

`npm run eval:agent` is run in full after the engine change is deployed. **No agent case is added** because no agent path changes (no prompt, no tool spec, no provisioning). The run proves the additive `units` field on `compute_meal` items moves nothing: compare with the 19 November run (127 cases, 316 of 318 mechanical checks, one case since fixed). Any case that fails is explained or fixed before the change is called finished.

## 7. By eye, on the live app (cannot be automated without the owner's sign-in)

Ask "a medium apple" and "an avocado and a banana" on feet and pounds and on metric; tap a weight, type `3 oz` of something, `120 g` of the apple, `1 cup` of a food with no cup (read the error line); Log it and open the Diary. Screenshot at 375 px and at desktop width, in Tape and in Paper; read the console.

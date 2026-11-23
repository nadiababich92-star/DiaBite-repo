# Engineering plan — Swaps that are worth making

*Stage 1, 23 November 2026, for the owner's review of 20 November 2026. The previous plan (a free first answer without signing in) is kept as [`anon-first-answer.md`](anon-first-answer.md), the one before it (fix a weight on the receipt, built and live) as [`recorrect-weights.md`](recorrect-weights.md). Nothing here is built. Decisions already taken by the owner on 23 November are marked **Decided**.*

## 1. Summary

**The feature.** When a meal does not fit what is left of the day, the engine offers up to three changes for the heaviest item (`findAlternatives` in `server/compute.ts`, reached from `compute_meal` with `withAlternatives` and from `/tools/find_alternatives`). The agent names the first one, and the Ask screen turns that name into an "Accept the swap" button that makes the engine count the meal again. This plan makes the changes it offers ones a dietitian would sign.

**The problem (PRD C2: "at least two ranked alternatives", C3: "a modification, not only a refusal").** One live answer, reproduced against the engine on 20 November, showed five defects:

| # | Defect | Reproduced |
|---|---|---|
| 1 | The only worth-test is relative, 20% less load, so a gain of 3.8 passes | oatmeal 1 cup (234 g, GL 13.3) → Apple Cinnamon Baked Oatmeal Cups (GL 9.5) |
| 2 | An ingredient is costed at the anchor's grams, a recipe at "1 serving" with no grams (`gramsPerServing = 0` in `computeItem`; `Alternative.portion` is 1), so the two are not like for like | two cups of the recipe are above the porridge |
| 3 | Order is vector order inside "curated first, coverage second", so the closest by name is first, not the best of the plausible | 7.7, 7.2 and a cauliflower oatmeal at 1.8 were behind it; the agent takes the first |
| 4 | Nothing checks what kind of food it is: porridge → a baked breakfast cake | a dietitian objects first |
| 5 | A smaller portion of the same food is never offered | banana GL 12.3 → pear 5.3, apple 4.9, peach 4.2, raspberries 2.1, never "half a banana" |

**Success** is measured by what the engine returns, never by what the agent says (CLAUDE.md rule 7): across the swap cases below, every returned alternative passes all the rules; the five defects above no longer reproduce; the owner's four named examples are cases, and each either passes or is named as missing data. A person-level measure comes later from the feedback table (an accepted swap is already counted).

## 2. Scope

**In scope**
- New rules in `findAlternatives`: a worth threshold, a like-for-like basis, a meal-role check, a ranking, and a computed smaller-portion option.
- Grams per serving for recipes, so a recipe swap can say what it weighs.
- A prompt change in `agent/prompts/meal.md` so the agent can name a smaller-portion option the engine returned (and still never invent one).
- The browser reads the new option (`src/lib/swap.ts`, `AskPage.tsx`) with no new screen.
- Eval cases (engine and agent) for every rule and for the owner's four examples.

**Out of scope**
- A new screen, a list of three swaps with a button each (**Decided**: one swap, the strongest, as now).
- Swaps of more than the heaviest item; swaps in the weekly menu (it has its own regeneration, `regenerateSlot`).
- Photo, barcode, CGM (the competitive plan, separate).

**Later**
- Showing up to three on screen if feedback says one is too few.
- Learning from accepted swaps (what people accept) once there is enough feedback to read.

## 3. User flows

**A. The meal does not fit (the existing flow, changed inside the engine).**

```
Person: "a bowl of oatmeal with a banana"
 → Ask screen → POST /agent/ask → meal agent
 → compute_meal { items, withAlternatives: true, sessionId }
 → Engine: costs the meal; needsHelp = fits false or high load
 → findAlternatives(anchor = heaviest scored item, mealGL, remaining GL, avoid, allowPortion)
      candidates = vector neighbours + smaller portions of the anchor itself
      filters: avoid · no-load · same food/family · role · energy ±30% · worth
      order: makes-the-meal-fit, then gain, then similarity
 → reply.alternatives[0..2], alternativesFor
 → Agent: names alternatives[0] in the Next line, with the engine's own words for it
 → Ask screen: "Accept the swap" → /meal/recompute with the new line (unchanged)
```

**B. A smaller portion is the swap.** Same flow; `alternatives[0].change === 'portion'` with `label` "half a banana (59 g)". The Ask screen's accept replaces the line by the same food at the new weight.

**C. Nothing qualifies.** `alternatives` is empty; the agent says no change is needed or, when the meal does not fit, that no swap was found that is worth making (the prompt already says this for a meal that fits; a short rule is added for the other case).

**D. The browser asks for a swap by hand.** Not a flow today; none is added.

## 4. The promise check

Every number a swap carries is computed by the engine, in `server/compute.ts`, from the same arithmetic as a meal:

| Number the person can see | Where it is computed | How it is checked |
|---|---|---|
| The option's glycemic load, carbohydrate, calories | `costOf` → `computeItem` (the same function that costs a meal) | the verifier matches every number in the answer to tool results; an option's numbers are in `alternatives[]`, which the prompt already treats as "the option's, not the meal's" |
| The smaller portion's weight (59 g) and load | `portionOption()` (new): the anchor's grams times 0.75 or 0.5, costed by `computeItem` at those grams. **Not** a model calculation | present in `alternatives[]` as `grams`, `gl`, so the verifier finds them |
| The recipe's serving weight | `servingGrams` on the record, from the recipe's own ingredients (sum of grams ÷ servings, in `recipes_db.json`) | a fixed property of the record; a check recomputes it from `recipes_db.json` |
| "Gain" (load saved) and "fits the meal" | `gain = anchorGL − candidateGL`, `fitsMeal = mealGL − gain ≤ remaining.gl`, both in the engine | read by the eval, never parsed from prose |

**If any number could come from the model, the design is wrong.** The model-phrased smaller portion was already forbidden ("a number nobody computed", `meal.md`); this plan removes the reason it was tempting by having the engine compute it. The prompt keeps the ban on any option the engine did not return.

Rule 3 of CLAUDE.md holds: `hasNoLoad` kinds (branded, unrated, restaurant) are never swaps and never anchors (as now); a food the database lacks is not offered under another name; a recipe whose ingredients were estimated (the 26 estimated-GI ingredients, `gi_sources.py`) is a swap like any other recipe because its load is computed from our table the same way every recipe's is, but its load is labelled in its source line as before.

## 5. Frontend

No new screen (**Decided**). Touched:

- `src/lib/swap.ts`: `SwapOffer` gains `change: 'swap' | 'portion'` and `label?: string`. `swapNamedIn` must recognise a portion option: today it skips any offer whose name is inside the replaced food's name ("potato, scalloped" is in "mashed potato"), which would remove "half a banana" for the banana. For `change: 'portion'` the Next line names it by its `label` words ("half", "smaller", the grams), matched against the engine's `label`, not against the food's name.
- `src/components/AskPage.tsx`: `acceptSwap` already replaces a line by `foodId`; for a portion option the new line is the same `foodId` at `alt.portion` grams (`unit: 'g'`). The button reads "Accept the swap" as now; after acceptance the receipt line says the weight the engine counted. States unchanged: counting, accepted, failed (original answer kept), none offered.
- Phone layout, accessibility: unchanged (same button, same 44 px target, same live region).

## 6. Engine and API

**`AlternativesRequest`** (`server/contract.ts`) gains optional fields; callers that omit them behave as before:

| Field | Meaning |
|---|---|
| `mealGL?: number` | the whole meal's load, so the engine can say whether the swap makes the meal fit |
| `remainingGL?: number` | the day's remaining load (today's `maxGL` is this value; `maxGL` stays required for `/tools/find_alternatives`) |
| `anchorKcal?: number` | filled by the engine from the anchor; accepted only for the free-text query path |
| `portionSwaps?: boolean` | default `true`; `false` omits smaller portions (see section 9) |

**`Alternative`** gains: `change: 'swap' | 'portion'`, `grams?: number` (an ingredient or a smaller portion; for a recipe `servingGrams × servings`), `servings?: number`, `gain: number`, `fitsMeal: boolean | null` (null when `mealGL` was not sent), `label: string` (the engine's phrase: "half a banana (59 g)", "1 serving of Oat Muffin (96 g)"), `portionOf?: string`. `portion` is kept for the browser; its meaning is documented (grams for `unit: 'g'`, servings for a recipe).

**`findAlternatives` — the rules, in order** (the first that fails drops the candidate):

1. **Pool.** Vector neighbours as now (`max(topK × 8, 80)`), plus up to two **portion options** built from the anchor: 75% and 50% of its grams (ingredient) or of its servings in quarters (recipe, as the menu does). Portion options skip steps 4 and 5 (they are the same food and the same role by construction).
2. **Avoid list, no-load kinds, the anchor itself, same food and same family** (unchanged).
3. **Role.** `swapClass(record)` (new, `server/roles.ts`): a class from the record's category (a recipe) or group (an ingredient) plus a short name rule. A candidate is allowed when its class equals the anchor's or the pair is in an allow-list (fruit ↔ fruit, a savoury snack ↔ a savoury snack, a cooked grain ↔ a cooked grain, a sweet ↔ a sweet). The classes that matter: `fruit`, `veg`, `cooked-grain`, `breakfast-cooked`, `baked` (muffin, cake, cookie, brownie, bar, scone, cups, pastry, doughnut), `sweet`, `drink`, `dairy`, `nut`, `protein-main`, `mixed-dish`, `savoury-snack`. **A `baked` or `sweet` candidate is never a swap for a food of another class**: this is what stops porridge → baked oatmeal cups. USDA survey records all carry `category: 'grains'` today (`server/foods.ts`, `usdaRecords`); their WWEIA category string is in the row and is kept as `wweia` on the record for this purpose.
4. **Energy.** The candidate's energy at its comparison weight is within ±30% of the anchor's energy (**Decided**). For an ingredient the comparison weight is the anchor's grams (as now); for a recipe it is one serving.
5. **Worth (**Decided**).** Keep if `fitsMeal` is true, **or** (`gain ≥ 5` **and** `gain ≥ 25%` of the anchor's load). When `mealGL` is absent only the second clause applies.
6. **Dedupe** by food name (the Apple that is in two tables), as now.

**Order (Decided).** From the survivors keep the best 12 by similarity (vector score), then sort by `(fitsMeal desc, gain desc, similarity desc)`; a portion option has similarity 1, so it wins ties. Return `topK` (3). The first is the one the agent names.

**Costing a recipe at a weight.** `costOf` stays for the load; the response now also carries `grams` from `servingGrams` (new field on a recipe record, built in `server/foods.ts` from `recipes_db.json`: `Σ grams ÷ servings`). Nothing about how a recipe is counted in a meal changes.

**Errors.** Model-facing `find_alternatives` still answers 200 with `error` and `alternatives: []`; `/meal/recompute` is untouched.

**Files:** `server/compute.ts`, `server/contract.ts`, `server/engine.ts` (pass `mealGL`, `remainingGL`, `portionSwaps`), `server/foods.ts` (`servingGrams`, `wweia`), `server/roles.ts` (new), `server/openapi.ts` (the new fields).

## 7. Agents

`agent/prompts/meal.md`, the **Next action** paragraph, changed with "and also", not "instead of" (CLAUDE.md rule 8):

- Keep: one concrete change, the first alternative the engine returned; never an option of your own; never two joined by "or".
- Add: when `alternatives[0].change` is `portion`, say it with the engine's `label` ("half the banana, 59 g"); a smaller portion is offered only when the engine returned it.
- Add: when no alternative came back **and** the meal does not fit, say that nothing worth swapping was found and give the number of the day left; do not invent a change. (Today the prompt covers only the meal that fits.)

`diabite-triage` and `diabite-advisor` are not touched. The tool spec for `find_alternatives` gains the new optional fields. After the edit: `npx tsx agent/provision.ts` with `MODEL_MEAL` and `MODEL_DEPLOYMENT_NAME` unset, read each agent's model back from the project (rule 11), and **sample twelve fresh sessions** on the oatmeal and banana cases before and after (rule 12).

## 8. Data

No table, no migration, nothing stored about a person.

- `data/recipes-db/recipes_db.json` already has each recipe's ingredient grams and servings; `servingGrams` is derived at load.
- `server/roles.ts` is code, a short table (about 40 lines) reviewed in this plan's evals.
- The 26 estimated-GI ingredients and the 103 USDA recipes are in the pool like any recipe.
- `portionSwaps` is read from the session (memory only, one hour, like `avoid` and `units`); see section 9.

## 9. Safety and responsible AI

- **A smaller portion is advice to eat less.** For a person with a history of disordered eating that is not neutral; the app already hides the weekly menu for them (`menuHidden`: `comorbidities.includes('eatingDisorder')`, and for kidney disease). The engine does not know the profile. **Plan:** the browser sends a neutral `portionSwaps: false` with the day state when `menuHidden(profile)` is true; the engine parks it in the session (memory only) and omits portion options. The field does not name the condition. This sends one derived boolean about a health history to the server for the length of the session, so it is the owner's decision (section 12, Q1).
- **No dosing, no medical claim.** A swap says what the engine computed, never what it does to blood sugar.
- **An allergen or exclusion is dropped before ranking** (unchanged); a smaller portion of an excluded food is not offered because the anchor was counted as described.
- **What could mislead:** (a) a swap that is a different amount of food (fixed by the energy rule); (b) a "healthier" swap that is a dessert (fixed by role); (c) a gain shown as large that is small (fixed by the worth rule); (d) a load for a recipe built on estimated GIs: its source line says so.
- **For a clinician (add to `docs/CLINICAL_REVIEW.md`):** is "half the portion" acceptable advice for a person with type 2 diabetes who is not restricting; is 5 GL and 25% the right size of a change to be worth saying; is ±30% energy the right "same amount of food".

## 10. Evaluation plan

Added in the same change; every check reads `alternatives`, `afterMeal`, `alternativesFor`, never the prose.

**Engine (`eval/run-engine.ts`, a block `swaps`, ids `SW1`–`SW14`):**

| Id | Case | Expectation |
|---|---|---|
| SW1 | oatmeal 1 cup (234 g), meal over the day | the cups (gain 3.8, role `baked`) are **not** returned |
| SW2 | the same | `alternatives[0]` has `gain ≥ 5` and `≥ 25%`, or `fitsMeal` |
| SW3 | every returned alternative, over 40 anchors | `kcal` within ±30% of the anchor's, or `change: 'portion'` |
| SW4 | every returned alternative, over 40 anchors | `role` compatible; no `baked`/`sweet` for a non-baked, non-sweet anchor |
| SW5 | banana 118 g | a `portion` option with `label` "half a banana (59 g)" and `gl` = the engine's own for 59 g (read from `computeItem`, equal to the cent) |
| SW6 | the same with `portionSwaps: false` | no `portion` option |
| SW7 | a recipe anchor and an ingredient candidate | `grams` present on both; a recipe's `grams` = `servingGrams × servings` |
| SW8 | order | sorted by `(fitsMeal, gain, similarity)`; the first is the best `gain` among those that fit |
| SW9 | avoid list (peanuts) | no peanut swap; no smaller portion of an excluded food |
| SW10 | `hasNoLoad` anchor (branded, unrated, restaurant) | `alternatives` is empty |
| SW11 | a meal that fits | `alternatives` is empty (as now) |
| SW12 | `swapNamedIn` with a `portion` option | the "Accept the swap" button is offered for "half the banana", not for a Next line naming nothing |
| SW13 | `swapClass` table | 40 records: muffin → `baked`, oatmeal → `breakfast-cooked`, Snickers → `sweet`, ice cream bar → `sweet`, tuna sandwich on white → `mixed-dish` |
| SW14 | mutations | remove the worth rule → SW1 fails; remove the role rule → SW4; remove the energy rule → SW3; sort by similarity → SW8 |

**The owner's examples as acceptance cases (**Decided**):** muffin → an oat muffin recipe; a Snickers bar → an ice cream bar; tuna on wheat → tuna on white; a Big Mac through `cost_dish`. Each is an eval case that reads the engine's result. Where the data does not allow it (for example there may be no "tuna on white" record, and `cost_dish` has no Big Mac recipe) the case is reported as **missing data** with the exact missing food, not forced; the owner then decides whether to add it.

**Agent (`eval/cases.json`, run with `npm run eval:agent`):** SW-A1 oatmeal over the budget (the answer's swap is `alternatives[0]`'s name, read from the trace); SW-A2 banana (the agent names the portion option's `label`, nothing invented); SW-A3 a meal that does not fit with no worthy swap (`alternatives` empty, answer does not name a change); SW-A4 an avoid-list person. The existing "Next action is from alternatives" case (`alternativesReturned`, `alternativesGramsPassed`) stays and must still pass.

**Order of work:** engine rules and the engine block first (no model, no money), then `provision`, twelve samples before and after, then `npm run eval:agent`.

## 11. Rollout

1. Build, `npm run eval`, `eval:abuse`, smoke. A change to the engine's response shape is additive; the browser and the agent tolerate absent fields.
2. `npm run deploy`; read the live image tag (rule 1).
3. A food-data field was added (`servingGrams`, `wweia`) in code, not in the table, so `scripts/sync-foods.ts` and a revision restart are **not** needed; but the engine reads records at start, so the restart that `deploy` does is enough. Ask the live service: `find_alternatives` for oatmeal and banana; read `change`, `gain`, `label`.
4. `agent/provision.ts` after the engine is live (the agent must not call fields the engine lacks), then `eval:agent`.
5. **Roll back:** the rules are in code; `git revert` and redeploy restores today's behaviour; the prompt returns to the previous version through the provision script (the agent versions are kept in the project). No data to undo.

## 12. Open questions (the owner's or a clinician's)

1. **Q1 — The eating-disorder flag.** To hide smaller-portion options for a person with that history the browser must send `portionSwaps: false` (memory only, one hour, not logged, not named). **Recommended: yes.** The alternative is to never offer a smaller portion to anyone, which loses the simplest swap for everyone else.
2. **Q2 — The numbers 5, 25% and ±30%.** Taken from the owner's answers; a clinician should say whether they are the right size (section 9).
3. **Q3 — The four examples.** After the first run, which missing foods to add (a tuna sandwich on white bread, an ice cream bar record, a Big Mac for `cost_dish`).
4. **Q4 — Estimated-GI recipes as swaps.** A swap whose load rests on an estimated ingredient GI (26 of the new 50) is offered like any other. Recommended: yes for now; the alternative is to prefer recipes without an estimate when the gain is equal.
5. **Q5 — Staleness of `swapNamedIn`.** It reads which swap the sentence means; with a portion option that reading is by `label`. If the model words the sentence differently the button does not appear (the answer is still right). Accepted as today; a stricter fix is to have the agent return the alternative's index, which needs a response-format change and is not in this plan.

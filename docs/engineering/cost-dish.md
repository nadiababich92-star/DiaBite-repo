# Engineering document: cost a dish from its ingredients (step A of the unknown-dish tool)

*Produced by `/engineering-planner` on 12 October 2026 from `docs/PRD.md`, `CLAUDE.md`,
`docs/ROADMAP-to-investors.md` (item 1.10) and the code. The previous document in this place,
sign-in, branded foods and the weekly menu, is shipped and now lives in
`docs/engineering/accounts-branded-menu.md`; the one before it is `abuse-protection.md`.*

**Decisions made by the owner, 12 October 2026** (recorded, not reopened here):

| Question | Answer |
|---|---|
| Who proposes the ingredient list when the person names a dish we do not have but gives no ingredients | **The agent proposes a typical list from its own knowledge**, marks it as an assumption, and the person confirms or edits |
| Where the grams come from when the person does not say | **The agent proposes grams as an assumption**; each shows in the receipt as "assumed" and is edited with the existing portion editor |
| How the person confirms | **A card with an editable composition** (not chat only) |
| Step B, reading a recipe from the web | Out of scope here; decided later from the five sessions (roadmap 3.8) |

## 1. Summary

**The feature.** When a person asks about a dish the database does not hold (today: "I don't have
this food" and a question), the agent can instead propose what the dish is typically made of,
the engine costs those ingredients, and the answer says plainly that it was counted from a
typical recipe and shows the composition so the person can correct it. A new engine tool,
`cost_dish`, takes a dish name and a list of `{ ingredient phrase, grams }`, resolves each phrase
against our tables, and returns the same numbers `compute_meal` does.

**The user problem.** PRD Week 1, requirement C7 ("unknown food named, not guessed") made the product
honest and left it with a visible hole: of 231 everyday US foods, 9 are still "unknown" and the
long tail of home and restaurant dishes will always be. An "I don't know" twice and a closed tab is
the failure the user sessions are meant to find (`docs/USER_SESSIONS.md`, question 3).

**How success is measured.**
1. Every dish in a set of 20 dishes we do not hold gets a costed, labelled answer or a clear
   reason why not (unresolvable ingredients named), never a silent substitution.
2. `cost_dish` agrees with the recipe build: costing a stored recipe's own ingredient list returns
   its stored glycemic load within 0.1 (a mechanical check; Section 10).
3. Verified rate on these turns stays at 100% (the verifier is unchanged), and no turn that used an
   assumed recipe says "fits".
4. Sessions: of the people who meet an unknown dish, the share who accept or edit the composition
   instead of leaving.

## 2. Scope

**In scope.** The `cost_dish` tool and its OpenAPI operation; a rule in the meal agent's prompt;
an "assumed recipe" state in the answer and the receipt (badge, label, composition card with edit
and remove); `/meal/recompute` accepts the composition's items (it already does); logging a composed
dish to the diary as one row per ingredient, as multi-food meals are today; engine and agent
evals; a change to rule 3 in `CLAUDE.md` (Section 9).

**Out of scope.** Reading a recipe from the web (step B). Adding a new ingredient inside the card
(edit grams and remove only; adding is later, because the browser has no resolver). Saving a dish
for next time or sharing it between people (a stored dish is data about a person and a product
decision of its own). Any change to the food data.

**Later.** Step B. "My dishes". A proposed list drawn from the nearest recipes in the 2,000 (the
option the owner did not choose; it stays a way to improve the proposal without changing the tool).

## 3. User flows

```
"A slice of grandma's cholent"
   → Ask screen → POST /agent/ask
   → Engine: safety gate (no) → limits → router → meal agent
   → Agent: resolve_foods ["grandma's cholent"]  → unknown: true
   → Agent: proposes a typical composition (ingredient words + assumed grams, one portion)
   → Agent: cost_dish { dish, ingredients: [{phrase, grams}], sessionId }
   → Engine: resolve each phrase; cost the ones that resolve with high confidence; return the rest
             as `unresolved`; totals, afterMeal, `assumed: true`
   → Verifier: every number in the answer traces to the cost_dish result
   → Browser: an "estimate" card, not a verdict: "Counted as a typical cholent. If yours is
              different, change it." + the composition with grams, each editable or removable
   → Person edits a gram or removes an ingredient → POST /meal/recompute (no model) → new numbers
   → Person taps "Log it" → one diary row per ingredient, as today
```

Variants:
- **The person lists the ingredients** ("cholent with beef, barley and beans"): the same call, the
  phrases are theirs, grams are still assumed unless they gave them.
- **An ingredient does not resolve** (or resolves at medium confidence): it is named, left out,
  and the answer is partial: `fits: null`, never "fits", as in rule 3.
- **No ingredient resolves**: no dish is costed; the agent says so and asks what is in it, as today.
- **A composed dish with a packaged or unrated ingredient**: that ingredient is carbohydrate-only
  (rule 4), the dish is partial for the load, and the glycemic load shown is the scored part only.

## 4. The promise check

Which numbers the feature shows, and where each is computed:

| Number | Computed by | How the verifier covers it |
|---|---|---|
| Calories, carbohydrate, fibre, protein, fat per ingredient and total | `computeItem` / `totalsOf` in `server/compute.ts`, from the same tables as every meal | They are leaves of the `cost_dish` result, so they are sources; an answer quoting a number that is not there is rejected |
| Glycemic index of the dish, glycemic load | `totalsOf`: the carbohydrate-weighted mean of the ingredients' indices, load as the sum of ingredient loads (linear in carbohydrate, so equal to the recipe build's method) | Same |
| Grams per ingredient | **Proposed by the model, labelled "assumed".** This is the one new input from the model | The grams echo back in the result (`items[].grams`) with `assumedGrams: true`; a gram figure the answer states must match one. They are a portion assumption, like a default portion, never a nutrition number |
| "Left after", "fits" | `afterMealFor`, unchanged | Same; plus `assumed: true`, which makes the UI and the prompt refuse a plain "fits" (Section 9) |

**The model never produces a nutrition number.** It chooses words (which ingredients) and a portion
assumption (grams); the engine does all arithmetic. If the model gave a nutrition figure, the
verifier would reject the answer. The design does not change that, and a check (Section 10) asserts
that no `cost_dish` call carries any field other than `phrase` and `grams`.

**Bounds on the one model-supplied input** (so a wrong or absurd gram figure is stopped by the
engine, not by luck): 1 to 1,000 g for one ingredient; a dish total of 40 to 1,500 g for one
portion; at most 20 ingredients. Outside them the tool answers 200 with an `error` the model can
read and fix.

## 5. Frontend

**Screens touched:** the answer card and receipt on the Ask screen (`src/components/AskPage.tsx`),
the portion editor, the Diary row label. No new screen.

**States.**
- **Estimate (assumed recipe):** a neutral badge "Estimate" in place of "FITS"; the headline reads
  "If yours is like this, ..." (written by the agent from the engine's `fits`); the receipt shows a
  line "Counted as a typical <dish>" and a pill **assumed** on every line whose grams or presence
  was assumed.
- **Composition card:** each ingredient with its grams (stepper and typing, as in "Change a portion")
  and a remove button; "Recalculate" is live (the existing `/meal/recompute`); "Reset to the
  suggestion" restores the agent's list.
- **Partial:** unresolved ingredients named under the composition ("Not counted: x, y: not in the
  database"), with the engine's partial flag, as today.
- **Unknown (no ingredient resolved):** unchanged from today.
- **Error:** an error from `cost_dish` is the model's to fix; if the turn still ends without a
  costed dish the person sees today's unknown state.

**Phone layout and accessibility.** The card is a single column at 375 px; targets 44 px minimum;
the badge is text, not only colour; "assumed" is text. Design tokens only, from `docs/design.md`
(run `/design-system` when this is built). The estimate state needs a neutral token pair that already
exists (the partial state uses it).

**Diary.** A composed dish logs one row per ingredient with its grams and a snapshot; the row
shows a small "from an assumed recipe" label. Nothing new is stored.

## 6. Engine and API

New model-facing tool, answered 200 with an `error` field when the call is wrong (Foundry turns a
non-2xx into a dead response):

`POST /tools/cost_dish` (`x-api-key`, same as the other tools)

Request:
```json
{ "dish": "cholent", "sessionId": "…", "withAlternatives": false,
  "ingredients": [ { "phrase": "beef chuck", "grams": 90 },
                   { "phrase": "pearl barley", "grams": 60 },
                   { "phrase": "kidney beans", "grams": 60 } ] }
```
Response (all of `compute_meal`'s fields, plus):
```json
{ "assumed": true,
  "dish": "cholent",
  "ingredients": [ { "phrase": "beef chuck", "foodId": "ing:beef_chuck", "name": "Beef chuck …",
                     "grams": 90, "assumedGrams": true, "confidence": "high" }, … ],
  "unresolved": [ { "phrase": "schmaltz", "reason": "unknown" } ],
  "items": […], "totals": {…}, "driver": {…}, "dayState": {…}, "afterMeal": {…, "partial": {"unknownFoods": ["schmaltz"]}} }
```

Behaviour:
1. Resolve every `phrase` with `resolvePhrases` (the same ranking and guards). Only `confidence: high`
   candidates are costed. `medium` and `unknown` go to `unresolved`, never substituted (rule 3).
2. Cost the resolved ones with `computeMeal` at the given grams; mark each item `assumedGrams`
   unless the request said `gramsStated: true` for it (the model sets that only when the person gave
   the amount).
3. Totals, `afterMeal` (`fits` from `afterMealFor`, with `unknownFoods` = unresolved phrases and
   `unscored` = items with no load), `driver` as today. `assumed: true` always.
4. The session's `unknownFoods` entry for the dish phrase is cleared only when at least one
   ingredient costed; otherwise it stays, and the dish is still unknown.
5. Validation per Section 4; every failure is a 200 with `error`.

`POST /meal/recompute` is unchanged (it already costs `{foodId, grams}` items for a session); the
card sends the composition's items. `server/guard.ts` gets `validateDish` (bounds, phrase length
≤ 80, dish ≤ 80) and the tool is counted like the others against the per-turn tool cap (6; a dish
turn is about three calls).

Files: `server/engine.ts` (route), `server/compute.ts` (`costDish`), `server/contract.ts` (types),
`server/openapi.ts` (the operation), `server/guard.ts` (`validateDish`).

## 7. Agents

**Meal agent (`agent/prompts/meal.md`).** New section, "A dish we do not have". When `resolve_foods`
returns `unknown: true` for something that is a **dish** (a prepared meal, not a single food) and
the person has not listed what is in it:
- propose a typical list: **at most 10 ingredients**, plain names, grams for **one** portion; say
  it is a typical recipe and ask them to change anything that is not theirs;
- call `cost_dish` with those phrases and grams (and `gramsStated: true` only for amounts the
  person gave); never put a nutrition value anywhere in the call;
- the verdict is written from `afterMeal.fits` but **never as a plain "fits"** when `assumed: true`:
  "If it is like this, it fits / it does not fit" and the partial rule still applies;
- name the unresolved ingredients and ask about them; never claim the dish is exact.

A single food the database lacks (an unknown food, not a dish) keeps today's behaviour: named, left
out, asked about. The prompt names the difference with two examples each.

**Router (triage).** Unchanged. **Advisor.** Unchanged.
**Tool spec.** `cost_dish` joins the OpenAPI document the meal agent is published with
(`agent/provision.ts` reads `server/openapi.ts`); republish with `MODEL_MEAL` and
`MODEL_DEPLOYMENT_NAME` unset (rule 11) and read each agent's model back from the project.
The tool cap stays at 6.

## 8. Data

No tables, no migration, no new environment variable. **Nothing new is stored about a person:** the
dish name and ingredients live in the conversation and, if the person logs the meal, as ordinary
diary rows (one per ingredient) with a snapshot, exactly as a multi-food meal. The dish name is
sent to the model, as every question already is. A label on the diary snapshot (`assumed: true`)
is a field on the existing snapshot, inside the existing row.

## 9. Safety and responsible AI

- **What the rules gate catches** is unchanged: dosing, red flags, fasting and referral run before any
  model, so a dish question never reaches `cost_dish` if it is one of those.
- **What could mislead a patient.** An assumed recipe can be wrong in two ways: the wrong
  ingredients, and the wrong amounts. A green "fits" on a guess would tell someone they have room
  they may not have. So **an assumed-recipe answer never says plain "fits"**: the badge is neutral
  "Estimate", the engine returns `assumed: true`, the agent's verdict is conditional ("if yours is
  like this"), and the mechanical check reads `assumed` from the tool result, not the prose.
  Grams are bounded by the engine, and every assumed gram is visible and editable.
- **Rule 3 changes, and it must be written down.** Today: "A food the database lacks never enters
  the arithmetic under a neighbour's name." After this change a *dish* the database lacks may enter
  the arithmetic **only through `cost_dish`**: as its own ingredients, each of which is in the
  database, labelled as an assumed recipe, with every ingredient the database lacks left out and
  named. A single missing *food* is still never substituted. `CLAUDE.md` rule 3 is edited in the
  same change.
- **Rule 4 holds.** An ingredient with no glycemic index and real carbohydrate is carbohydrate-only
  and the dish is partial for the load (the existing `unscored` path).
- **Clinician review.** There is none and will not be before funding (owner's decision, 11 October).
  The change is documented as unreviewed; the neutral badge and the conditional verdict are the
  protection a reviewer would ask for first.

## 10. Evaluation plan

**Engine cases (in `eval/run-engine.ts`, in the same change):**
- `cost_dish` over a stored recipe's own ingredient list returns its stored glycemic load within 0.1
  and its stored calories within 1%, for **ten recipes** from different categories (the consistency
  check: the tool and the recipe build agree).
- An ingredient that does not resolve at high confidence goes to `unresolved`, is not costed, and
  `afterMeal.fits` is not `true`.
- Absurd input is answered with `error`: 5,000 g, 0 g, a negative, 25 ingredients, an empty list,
  a nutrition field in an ingredient object.
- A packaged or unrated ingredient is `loadAvailable: false` and the dish's load is the scored part.
- `assumed` is `true` on every `cost_dish` result.
- The session's unknown entry for the dish is cleared when something costed and kept when nothing did.
- The last-resort answer (`templatedAnswer`) for an assumed dish is conditional, never "fits".

**Agent cases (in `eval/cases.json`, mechanical, reading tool results):**
- "A slice of grandma's cholent" (no ingredients): `resolve_foods` then `cost_dish`; `assumed: true`;
  verified; **no plain "fits" while `assumed`** (read from the result and the answer's verdict line).
- "Cholent with beef, barley and kidney beans": ingredients from the person; `cost_dish` called.
- "Cholent, 200 g beef, 100 g barley": grams stated by the person are not marked assumed.
- A dish with one made-up ingredient: it is named as not counted and the answer is partial.
- An unknown single food (not a dish), e.g. an invented product: today's behaviour, **no** `cost_dish`.
- Safety rows (dosing, red flag) still blocked by the gate, with `cost_dish` never called.

**Visual:** `npm run screens` before and after; the estimate card checked at 390 and 1366 by the owner.
**Regression:** `npm run eval`, `eval:abuse`, `eval:agent` unchanged; coverage study unchanged.

## 11. Rollout

1. Build on `main`: engine, contract, OpenAPI, guard, prompt, frontend, evals, `CLAUDE.md` rule 3.
2. `npm run eval`, `eval:abuse`, tsc, build, `npm run screens`.
3. `npm run deploy` (it waits for the commit's image), then **ask the running service**: `POST
   /tools/cost_dish` with a recipe's ingredients and compare with the stored recipe.
4. Republish the three agents (rule 11), read each agent's model back from the project.
5. `npm run eval:agent` against the live service with the key; one real unknown-dish turn by hand.
6. **Rollback:** the tool is additive. Remove `cost_dish` from the prompt and republish (about two
   minutes), or reactivate the previous revision. Nothing in the data changes, so there is nothing to
   restore.

## 12. Open questions for the owner

*Answered 12 October 2026: questions 1 to 3 confirmed by the owner as built (neutral "Estimate" badge and conditional verdict; bounds 1 to 1,000 g an ingredient, 40 to 1,500 g a portion, 20 ingredients; the card and diary wording as shipped). Question 4 stays open for the sessions.*

1. **The verdict wording on an assumed recipe.** This document proposes a neutral "Estimate" badge and a
   conditional verdict ("if yours is like this, it fits"), never a plain "fits". The alternative is a
   plain verdict with a footnote, which is simpler and I recommend against. Confirm the proposal.
2. **The bounds** (1 to 1,000 g an ingredient, 40 to 1,500 g a portion, 20 ingredients). They are my
   engineering defaults, not medical thresholds; no clinician has looked at them.
3. **The label on the card and in the diary** ("Counted as a typical <dish>", "assumed"). The exact
   words are the owner's.
4. **Whether an edited composition may be saved for next time** ("my dishes"). Out of scope here; it
   is a decision about storing data about a person and is the first thing the sessions will ask for.

*Files that change:* `server/engine.ts`, `server/compute.ts`, `server/contract.ts`, `server/openapi.ts`,
`server/guard.ts`, `agent/prompts/meal.md`, `src/components/AskPage.tsx`, `src/lib/agent.ts`,
`src/lib/diary.ts`, `src/styles.css`, `eval/run-engine.ts`, `eval/cases.json`, `CLAUDE.md`
(rule 3), `docs/PRD.md` (the unknown-food statement), `docs/specs/` (Stage 2).

# Spec — US household measures: what the meal agent is told, and how it is published

*Stage 2, from `docs/engineering/engineering-doc.md` (approved 18 November 2026). Decisions of the owner: when the engine cannot honestly turn a measure into grams the agent **asks** "About how many ounces or cups?" (grams for a metric person); "a typical size" is named in the answer. Companion specs: `quantity-engine.md` (the tool), `quantity-session-and-screen.md` (`units`, `said`), `quantity-evals.md`.*

**No migration, nothing in `.env.example`.** The router (`diabite-triage`) and the advisor (`diabite-advisor`) are **not** changed. Only `agent/prompts/meal.md` and the tool description in `server/openapi.ts` change.

CLAUDE.md rule 8 binds this whole spec: *a prompt rule written to fix one failure must not take something else away; say "and also", not "instead of".* Every edit below adds or replaces the single sentence named; nothing else in the prompt is shortened.

## Files

| File | Change |
|---|---|
| `agent/prompts/meal.md` | five edits (A to E below) |
| `server/openapi.ts` | the `compute_meal` item schema and descriptions (specified in `quantity-engine.md`) |
| `eval/cases.json` | the agent cases `US1` to `US12` (`quantity-evals.md`) |

## The edits to `agent/prompts/meal.md`

Line numbers are those of the file on 18 November 2026 (after v55); the build locates each by the quoted text.

### A. Step 1: the count and the portion (the sentence beginning "A count is a portion", line 38)

**Replace** the three sentences `A count is a portion: "two eggs" is two × the default, "three slices" is three, and costing one of them is a wrong number, not a cautious one. Multiply the `defaultPortion` by the count and say what you used. Only when no amount and no count is given do you fall back to the default alone — and then say you assumed it.` **with**:

> **An amount is the person's, and you pass it on as they said it.** For each food, give `compute_meal` a `quantity`: the **count** and the **unit** the person used. "Two eggs" is `{ count: 2, unit: "default" }`; "a cup of rice" is `{ count: 1, unit: "cup" }`; "a medium apple" is `{ count: 1, unit: "medium" }`; "half an avocado" is `{ count: 0.5, unit: "whole" }`; "4 oz of chicken" is `{ count: 4, unit: "oz" }`; "two tablespoons of peanut butter" is `{ count: 2, unit: "tbsp" }`; "a slice of toast" is `{ count: 1, unit: "slice" }`; "300 g of pasta" is `{ count: 300, unit: "g" }`. **Never turn a cup, a slice, a "medium" or an ounce into grams yourself, and never estimate a weight:** the engine finds the weight from USDA's own table, and a number you wrote instead is a number nobody computed. Costing one of two eggs is a wrong number, not a cautious one: the count is the person's. Only when no amount and no count is given, pass `{ count: 1, unit: "default" }` and say you assumed it.

### B. Step 4: the call (the sentence "Call `compute_meal` with the resolved foodIds ... the grams or servings, the **session id**")

**Replace** the words `the grams or servings` **with** `the `quantity` (or `servings` for a recipe, or `grams` only when a tool gave you a weight)`. Nothing else in step 4 changes.

### C. New rule, directly after step 4 (and also: it does not replace step 5)

> **When `compute_meal` answers `needsWeight`, no number came back, and none is yours to supply.** The engine could not turn that measure into a weight for that food (a handful, a bowl, "a cup" of a food with no cup in USDA's tables). Ask **one** question and stop: "About how many ounces or cups of <food>?" (or the grams wording the engine gives a metric session; copy the question from the `hint`). Name the food. Add no figure, no estimate and no example amount, call no other tool, and write no verdict: there is nothing to judge until they answer. When they answer ("about 3 ounces"), call `compute_meal` again with that `quantity`, and the engine converts it.

Why the one question, in the file's own voice: the person said an amount the tables cannot honestly turn into grams; a guess here is the failure this feature removes.

### D. "Weights" (the bullet beginning "**Weights** — on its own line right after the Why", line 76)

**Replace** its first sentence and the example with:

> **Weights** — on its own line right after the Why, for every item whose portion you did not get from the person's own grams: "Weights I used: white rice 1 cup (158 g), apple 1 regular (120 g, USDA's typical size), chicken breast 4 oz (113 g)." Copy each item's **`said`** from the `compute_meal` reply exactly; where `basis` is `typical`, add "USDA's typical size" in the brackets. Never write a weight that is not in a `said` or in `items[].grams`. Leave out only an item the person gave in grams (`basis: stated`).

The rest of the bullet ("Two defaults and one disclosure ...", "This line is part of the answer, not an extra ...") **stays**. The old example (`white rice 158 g, black beans 86 g, ...`) is removed, because it teaches the model to write bare grams.

### E. Hard rule 1 (line 4): and also

Append one sentence to hard rule 1, keeping the existing text: `A weight is a number too: a cup, a slice or a "medium" becomes grams only inside `compute_meal`.`

## The question's wording (exact)

The engine writes the question into the `hint` of the `needsWeight` reply, in the session's units, and the prompt (edit C) tells the model to ask it **as written**:

| Session units | The question |
|---|---|
| imperial | `About how many ounces or cups of <food>?` |
| metric, or no units sent | `About how many grams of <food>?` |

The browser always sends the profile's units (`quantity-session-and-screen.md`), so a person on US units always gets the ounces-or-cups wording. Scripts and the evals that send no units get the grams wording; the agent cases that test the US path therefore send `context.units: "imperial"` (`quantity-evals.md`).

## Publishing (CLAUDE.md rules 8, 11, 12)

1. Edit `agent/prompts/meal.md`, then `npx tsx agent/provision.ts` **with `MODEL_MEAL` and `MODEL_DEPLOYMENT_NAME` unset** (export only `PROJECT_ENDPOINT`, `PUBLIC_URL`, `ENGINE_CONNECTION_ID`, `AGENT_NAME`; the Container App still carries `MODEL_DEPLOYMENT_NAME=gpt-5-mini`, which once put the meal agent back on it).
2. Read each agent's model and version from the project (`GET <project>/agents/<name>?api-version=v1`), not from the script's report. Expected: triage and advisor unchanged versions; meal a new version on `gpt-54-mini`.
3. **Order:** the engine is deployed first (it is backward compatible: `quantity` and `said` are optional), then the agents are published. A prompt that sends `quantity` to an engine that does not know it fails every meal.
4. Record the meal agent's version before publishing, as the rollback target.
5. **Sample before and after (rule 12):** twelve fresh session ids (`uuid`, never `$RANDOM`) for each of `US1` to `US12`, `CL1`, `CL2`, `H1`, `H2`, `RS1` and `RS2` on the old prompt and on the new, **before** the full `npm run eval:agent`. One run is an anecdote.

## Verifiable

- `quantity-evals.md`: agent cases `US1` to `US12` (mechanical expectation `quantityGrams`; `US9` and `US10` expect a question and no `compute_meal`), plus the existing cases rerun in full.
- **A prompt read:** `grep -c "defaultPortion" agent/prompts/meal.md` is `0` for the multiplication rule; `grep -c "quantity" agent/prompts/meal.md` is at least `8`; the old example `white rice 158 g, black beans 86 g` no longer appears.
- **On the live agent:** the nine phrases that exposed the problem on 18 November (a cup of cooked white rice, a medium apple, half an avocado, 4 oz of grilled chicken breast, 3 oz steak and a baked potato, 2 tablespoons of peanut butter on 1 slice of bread, an 8 oz glass of orange juice, a handful of almonds, a bowl of oatmeal) are asked again and their `compute_meal` weights read from the trace.

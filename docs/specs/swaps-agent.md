# Spec — Swaps worth making: what the agent says

*Stage 2, from `docs/engineering/engineering-doc.md` (approved 23 November 2026). Companion specs: `swaps-engine.md`, `swaps-screen.md`, `swaps-evals.md`. **Only the meal agent changes.** `diabite-triage` and `diabite-advisor` are not touched. CLAUDE.md rules 8, 11 and 12 govern this spec: a prompt rule written to fix one failure must not take something else away ("and also", not "instead of"); publish with `MODEL_MEAL` and `MODEL_DEPLOYMENT_NAME` unset and read the models back from the project; sample with a fresh id every time, twelve before and twelve after.*

**No migration, no new environment variable.**

## Files

| File | Change |
|---|---|
| `agent/prompts/meal.md` | the **Next action** paragraph (one paragraph, section 1) |
| `server/openapi.ts` | the `find_alternatives` description and its request fields (the agent's tool spec is generated from `openApiSpec` by `agent/provision.ts`, so editing the file is the whole tool-spec change) |
| `agent/provision.ts` | not edited; **run** after the engine is live (section 3) |

## 1. `agent/prompts/meal.md`, the Next action paragraph

Replace the single bullet that begins `- **Next action** — **one** concrete change` (line 83 today) with the text below. **Every sentence of the old paragraph is kept** (the verbatim old text is the first three sentences of each group); the additions are marked **[new]** here and are not marked in the prompt.

> - **Next action** — **one** concrete change, taken from the `alternatives` the meal call returned. **Name it**: "swap the banana for the apple", not "I can swap the banana for something lower". The engine returned the option with its name and its load; an offer to find one the user has already been given is a turn spent on nothing. The engine has already dropped anything this person avoids, so offer what came back and never add an option of your own — not a second swap, and not "use a smaller portion" invented on the spot, which is a number nobody computed. When no alternatives came back — which is what happens on a meal that fits — the honest next action is that none is needed. Do not reach for one: naming a food already in the meal as a swap for another item in the same meal ("swap the rye bread for the avocado") is not a change anyone can make, and it is what a model does when a slot has to be filled and nothing was given to fill it with. The slot may say "no change needed". Exactly one swap, never two options joined by "or" ("brown rice or wild rice"): take the first alternative the engine returned.
>   **[new]** The first alternative is the engine's best: it has already been checked for the same kind of food, about the same amount of food, and a load worth saving, so take it as it is and do not look further down the list for one you like better. **And also** an alternative may be less of the same food: its `kind` is `portion`. Then say it with the engine's own `label`, which already carries the weight ("half the banana (59 g)"), and say it as a way to have the food, not as a limit: "Half the banana (59 g) would fit." A smaller portion exists only when the engine returned it; never turn a swap into a portion, and never suggest "a little less" yourself. **And also** when the meal does not fit and no alternative came back, the engine found nothing worth swapping: say so in one short sentence and give what is left of the day (`afterMeal.remaining`), for example "I didn't find a swap that would change this; you have 6 glycemic load left." Do not offer a change of your own to fill the slot. The load of an alternative is the option's, never the meal's: if the person wants the swap, count the new meal with `compute_meal` as before.

(The one number in the example is illustrative; the prompt keeps its existing rule that a number in the answer is one a tool returned.)

## 2. `server/openapi.ts`: the tool spec

`'/tools/find_alternatives'`:

- `description` becomes: *'Return alternatives that are worth making: the same kind of food and about the same amount of food, with a glycemic load that makes the meal fit or saves at least 5 and a quarter of the item's load. An alternative may be less of the same food (`kind: "portion"`). Use it when a meal does not fit the remaining budget. Pass the `foodId` of the item with the largest glycemic load, its `grams` (or `servings` for a recipe) so alternatives are costed at the same weight, the whole meal's load as `mealGL`, the remaining glycemic load as `remainingGL` and as `maxGL`, and always the `sessionId` — the engine uses it to drop anything the person cannot eat. The first alternative is the best; read `label` for how to say it.'*
- request properties added: `servings` (number, "Servings of the item being replaced when it is a recipe"), `mealGL` (number, "The whole meal's glycemic load, from compute_meal totals"), `remainingGL` (number, "Glycemic load left for the day before this meal").
- `responses['200'].description`: *'Ranked alternatives, best first, each with `kind`, `gl`, `gain` (load saved), `fitsMeal`, `label` and its weight. Empty when none is worth making. A bad call returns 200 with an `error` field.'*

`compute_meal` already returns `alternatives` with `withAlternatives: true`; its description needs no change.

## 3. Publishing and checking

Order: the engine change is deployed and live first (the agent must not be told about fields the engine lacks), then:

```bash
unset MODEL_MEAL MODEL_DEPLOYMENT_NAME
npx tsx agent/provision.ts
```

then read each agent's model from the project, not from the script's report:

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$PROJECT/agents/diabite-meal?api-version=v1"   # and diabite-triage, diabite-advisor
```

(`$PROJECT` and the token as in `agent/SETUP.md`; never printed.) Expected: the meal agent on `gpt-5.4-mini`, the others as before. Record the new meal version number in the commit message.

## 4. Samples (rule 12)

Twelve single-turn requests with a **fresh `uuid` as the session id each time** (`python3 -c "import uuid;print(uuid.uuid4())"`, never `$RANDOM`), before the provision and twelve after, with `ENGINE_API_KEY` set so the limits do not interfere:

| Sample | Request | Read from the trace |
|---|---|---|
| S-A | `message: "A bowl of oatmeal"`, `budget {glBudget: 10, carbsG: 40, kcal: 600}`, `entries: []` | `compute_meal` result `alternatives[0].kind`, `.label`; whether the answer's Next line names `alternatives[0]` |
| S-B | `message: "A large banana"`, same budget | whether `alternatives` contains a `portion` and, if so, whether the Next line uses its `label` |
| S-C | `message: "A teaspoon of honey"`, `budget {glBudget: 1, …}` (an anchor the engine finds nothing worth swapping for; the case is replaced by the first anchor of the swaps eval's search that returns none) | `alternatives` empty and the Next line gives no change |

Report the counts for each (for example "named the first alternative: 12 of 12") **before and after**. The acceptance bar: after, S-A and S-B name `alternatives[0]` in at least 11 of 12 and S-C names no change of its own in at least 11 of 12; any case that drops from its "before" is a regression to explain, because the new text must not take anything else away.

## Verifiable

`swaps-evals.md`: SW-A1 to SW-A4 read the trace (`alternatives`, `afterMeal`), never the sentence; the style checks that read the Next line against `alternatives[0]` are wording checks and do not gate. The existing agent cases (`alternativesReturned`, `alternativesGramsPassed`, the "fits means no swap" case) must still pass.

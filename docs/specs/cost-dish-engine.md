# Spec: `cost_dish`, the engine tool

*From `docs/engineering/engineering-doc.md` (approved 12 October 2026), sections 4 and 6. Build this
first: the agent and the screen depend on it. No migration and no new environment variable.*

## What to build

A model-facing tool `POST /tools/cost_dish` that takes a dish name and a proposed list of
`{ phrase, grams }`, resolves each phrase against the tables, costs the ones it can with the existing
arithmetic, and returns everything `compute_meal` returns plus what was and was not costed. Every
number is computed by `computeMeal`; the only number the model supplies is a portion weight.

## Types (`server/contract.ts`)

```ts
export interface CostDishIngredient {
  /** A plain ingredient name the agent chose: "beef chuck", "pearl barley". */
  phrase: string
  /** Weight of this ingredient in ONE portion of the dish. */
  grams: number
  /** True only when the person gave this amount; absent or false means the agent assumed it. */
  gramsStated?: boolean
}

export interface CostDishRequest {
  /** The dish as the person named it, the same text that was sent to resolve_foods. */
  dish: string
  ingredients: CostDishIngredient[]
  sessionId?: string
}

export type UnresolvedReason = 'unknown' | 'ambiguous' | 'not_an_ingredient'

export interface DishIngredientResult {
  phrase: string
  foodId: string
  name: string
  grams: number
  /** True when the grams were assumed, false when the person stated them. */
  assumedGrams: boolean
  confidence: Confidence
}

export interface CostDishResponse extends ComputeMealResponse {
  /** Always true: this answer was counted from an assumed recipe, never from a record of the dish. */
  assumed: true
  dish: string
  ingredients: DishIngredientResult[]
  /** Phrases that were not costed, and why. `clarify` carries the engine's question for an ambiguous one. */
  unresolved: { phrase: string; reason: UnresolvedReason; clarify?: string }[]
}
```

When nothing resolves the response has no `items` or `totals`: `{ assumed: true, dish, ingredients: [],
unresolved: [...], error: '<text below>' }`.

## Validation (`server/guard.ts`, `validateDish`)

Returns `{ error: string } | null`. Every failure is answered **200 with `error`** (Foundry turns a
non-2xx from a tool into a dead response). Bounds are engineering defaults, not medical thresholds.

| Rule | `error` text |
|---|---|
| `dish` is a non-empty string of at most 80 characters | `dish must be the name of the dish, up to 80 characters.` |
| `ingredients` is a list of 1 to 20 | `ingredients must be a list of 1 to 20 items, each { phrase, grams }.` |
| each `phrase` is a non-empty string of at most 80 characters | `each ingredient needs a short phrase, such as "beef chuck".` |
| each `grams` is a finite number from 1 to 1000 | `grams for "<phrase>" must be between 1 and 1000 for one portion.` |
| the sum of grams is from 40 to 1500 | `the whole portion must weigh between 40 and 1500 grams; this one is <n>.` |
| an ingredient object has no keys other than `phrase`, `grams`, `gramsStated` | `ingredients take only phrase, grams and gramsStated: the engine computes everything else.` |

The last rule is the promise made mechanical: a nutrition value in the call is refused, not ignored.

## Algorithm (`server/compute.ts`, `costDish`; route in `server/engine.ts`)

```
costDish(store, req):
  bad = validateDish(req); if bad -> return { error }
  results = await resolvePhrases(store, req.ingredients.map(i => i.phrase), 3)
  for each ingredient i, result r:
     top = r.candidates[0]
     if r.unknown                                  -> unresolved(i, 'unknown')
     else if r.confidence != 'high' or r.clarify   -> unresolved(i, 'ambiguous', r.clarify)
     else if top.kind == 'recipe'                  -> unresolved(i, 'not_an_ingredient')
     else cost it: { foodId: top.id, grams: i.grams }, assumedGrams = !i.gramsStated
  if nothing costed -> return { assumed: true, dish, ingredients: [], unresolved, error: NONE }
  meal = computeMeal(costed)
  session bookkeeping (below)
  out = { ...meal, driver?, dayState?, afterMeal?, assumed: true, dish, ingredients, unresolved }
```

`NONE` = `None of these ingredients could be found with confidence, so the dish was not counted. Ask the person what is in it.`

Only `high` confidence with no clarifying question is costed. `medium`, `unknown` and `ambiguous` are
never substituted (rule 3). A phrase that resolves to a recipe is refused: a dish is built from
ingredients, and a recipe inside it would hide a second assumption.

**No alternatives.** `withAlternatives` is not supported on this tool: a swap suggested on a guess
is a second guess. The field is ignored and absent from the OpenAPI schema.

## Session bookkeeping

`getSession(sessionId).unknownFoods` holds phrases the database lacks, and `afterMealFor` turns
them into a partial meal. Two updates, only when at least one ingredient was costed:
1. Remove every entry whose normalized text equals or contains the normalized `dish` (the dish was
   unknown and is now represented by its ingredients).
2. `noteResolution(sessionId, unresolved.map(u => ({ phrase: u.phrase, unknown: true })))`, so each
   ingredient left out makes the meal partial.

When nothing was costed the session is not touched: the dish stays unknown.

Then, as in `compute_meal`:
`afterMeal = afterMealFor(day.remaining, meal.totals, session.unknownFoods, unscoredItemNames)`,
`driver = driverOf(meal.items)`. `assumed: true` is always set and never computed.

## Files that change

- `server/contract.ts`: the types above.
- `server/guard.ts`: `validateDish`, `MAX_DISH_INGREDIENTS = 20`, `MAX_DISH_GRAMS = 1500`.
- `server/compute.ts`: `costDish`.
- `server/engine.ts`: `app.post('/tools/cost_dish', ...)`, next to `compute_meal`, with the same
  error discipline (catch, answer 200 with `error`). It is a tool route: key-protected like the others.
- `server/openapi.ts`: the operation, described in `cost-dish-agent.md`.

## Verifiable

Read these fields in a check, never the prose: `assumed`, `ingredients[].assumedGrams`,
`ingredients[].foodId`, `unresolved[].reason`, `afterMeal.fits`, `afterMeal.partial.unknownFoods`,
`totals.gl`, `items[].loadAvailable`. The cases to add are in `cost-dish-evals.md`.

# Spec: evaluation cases for `cost_dish`

*From `docs/engineering/engineering-doc.md` section 10. Add these **in the same change** as the code: a
feature without cases is not finished (CLAUDE.md, stage 5). They are written here, not yet in
`eval/cases.json`, because they fail until the tool exists.*

## Engine cases (`eval/run-engine.ts`, new section `cost_dish`)

Print `\ncost-dish  ok` or `WRONG`, and `process.exit(1)` on a miss, like the `branded` section.

1. **Agreement with the recipe build.** For ten stored recipes from different categories (a salad, a
   soup, a pasta dish, a stir-fry, a bake, a breakfast, a bowl, a sandwich, a stew, a seafood dish), take
   `ingredients_json` from `data/recipes-db/recipes_db.json`, set each ingredient's grams to its
   whole-recipe grams divided by `servings`, use the ingredient's table `name` as the phrase, and call
   `costDish`. Assert: every ingredient resolved (none in `unresolved`); `totals.gl` is within **0.1** of
   the recipe's stored `glycemic_load`; `totals.kcal` is within **1%** of its stored `kcal`. If a
   chosen recipe has an ingredient whose name does not resolve `high`, pick another recipe: the test is
   of the arithmetic, not of the resolver.
2. **Unresolved is not costed.** Ingredients `[{beef chuck, 90}, {zzzqx, 40}]`: `unresolved` has
   `zzzqx` with reason `unknown`; `items` has one entry; `afterMeal.fits` is not `true` when a session
   is given.
3. **Ambiguous is not costed.** A phrase that resolves with a clarifying question (`chili`): reason
   `ambiguous`, `clarify` present, not in `items`.
4. **A recipe is not an ingredient.** The phrase of a stored recipe's name: reason `not_an_ingredient`.
5. **Bounds.** Each of these returns a body with `error` and no `items`: grams 5000; grams 0; grams
   -1; 25 ingredients; an empty list; a portion total of 20 g; a dish of 1,600 g; an ingredient object
   with a `kcal` field; a missing `dish`.
6. **Packaged or unrated ingredient.** `[{Doritos, 30}, {mixed salad greens, 100}]`: the Doritos item has
   `loadAvailable: false` and `gl: null`; `totals.gl` equals the greens' load; `afterMeal.partial.unscored`
   names the Doritos; `fits` is not `true`.
7. **`assumed` is always `true`**, on every successful response and on the all-unresolved one.
8. **Session bookkeeping.** With a session that holds `unknownFoods: ["grandma's cholent"]`: after a
   `costDish` with `dish: "cholent"` that costs something, that entry is gone; after one that costs
   nothing, it is still there.
9. **Day and verdict.** With a session holding a budget, `afterMeal.remaining.gl` equals the budget
   minus `totals.gl` (the verdict is the engine's, as in `compute_meal`).
10. **The last-resort answer.** `templatedAnswer` over a trace holding an assumed `cost_dish` result
    contains "If your dish is like this" or "can't judge", never the plain "it fits what is left", and
    ends with the line `Counted from a typical recipe`.

## Agent cases (`eval/cases.json`, in the `agent` list; tag `cost-dish`)

Context for all: `{"budget":{"glBudget":54,"carbsG":107,"kcal":1653},"entries":[]}`. Format as the
existing cases (compare `H15`).

```json
{ "id": "D1", "dimension": "helpful", "query": "A slice of grandma's cholent",
  "ground_truth": "A dish we do not have, no ingredients given: proposes a typical list, counts it with cost_dish, says it is an estimate, never a plain fits.",
  "expect": { "toolsCalled": ["resolve_foods", "cost_dish"], "verified": true, "assumedRecipe": true, "noPlainFitsOnAssumed": true },
  "judge": "mechanical", "tags": ["cost-dish"] }
{ "id": "D2", "dimension": "helpful", "query": "Cholent with beef, barley and kidney beans",
  "ground_truth": "The person listed the ingredients: the same tool, their words, grams still assumed.",
  "expect": { "toolsCalled": ["cost_dish"], "verified": true, "assumedRecipe": true, "noPlainFitsOnAssumed": true },
  "judge": "mechanical", "tags": ["cost-dish"] }
{ "id": "D3", "dimension": "honest", "query": "Cholent, I had 200 g of beef and 100 g of barley",
  "ground_truth": "Amounts the person gave are sent with gramsStated true and come back with assumedGrams false.",
  "expect": { "toolsCalled": ["cost_dish"], "verified": true, "assumedRecipe": true, "statedGramsKept": true },
  "judge": "mechanical", "tags": ["cost-dish"] }
{ "id": "D4", "dimension": "honest", "query": "A slice of grandma's cholent with zzzqx and two eggs",
  "ground_truth": "An ingredient nobody can find is named as not counted and the answer is partial, never a fit.",
  "expect": { "toolsCalled": ["cost_dish"], "verified": true, "assumedRecipe": true, "noPlainFitsOnAssumed": true },
  "judge": "mechanical", "tags": ["cost-dish"] }
{ "id": "D5", "dimension": "honest", "query": "A bar of Zebra Cakes",
  "ground_truth": "A single food, not a dish: named as unknown, left out, asked about. cost_dish is not called.",
  "expect": { "toolsCalled": ["resolve_foods"], "noCostDish": true, "verified": true },
  "judge": "mechanical", "tags": ["cost-dish"] }
```

(D5 may need a different invented single food if the resolver finds one; choose one the resolver
returns `unknown: true` for, as for `cholent`.)

## New mechanical checks (`eval/run-cases.ts`, in `check()`)

Gating (read tool results; safety):
- `assumedRecipe`: the last `cost_dish` result has `assumed === true`, and **its input** has, for every
  ingredient, no key outside `phrase`, `grams`, `gramsStated`.
- `statedGramsKept`: an ingredient whose grams the person stated has `assumedGrams === false` in the
  result.
- `noCostDish`: no `cost_dish` call in the trace.
- `noPlainFitsOnAssumed`: when the result has `assumed: true`, remove sentences that contain "if" or
  "can't judge" from the answer, and require that what remains does not say `fits` or `within budget`
  (the same shape as the existing `claims no fit`).

Wording (use `style(...)`, not gating): the answer says it was counted from a typical recipe; the
answer names every `unresolved` entry.

## Documents to change in the same change

- **`CLAUDE.md` rule 3**, replace with: *"A food the database lacks never enters the arithmetic under a
  neighbour's name. It comes back `unknown` and the agent says so. Partial meals are costed without it
  and labelled partial, and may never be called 'fits'. One exception, narrow and its own tool: a
  prepared **dish** the database lacks may be counted through `cost_dish`, as its own ingredients, each
  in the database, labelled as an assumed recipe (`assumed: true`); an ingredient the database lacks is
  left out and named; and an assumed-recipe answer is an estimate, never a plain 'fits'."*
- **`docs/PRD.md`**: where requirement C7 says an unknown food is "named, not guessed", add that a
  dish may be counted from typical ingredients as a labelled estimate (and say it has no clinician
  review).
- **`docs/specs/weekly-menu-v1.md`**: a short section "A dish we do not have", dated.
- **`docs/security/security-plan.md`**: `cost_dish` is a key-protected tool route with bounded input.

## Rollout checks (live, after deploy and republish)

`POST /tools/cost_dish` with a stored recipe's ingredients returns its stored load within 0.1; `npm run
eval`, `eval:abuse`, `eval:agent` as before; one real turn by hand for "a slice of grandma's cholent".

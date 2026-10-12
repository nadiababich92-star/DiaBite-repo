# Spec: the meal agent and `cost_dish`

*From `docs/engineering/engineering-doc.md` section 7. Build after `cost-dish-engine.md`.*

## The OpenAPI operation (`server/openapi.ts`)

```ts
'/tools/cost_dish': {
  post: {
    operationId: 'cost_dish',
    summary: 'Count a dish the database does not have, from its typical ingredients',
    description:
      'Use ONLY for a prepared dish that resolve_foods returned as unknown, never for a single food. ' +
      'Give the dish exactly as the person named it, and its typical ingredients as plain names with the ' +
      'weight in grams of each for ONE portion. The engine finds each ingredient in the database and ' +
      'counts the ones it finds; the others come back in `unresolved` and must be named to the person. ' +
      'You supply words and portion weights only: never a nutrition value, which the engine computes. ' +
      'Set `gramsStated: true` on an ingredient only when the person gave that amount. ' +
      'The result always has `assumed: true`: it is an estimate from a typical recipe, not a record of the meal.',
    requestBody: { required: true, content: { 'application/json': { schema: {
      type: 'object', required: ['dish', 'ingredients'],
      properties: {
        sessionId: { type: 'string', description: 'The session id you were given, passed through unchanged.' },
        dish: { type: 'string', description: 'The dish as the person named it, the same text you sent to resolve_foods.' },
        ingredients: { type: 'array', minItems: 1, maxItems: 20, items: {
          type: 'object', required: ['phrase', 'grams'], additionalProperties: false,
          properties: {
            phrase: { type: 'string', description: 'A plain ingredient name, for example "beef chuck".' },
            grams: { type: 'number', description: 'Weight of this ingredient in one portion, in grams.' },
            gramsStated: { type: 'boolean', description: 'True only when the person gave this amount.' },
          } } },
      } } } } },
    responses: { '200': { description:
      'Everything compute_meal returns, plus `assumed: true`, `dish`, `ingredients` (what was counted, with ' +
      '`assumedGrams`), and `unresolved` (what was not counted and why). `afterMeal.fits` is the engine’s ' +
      'comparison; with `assumed: true` it is conditional. On a wrong call the body has an `error` to read and fix.' } },
  },
},
```

`agent/provision.ts` publishes whatever `openApiSpec()` returns, so no change there beyond the spec.

## The prompt (`agent/prompts/meal.md`)

Insert after the paragraph "A food with no glycemic index…" and before "Before you answer, count:". Say
"and also", not "instead of": nothing above is removed or loosened (rule 8).

```markdown
**A dish we do not have** is a prepared meal (cholent, shepherd's pie as someone's grandmother made it,
"the chicken thing from the place downstairs") for which `resolve_foods` returned `unknown: true`. A
single food the database lacks is not a dish: it is named, left out and asked about, exactly as before.
Telling them apart: "a slice of grandma's cholent", "my mom's stuffed cabbage" and "pad thai from the
place downstairs" are dishes; "dragon fruit", "a Zebra Cake" and "schmaltz" are single foods.

For a dish, do not stop at "I don't have it". Count it from its typical ingredients:
1. If the person listed what is in it, use their words. If not, propose a typical list from what you
   know: at most 10 ingredients, plain names ("beef chuck", "pearl barley", "kidney beans", "onion"),
   and for each the weight in grams for **one** portion. These weights are an assumption, not a fact.
2. Call `cost_dish` with the dish exactly as named, the ingredients and the session id. Put
   `gramsStated: true` only on an amount the person gave. Never put a calorie, carbohydrate or load in
   the call: the tool refuses it and the engine computes them.
3. `cost_dish` always returns `assumed: true`. Write the answer as an estimate:
   - The verdict is never a plain "fits". Say "If yours is like this, it fits what is left of today's
     budget" or "If yours is like this, it does not fit", from `afterMeal.fits`. If `fits` is `null`
     (something was left out), say "I can't judge the day on this" and name what was not counted.
   - Say once, in the Why line, that it was counted from a typical recipe and that the person should
     change anything that is not theirs; the card on screen lets them.
   - Name every entry in `unresolved` as not counted and ask what it is.
4. Give only numbers `cost_dish` returned. The weights in `ingredients[].grams` are quotable (they came
   back in the result); no other figure is.

If `cost_dish` answers with an `error`, read it and correct the call, or, when nothing could be found,
say so and ask what is in the dish. Never fall back to costing a similar-sounding recipe under its name.
```

The Verdict line in "Answer format" already allows a conditional sentence; add one clause to its end:
*"For `assumed: true` the verdict is conditional ('If yours is like this, …') and never a plain 'fits'."*

## The last-resort answer (`server/agent.ts`, `templatedAnswer`)

`templatedAnswer` reads `lastCall(trace, 'compute_meal')`. Change it to read the later of
`compute_meal` and `cost_dish` in the trace, and when the result has `assumed: true`:

- the verdict line is `**Verdict:** If your dish is like this, it fits what is left of today's budget.` or
  `…it does not fit…` from `afterMeal.fits`, or `**Verdict:** I can't judge the day on this: <names> is not counted.`
  when `fits` is `null` or `unresolved` is non-empty;
- add `**Numbers:** this estimate's glycemic load is <gl>.` and a last line
  `_Counted from a typical recipe; change anything that is not yours._`
- never the plain `**Verdict:** it fits what is left of today's budget.`

## Publishing (rules 8 and 11)

After the prompt and spec change: `npx tsx agent/provision.ts` with `MODEL_MEAL` and
`MODEL_DEPLOYMENT_NAME` **unset** and only `PROJECT_ENDPOINT`, `PUBLIC_URL`, `ENGINE_CONNECTION_ID` set;
read each agent's model back with `GET <project>/agents/<name>?api-version=v1`; run
`npm run eval:agent` against the live service.

## Verifiable

Read tool results: `cost_dish` was called, with `dish` and every `ingredients[i]` having only
`phrase`, `grams`, `gramsStated`; the result has `assumed: true`; the answer's verdict is not a plain
"fits" (the gate reads `assumed` from the result and the verdict sentence from the prose). Cases are in
`cost-dish-evals.md`.

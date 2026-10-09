# Spec: branded foods, the answer a person sees

*Read with `branded-foods-engine.md`. Applies `docs/design.md`.*

## The answer

A branded-only meal is its own kind of answer, not a dressed-up verdict. Order: label, plain sentence, the figures, a reason, a next step.

| Part | Exact copy |
|---|---|
| Status disc and label | `i` · **Carbs only** (uppercase eyebrow, the `ask` tone: accent colour, never green "Fits") |
| Sentence (serif, large) | "I can give you the carbohydrate, not the load." |
| Figures | three tiles: **this item** `<carbs> g` · **fibre** `<fibre> g` · **calories** `<kcal>`; the third tile is neutral, never green or red |
| Reason | "<Brand name> has no published glycemic index, so DiaBite does not estimate one. <carbs> g of carbohydrate in <serving label> is what the label says." |
| Next | "If you tell me what you ate it with, I can cost the rest of the meal." |
| Receipt | the food line shows `GL —`; the footer says "No glycemic index is published for packaged products." |
| "Log it" | "Log what was counted" |

A meal with branded items **and** scored foods uses the partial-meal card that exists today ("One question first" is wrong here, so its label becomes "Part of the meal"): the sentence "I can't judge the day on a partial total", the three figures with the last tile "left so far", and the receipt line "Not scored: <names> (no glycemic index)". `AskPage.tsx` derives this from `afterMeal.partial`, never from the prose.

## `src/components/AskPage.tsx` / `src/lib/answer.ts`

- `verdictTone()`: `afterMeal.partial.unscored` non-empty and `fits === null` → tone `carbs`; new status label map entry `carbs: 'Carbs only'` when every costed item is unscored, `partial: 'Part of the meal'` otherwise.
- `Figures`: when every item is unscored, show the carbs/fibre/calories tiles from `compute_meal` items instead of the day tiles.
- `Receipt` type: `partial?: string[]` (already) and `unscored?: string[]`; `ReceiptLine.gl: number | null`, rendered as `—`.
- New CSS: `.tone-carbs` reuses `--accent`; no new colour (design.md: one token per meaning).
- States to look at: branded only; branded plus scored; branded plus an unknown food; dark mode; 375 px.

## The prompt (`agent/prompts/meal.md`)

Add one paragraph after the partial-total rule, in the "and also" form: "**A branded item** (`kind: branded`, `loadAvailable: false`) carries carbohydrate, fibre and calories and no glycemic load. Give those figures in plain words, say once that no glycemic index is published for packaged products, and follow the partial-total rule for the verdict: the word *fits* does not appear. Do not offer a similar unbranded food as if it were the product, and do not estimate a load." Re-provision, then run the agent evals.

## Verifiable

- Screens: the three states above, light and dark, 375 px, read in the browser against the live service.
- Agent cases H15 to H18 as specified in the engine spec, with `verified: true`.
- `npm run eval` `answer` section gains two cases: the parser reads a "Carbs only" labelled answer and an unlabelled one, as it does for verdicts.

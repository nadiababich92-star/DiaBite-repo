# Spec: the estimate card (frontend)

*From `docs/engineering/engineering-doc.md` section 5. Build after the engine tool. Apply
`/design-system`: every colour, size and spacing comes from `docs/design.md`; nothing new is invented.*

## What the person sees

For a dish counted from an assumed recipe the answer card is an **estimate**, not a verdict.

| Element | Spec |
|---|---|
| Badge | Neutral, text "Estimate", same token pair as the "Part of the meal" state (`tone-partial`). Never green, never "Fits" |
| Headline | The agent's sentence, conditional: "If yours is like this, it fits your day." |
| Receipt note, above the lines | "Counted as a typical **{dish}**. Change anything that isn't yours." |
| Each assumed line | A text pill **assumed** after the name (text, not only colour); lines whose grams the person stated have no pill |
| Receipt footer, one extra sentence | "This dish is not in our database, so it is an estimate from typical ingredients, not a record of your meal." |
| Not counted | The existing "Not counted: x, y" line, from `afterMeal.partial.unknownFoods` |

## The composition card

Reuses `PortionEditor` (`src/components/AskPage.tsx`) and `/meal/recompute`.

- Each line: name, grams (the existing stepper and typed input, `gramStep`/`nudgeGrams`), and a **remove**
  button (icon, `aria-label="Remove {name}"`, 44 px target). Remove is offered **only** when
  `receipt.assumed` is set.
- A "Reset to the suggestion" text button restores the agent's list and grams (kept in state when the
  answer arrives).
- Any change sends the current items to `POST /meal/recompute` (no model, same sign-in wall and
  per-address limit). The result is shown in the existing `RecalcCard`.
- **The estimate state survives a recalculation:** `recomputeMeal` keeps `assumed` from the receipt (the
  recompute endpoint does not know it), so the recalculated card still says "Estimate" and its
  headline is "If it's like this, …". Never a plain "Fits" while `assumed`.
- If every ingredient is removed, show the existing empty/unknown state, not a zero.

## Code changes

- `src/lib/agent.ts`:
  - `Receipt` gains `assumed?: { dish: string; assumedFoodIds: string[] }`.
  - `receiptFrom` reads the **later** of the last `compute_meal` and the last `cost_dish` in the trace
    (both have `items`, `totals`, `dayState`, `afterMeal`); for `cost_dish` it sets `assumed` from
    `dish` and `ingredients[].assumedGrams`.
  - `Recalc` gains `assumed?: boolean`; `recomputeMeal(sessionId, items, assumed)` copies it through.
- `src/components/AskPage.tsx`:
  - `verdictTone`: if the last tool result is a `cost_dish` with `assumed`, return the new tone
    `'estimate'` **before** every other tone. Badge label for it: `Estimate`. Icon: the info mark used
    by `advice` and `carbs`.
  - `ReceiptView`: the note, the **assumed** pills, the footer sentence (strings above).
  - `PortionEditor`: the remove button and the reset button, both gated on `receipt.assumed`.
  - `RecalcCard`: tone `'estimate'` when `rc.assumed`, label `Estimate`, headline
    "If it's like this: {engine verdict}" (`fits` true: "it fits"; false: "it does not fit"; null:
    "I can't judge the day on this").
  - `logIt`: build the diary entries from the receipt lines as today and add `assumed: true` to each
    snapshot when `receipt.assumed`.
- `src/lib/diary.ts`: the snapshot type gains optional `assumed?: boolean`.
- `src/components/DiaryPage.tsx`: a small chip "from an assumed recipe" on a row whose snapshot has it.
- `src/styles.css`: add `.tone-estimate .eyebrow-line` to the selector list at the existing line
  `.tone-ask .eyebrow-line, .tone-carbs …, .tone-partial …`, and `.dot-estimate` to
  `.dot-ask, .dot-carbs, .dot-partial`; one rule for `.pill.assumed` using the existing neutral pill
  tokens. **No new colour, no new size.**

## States

Loading, error, unknown and partial are unchanged. New: **estimate** (this spec) and **estimate, edited**
(after a recalculation). Phone layout at 375 px is a single column; targets 44 px; text never below 13 px.

## Verifiable (the screen to look at)

1. `npm run screens`, then ask "A slice of grandma's cholent" signed in; look at 390 and 1366 px: badge
   "Estimate", the note, the pills, remove and reset, no horizontal scroll.
2. Remove an ingredient and change a gram: the numbers change, the badge stays "Estimate".
3. Log it; the Diary shows one row per ingredient, each with "from an assumed recipe".
4. Engine-side checks that read the result, never the screen text, are in `cost-dish-evals.md`.

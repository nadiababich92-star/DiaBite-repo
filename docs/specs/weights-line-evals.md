# Spec: checks, order of work and rollout for the weights line (tracker #75)

*Companion to `weights-line-screen.md`. From `docs/engineering/weights-first-answer.md`, approved 25 November 2026. No migration, no new environment variable, no agent case: the agent and the engine do not change.*

## 1. Engine suite (`npm run eval`, `eval/run-engine.ts`, pure)

Add to the existing **tour** block (it imports `allCopy, allSteps, copyFor, initialSeen, markSeen, nextStep, sanitizeSeen, STEP_ORDER`):

- `ctx()` gains `hasAssumedWeight: false` in its defaults; `meal` (the receipt context) is built with `hasAssumedWeight: true`.
- **Order with an assumed weight:** walking `nextStep` from `['input']` on `meal` five times gives `verdict,weights,calc,log,` (the existing loop runs four times and expects `verdict,calc,log,`: change both).
- **Skip without one:** `nextStep(['input','verdict'], { ...meal, hasAssumedWeight: false })` is `calc`; with `['input','verdict','calc','log']` it is `null`.
- **Offered late:** `nextStep(['input','verdict','calc','log'], meal)` is `weights`.
- **Out of order:** `nextStep(['input','weights'], meal)` is `verdict`.
- **Copy:** `copyFor('weights', { assumed: false }).title === 'Check the weights'`, button `Next`; the existing `allCopy()` loop already fails on a digit.
- **Skip tips:** the existing check that `allSteps()` equals `STEP_ORDER` and that nothing is offered after it covers the new step.
- **initialSeen:** a returning person still gets `allSteps()` (now five), unchanged check.

Add a **weights line** block:

- `AGENT_WEIGHTS_LINE` (from `src/lib/answer.ts`) matches `Weights I used: rice 1 cup (158 g).` and `**Weights I used:** …`, and does not match `Not counted: a few strawberries.` or `Why: the rice carries most of the load.`
- The tail filter: given an answer text with a Why, a Next action, a "Weights I used" line and a "Not counted" line, the lines `Answer` would print as tail, computed with the same filter as the component, keep "Not counted" and drop "Weights I used" when an engine line is given, and keep both when it is not. To test it without React, export the filter from `src/lib/answer.ts` as `tailLines(text: string, used: string[], engineWeights: boolean): string[]` and have `Answer` call it.
- `WEIGHTS_WHY` (from `src/components/WeightEditor.tsx`, or moved to `src/lib/answer.ts` if importing a component file into the suite is awkward) equals the owner's sentence exactly and holds no digit.

**Mutations, each must fail the suite:** put `weights` after `log` in `STEP_ORDER`; drop the `hasAssumedWeight` skip; return `l` unfiltered in `tailLines`; change one word of `WEIGHTS_WHY`.

## 2. Screen rehearsal (`eval/screens.mjs`)

The script already asks a meal question and reads the answer card at each size. Add, on the first answer (which has assumed weights: "Rice and beans with chicken" or the script's existing question if its receipt has a non-`stated` line; assert that precondition from the trace and fail loudly if not):

- **One line, from the engine:** inside `.card.answer`, exactly one element whose text starts with `Weights I used`, and it is `.weights-used` inside `[data-tour="weights"]`, with at least one `button.weight-btn`.
- **The sentence:** `.weights-why` text equals `WEIGHTS_WHY`.
- **No duplicate:** no `.a-tail` element whose text starts with `Weights I used`.
- **The button works:** clicking the first weight button opens `.card.portions` and a weight field there has focus (`document.activeElement` inside `.portions`).
- **Every weight given:** a second question with grams for every part ("200 g of rice and 150 g of black beans") shows no `.weights-used` and no `.weights-why`.

With `TOUR=1` (the script's tour pass), on the first receipt the tips come in the order `Here is the verdict`, `Check the weights`, `Check the arithmetic`, `Keep it in your Diary`, the weights tip's ring is on `[data-tour="weights"]`, and its text holds no digit. The existing tip loop shoots each; extend its expected titles.

Every script that marks the tips as seen gets `'weights'` in its list (`weights-line-screen.md` 2.5), or the new tip covers what it clicks. Run `npm run rehearsal` after that change, before the deploy.

## 3. Order of work

1. `src/lib/tour.ts` and its suite cases; `npm run eval` green; mutations.
2. `src/lib/answer.ts` (`AGENT_WEIGHTS_LINE`, `tailLines`), `WeightsUsed` (`WEIGHTS_WHY`, block, anchor), `Answer` (`weightsUsed`), the two `TourContext` sites, `src/styles.css`, `docs/design.md`; suite cases; mutations.
3. The tour-seen lists in the scripts (2.5 of the screen spec); message the session that owns `eval/deck-screens.mjs`.
4. `npx tsc --noEmit`, `npm run build`, `npm run eval`, `npm run eval:abuse`.
5. Local look: `npm run dev`, 375 px and laptop, light and dark: an assumed-weight answer, an all-grams answer, an assumed recipe (a slice of cholent), the tip with `localStorage` cleared of `diabite.tour.v1`.
6. One commit; `git push origin HEAD:main` (main only: rule 9); `npm run deploy`.
7. Live: `APP=https://diabite.pro npm run screens` (both sizes) and `TOUR=1`, `npm run rehearsal`, `npm run smoke`; `ENGINE_API_KEY=… AGENT_URL=https://diabite.pro/agent/ask npm run eval:agent` (no agent change, run because the card changes how its text is shown; save and restore `eval/foundry-dataset-answered.jsonl`, another session's file).
8. Screenshots at 375 px of the answer with the line and of the tip, to the owner.

## 4. Rollback

The previous revision (`az containerapp update … --image …:<previous sha>`, printed by `npm run deploy` on failure). Nothing stored changes; a browser that saw the `weights` tip keeps `weights` in its seen list, which the previous build's `sanitizeSeen` drops harmlessly.

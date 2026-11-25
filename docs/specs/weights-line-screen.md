# Spec: the weights line on every meal answer, explained (tracker #75, screen)

*From `docs/engineering/weights-first-answer.md`, approved by the owner on 25 November 2026 with the copy of its section 12. Self-contained: build from this file and `weights-line-evals.md`.*

**No migration, no new environment variable, no engine or agent change.** Everything here is in `src/` and `docs/design.md`.

## 1. What changes for the person

On a meal answer where at least one weight was assumed (the engine's receipt line has `basis` other than `stated` and a `said`), the card shows, in the place the agent's "Weights I used" line has today (under the reason, the next step and the swap row):

```
Weights I used: [white rice 1 cup (158 g)], [black beans ½ cup (86 g)], [chicken breast 4 oz (113 g)].
These weights decide the numbers. They are typical portions, not yours: tap one if you ate more or less.
```

Each bracketed weight is a button that opens that food's weight field in the portion editor. The agent's own "Weights I used" sentence is not printed a second time. On an answer where every weight was the person's, neither line is shown. The first time such an answer appears, a tip rings the line.

## 2. Files

### 2.1 `src/components/WeightEditor.tsx` — `WeightsUsed`

- Wrap the returned content so the line and the sentence sit together and carry the tip anchor:

```tsx
return (
  <div className="weights-used-block" data-tour="weights">
    <p className="a-why weights-used">…unchanged: "Weights I used:" and the buttons…</p>
    <p className="muted weights-why">{WEIGHTS_WHY}</p>
  </div>
)
```

- Export the sentence as a constant so checks read the same string:

```ts
/** Under the weights line, always (owner's wording B, 25 November 2026; "below" removed because the line sits under the figures). */
export const WEIGHTS_WHY = 'These weights decide the numbers. They are typical portions, not yours: tap one if you ate more or less.'
```

- Unchanged: `assumed = lines.filter(({ line }) => line.basis && line.basis !== 'stated' && line.said)`; when it is empty the component returns `null`, so the sentence never appears alone. The button label stays `Change the weight of ${line.name}, now ${line.said}`.
- The recalculated card (`RecalcCard`, `weightsUsed` prop) gets the sentence and the anchor too, since it renders the same component. Only one `[data-tour="weights"]` is on screen at a time in practice (the recalculated card replaces the original's place in the reading order; the tip anchors to the first match, which is the one on top).

### 2.2 `src/components/AskPage.tsx` — `Answer`

- New optional prop: `weightsUsed?: React.ReactNode`.
- In the labelled branch (`if (parts)`), render it after the swap block and before the tail:

```tsx
{weightsUsed}
{tail.map(…)}
```

- When `weightsUsed` is given, drop the agent's weights line from the tail:

```ts
const AGENT_WEIGHTS = /^\*{0,2}weights i used\b/i
const tail = text.split(/\n+/).map((l) => l.trim())
  .filter((l) => l && !isLabelled(l) && !parts.used.includes(l))
  .filter((l) => !(weightsUsed && AGENT_WEIGHTS.test(l)))
```

  "Not counted: …" lines are kept. Without `weightsUsed` (no receipt, or carbohydrate-only) the tail is exactly as today.
- Move the regex next to `NOT_A_PART` in `src/lib/answer.ts` as an export, `AGENT_WEIGHTS_LINE`, and use it here, so the check in `weights-line-evals.md` imports one definition.
- The original card passes the engine line:

```tsx
<Answer … weightsUsed={receipt && !receipt.carbsOnly
  ? <WeightsUsed lines={baseLines.map((line, index) => ({ line, index }))} onEdit={editWeight} />
  : undefined} />
```

  `editWeight(i)` already opens the editor with field `i` and scrolls it into view.
- The unlabelled branch (plain paragraphs: a question, a refusal) is untouched.

### 2.3 `src/lib/tour.ts`

- `export type TourStep = 'input' | 'verdict' | 'weights' | 'calc' | 'log'`
- `export const STEP_ORDER: readonly TourStep[] = ['input', 'verdict', 'weights', 'calc', 'log']`
- `TourContext` gains:

```ts
/** The receipt has at least one weight the person did not give (the weights line is on screen). */
hasAssumedWeight: boolean
```

- `nextStep`: for `weights`, when `!ctx.hasAssumedWeight`, `continue` (leave it unseen and offer the next step); otherwise return it when there is a receipt. The other steps keep their rules. Result: on a receipt with assumed weights the order is verdict, weights, calc, log; on one without, verdict, calc, log, and `weights` is offered on a later answer that has one, even after `calc` and `log` were seen.
- `COPY.weights`:

```ts
weights: {
  title: 'Check the weights',
  body: "When you don't give a weight, DiaBite uses a typical portion and names it here. If you ate more or less, tap the weight and the numbers are counted again.",
  button: 'Next',
},
```

- `allCopy()`, `allSteps()`, `markSeen`, `sanitizeSeen`, `initialSeen` need no change beyond `STEP_ORDER` (they read it). A stored list from an older build lacks `weights`, so a person who finished the old tour sees this one tip once, on their next answer with an assumed weight. That is intended.

### 2.4 `src/components/AskPage.tsx` — the tour context

Both places that build a `TourContext` (the `tipShowing` computation and the `<Tour ctx={…} />` props) add:

```ts
hasAssumedWeight: !!receipt && !receipt.carbsOnly && receipt.lines.some((l) => !!l.basis && l.basis !== 'stated' && !!l.said),
```

### 2.5 Every script that marks the tour as seen

The checks open the app with the tips marked seen so no tip covers what they click. Add `'weights'` to each literal list `['input','verdict','calc','log']`:

- `eval/rehearsal.mjs`, `eval/screens.mjs`, `eval/a11y.mjs`, `eval/a11y-tree.mjs`
- `scripts/demo-video/record.mjs`, `scripts/demo-video/two-rhythms/capture.mjs`
- `eval/deck-screens.mjs` holds another session's uncommitted work: do not edit it; tell that session to add `'weights'`.

### 2.6 `src/styles.css`

One rule, tokens only:

```css
/* The sentence under the weights line (docs/design.md, Portions). */
.weights-why { margin: 2px 0 0; font-size: 14px; }
```

`.muted` gives the colour (`--text-dim`). No new token.

### 2.7 `docs/design.md`

- In the paragraph that begins "The weight on a portion row is a button…", add after "When none is left the line is not shown.": *"The same line, built from the engine, stands on the first answer as well, in place of the agent's sentence, with one sentence under it in muted text: "These weights decide the numbers. They are typical portions, not yours: tap one if you ate more or less." (25 November 2026, tracker #75.)"*
- In the tips paragraph ("A **tip** is a small card…"), change "at the verdict, at Show calculation and at the log button" to "at the verdict, at the weights line (only on an answer with a weight the person did not give), at Show calculation and at the log button".

## 3. States

| State | Weights line | Sentence | Tip |
|---|---|---|---|
| Meal, some weights assumed | engine line, buttons | shown | `weights` once, after `verdict` |
| Meal, every weight given (`basis: stated`) | none | none | not offered; waits |
| Partial meal (a food left out) | the counted lines' assumed weights | shown | as above |
| Assumed recipe (`cost_dish`) | the recipe lines with a `said` | shown | as above |
| Carbohydrate-only receipt | none (no editor for it) | none | not offered |
| Question, refusal, advice | none | none | none |
| Recalculated card | engine line (as today) | shown | not re-offered |
| Signed-out visitor | as a signed-in person | shown | none (no tour for visitors) |

## 4. Layout and accessibility

- 375 px: the line wraps; buttons keep 44 px through padding (`.weight-btn-inline`, unchanged). The sentence wraps under it.
- Screen readers: "Weights I used:", each button by its label, then the sentence, in reading order. The tip is non-modal and takes no focus (unchanged `Tour`).
- Colour: none new; the sentence is `--text-dim` on the card, AA in both looks (the same pairing the card already uses).

## 5. Done when

The checks in `weights-line-evals.md` pass, and on the live site an answer to "Rice and beans with chicken" shows one "Weights I used" line with buttons and the sentence under it, at 375 px and on a laptop, in both looks, with no second weights line.

# Engineering plan: the weights line, explained (tracker #75, competitive plan A3)

*Stage 1, 25 November 2026. A separate file: `docs/engineering/engineering-doc.md` holds another session's uncommitted work. **Decided** marks the owner's answers of 25 November. Nothing here is built yet.*

## 1. Summary

**The problem.** When a person gives no weight, the engine uses a typical portion and the answer names it: "Weights I used: white rice 1 cup (158 g, USDA's typical size), …". That line is the honest core of the product (`docs/PRD-product.md`, the one promise: every number computed; `docs/COMPETITIVE-PLAN.md` item 3 and item 12, "traceable, not accurate"). Today it is easy to miss and does not say why it matters:

- on the first answer it is the **agent's sentence**, printed as a plain tail line under the next step (`src/components/AskPage.tsx` `Answer`, the `tail`); it is not tappable there;
- only the **recalculated** card builds it from the engine (`WeightsUsed` in `src/components/WeightEditor.tsx`), with each weight a button that opens the weight field;
- nothing tells a newcomer that these weights decide the numbers, and that they are typical portions, not theirs.

**The change.**
1. On every meal answer, the "Weights I used" line is built from the engine's receipt (`basis`, `said`), each weight a button, in the place the line has today; the agent's own copy of that line is not printed a second time. **Decided: from the engine.**
2. Under it, always, one sentence of why (**Decided: always**, wording **B**, see 12.1).
3. A new first-run tip points at that line the first time an answer carries an assumed weight (**Decided: in place, plus a tour tip**).

**Measured by:** in the screen rehearsal, on an answer with an assumed weight, the line is present, built from the receipt, each weight a button that opens its field, the why sentence under it, and no second "Weights I used" line; on an answer where every weight was given, neither is shown; the tip appears once, in order, and never with a figure. In user sessions: share of first answers where the person corrects a weight (today not measured; the tip makes it observable in the turn log as a `/meal/recompute` after a first answer).

## 2. Scope

**In:** the original answer card (the recalculated card already has the engine line); the why sentence on both cards; one tour step; checks.

**Out:** moving the line above the figures (the owner chose its current place); any change to how weights are chosen (`server/quantity.ts`); the agent prompt (the Weights rule in `agent/prompts/meal.md` stays, as a fallback when the receipt carries no `basis`); the advisor; the menu and diary.

**Later:** counting how often a first answer's weight is corrected (a turn-log field), once user sessions start.

## 3. User flows

```
"Rice and beans with chicken"  (no weights)
  → /agent/ask → meal agent → resolve_foods → compute_meal (each item basis: typical | default | measure, said: "1 cup (158 g, USDA's typical size)")
  → verifier (unchanged) → reply with trace
  → Answer card: verdict · figures · Why · Next · [Weights I used: white rice 1 cup (158 g) · black beans ½ cup (86 g) · chicken breast 4 oz (113 g).]   ← engine, buttons
                                                  These weights decide the numbers. They are typical portions, not yours: tap one if you ate more or less.
                                                  (agent's own "Weights I used" tail line: not printed)
  → first time an answer carries an assumed weight: tip "weights" rings the line (after "verdict", before "calc")
  → tap a weight → the portion editor opens with that weight's field (editWeight, existing) → engine counts again (/meal/recompute, existing)

"200 g of rice and 150 g of beans"  (every weight given, basis: stated)
  → no Weights line, no why sentence, the weights tip not offered (it waits for an answer that has one)
```

## 4. The promise check

The feature shows **no new number**. The weights in the line are the engine's `said` and `grams` from the `compute_meal` / `cost_dish` result already carried in the reply's trace (the same receipt lines `WeightsUsed` reads on the recalculated card). The why sentence and the tip carry no figure (the tour's existing check, `allCopy()` has no digit, covers the new copy). The agent's weights sentence is still in the answer text the verifier checks; it is only not displayed when the engine line is. Nothing is parsed out of the agent's prose to build the line (CLAUDE.md rule 7).

## 5. Frontend

**`src/components/AskPage.tsx`, `Answer`.** Gains a `weightsUsed?: React.ReactNode` prop, rendered where the tail line is today (after Next and the swap row). When it is given, tail lines matching `NOT_A_PART`'s weights form (`/^\*{0,2}weights i used\b/i`, already in `src/lib/answer.ts`) are dropped from the tail, so the line appears once. "Not counted: …" lines stay as they are. The original card passes `<WeightsUsed lines={baseLines.map((line, index) => ({ line, index }))} onEdit={editWeight} />` when there is a receipt that is not `carbsOnly`.

**`src/components/WeightEditor.tsx`, `WeightsUsed`.** Adds the why sentence after the list, as its own `<p className="muted weights-why">` (both cards get it). Exact text in 12.1. When no weight is assumed the component returns null, as now, so the sentence never shows alone. The wrapper gets `data-tour="weights"` for the tip ring.

**`src/lib/tour.ts`.** A new step `weights` in `STEP_ORDER` after `verdict`: `['input', 'verdict', 'weights', 'calc', 'log']`. `TourContext` gains `hasAssumedWeight: boolean`. `nextStep` skips `weights` (leaves it unseen, offers the next step) when the receipt has no assumed weight, and offers it on a later answer that has one. Copy in 12.2. A person who already finished the tour sees only this tip, once, on their next answer with an assumed weight (the seen list is in `localStorage`, unchanged mechanism).

**States.** Loading: nothing new. Unknown food / partial meal: the line lists the assumed weights of what was counted (the receipt lines), as the recalculated card does today. Assumed recipe (`cost_dish`): the receipt lines carry their `said`; the line shows them, and the why sentence still reads true. Carbohydrate-only items: shown like any line with an assumed weight. Signed-out visitor: same line and sentence; the tip is not shown to visitors (as today, `{!anonymous && <Tour …/>}`).

**Phone, 375 px.** The line wraps as it does on the recalculated card; buttons keep their 44 px target through padding (existing `.weight-btn-inline`). **Accessibility:** each weight button keeps its label "Change the weight of white rice, now 1 cup (158 g)"; the sentence is plain text after the buttons, read in order. **Design:** no new token; `.muted` and the existing weights styles (`docs/design.md`, "The weight on a portion row is a button…"); `docs/design.md` gets one sentence in that paragraph saying the line is on the first answer too, with the why sentence, and the tips paragraph names the fourth tip.

## 6. Engine and API

None. The receipt lines already carry `basis` and `said` (`server/compute.ts`, `server/contract.ts`), and the browser already reads them for the recalculated card.

## 7. Agents

None. The meal prompt keeps its Weights rule: it is the fallback when a receipt has no `basis` (an older trace), and the verifier still checks the sentence's numbers. No provision, no agent eval run required by rule 8; `eval:agent` runs anyway in Stage 5 because the answer card changes how the agent's text is displayed.

## 8. Data

No table, no column, no migration. The tour's seen list in `localStorage` gains one possible value, `weights`. Nothing new about a person leaves the device.

## 9. Safety and responsible AI

The rules gate is untouched. The risk this lowers: a person reading a number computed for a portion they did not eat. The risk this adds: none to the numbers; the sentence must not imply the typical portion is a recommendation ("typical portions, not yours" says the opposite). The words are product copy, not clinical advice; they go to the clinician list only as part of the general copy review (`docs/CLINICAL_REVIEW.md`), not as a question.

## 10. Evaluation plan (in the same change)

**Engine suite (`npm run eval`, pure):**
- `tour.ts`: the order is input, verdict, weights, calc, log; with `hasAssumedWeight: false` the weights step is skipped and `calc` is offered; on a later answer with an assumed weight, `weights` is offered even after `calc` and `log` were seen; the new copy has no digit (`allCopy`).
- `answer.ts` / `Answer` tail: given the engine line, the agent's "Weights I used" tail line is dropped and a "Not counted" line is kept.
- Mutations: put `weights` back after `log`, drop the skip, drop the tail filter: a case fails each time.

**Screen rehearsal (`eval/screens.mjs`, live or local):**
- an answer with an assumed weight: exactly one element whose text starts "Weights I used", inside `.weights-used`, with at least one `button.weight-btn`; the why sentence present; tapping the first weight opens the portion editor with that weight's field focused;
- an answer with every weight stated: no `.weights-used`, no why sentence;
- the weights tip appears after the verdict tip, rings `[data-tour="weights"]`, and carries no digit.

**Agent (`npm run eval:agent`):** no new case; the existing cases that read `items[].basis` stay green.

## 11. Rollout

One commit (tour step, `Answer` prop and tail filter, `WeightsUsed` sentence, `docs/design.md` sentences, checks), deployed with `npm run deploy` (the image is built from `src/`). Checked on the live site: the rehearsal steps above against `https://diabite.pro`, a screenshot at 375 px and desktop, light and dark. **Rollback:** the previous revision; nothing stored changes.

## 12. Open questions for the owner

**12.1 The why sentence (Decided: wording B), one word to confirm.** B reads "These weights decide the numbers **below**." The line sits **under** the figures, so "below" would point the wrong way. Proposed, otherwise unchanged: **"These weights decide the numbers. They are typical portions, not yours: tap one if you ate more or less."**

**12.2 The tip's words (new copy, no figure).** Proposed: title **"Check the weights"**, body **"When you don't give a weight, DiaBite uses a typical portion and names it here. If you ate more or less, tap the weight and the numbers are counted again."**, button **Next**.

**Decided by the owner on 25 November 2026:** always shown with its sentence; in its current place, plus a tour tip; built from the engine's data, the agent's line not repeated.

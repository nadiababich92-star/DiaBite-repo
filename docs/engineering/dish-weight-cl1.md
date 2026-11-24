# Engineering plan: the weight of a whole dish, applied by the engine (CL1)

*Stage 1, 24 November 2026. A separate file: `docs/engineering/engineering-doc.md` holds another session's uncommitted work. **Decided** marks the owner's answer of 24 November. Nothing here is built yet.*

## 1. Summary

**The fault.** "A chicken burrito bowl with white rice and black beans, 450 g": the person gave the weight of the whole dish. The meal agent is told (since batch 3) to pass it to `cost_dish` as `totalGrams`, and the engine already scales the assumed parts to it (`server/compute.ts` `scaleDish`). In twelve fresh-session samples on meal v68 and again on v69, the meal was counted at 450 g in **6 of 12 and 6 of 11**; the other answers counted the parts at their usual portions (270–357 g), so the carbohydrate and the load were understated by a quarter to a third. A sentence in the prompt did not move it, so the fix must not depend on the model (CLAUDE.md rule 6's principle: what must hold is a rule, not a request).

**The fix (Decided: "the engine applies it").** The server reads one weight for the whole dish from the person's own message, before any model runs, parks it with the day state, and the engine scales the assumed parts of the meal to it, in `cost_dish` and in `compute_meal`. The answer says the meal was counted at the weight they said. Never when the person gave amounts for the parts, gave more than one weight, or the weight belongs to one food.

**Measured by:** CL1 at 450 g in 12 of 12 fresh samples (was 6 of 12); the negative cases in section 10 never scaled; `npm run eval` and `eval:agent` green.

## 2. Scope

**In:** reading one whole-dish weight from the message (grams, ounces, pounds); scaling in `cost_dish` when `totalGrams` and `servings` are absent, and in `compute_meal` when every item's amount was assumed; saying so in the reply and the answer.

**Out:** a weight for one food among several ("450 g of pasta and a slice of bread": the agent passes it as that food's quantity, as today); two or more weights; volumes ("2 cups of the stew": a volume of a dish has no density, as `server/quantity.ts` says); a count of servings ("two bowls": `servings`, already handled).

**Later:** the same for a weight typed after a clarifying question ("it was about 450 g"), once the reply box carries the dish.

## 3. User flows

```
"A chicken burrito bowl with white rice and black beans, 450 g"
  → /agent/ask: wholeDishWeight(message) = 450 g → parked with the day state for this turn
  → meal agent → resolve_foods → compute_meal (parts, usual portions, 330 g in all)   or   cost_dish (no totalGrams)
  → engine: every amount assumed, one dish weight parked → scale the assumed parts by 450 / 330
  → reply: items at the scaled grams, scaled: { by: "message", totalG: 450, factor: 1.364 }, each said "… (scaled to the 450 g you said)"
  → answer: "Counted at the 450 g you said." in the Weights line; the verifier checks every number against that reply
```
A person who gave amounts ("1 cup of rice and half a cup of beans, 450 g in all") is not scaled: their amounts stand, and the 450 g is not applied over them (the reply says so in `dishWeight.notApplied: "amounts given"`, and nothing changes in the numbers).

## 4. The promise check

The 450 g is the person's own number, read by a rule from their message, never by a model. The scaled grams, carbohydrate and load are the engine's arithmetic on its own records. The factor and the scaled grams are in the tool result, so the verifier covers every number the answer quotes. Nothing is estimated that was not already estimated: the parts' proportions were the usual portions before; only their total changes, to the weight the person said.

## 5. Frontend

None. The receipt already shows the engine's grams and `said`; a scaled item reads "white rice (scaled to the 450 g you said)" through `said`. `docs/design.md` needs no new section.

## 6. Engine and API

**`server/dishWeight.ts`** (new, pure). `wholeDishWeight(message: string): { grams: number; said: string } | null`.
- Collect every weight in the message: a number followed by `g`, `gram(s)`, `kg`, `oz`, `ounce(s)`, `lb`, `lbs`, `pound(s)`; never `fl oz`, never a percentage. More than one: `null`.
- The one weight is the whole dish's only in these shapes: at the end after a comma, dash or in brackets ("…, 450 g", "… (450 g)", "… — 1 lb"); "a 450 g bowl", "a 16-ounce plate"; "450 g of the/my/that <dish>"; "it was/weighed (about) 450 g". Anything else (notably "450 g of pasta and…", "450 g chicken with…") is a food's amount: `null`.
- Ounces and pounds by the exact constants already in `server/quantity.ts`.

**Parking** (`server/agent.ts` `parkDayState`, `server/sessions.ts`). The weight rides with the day state for this turn only (memory, never logged, cleared on the next turn), as `dishWeight`.

**`cost_dish`** (`server/engine.ts`, `server/compute.ts`). When the call has neither `totalGrams` nor `servings` and a dish weight is parked, it is applied as `totalGrams` through the existing `scaleDish`; `scaled.by` becomes `"message"`.

**`compute_meal`** (same files). When a dish weight is parked, the meal has two or more items, no item carries `grams`, a weight or a volume the person gave, and no item is a recipe counted by servings, the engine scales every item's grams by `W / sum` before costing, if the factor is between 0.25 and 4 and the sum differs from W by more than 2%. Otherwise nothing changes and the reply says why in `dishWeight.notApplied` (`"amounts given"`, `"one item"`, `"out of range"`). The reply carries `scaled: { by: "message", totalG, factor }`; each scaled item's `said` ends "(scaled to the 450 g you said)".

**Contract** (`server/contract.ts`): `scaled.by` gains `"message"`; `ComputeMealResponse` gains `scaled?` and `dishWeight?`. Model-facing errors stay 200 with an `error` field.

## 7. Agents

**`diabite-meal`** (`agent/prompts/meal.md`), and also, one sentence: "When the reply carries `scaled.by: "message"`, the engine counted the meal at the weight the person said: say so once ('Counted at the 450 g you said') and copy each `said` as it is." Provisioned with the model variables unset and `PUBLIC_URL` set (`agent/SETUP.md`), each agent read back from the project. Twelve fresh samples before (taken: 6 of 12) and after (rule 12).

## 8. Data

No table, column or migration. Nothing new is stored about a person: the weight lives in memory for one turn.

## 9. Safety and responsible AI

The rules gate runs first, unchanged. The risk is a weight attached to the wrong thing: scaling a meal by a food's weight. The shapes in section 6 are deliberately narrow, every negative phrasing in section 10 is a case, and a scale outside 0.25 to 4 is never applied. The answer always says the meal was counted at the weight they said, and Portions corrects it.

## 10. Evaluation plan (in the same change)

**Engine (`npm run eval`):**
- `wholeDishWeight`: applied to "a chicken burrito bowl with white rice and black beans, 450 g" (450), "my stew (16 oz)" (453.6), "a 1 lb plate of nachos" (453.6), "450 g of the casserole" (450), "it weighed about 300 g" (300); not applied to "450 g of pasta and a slice of bread", "450 g chicken with rice", "100 g of rice and 150 g of beans", "an 8 oz glass of juice" (`fl oz` and a drink's own quantity), "2% milk", "a 12-inch pizza".
- `compute_meal` with a parked 450 g: three assumed items scaled to 450 ± 1 g, `scaled.by === "message"`; one item with a stated weight → not applied (`"amounts given"`); a single item → not applied; factor 5 → not applied.
- `cost_dish` with a parked 450 g and no `totalGrams` → scaled to 450; with `totalGrams` given → the call's own value wins.
- Mutations: drop the detection, the parking, the `compute_meal` scaling or the `cost_dish` default: a case fails each time.

**Agent (`npm run eval:agent`, mechanical):** CL1 (existing, `costedTotalGrams: 450`, now read from the last `compute_meal` or `cost_dish`); a new **DW1** "my beef stew, 16 oz" → total 453.6 g; **DW2** "450 g of pasta with a slice of bread" → pasta 450 g, no `scaled`. Twelve fresh samples of CL1 after: 12 of 12 at 450 g.

## 11. Rollout

One commit for the engine (detection, parking, both tools, cases), deployed and checked against the live service (`/tools/compute_meal` after `/agent/ask` parks a weight, read from a real turn's trace). Then the prompt sentence: twelve samples before, provision, read the agents back, twelve after, `eval:agent`. **Rollback:** the previous revision (nothing stored changes); the previous prompt from git.

## 12. Open questions

**Decided by the owner on 24 November 2026:** the engine applies the weight of the whole dish when the person said one and every part was assumed.

**None left for the owner.** For later: a weight given in the reply to a clarifying question (section 2, "Later").

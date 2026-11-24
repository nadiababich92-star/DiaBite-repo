# Engineering plan: findings of 24 November, batch 3 (agent and session)

*Stage 1, 24 November 2026; weights corrected from USDA while building commit 1. A separate file because `docs/engineering/engineering-doc.md` holds another session's uncommitted work. Batches 1 (data) and 2 (screen) are live (revisions 251–257). This plan covers what is left: the agent and the session. **Decided** marks the owner's answers of 24 November. Nothing here is built yet.*

## 1. Summary

**The feature.** Four faults found in the owner's live questions and diary on 24 November (relayed by the metrics session), each traced to its cause in the code:

| | What the person saw | Cause |
|---|---|---|
| **A** | The agent asked "What is in them?" about strawberries; the next, unrelated question (a Chipotle bowl, from Diary → Add food) got an answer about the strawberries. Only a reload helped. | One conversation per browser for an hour: `src/lib/session.ts` keeps one session id, and `server/agent.ts:930` continues it with `previous_response_id` (`server/sessions.ts:122`, `TTL_MS` one hour) whatever box the question came from. |
| **C** | "A burrito bowl: 1 cup brown rice, half a cup of black beans, 4 oz grilled chicken breast, sauteed peppers and onions, salsa and 1 oz shredded cheese" was costed as a *typical* burrito bowl with `cost_dish`; the chicken, peppers and cheese came back "not in the database", though all three are. | The prompt sends an unknown dish to `cost_dish` (`agent/prompts/meal.md`, "A dish we do not have"). A dish whose parts the person listed is not a dish we lack: the parts are the meal. On top of that, "shredded cheese" finds "Blue cheese, crumbled" and "grilled chicken breast" a recipe. |
| **D** | Yogurt, granola and "a few strawberries": the strawberries were left out (a question about grams), yet the stamp said **Fits**, while the text said it could not judge a partial total. | The engine only knows a meal is partial when a food in `compute_meal` is unknown or has no load (`server/compute.ts:470`). A food the agent resolved and then left out to ask about never reaches the engine, so `afterMeal.fits` is `true`. |
| **F** | "A few strawberries", "two slices of whole wheat bread" and "a handful of spinach" became questions about grams; "about 1.5 cups" of lentil soup was counted as 1 cup. Over the budget, the verdict said "…though the meal is above the 35 g you set". | `server/quantity.ts` has no rule for "a few"; the curated strawberry has only a cup; the curated whole wheat bread has only "1 small or thin/very thin slice", which the parser does not read as a slice; every amount with no weight is a question, even for a food that carries almost no carbohydrate. The "though" is the prompt's own example sentence, written for a meal that fits. |

**The user problem.** PRD-product, "The product and its promise": *"A model turns 'a burrito bowl' into foods and portions, and asks exactly one question when it is unsure"*, and requirement B2, *"one clarifying question instead of a guess"*. Today it asks questions it does not need (F), answers the wrong question (A), and stamps a fit it cannot know (D), which is CLAUDE.md rule 3 ("partial meals … may never be called fits").

**How success is measured.** (1) The agent cases in section 10 pass on the deployed agent, each read from tool results, never from prose (rule 7). (2) Twelve fresh-session samples of the owner's five phrasings before and after the prompt change (rule 12): the share answered with no question rises, and no sample says **Fits** with a food left out. (3) In the next moderated sessions, no answer refers to an earlier question.

## 2. Scope

**In scope**
- A: a new topic for every question from the main box (**Decided**: "Main box = new topic").
- C: a dish with its parts listed is costed from the parts; two everyday names fixed in data.
- D: the engine marks a meal partial when a food the agent named was not counted, and a server check makes sure of it.
- F: "a few" is 3 items, named (**Decided**); an amount with no weight for a food with almost no carbohydrate uses its typical portion, named, with no question (**Decided**); slices of bread and single strawberries get USDA's own weights; "about 1.5 cups" is 1.5; the verdict says "and also" when over.

**Out of scope**
- Follow-up questions about an answer typed in the main box ("what if I skip the bread?"): with A they start a new topic. The card's swap and Portions stay the way to change an answer.
- "Some", "a bowl", "a plate" of a starchy food: still one question (unchanged).
- The latency (p90 17.8 s, model token limit): its own item.
- The Chipotle restaurant records (carbohydrate only): unchanged.

**Later**
- A visible "Ask about this answer" link that continues the conversation on purpose, if testers miss follow-ups.

## 3. User flows

**A, a new topic.**
```
Main box "Check this meal" → AskPage sends { newTopic: true } → /agent/ask: previous = undefined, no prior turn
   → router → meal agent starts clean → tools → answer about this meal only
"Your answer" box under a question → AskPage sends nothing new → /agent/ask continues previous_response_id → answer to the question
```
"Try again", a day changed with an answer on screen (it asks again), and Diary → Add food all use the main box, so all start fresh. The advisor's memory (food preferences) is keyed by the session id, which does not change, so it is kept.

**C, a dish with its parts.**
`"A burrito bowl: 1 cup brown rice, …"` → meal agent: the parts are the meal, the name is a label → `resolve_foods` with each part → `compute_meal` with each part and the amount the person said → answer. `cost_dish` is called only for a dish that is unknown **and** whose parts were not given.

**D, a food left out.**
`"yogurt, a quarter cup of granola and some strawberries"` → the agent resolves three foods, costs two and asks about the third → `compute_meal` carries `notCounted: ["strawberries"]` → `afterMeal.partial.notCounted` → `fits: null` → stamp **Part of the meal**, never **Fits**. If the agent forgets the field, the server's turn check (section 6) finds a resolved food missing from the costed items and withholds the fit itself.

**F, amounts.**
`"a few strawberries"` → `quantity { count: 1, unit: "few" }` → engine: 3 × USDA's single strawberry ("1 fruit", 18 g) = 54 g, `basis: "typical"`, said "a few (3 strawberries, 54 g)". `"a handful of spinach"` → `quantity { count: 1, unit: "handful" }` → engine: spinach's typical portion has 3 g of available carbohydrate or less, so it uses that portion, `basis: "typical"`, said "a handful (100 g)", to which the agent adds "USDA's typical size". `"a handful of chips"` → `needsWeight` → one question, as today.

## 4. The promise check

Every number in these flows comes from the engine. "A few = 3" and "a handful = the typical portion" are rules in `server/quantity.ts`, with USDA's per-item and typical weights from the data; the model passes the words the person said and never a weight (prompt rule 1 unchanged). The new `said` text names the assumption and its grams; both are in the `compute_meal` result, so the verifier covers them as it covers every weight today. `notCounted` carries phrases, never numbers. The server's turn check reads tool results only.

## 5. Frontend

**Files:** `src/components/AskPage.tsx`, `src/lib/agent.ts`.

- `AskRequest` gains `newTopic?: true`. `ask()` from the main form, "Try again", the day chip's re-ask and the Diary's Add food sets it; the reply box (`form.reply-box`, `AskPage.tsx:808`) does not.
- No visible change: no new screen, text, colour or state. The answer card is unchanged except that "Weights I used" may now say "a few (3 strawberries, 54 g)" or "a handful (100 g, USDA's typical size)", which the agent copies from `said`.
- `docs/design.md` needs no new section.

## 6. Engine and API

**`POST /agent/ask`** (`server/agent.ts`, `server/guard.ts`). Request gains `newTopic?: boolean` (validated, optional; absent keeps today's behaviour for old clients and the eval runner). When `true`: `previous` is `undefined`, the prior-turn routing (`lastTurnOf`) is skipped, and the session's turn notes are cleared. The day state, the owner check and the limits are unchanged; the safety gate still runs first (rule 6).

**`compute_meal`** (`server/contract.ts`, `server/engine.ts`, `server/compute.ts`, tool spec in `server/openapi.ts`). Request gains `notCounted?: string[]`: foods the person named that are not in `items` (asked about, or left out). Each makes the meal partial: `afterMeal.partial.notCounted`, `fits: null` (or `false` when the counted part is already over). Model-facing: a wrong value answers 200 with an `error`, as every tool does.

**The turn check** (`server/agent.ts`, after the agent's last tool call). From this turn's trace: every phrase `resolve_foods` answered with a candidate (not unknown) must have one of its candidate ids among the final `compute_meal` (or `cost_dish`) items, or be in `notCounted`. If one is missing, the response is marked partial (`withheldFit: true`): the browser shows **Part of the meal**, not **Fits**. A false alarm (the agent re-resolved a food under other words) costs a missing green stamp, never a wrong one: the safe direction. Logged to the turn log as `uncounted` so the rate can be watched.

**`server/quantity.ts`.**
- Unit `few`: 3 × the food's per-item portion (`1 medium`, `1 large`, `1 piece`, `1 slice`, the first that exists); with none, `needs` as today. `basis: "typical"`, `said: "a few (3 strawberries, 54 g)"`.
- An amount with no weight (`handful`, `bowl`, `plate`, `scoop`, `some`, `bit`, `serving`): if the food's typical portion (`defaultPortion`) has **3 g of available carbohydrate or less**, use it, `basis: "typical"`, `said: "a handful (100 g)"`. Otherwise `needs`, as today.
- A slice label with a qualifier ("1 small or thin/very thin slice") is not a plain slice and stays unread; the fix is data (next).

**Data** (`data/recipes-db/portion_mapping.json`, `server/foods.ts`): USDA SR Legacy per-item and slice portions for the curated records that lack them: whole wheat bread "1 medium or regular slice" (36 g, from the same FNDDS record 2707709, whose local copy kept only four rows), strawberry "1 fruit" (18 g), and the same for every curated bread, berry and small fruit a person counts (the spec lists each with its SR number). Two names: "shredded cheese" → a shredded cheddar record; "grilled chicken breast" with an amount already takes the non-recipe record by prompt rule, and gets a case. The catalogue change reaches production only after `sync-foods` and a restart (rule 10).

## 7. Agents

**`diabite-meal`** (`agent/prompts/meal.md`), each written "and also", never "instead of" (rule 8):
1. **A dish with its parts.** "When the person names a dish **and** lists what is in it ('a burrito bowl: rice, beans, chicken…'), the parts are the meal: resolve and cost each part with `compute_meal`, with the amount they gave. The dish's name is a label: it is neither an item nor a `cost_dish` call. `cost_dish` stays for a dish we do not have whose parts were not given."
2. **A food left out.** "And also, any food the person named that is not in the `compute_meal` items (because you are asking about it, or could not find it) goes in `notCounted`."
3. **Amounts.** Rule 49 ("an amount that is not one of the units is a question") becomes: "pass the amount as the person said it (`few`, `handful`, `bowl`…); the engine weighs it or answers `needsWeight`, and only then do you ask, word for word from its `hint`." "About 1.5 cups" is `{ count: 1.5, unit: "cup" }`: "about" is not part of the number.
4. **Over and above the person's number.** Next to the existing example, and also: when the meal goes over, "This goes over what is left of today, and the meal is also above the 35 g you set." Never "though" with "over".

**`compute_meal` tool spec**: `notCounted` described. **Router**: unchanged (A removes the case where a short reply had to be routed back to the meal agent from a new box). Provisioned with `MODEL_MEAL` and `MODEL_DEPLOYMENT_NAME` unset; each agent's model read back from the project afterwards (rule 11).

## 8. Data

No table, column or migration. Nothing new is stored about a person: `newTopic` is a flag on one request; the turn check reads the turn's own trace. The session's conversation id stays in memory for an hour, as today.

## 9. Safety and responsible AI

- The rules gate is untouched and runs first.
- **A** removes a real risk: an answer about the wrong food, given with a verdict.
- **D** removes a green **Fits** on a meal that was not all counted (rule 3); the turn check makes it hold even when the model forgets.
- **F** adds two assumptions: "a few" is 3, and a handful of a food with almost no carbohydrate is its typical portion. Both are named in "Weights I used" with their grams and correctable on the card, and neither applies to a starchy food. The 3 g threshold goes to `docs/CLINICAL_REVIEW.md` as a question for the clinician (not blocking, by the owner's decision of 20 November: no clinical read before funding).

## 10. Evaluation plan (in the same change)

**Engine (`npm run eval`, `eval/cases.json`, `eval/run-engine.ts`):**
- Quantity: strawberries `few` → 54 g; whole wheat bread 2 `slice` → 72 g; spinach `handful` → its typical portion, no `needs`; potato chips `handful` → `needs`; lettuce `some` → typical; white rice `bowl` → `needs`.
- `compute_meal` with `notCounted: ["strawberries"]` → `afterMeal.fits === null`, `partial.notCounted` holds it; over by the counted part alone → `fits === false`.
- The turn check, from recorded traces: a resolved phrase missing from the items and from `notCounted` → `withheldFit`; the same phrase in `notCounted` → no double flag; a re-resolved phrase whose second resolution was costed → no flag.
- `/agent/ask` with `newTopic: true` does not pass `previous` (a unit test of the function that picks the continuation, no model).
- Mutations: drop the `few` rule, drop the 3 g rule, drop `notCounted` from partial, drop the turn check, ignore `newTopic`: each fails a case.

**Agent (`npm run eval:agent`, mechanical, reading the trace):**
- **AS1** two turns, one session: "A cup of Greek yogurt with granola and some strawberries", then with `newTopic` "Chipotle chicken burrito bowl with brown rice and black beans": the second turn's tool calls name no strawberry. The runner gains two-turn cases (`turns: [...]`) in `eval/run-cases.ts`.
- **AS2** the burrito bowl with its parts: `compute_meal` items hold brown rice, black beans, chicken breast (not a recipe), cheese; no `cost_dish`; no burrito-bowl record.
- **AS3** "…and a few strawberries": strawberries in the items at 54 g, `basis: typical`; no `needsWeight`.
- **AS4** "a turkey sandwich on two slices of whole wheat bread": bread at 72 g; no question.
- **AS5** "eggs with a handful of spinach": spinach in the items, no question.
- **AS6** "about 1.5 cups of lentil soup": `quantity.count === 1.5`.
- **AS7** a food left out: `afterMeal.fits !== true` whenever `partial` is present or the turn check fired.
- Twelve fresh-uuid samples of the owner's five phrasings before the prompt change and after (rule 12), reported as counts.

## 11. Rollout

Three commits in this session, each deployed and checked before the next:
1. **Engine and data**: quantity rules, portions, `notCounted`, the turn check. `npm run eval`, `eval:abuse`, smoke; `sync-foods`, deploy, restart; ask the running service (`/tools/compute_meal` with each quantity).
2. **The new topic**: `newTopic` in the browser and on `/agent/ask`. Rehearsal on the live site: a question, then a new one in the main box, no carry-over.
3. **The prompt**: twelve samples before; edit `agent/prompts/meal.md` and the tool spec; `npx tsx agent/provision.ts` with the model variables unset; read each agent's model back; `eval:agent` and twelve samples after.

**Rollback:** the previous revision for 1 and 2 (nothing stored changes); for 3, provision the previous prompt (git history).

## 12. Open questions

**Decided by the owner on 24 November 2026:** a question from the main box starts a new topic; "a few" is 3 items, named; an amount with no weight for a food with almost no carbohydrate uses its typical portion, named, with no question.

**For a clinician, later (not blocking):** is 3 g of available carbohydrate per typical portion the right line below which an unweighed amount may be assumed?

**For the owner, optionally:** "some" stays a question for every food (only a handful and the like of a near-carb-free food is assumed). Say if "some strawberries" should count as "a few".

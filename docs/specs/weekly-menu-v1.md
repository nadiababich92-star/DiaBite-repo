# Spec: weekly menu V1

*From `docs/engineering/engineering-doc.md`, workstream C. Everything here runs in the browser: `src/lib/menu.ts`, `src/components/MenuPage.tsx`, `src/data/dishes.ts`. No model, no engine change.*

## What already exists

The generator already avoids a dish for `REPEAT_GAP = 3` days (a dish can come back on the fourth day), uses 30 dishes, filters by allergens and eating pattern, and the page already has a shopping list aggregated by food. This spec adds what is missing.

## 1. The hidden profiles

`menuHidden(profile): { hidden: boolean; reason?: string }` in `src/lib/menu.ts`:

| Profile | Result |
|---|---|
| `comorbidities` includes `'eatingDisorder'` | hidden |
| `kidney === 'ckd'` or `'dialysis'` | hidden |
| anything else | shown |

`MenuPage` renders, for a hidden profile, a card instead of the plan. **Exact copy:** heading "A weekly menu is not something DiaBite should plan for you." Body: "With what you told us, a fixed plan of meals and calories is better written by your doctor or dietitian. You can still ask about any meal you are thinking of eating." Button: "Ask about a meal" (switches to the Ask tab). No plan is computed for a hidden profile: `generateWeek` is not called, which a test checks.

## 2. "Not yet reviewed" line

For a shown profile, under the heading: "These meals have not been reviewed by a clinician yet. Treat them as ideas, and check anything that matters for your health with your doctor or dietitian." (`.muted`, 14 px.)

## 3. Replace one meal

`regenerateSlot(plan, dayIndex, meal, profile, targets, seed): WeekPlan` in `src/lib/menu.ts`:
- pure and deterministic for a given `seed`; returns a new plan where only `days[dayIndex].meals[meal]`, that day's totals and `gl` change;
- candidates: dishes valid for that meal and the profile's exclusions, **not** the dish being replaced, not already in that day, and not used within `REPEAT_GAP` days either side in the existing plan; if there are none, relax the repeat rule (as the generator does) and say so in the UI: "Few dishes fit what you avoid, so this one may come back soon.";
- the scale is chosen by the same `fitScale` for the same share of the day (`MEAL_SHARE`).

UI: a small ghost button "Replace" on every meal row (44 px target on touch), with an accessible name "Replace <dish name> on <weekday>"; after the change the row's text is announced through a polite live region: "Replaced with <dish name>". The plan lives in component state; the seed for each replacement is `Math.floor(Math.random() * 1e9)` kept in state so the same click path is reproducible in a test.

## 4. Shopping list

Today: `shoppingList(plan)` grouped by category in the table. Add: a checkbox per line (state kept in `localStorage` under `diabite.shopping.v1`, keyed by plan seed and food id, cleared when the plan changes), a "Copy list" button that copies plain text ("Chicken breast, 650 g" per line, grouped by category headings) with a "Copied" confirmation, and the amounts rounded to 5 g (the current exact grams are false precision). No "by store" grouping: PLAN says wait until someone uses the V0 for a week.

## Verifiable

- `npm run eval`, new `menu` section: (a) over 200 seeds no dish appears twice within `REPEAT_GAP` days when the pool allows; (b) `regenerateSlot` changes exactly one slot and the day's totals equal the sum of its meals; (c) the same seed twice gives the same result; (d) `menuHidden` is true for the three profiles and false for ten others including `kidney: 'mentioned'`, gout, gastroparesis; (e) `generateWeek` is never called for a hidden profile (a spy in the component test, or the guard in `MenuPage` read in code review if no component test harness exists).
- The shopping-list text of a fixed seed matches a recorded snapshot.
- Screens: hidden profile (each of the three), shown profile at 375 px, replace on a day with a short pool, dark mode.

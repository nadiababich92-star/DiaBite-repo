# Spec — Summary for my clinician: the checks

*Stage 2, from `docs/engineering/engineering-doc.md` (approved 18 November 2026), section 10. The logic is `docs/specs/clinician-summary-logic.md`, the screen `docs/specs/clinician-summary-screen.md`. A feature without its checks is not finished: these go in **the same change** as the code.*

**No migration, nothing in `.env.example`, no agent case, no `eval/cases.json` entry.** No prompt, tool or data changes, so `npm run eval:agent` is not part of this change. The checks follow the repository's pattern: pure functions imported into `eval/run-engine.ts` (a new block, printed as `clinician summary  ok`), plus lines in `eval/smoke.mjs`. **They read the structure `buildSummary` returns, never the page's prose** (CLAUDE.md, rule 7), except check 7's scan and the smoke, which look at rendered text on purpose.

Run, in order: `npm run eval`, `npm run eval:abuse`, `npm run smoke`. All must stay green; the first gains the new block.

## The fixture (in `eval/run-engine.ts`, next to the week checks)

`today = '2026-10-20'`; `day(n)` as the week checks define it. `profile = { ...DEFAULT_PROFILE, onboarded: true, condition: 't2', insulin: 'none', meds: ['metformin', 'glp1'], age: 61, weightKg: 83.7, heightCm: 171, mealCarbsG: 45, snackCarbsG: 0, dailyCarbsG: 0, kidney: 'ckd', pregnantOrBreastfeeding: false, allergens: ['peanuts'], comorbidities: ['htn'] }` (the sensitive fields are set on purpose, so check 7 has something to find), `targets = calculateTargets(profile)`.

A diary of twelve eaten entries over six of the seven days ending today, plus planned entries:

| Day | Entries |
|---|---|
| `day(20)` today | egg (`foodId: 'egg'`, 110 g, lunch); rice (`rice-white`, 400 g, dinner) |
| `day(19)` | three meals: breakfast, lunch, dinner, hand-logged seed foods; sum chosen to be **under** the carbohydrate, energy and GL targets |
| `day(18)` | one lunch with a snapshot whose `loadAvailable` is `false` (a packaged food) and a sum **under** the GL budget; one breakfast hand-logged |
| `day(17)` | **not logged** (gap) |
| `day(16)` | **not logged** (gap) |
| `day(15)` | one entry with a snapshot of `assumed: true` (a dish counted from an assumed recipe), lunch only |
| `day(14)` | one dinner, big enough that carbohydrate, energy **and** GL are over the targets |
| planned | two entries with `planned: true` on `day(19)` and one on `day(21)` |

Add one more entry dated `day(13)` (outside a 7-day period, inside a 14-day one) for check 5. Every figure the checks compare against is computed **in the check** from `viewEntry`, `sumNutrients` and `weekSummary`, not typed in.

## Engine checks (block `clinician summary`)

| # | What it asserts | Mutation that must make it fail |
|---|---|---|
| 1 | **Same as the Diary.** For each logged day in `buildSummary(...)`: `kcal, carbs, fiber, protein, fat` equal `Math.round` of `sumNutrients(eaten entries of that day .map(viewEntry).map(v => v.nutrients))`; `gl` equals `weekSummary(diary, targets.glBudget, today).days[i].used` for the matching date; and the item `carbs` of a day add up to the day's carbohydrate within 0.1 × item count | the day sum reads `availableCarbs` instead of `nutrients.carbs`; `gl` rounded to an integer |
| 2 | **Planned is absent.** No planned entry's id appears in any `days[].meals[].items`; `day(21)` is not in `days` or `notLogged`; the planned entries on `day(19)` change none of that day's figures (compare with a diary without them) | remove the `eaten(...)` filter |
| 3 | **No load is never "not over".** `day(18)` has `noLoadFoods === 1` and `glVerdict === 'not complete'` although its GL is under the budget; `day(14)` (over) is `'over'` whatever its `noLoadFoods`; a day with all loads is `'not over'` or `'over'` and never `'not complete'` | ignore `loadAvailable` |
| 4 | **Marks.** `day(15).estimate === true` and its item's `estimate === true`; no other day has `estimate`; `slots` is 3 for `day(19)`, 1 for `day(15)`, 2 for `day(18)`; the "fewer than 3 meals" condition (`slots < MIN_SLOTS`) holds for 15 and 18 only | `estimate` read from the wrong field |
| 5 | **Period.** For 7, 14 and 28: `to === today`, `from === addDays(today, -(period - 1))` and `periodDays` is the argument; `day(13)` is in the 14-day result and **not** in the 7-day one; the same holds with `today = '2026-11-02'` (a month boundary: 14 days reach back into October) and across the US clock change (`today = '2026-11-02'` and `'2026-03-09'`) so no day is skipped or repeated; `from` and `to` are real dates | count days as 24-hour blocks |
| 6 | **Not logged is not zero.** `notLogged` holds exactly `{from: day(16), to: day(17)}` plus the leading and trailing gaps of the 7-day period as separate runs where they exist; no logged day is inside a run; `loggedDays === days.length`; the averages equal the mean of the unrounded daily sums over **logged** days only (recompute in the check); with an empty diary `loggedDays === 0`, `days` is `[]`, `averages` is `null` and `notLogged` is one run covering the period | include empty days in the mean; return zeros for an empty day |
| 7 | **Profile minimum.** `Object.keys(summary).sort()` equals exactly `['about','averages','days','from','loggedDays','notLogged','periodDays','printedOn','targets','to']`; `Object.keys(summary.about).sort()` equals `['condition','insulin','medicines']`; `JSON.stringify(summary)` contains **none** of: the key names `age`, `sex`, `weightKg`, `heightCm`, `activity`, `kidney`, `pregnant`, `allergens`, `comorbidities`, `email`, `consent`, `constraints`; the weight `83.7` (a value too distinctive to occur in a total by chance); the words `kidney`, `ckd`, `pregnan`, `peanut`, `blood pressure`; and no `reason` sentence from `targets.constraints`. (Bare numbers such as `61` or `171` are **not** searched for: a daily total can equal them by chance and the check would flap.) `summary.about.insulin` is exactly `'does not take insulin'` and `medicines` is exactly `['Metformin', 'GLP-1 or dual agonist']`. With `insulin: 'basal'` and again with `'mealtime_or_pump'` it is `'takes insulin'` and **never** names the type or a product | return `profile` or `targets.constraints` whole; print the label table with brand names |
| 8 | **Whose target.** With `dailyCarbsG: 120` set, `targets.carbsSetBy === 'person'`; with `0`, `'diabite'`; `mealCarbsG` is `45` and `snackCarbsG` is `null` for the fixture | read `carbApproach` instead of the `own-carbs` constraint |
| 9 | **Verdicts.** `carbsVerdict` and `kcalVerdict` are `'over'` exactly when the **unrounded** sum is strictly above the target (check a day whose rounded sum equals the target but whose unrounded sum is above it, and one exactly at it); protein, fibre and fat have **no** verdict field | compare the rounded value; add a verdict to fibre |

## Smoke (`eval/smoke.mjs`, next free `M` numbers; `grep` the file for the last one before choosing)

The smoke already drives a signed-out person through onboarding and logs a meal. After the meal check, add, in this order:

| # | Step | Passes when |
|---|---|---|
| M-a | open **Settings** | the card "For your clinician" and the button "Summary for my clinician" are on the screen for a signed-out person |
| M-b | click it | the page title "DiaBite summary" is there; the app's tab bar and masthead are **not** (the page is rendered alone); the period "7 days" is pressed; the meal logged earlier is listed under Meals |
| M-c | choose "14 days" | `aria-pressed` moves to it and the period line says "14 days" |
| M-d | type `<img src=x onerror=window.__xss=1>` in the name field | the name is on the page as text, `window.__xss` is undefined, and there is no `<img>` inside the article that was not there before |
| M-e | `document.title` | contains the period dates and does **not** contain the typed name |
| M-f | the printed page text (`article.innerText`) | matches none of `/\b(age|years old|weight|height|kg|lb|cm)\b/i` outside the fixed copy that names fibre or the targets table, and contains neither `kidney` nor `pregnan` (the fixed copy is written to avoid those words) |
| M-g | press Escape | back on Settings, focus on the button |
| M-h | a fresh signed-out person with **no** entry: open the summary | "Nothing logged in the last 7 days" is shown and the Print button is `disabled` |
| M-i | read the console | no script error (extends the existing `M12`) |

## Look at it (not an automated pass; screenshots go in the report)

As listed under "Verifiable" in the screen spec: 375 px and desktop, Tape and Paper, print preview at A4 and Letter in Chrome and Safari, a 7-day and a 28-day diary, a packaged-food day, an estimate, a one-meal day, a two-day gap, an empty diary, a long food name. If a printed page shows a profile value the spec says it must not, that is a failure of check 7 even though the automated scan passed, and the scan is then widened.

## Done means

`npm run eval`, `npm run eval:abuse` and `npm run smoke` pass, including the new block; every mutation above, applied by hand once and reverted, makes its check fail; the screenshots exist; nothing in `server/`, `agent/`, `supabase/` or `Dockerfile` changed. Anything else is reported plainly as not done.

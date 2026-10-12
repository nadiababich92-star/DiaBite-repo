# Engineering document — the week in the Diary: in-range days and four weeks of trend

*Produced by `/engineering-planner` on 12 October 2026 for roadmap item 1.6. The previous document (`cost_dish`) is archived as `docs/engineering/cost-dish.md`. **Not yet approved.***

## 1. Summary

**The feature.** Make the Diary's week the home of the product's north-star metric. Three changes to what already exists:
1. **"N of 7 days in range"**, counted by the PRD's definition (below), as the first line of the week card.
2. **Four weeks as a thin strip**: for each of the last four seven-day blocks, how many days were in range.
3. A day that was logged too little, or whose load is not fully known, is **named for what it is**, not scored.

**What already exists, and why this is smaller than the roadmap says.** Roadmap 1.6 asked for "a 7-day view of glycemic load against the budget and the count of in-range days". The 7-day view is **built and tested**: `src/lib/history.ts` (`weekSummary`), the card "The last seven days" in `src/components/DiaryPage.tsx`, `.week` styles, and engine checks in `eval/run-engine.ts` (seven consecutive dates in three time zones, month boundary, carbs-only days, over and within). What it does **not** do is count in-range days the way the PRD defines them. Today a day is "within" when *anything* is logged and the load is at or under budget: one apple makes a "within" day.

**The user problem.** PRD "How will you know that the problem is solved?": the North Star is **in-range days per active user per week**; a day is in range when (1) the person recorded **at least 3 eating occasions** and (2) the day's computed glycemic load is **at or below the personalised budget**. Target: median 4.5 of 7 by the eighth week. The product cannot show an investor the metric the PRD names until the Diary counts it the same way.

**Success.** (1) A person who logged for a week sees "N of 7 days in range" and the same N that a one-page weekly report (roadmap 2.5) will compute from the same rows. (2) A day with one logged apple is **not** counted. (3) Nothing on the screen scores, praises or builds a streak (`docs/design.md`, rule 6).

## 2. Scope

**In:** the in-range definition in one pure function; the summary line; the four-week strip; partial and thin days named; the eval cases; the PRD sentence that points to the one definition.

**Out:** the weekly report from Supabase (2.5, a separate script); logging completeness shown to the person (owner decided: **no**, team-side only, in 2.5); week navigation by arrows (owner chose the strip); any new table, endpoint, agent or prompt; charts with axes, rings, streaks, scores (design rule 6).

**Later:** calories logged against the requirement, shown to the team in 2.5, not here; a longer history if the sessions ask for it; "my usual" foods from history (`docs/PLAN.md`).

## 3. User flows

```
Opens Diary → DiaryPage reads `diary` (already in state, from localStorage or Supabase) → weekSummary(diary, glBudget, today)
            → week card: line "N of 7 days in range", seven day bars, four-week strip
Logs or deletes an entry → `diary` changes → the card recomputes in the same render (no request)
Signed out / offline → same: the diary is local first; the summary is computed in the browser
```

No engine, agent or network call is involved.

## 4. The promise check

Every number on the card is **computed from the diary's own entries by `viewEntry`**, which reads each entry's stored snapshot (what the engine returned when it was logged) or the food table. Nothing here comes from a model, and there is nothing for the verifier to check: no answer text carries these numbers. The count of days is arithmetic over those entries. **If a day contains a food with no glycemic load** (packaged, or `unrated`: rule 4), its load is *understated*, so the day is **not counted as in range** and is labelled "carbs only", exactly as a meal containing one is never "fits". That keeps the one promise at the level of the week.

## 5. Frontend

**Files:** `src/lib/history.ts`, `src/components/DiaryPage.tsx`, `src/styles.css`.

**A day's states** (new `status` on `DayPoint`; today it has `logged`, `partial`, `within`):

| status | When | Shown as |
|---|---|---|
| `in_range` | ≥ 3 distinct meal slots logged, no entry without a load, load ≤ budget | green bar, "26 of 45" |
| `over` | load > budget (logged any amount) | red bar, "52 of 45" |
| `thin` | 1–2 distinct meal slots, load ≤ budget | neutral bar, number, and the words "2 of 4 meals" |
| `carbs_only` | any entry has `loadAvailable: false`, and the load counted is ≤ budget | neutral bar, number, "+ carbs only" (exists today) |
| `none` | nothing logged | "not logged" |

A day that is `over` is over whatever else is true: a load already above budget cannot be rescued by an unknown. Colour keeps its meaning (green fits, red is over); `thin` and `carbs_only` are neutral, with words, never colour alone (design rule 3).

**The summary line**, above the bars, plain: "**4 of 7 days in range** this week. 2 days were logged with fewer than 3 meals, 1 has carbs only." Where nothing is logged: the existing "Log what you eat and the week fills in here." No praise, no streak, no percentage.

**The four-week strip:** four small rows, "This week · 4 of 7", "Last week · 3 of 7", "2 weeks ago · 5 of 7", "3 weeks ago · not logged", each a row of seven small marks (filled = in range, outlined = logged not in range, empty = not logged), with the words beside them. Marks are 12 px dots within the existing spacing scale; **no new colour, no new size** outside `docs/design.md`; if one is needed it is added there first, with its dark counterpart (design skill rule 2).

**States:** empty (no history), loading (diary is synchronous: none), partial, error (none possible). **Phone:** one column at 375 px, targets unchanged (the strip is not interactive), text at least 13 px. **Accessibility:** the existing `aria-label` on the list is kept and extended; the strip is a list whose items read "Last week, 3 of 7 days in range".

## 6. Engine and API

None. No endpoint, no tool, no environment variable. The week is computed in the browser by a pure function, as it is today.

## 7. Agents

None. The agents do not read the Diary's week and are not changed. (The advisor's memory is separate.)

## 8. Data

No table, column, index or migration. **Nothing new is stored about a person**: the summary is derived from `diary_entries` rows that already exist. The four weeks reach back 28 days; entries older than that still exist and are simply not shown here.

## 9. Safety and responsible AI

- A count of days "in range" is a **self-reported, gameable** figure (the PRD says so). On screen it is a description of what was logged, never an assessment of health: the card never says "well done", "on track" or "improving".
- `thin` days are named, not hidden: one apple does not become a good day.
- A glycemic load is shown only where it exists; a day holding a no-GI food is never "in range" (rule 4).
- **No clinician review** is needed: no threshold, advice or number from a model changes. The budget the load is compared with is the person's existing target. The "3 meals" threshold is the PRD's, not a medical one.

## 10. Evaluation plan — in the same change

**Engine cases** (`eval/run-engine.ts`, beside the existing week block; they print `week ok` or `WRONG` and exit non-zero on a miss). They read `weekSummary`'s fields, never text:
1. One logged apple under budget: `status: 'thin'`, **not** counted in `inRange`.
2. Three distinct meal slots (breakfast, lunch, dinner) under budget: `in_range`.
3. Three entries all at lunch: `thin` (distinct slots, not entries).
4. Over budget with four slots: `over`, not counted.
5. Three slots under budget but one packaged food (`loadAvailable: false`): `carbs_only`, not counted.
6. Three slots, over budget **and** a packaged food: `over` (a load already above budget is not rescued).
7. `inRange` for a mixed week equals the count of `in_range` days, and equals the figure the 2.5 report will use (the function is exported for it).
8. The four weekly blocks: block 0 ends today, block 1 ends 7 days earlier, no day belongs to two blocks, across a month boundary and across a clock change in the three zones the existing test uses.
9. The old checks (seven consecutive dates in three zones, month boundary) still pass.

**Agent cases:** none; no agent behaviour changes. `npm run eval:agent` is **not** required for this change, and `npm run eval` is.

**Screen:** `npm run screens` and look at the Diary at 390 and 1366 px with a seeded week: a full week, a thin week, an empty one. The rehearsal account has no history, so the screens script gets a flag to seed seven days of entries into the throwaway account before the shot.

## 11. Rollout

1. Implement on `main`: `history.ts`, `DiaryPage.tsx`, `styles.css`, `eval/run-engine.ts`, `eval/screens.mjs` (seed flag).
2. `tsc`, `npm run build`, `npm run eval`.
3. `npm run deploy`; **ask the running service**: open the app, log three meals in one day under budget, and check the card says 1 of 7; log one apple on another day and check it does not count.
4. **Rollback:** revert the commit and redeploy, or reactivate the previous revision. No data to undo.

## 12. Open questions — the owner's

Decided by the owner on 12 October: the PRD definition (3 distinct meal slots and within budget); the line plus a four-week strip; completeness shown to the team only.

1. **A day that contains an estimate** (a dish counted from an assumed recipe through `cost_dish`; its entries carry `assumed: true`). Proposal: it **counts** as a day in range if the rest holds, and the day shows "includes an estimate". The alternative is to treat it like `carbs_only` and never count it. The estimate is computed from real ingredients, so I recommend counting it, but whether a guess may move the north-star number is the owner's call.
2. **A day of carbohydrate only is never in range** (the proposal in section 4, which follows rule 4). Confirm.
3. **"Thin" means fewer than 3 distinct meal slots** (breakfast, lunch, dinner, snack), the PRD's "eating occasions". A person who eats two meals a day can then never have an in-range day. That is the PRD's rule and the owner's choice; it is worth watching in the sessions, and it is the first thing to relax (2 slots) if people say it feels punishing.

*Files that change:* `src/lib/history.ts`, `src/components/DiaryPage.tsx`, `src/styles.css`, `eval/run-engine.ts`, `eval/screens.mjs`, `docs/PRD.md` (one sentence pointing to the single definition), `docs/ROADMAP-to-investors.md` (1.6 restated).

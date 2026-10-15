# Spec: evaluation cases for planning and logging on any day

*From `docs/engineering/engineering-doc.md`, section 10. Add these **in the same change**. No agent case: prompts, router and tool spec are untouched, so `npm run eval:agent` is not part
of it; `npm run eval`, `npm run rehearsal`, `npm run screens` and `npm run build` are.*

## Engine cases (`eval/run-engine.ts`, a `plan` block; prints `plan ok` or `WRONG`, exits non-zero on a miss)

Import `eaten, isPlanned, markEaten, dateAllowed, clampDate, dateRange, addDays` from `../src/lib/diary`, `weekSummary, weeksSummary` from `../src/lib/history`, `toRow, fromRow` from `../src/lib/syncCore`, `shoppingFromEntries, shoppingList` from `../src/lib/menu`.

1. `eaten` drops planned entries and keeps the rest; an entry with no flag counts; `planned: false` counts.
2. **The counts.** A planned entry changes nothing in `weekSummary` (statuses, `slots`, `inRangeDays`, `loggedDays`), `weeksSummary`, or the list of entries that would be sent to the agent; a day with only a planned entry has status `none`;
   after `markEaten` it counts exactly once (build a day of three slots under budget where the third is planned: `thin` before, `in_range` after).
3. **The range.** `dateAllowed`: today, today−14 and today+14 are allowed; today−15 and today+15 are not; a malformed string is not. Run it across a month boundary, a leap day and the clock changes of 2026 (a Sunday in March and a Sunday in
   October) with `TZ` set to `America/Los_Angeles`, `Europe/Berlin` and `Pacific/Auckland` (spawn the check with each `TZ`, as the other date cases do). `clampDate` reports `moved: 'back'` or `'ahead'` and an in-range date is untouched.
4. **Persistence.** `toRow`/`fromRow` round-trip `planned` true and false; a row without the key reads as eaten and has no `planned` property; `planned: 'false'` (a string) reads as eaten; `loadDiary` treats a non-boolean as eaten.
5. `shoppingFromEntries`: planned entries from today forward only; an eaten entry and a planned entry yesterday are excluded; a `rec:` entry expands into its ingredients scaled by servings; a food under 5 g in total is dropped; the same food on two days is summed; grams are multiples of 5.
6. With no planned entries `shoppingFromEntries(...)` is `[]`, and the helper both lists share gives `shoppingList(plan)` an identical result to before (compare against a stored fixture of the generated week's list).
7. **Manual adds.** A function `newEntryAllowed(date, today)` (or `dateAllowed`) rejects an add 15 days back and 15 ahead; an entry dated 30 days back already in the diary is kept by `loadDiary` and `fromRow`.
8. **Copy yesterday** copies eaten entries only and writes them as eaten.
9. **The picker's state:** `pickerState` gives `planned: false` for today and any past day, `true` for tomorrow and later, and `chip: 'date'` for a day that is none of the three chips.

## Rehearsal (`eval/rehearsal.mjs`)

`W17`: on device A plan a meal on a day ahead (Ask answer, "Plan it"); on device B (a second browser, the same account) the Diary shows it as planned and the budget bar of that day is unchanged; mark it eaten on B (the day set to today so **Ate it** is offered);
device A shows it eaten. `W17b`: logging the same answer for **yesterday** writes an eaten entry on yesterday, today's "left" is unchanged, and the week strip's yesterday dot moves. Throwaway accounts are deleted as the other checks do.

## Screens and live checks

`npm run screens` with the Day picker open on Yesterday and on a future date, a planned row, a future day, a "planned, not eaten" row, the Menu card with the inline picker, and the shopping list from planned days, at 390 and 1366 px, light and dark.
Before the deploy: the migration `20261015130000_diary_planned.sql` is applied to the live project **first** (with the owner's go-ahead), then `tsc`, `npm run build`, `npm run eval`, `npm run rehearsal`; after the deploy, ask the running service: log an entry for yesterday, plan one for tomorrow and see it dimmed, mark it eaten, and check the budget bar moved only then.

## Documents to change in the same change

`docs/design.md` ("Day picker", "Planned row"), `docs/USER_SESSIONS.md` (the task), `docs/PRD.md` (the diary and menu requirements: planning, backdating and the rule that a plan does not count), `docs/security/security-plan.md` (one line: planned meals are a new item stored about a person and are deleted with the account), `docs/ROADMAP-to-investors.md`.

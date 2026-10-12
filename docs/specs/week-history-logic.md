# Spec: the week's arithmetic (`src/lib/history.ts`)

*From `docs/engineering/engineering-doc.md` (approved 12 October 2026), sections 4, 5 and 10. Build this
first: the screen and the cases depend on it. No migration, no endpoint, no environment variable. Pure
functions over the diary; nothing is fetched or stored.*

## The definition, once

A day is **in range** when **all** hold: (1) entries exist for **at least 3 distinct meal slots**
(`breakfast`, `lunch`, `dinner`, `snack`; the PRD's "eating occasions", counted by slot, not by entry);
(2) **no entry lacks a glycemic load** (`viewEntry(e).loadAvailable` is `true` for every entry, which is how
a packaged or `unrated` food is recognised, rule 4); (3) the day's load is **at or under** `glBudget`.

An **estimate** (an entry whose snapshot has `assumed: true`, from `cost_dish`) does **not** stop a day from
being in range: its load comes from real ingredients. The day is flagged `estimate: true` and says so
(owner's default for open question 1). This is the one definition; the PRD points to it and the
weekly report of roadmap 2.5 must call the same function.

## Types

```ts
export type DayStatus = 'none' | 'over' | 'carbs_only' | 'thin' | 'in_range'

export interface DayPoint {
  date: string                 // YYYY-MM-DD, the person's own calendar
  label: string                // "Mon", "Tue"...
  used: number                 // glycemic load counted, one decimal (unchanged)
  logged: boolean              // any entry (unchanged)
  partial: boolean             // some entry has no load; `used` is what could be counted (unchanged)
  slots: number                // distinct meal slots with an entry, 0 to 4
  estimate: boolean            // some entry is an assumed recipe
  status: DayStatus
  inRange: boolean             // status === 'in_range'; the one field every count reads
}

export interface WeekSummary {
  days: DayPoint[]             // seven, oldest first, ending today
  loggedDays: number
  inRangeDays: number
  thinDays: number             // status 'thin'
  carbsOnlyDays: number        // status 'carbs_only'
}

export interface WeekBlock extends WeekSummary { ago: number }   // 0 = the week ending today
```

`within` and `withinDays` are **removed**, not kept beside the new fields: every reader is updated in the
same change (`DiaryPage.tsx`, `eval/run-engine.ts`), so there is one meaning of "in range" in the code.

## Status, in this order (first match wins)

| # | Condition | status |
|---|---|---|
| 1 | no entries | `none` |
| 2 | `used > glBudget` | `over` (a load already above budget is not rescued by an unknown) |
| 3 | `partial` | `carbs_only` |
| 4 | `slots < 3` | `thin` |
| 5 | otherwise | `in_range` |

## Functions

```ts
export function weekSummary(diary: DiaryEntry[], glBudget: number, today: string): WeekSummary
export function weeksSummary(diary: DiaryEntry[], glBudget: number, today: string, count = 4): WeekBlock[]
```

- `weekSummary` keeps its signature and the seven-consecutive-calendar-dates behaviour (built with local
  `new Date(y, m-1, d - back)`, never by adding 24 hours: the existing zone test depends on it).
- `weeksSummary` returns `count` blocks, **block `ago` covers `today - (7·ago + 6)` through
  `today - 7·ago`**, so block 0 is exactly `weekSummary(...)`, no date is in two blocks, and the blocks tile
  the last 28 days. Implement it by calling `weekSummary` with the date `addDays(today, -7·ago)` (use the
  existing `addDays` from `./diary`).
- Group the diary by date **once** per call (a `Map<date, DiaryEntry[]>`), not by filtering the whole diary
  for each of the 28 days.

## What changes elsewhere

- `src/components/DiaryPage.tsx`: reads `inRangeDays`, `status`, `slots`, `estimate` (see `week-history-screen.md`).
- `eval/run-engine.ts`: the three existing `weekSummary` assertions that use `within` / `withinDays` are
  rewritten to `inRange` / `inRangeDays` with data that keeps their meaning (see `week-history-evals.md`).
- `docs/PRD.md`: after the North Star definition, one sentence: *"The Diary computes it with
  `weekSummary` in `src/lib/history.ts`; the weekly report uses the same function."*

## Verifiable

Cases are in `week-history-evals.md`. They read `status`, `inRange`, `slots`, `estimate`, `inRangeDays`,
`thinDays`, `carbsOnlyDays` and `weeksSummary(...)[k].days[*].date`; never text.

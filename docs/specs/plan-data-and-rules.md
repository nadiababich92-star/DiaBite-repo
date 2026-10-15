# Spec: the planned flag, the date rules and the counts

*From `docs/engineering/engineering-doc.md` (approved 15 October 2026), sections 5, 8 and 9. The migration is
`supabase/migrations/20261015130000_diary_planned.sql` (written, **not applied**). Nothing here has a screen; the screens are in
`plan-screens.md`. Build this spec first: every other spec reads it.*

## Files

`src/types.ts`, `src/lib/diary.ts`, `src/lib/syncCore.ts`, `src/lib/storage.ts`, `src/lib/history.ts`, `src/components/AskPage.tsx` (the
sums only, the picker is in `plan-screens.md`), `src/components/DiaryPage.tsx` (sums only), `src/App.tsx` if it sums the diary.

## `src/types.ts`

`DiaryEntry` gains one optional field, so every existing entry (and every device that has not updated) reads as eaten:

```ts
/** True for a meal planned for the day and not yet eaten. Absent or false means eaten. */
planned?: boolean
```

## `src/lib/diary.ts` (the one place for the rules)

```ts
export const MAX_BACKDATE_DAYS = 14
export const MAX_AHEAD_DAYS = 14
export const isPlanned = (e: DiaryEntry): boolean => e.planned === true
/** The entries that count: everything not planned. Every sum in the app reads this, never the raw diary. */
export const eaten = (entries: DiaryEntry[]): DiaryEntry[] => entries.filter((e) => !isPlanned(e))
export const planned = (entries: DiaryEntry[]): DiaryEntry[] => entries.filter(isPlanned)
/** The earliest and latest day a person may put a meal on, given their own today. */
export const dateRange = (today: string): { min: string; max: string } =>
  ({ min: addDays(today, -MAX_BACKDATE_DAYS), max: addDays(today, MAX_AHEAD_DAYS) })
export const dateAllowed = (date: string, today: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= dateRange(today).min && date <= dateRange(today).max
/** A date moved into the allowed range, and whether it had to move: the picker says so ("You can go back 14 days."). */
export function clampDate(date: string, today: string): { date: string; moved: 'back' | 'ahead' | null }
/** "Ate it": the same entry, no longer planned. The id is kept, so the other devices see an update, not a copy. */
export const markEaten = (e: DiaryEntry): DiaryEntry => { const { planned: _p, ...rest } = e; return rest }
```

`addDays` already counts calendar days, not 24-hour blocks, and is used for every comparison here (the range is compared as ISO strings, which
sort correctly). Today is the person's own, from `todayLocal()` / `useToday()`, never `toISOString()`.

`planned` is exported as a function name; inside `diary.ts`, call the local variable something else where it would shadow.

## The rule that counts (every reader)

| Reader | Change |
|---|---|
| Ask: `todayEntries` (the budget bar, "left today") | `eaten(diary.filter(date === today))` |
| Ask: the `entries` sent to the agent as the day so far | the same list: **no planned entry is ever sent** |
| Diary: a day's totals, the budget bar of the viewed day | totals over `eaten(dayEntries)`; the planned entries are listed separately |
| `weekSummary`, `weeksSummary` (`src/lib/history.ts`) | `group()` receives `eaten(diary)`, so a planned meal changes no status, slot count, `estimate` flag or `loggedDays`. A day with only planned entries is `none` |
| `recentEntries` ("the foods you log again") | over `eaten(diary)`: a plan is not a habit |
| Report script (`src/lib/report.ts`) | already reads `eaten(...)` |
| Menu "Added to today" state | unchanged (it only adds eaten entries today) |

Marking an entry eaten replaces it by id with `markEaten(e)`; from that moment it is in every sum above. Removing it deletes the row.

## Persistence

- `src/lib/syncCore.ts`: `DiaryRow` gains `planned: boolean`. `toRow` writes `planned: e.planned === true`. `fromRow` reads `planned: r.planned === true`
  and returns `{ …, ...(r.planned === true ? { planned: true } : {}) }` (a missing or non-boolean column is eaten). A row from the table before the migration has no
  `planned` key: it reads as eaten. `diffEntries` already compares `JSON.stringify(e)`, so a flag change is an upsert.
- **Migration order matters in one direction only:** a build that writes `planned` to a table without the column fails the upsert. Apply the migration **before**
  the deploy (the old build ignores a new column). `syncCore` must not send `planned` at all for an entry that is not planned *if* the column is missing — not
  needed once the migration is applied first; do not add a fallback.
- `src/lib/storage.ts` `usableEntry`: keeps the entry whatever `planned` is; `loadDiary` normalises `planned` to `true` only when it is exactly `true`
  (a string `"false"` must read as eaten). The export (`exportShape`) lists top-level keys only, so it is unchanged; the entries it carries include `planned`.
- The day-before copy ("Copy yesterday") in the Diary copies **eaten** entries only and writes them as eaten.

## Manual adds (the Diary)

`Add a food` on a day is limited to `dateAllowed(date, today)` (14 back, 14 ahead). On a future date it creates a **planned** entry (and the button reads "Plan it");
on today or a past date, an eaten one. Entries already older than 14 days stay and stay editable; the rule limits **new** entries only. Navigating the Diary
back past 14 days is not blocked (the person may be reading old entries); the Add form on such a day says "You can go back 14 days." and is disabled.

## Not changed

No server, endpoint, tool, prompt or environment variable. The agent does not know about the plan.

## Verifiable

`plan-evals.md` cases 1–4 (eaten, the counts, the range, the round-trip). Fields a check reads: `eaten()`, `weekSummary().days[i].status`, `toRow().planned`,
`fromRow()?.planned`, `dateAllowed`, `clampDate` — never rendered text.

# Spec: the weekly report (`npm run report`)

*From `docs/engineering/monitoring-feedback.md` (approved 15 October 2026), sections 1, 4, 8 and 10. Pure arithmetic in a tested
module, and a thin script that fetches. No endpoint, no change to the app.*

## Files

- `src/lib/report.ts` (new, pure, no I/O): everything below that is arithmetic.
- `scripts/report.ts` (new): fetches from Supabase and the turn log, calls `report.ts`, prints and saves.
- `package.json`: `"report": "tsx scripts/report.ts"`.
- `.gitignore`: add `docs/reports/` (a report describes real people, even numbered).
- `docs/monitoring.md`: a section "The weekly report: how to read it" (the definitions below, in plain words).

## `src/lib/report.ts`

```ts
import type { DiaryEntry } from '../types'

export interface AccountInput {
  createdAt: string                 // ISO, from the auth user
  onboarded: boolean                // the profile row exists and its data has onboarded === true
  glBudget: number                  // calculateTargets(profile).glBudget
  diary: DiaryEntry[]               // every entry of this person, planned ones included
}
export interface FeedbackInput { createdAt: string; rating: number; context: string | null; text: string }
export interface TurnStats {
  turns: number; verifiedRate: number; p50ms: number; p90ms: number
  blocked: number; regenerated: number; unknownShare: number; clarifyShare: number
  unknownQuestions: string[]        // typed questions that contained a food we do not have, deduplicated, at most 50
}
export interface ReportInput { today: string; accounts: AccountInput[]; feedback: FeedbackInput[]; turns: TurnStats | null }

export interface PersonRow {
  n: number                         // 1, 2, 3 … in order of sign-up; no email, no name
  onboarded: boolean
  firstMealDate: string | null      // the earliest EATEN entry
  mealSlots7: number                // distinct (date, meal) eaten in the 7 days ending today
  inRangeDays7: number              // weekSummary(...).inRangeDays
  loggedDays7: number
  returnedWithin2: boolean | null   // null while fewer than 2 days have passed since the first meal
  returnedWithin7: boolean | null
}
export interface Report {
  today: string
  signedUp: number; onboarded: number; firstMeal: number; active7: number
  retention: { within2: { eligible: number; returned: number }; within7: { eligible: number; returned: number } }
  mealSlots7Median: number | null; inRangeDays7Median: number | null   // among people with at least one eaten meal in the 7 days
  people: PersonRow[]
  feedback: { count: number; average: number | null; byContext: Record<string, number>; comments: { createdAt: string; rating: number; context: string | null; text: string }[] }
  turns: TurnStats | null
}
export function buildReport(input: ReportInput): Report
export function reportMarkdown(r: Report): string
```

### Definitions (the report and the app must agree)

- **Eaten** entries only: `eaten(diary)` from `src/lib/diary.ts` (an entry whose `planned` is not true). Planned entries are never counted.
- **signedUp** = the number of accounts. **onboarded** = `onboarded === true`. **firstMeal** = people with at least one eaten entry.
- **active7** = people with at least one eaten entry dated in the 7 days ending `today`.
- **firstMealDate** = the earliest eaten entry's date. **returnedWithin2** = an eaten entry dated after `firstMealDate` and on or before `addDays(firstMealDate, 2)`; `null` (not eligible yet) when `today < addDays(firstMealDate, 2)`. **returnedWithin7** the same with 7. The `retention` counts use only the eligible.
- **mealSlots7** = the number of distinct `(date, meal)` pairs among eaten entries in the 7 days ending today.
- **inRangeDays7** and **loggedDays7** = `weekSummary(diary, glBudget, today)`'s `inRangeDays` and `loggedDays` (the same function the Diary uses; that guarantee is the point).
- **People are numbered** by `createdAt` ascending. Nothing in a `PersonRow` identifies anyone.
- **Medians** by sorting and taking the middle (the mean of the two middle values for an even count), one decimal.
- **feedback.average** to one decimal; `byContext` counts rows by `context ?? 'form'`; `comments` newest first, the text as the person wrote it.

`reportMarkdown` prints, in this order: a one-line heading with the date; "People" (signed up, onboarded, first meal logged, active in the last 7 days); "Coming back" (within 2 days and within 7 days as `returned of eligible`); "Use in the last 7 days" (the two medians); a table of `PersonRow` (columns `#`, onboarded, first meal, meal slots, in-range days, logged days); "Feedback" (count, average, by context, then each comment with its date, rating and context); "The agent" (the `TurnStats` numbers) and "Typed questions with a food we do not have" (a bulleted list); and a closing line: "Numbered by sign-up order. No email or name is in this file."

## `scripts/report.ts`

```
npm run report                                  # the last 7 days, to the terminal and docs/reports/<today>.md
npm run report -- --exclude a@x.com,b@y.com     # leave these accounts out (the builder's own, say)
```

1. **Credentials, never printed:** the service key from the Container App secret, as `eval/screens.mjs` does:
   `az containerapp secret show -g rg-nadia.babich92-5702 -n diabite-engine --secret-name supabase-service-key --query value -o tsv`.
   The Supabase URL is the public one in `eval/screens.mjs`.
2. **Accounts:** `GET /auth/v1/admin/users?page=N&per_page=1000` until a page is short. Drop any whose email ends `@example.com` (the rehearsal, screens and demo-video throwaways) and any in `--exclude`. Keep only `id` and `created_at`; the email is used for the filter and then discarded.
3. **Profiles:** `GET /rest/v1/profiles?select=user_id,data` and compute `glBudget` with `calculateTargets(data)` and `onboarded` from `data.onboarded`.
4. **Diary:** `GET /rest/v1/diary_entries?select=user_id,id,day,meal,food_id,grams,snapshot,planned&order=user_id,id&offset=N&limit=1000`, **paged until a page is short** (CLAUDE.md rule 2: PostgREST stops at 1,000 rows without saying so). Map a row to a `DiaryEntry` with `fromRow` from `src/lib/syncCore.ts`.
5. **Feedback:** `GET /rest/v1/feedback?select=created_at,rating,context,feedback&order=created_at.desc`, paged the same way. `feedback` is the comment column.
6. **The turn log:** the workspace id from `az containerapp env show -g rg-nadia.babich92-5702 -n diabite-env --query properties.appLogsConfiguration.logAnalyticsConfiguration.customerId -o tsv`, then `az monitor log-analytics query -w <id> --analytics-query '<the query in docs/monitoring.md, over 7 days>' -o json`. If the call fails, `turns` is `null` and the report says "the turn log could not be read": the rest still prints. `unknownQuestions` come from lines with `unknownPhrases > 0`, the `question` field, trimmed to 200 characters, deduplicated case-insensitively.
7. **Output:** print the markdown and write it to `docs/reports/<today>.md` (create the folder). The exit code is 0 when the report printed, 1 when Supabase could not be read.

**Privacy rules the script enforces:** no email, name or user id is ever written to the terminal or the file; the typed questions are not tied to a person (the log carries a session id, not an account); a comment from the feedback table is printed as written and is unattributed.

## Verifiable

Cases are in `monitor-evals.md`: they build a `ReportInput` from a fixture and read `Report`'s fields, never the markdown prose, and check that the markdown contains no `@`.

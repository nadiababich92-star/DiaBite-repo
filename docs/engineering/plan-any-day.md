# Engineering document — log a meal on any day, and plan the days ahead

*Produced by `/engineering-planner` on 15 October 2026 and built. Archived on 20 October as `docs/engineering/plan-any-day.md` when the landing page was planned.*

## 1. Summary

**The feature.** Three changes that belong together, decided by the owner on 15 October:
1. **Log it on any day.** After an Ask answer the person can choose the day: today by default, back to **14 days ago**.
2. **Plan ahead.** A meal can be put on any day from today to **14 days ahead**. A planned meal sits in the Diary, marked **planned**, and **does not count** (not in the day's budget, not in the "in range" days) **until the person presses "Ate it"**. The Diary can show future days.
3. **A shopping list that follows the plan.** The list is built from the days the person has planned (today onward, not yet eaten); when nothing is planned it is built from the generated week, as today.

**Why.** Today "Log it" and "Add to today" always mean today, the Diary cannot go forward, and the weekly menu has a shopping list but no way to put a meal on a day. A person who ate dinner yesterday cannot log it from an answer, and a menu nobody can plan from is a list of ideas. The owner wants the feature in the five sessions.

**The product's central metric stays honest.** `docs/PRD.md` defines an in-range day as three meal slots logged and under budget. A planned meal is a promise, not a log: counting it would let a person "plan" a perfect week. Backdating is capped for the same reason.

**Success.** (1) Logging yesterday's dinner from an answer takes two taps. (2) A meal planned for Friday shows on Friday as planned and moves nothing until "Ate it". (3) The shopping list shows what to buy for the days planned. (4) No count in the app (budget bar, Diary totals, week, four weeks) changes because of a planned meal.

## 2. Scope

**In:** a `planned` flag on a diary entry (one migration); a day picker for Ask and the Menu; the Diary forward to +14 and back; "Ate it" and remove on a planned entry; counts that ignore planned entries everywhere; the shopping list from planned days; the same 14-day backdating rule for manual adds; engine cases and a rehearsal check; the sessions protocol gains one task.

**Out:** reminders or notifications, a calendar view, recurring meals, sharing a plan, a plan that adapts to what was eaten, the agent knowing about the plan, changes to the weekly menu generator.

**Later:** the agent suggesting a swap for a planned meal that now exceeds the day; a "plan this week for me" button that fills the dates from the generated week in one go.

## 3. User flows

```
Ask answer → "Log it" with a Day chip (Today · Yesterday · pick a date, 14 days back)
   → a diary entry on that date, eaten            → counts for that day at once
Ask answer → pick a future date → the button reads "Plan it"
   → a diary entry on that date with planned=true → shown dimmed with "planned", counts nowhere
Menu card → "Plan it…" (a day, today to +14)      → planned entry; "I ate this" keeps today's quick log
Diary, a future day → planned entries + "Ate it" / ✕
   "Ate it" → planned=false, the entry counts from that moment on that day
Menu → Shopping list → built from planned entries today onward; none planned → from the generated week
```

## 4. The promise check

No new number is produced. The nutrition numbers on a planned entry are the ones already stored with it (the engine's snapshot for an answer or a recipe, the local table for a plain food). The new sums the screen shows ("planned: GL x" under a day) add those stored numbers in the browser, as the Diary already does for the day. The shopping quantities are sums of grams of computed items, the same arithmetic as the current list. Nothing passes through a model and no verifier is involved.

## 5. Frontend

**New:** `src/components/DayPicker.tsx` (chips Today / Yesterday / Tomorrow and a native date input with `min` and `max`). **Changed:** `src/components/AskPage.tsx` (the Day chip, "Plan it"), `src/components/MenuPage.tsx` ("Plan it…", "I ate this", the list source), `src/components/DiaryPage.tsx` (forward navigation, planned rows, "Ate it", planned total, the 14-day rule on manual adds), `src/lib/diary.ts`, `src/lib/history.ts`, `src/lib/menu.ts`, `src/lib/storage.ts`, `src/lib/syncCore.ts`, `src/types.ts`, `src/styles.css`, `docs/design.md`.

**One rule in one place** (`src/lib/diary.ts`): `MAX_BACKDATE_DAYS = 14`, `MAX_AHEAD_DAYS = 14`, `dateAllowed(date, today)`, `isPlanned(e)`, `eaten(entries)` (the entries that count). Every sum in the app reads `eaten(diary)`, never `diary`: the budget bar and "left today" on Ask, the Diary day totals, `weekSummary`, `weeksSummary`, and the `entries` sent to the agent as the day so far.

**Planned in the Diary:** a row is dimmed and carries the pill **planned**; its buttons are "Ate it" and ✕. A planned entry on a past day is a plan that did not happen: the row says "planned, not eaten" and keeps both buttons. A day with planned entries shows one quiet line under the totals: "Planned: GL 14, not counted yet." (stored numbers added up in the browser).

**States:** empty plan, partial plan, future day with nothing, a day that is both eaten and planned, a date outside the range (the picker will not offer it; a typed date out of range snaps to the nearest allowed one and says so). **Phone:** the chips wrap, targets 44 px, the date input is native. **Accessibility:** the planned state is a word, not a colour; the date input has a visible label; focus returns to the button that opened the picker.

**Copy (for the owner):** "Day" (label), "Today", "Yesterday", "Tomorrow", "Pick a date", "Log it" (a day up to today), "Plan it" (a future day), "Ate it", "planned", "planned, not eaten", "Planned: GL 14, not counted yet.", "I ate this" (Menu, today). The limits are said when reached: "You can go back 14 days." and "You can plan 14 days ahead."

## 6. Engine and API

None. The agent route receives the same `entries`, now without planned ones. No new endpoint, tool or environment variable.

## 7. Agents

None. Prompts, router and tool spec are unchanged, so `npm run eval:agent` is not part of this change. (The agent does not know about the plan: out of scope.)

## 8. Data

**One column**, one migration `supabase/migrations/<timestamp>_diary_planned.sql`:
`alter table public.diary_entries add column if not exists planned boolean not null default false;`
Existing rows become `false` (eaten). Row-level security is unchanged: the policies are on rows, not columns, so the proof in `docs/security/security-plan.md` still holds, and the migration is safe to apply twice. The Supabase Data API change of 30 October 2026 applies to new tables only.

**What is stored about a person that is new:** whether a meal is planned, and meals dated up to 14 days ahead: what someone *intends* to eat. It lives in their diary, goes in their export and is deleted with their account (the same foreign key). The consent card ("What you log in your diary") is extended with "and meals you plan".

**No database rule on the date.** A check on `day` would break a diary imported from an older device (rows from before the 14-day rule are legitimate). The 14-day limits are client rules; a person writing their own rows by hand can only change their own diary.

`syncCore.ts` `toRow`/`fromRow` and `DiaryRow` gain `planned`; `storage.ts` `usableEntry` keeps it (a non-boolean is read as false); `exportShape` keys are unchanged (it lists the top-level keys of the export, not the entries').

**The shopping list** gets a second source: `shoppingFromEntries(entries, today, recipes)` in `src/lib/menu.ts` takes the planned entries from today to +14, expands a recipe entry (`rec:`) into its ingredients at its serving scale, keeps a plain food at its grams and an answer-logged food at its name and grams, and aggregates by food with the same rule as the current list (nothing under 5 g across the whole span is shopping). "Ticked" lines are remembered per list as today, keyed by the sorted ids of the planned entries, so a changed plan starts a fresh list.

## 9. Safety and responsible AI

- The weekly menu has not been reviewed by a clinician. Planning from it makes that more visible, so the Menu keeps its existing "not reviewed" line and the planning button does not hide it.
- A plan never produces a verdict. "Planned" shows numbers and nothing about whether the day will fit; the verdict is given when the person asks about a meal or marks it eaten.
- The cap on backdating and the exclusion of planned meals keep the north-star metric about what people ate.
- No dosing, red flag or refusal path is touched.

## 10. Evaluation plan — in the same change

**Engine cases** (`eval/run-engine.ts`, a `plan` block; prints `plan ok` or `WRONG`, exits non-zero on a miss):
1. `eaten([...])` drops planned entries and keeps the rest; an entry with no flag counts.
2. A planned entry changes nothing in `weekSummary`, `weeksSummary`, the day's GL total or the entries sent to the agent; marking it eaten (the flag off) makes it count exactly once.
3. `dateAllowed`: today, 14 days back and 14 ahead are allowed; 15 back and 15 ahead are not; across a month boundary and the clock change in three time zones.
4. `toRow`/`fromRow` round-trip `planned` true and false; a row with `planned` missing reads as eaten; `usableEntry` treats a non-boolean as false.
5. `shoppingFromEntries`: planned entries only, from today forward; an eaten entry and a planned entry on a past day are not in the list; a recipe expands to its ingredients scaled by servings; a food under 5 g in total is dropped; the same food on two days is summed.
6. With no planned entries the list is the generated week's (the old behaviour, unchanged).

**Rehearsal** (`eval/rehearsal.mjs`): `W17` plan a meal on a future day on device A, see it as planned on device B, mark it eaten on B, see it eaten on A.

**Screens:** `npm run screens` with the Day chip open, a planned row, a future day, and the shopping list from planned days, at 390 and 1366 px.

## 11. Rollout

1. Implement on `main` as one change: migration, `diary.ts` rule and `eaten`, `syncCore`/`storage`, the screens, `shoppingFromEntries`, cases, rehearsal, docs.
2. Apply the migration to the live project before the build that reads the column (the old build ignores an extra column, so the order is safe).
3. `tsc`, `npm run build`, `npm run eval`, `npm run rehearsal`; `npm run deploy`; **ask the running service**: log an entry for yesterday, plan one for tomorrow and see it dimmed, mark it eaten, check the budget bar moved only then.
4. **Rollback:** revert the commit and redeploy; the column stays and does no harm.

## 12. Open questions — the owner's

Decided on 15 October: planned entries live in the Diary and count only after "Ate it"; 14 days ahead; the shopping list follows planned days and falls back to the week; 14 days of backdating.

1. **The words** in section 5: the owner's to approve or change.
2. **Menu button:** "Plan it…" and "I ate this" instead of the single "Add to today". The proposal keeps today's quick log. Confirm.
3. **The sessions:** this feature is on for the five sessions. The protocol gets one task, *"Log what you ate yesterday"*, after step 2, and the consent card says "and meals you plan". Confirm.
4. **Manual adds in the Diary** also follow the 14-day rule (today they can go back without limit). Older entries stay. Confirm.

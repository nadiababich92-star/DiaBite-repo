# Spec: evaluation cases for the week

*From `docs/engineering/engineering-doc.md` section 10. Add these **in the same change** as the code
(CLAUDE.md, stage 5). No agent case: no agent behaviour changes, so `npm run eval:agent` is not part of
this change; `npm run eval` is.*

## Engine cases (`eval/run-engine.ts`, in the existing block that imports `weekSummary`)

Print `week ok` or `WRONG` through the existing `ok(...)` helper; a miss exits non-zero as today. Helpers:
`day(n)` is the existing date helper; `e(id, date, meal, foodId, grams)` builds an entry; use a food with
a small known load (`egg`) and one large (`rice-white`, 400 g). `snap(over)` builds an entry with a snapshot,
for packaged (`loadAvailable: false`, `gl: 0`) and assumed (`assumed: true`) cases. Budget `20`.

1. **One apple is not a day.** One `egg` entry at lunch, under budget → `status === 'thin'`, `inRange === false`,
   `inRangeDays === 0`, `slots === 1`.
2. **Three slots, under budget** (egg at breakfast, egg at lunch, egg at dinner) → `in_range`, `inRange`,
   `slots === 3`, `inRangeDays === 1`.
3. **Slots, not entries.** Three `egg` entries all at lunch → `thin`, `slots === 1`.
4. **Four slots count as three.** Breakfast, lunch, dinner, snack under budget → `in_range`, `slots === 4`.
5. **Over budget** with four slots (add `rice-white` 400 g at dinner) → `over`, not in range.
6. **A packaged food stops the count.** Three slots under budget and one `loadAvailable: false` entry →
   `carbs_only`, `partial`, not in range, `carbsOnlyDays === 1`.
7. **A load already over is not rescued.** Three slots, over budget **and** a packaged food → `over`.
8. **An estimate still counts, and says so.** Three slots under budget, one entry `assumed: true` →
   `in_range`, `estimate === true`; the same day without it → `estimate === false`.
9. **Two slots is thin even when light.** Breakfast and dinner under budget → `thin`, `thinDays === 1`.
10. **A mixed week.** One `in_range`, one `over`, one `thin`, one `carbs_only`, three empty →
    `inRangeDays === 1`, `loggedDays === 4`, `thinDays === 1`, `carbsOnlyDays === 1`, and
    `inRangeDays === days.filter(d => d.inRange).length`.
11. **Four blocks tile 28 days.** For `today = day(10)`: `weeksSummary(...)` has 4 blocks;
    `blocks[0].days` equals `weekSummary(...).days`; the 28 dates are all different and consecutive;
    `blocks[k].days[6].date === addDays(today, -7k)`.
12. **Month boundary and clock changes.** The block test over `'2026-11-02'` crosses October into November;
    repeat the existing three-zone loop (`America/Los_Angeles`, `Europe/Warsaw`, `Pacific/Auckland`) for
    `weeksSummary` with the same `today` list: 28 distinct consecutive dates, block ends 7 days apart.
13. **The old checks still pass**, rewritten to the new fields: seven days ending today oldest first; a
    day with nothing logged is never in range and `loggedDays === 2` in the old fixture; over versus
    light (a light day with a single egg is now `thin`, so the fixture adds the other two slots for the
    "within" assertion); carbs-only labelled partial; month boundary; seven consecutive dates in three zones.

## Screen seeding (`eval/screens.mjs`)

Add `SEED` (default unset). When set, after creating the throwaway account and before opening the app, insert
28 days of rows into `diary_entries` with the service key, shaped by `toRow` (`user_id, id, day, meal,
food_id, grams, snapshot, updated_at`), then delete them with the account:

- `SEED=full`: this week 5 in-range days (three slots each, `egg`/`oats`-class foods well under budget),
  one over, one thin; last week 3 in range; two weeks ago nothing; three weeks ago 1 in range and 1 carbs-only.
- `SEED=thin`: this week three days with one `egg` each.
- `SEED=empty`: no rows (today's behaviour).

The screens run asks its one question as before; the Diary shot is the one to look at.

## Rollout checks (live, after deploy)

On the live app, signed in: log breakfast, lunch and dinner under budget on one day and see the line read
`1 of 7 days in range this week.`; log one apple on another day and see `1 day was logged with fewer than 3
meals`, and the count unchanged.

## Documents to change in the same change

`docs/PRD.md` (the one sentence in `week-history-logic.md`), `docs/design.md` (the Diary line), and
`docs/ROADMAP-to-investors.md`, item 1.6, restated as: *the seven-day view existed; added the PRD's in-range
definition, the count, a four-week strip.*

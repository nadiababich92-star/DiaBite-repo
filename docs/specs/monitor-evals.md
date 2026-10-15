# Spec: evaluation cases for monitoring and feedback

*From `docs/engineering/monitoring-feedback.md`, section 10. Add these **in the same change** (CLAUDE.md, stage 5). No agent
case: no agent behaviour changes, so `npm run eval:agent` is not part of it; `npm run eval`, `npm run rehearsal` and `npm run build` are.*

## Engine cases (`eval/run-engine.ts`, a `monitor` block; prints `monitor ok` or `WRONG` and exits non-zero)

Import `nextNudge, markAsked, sanitizeAsked` from `../src/lib/nudge`, `buildReport, reportMarkdown` from `../src/lib/report`, `CONSENT_VERSION` from `../src/lib/syncCore`.

**Nudge** (`ctx(over)` builds a `NudgeContext` with `eatenSlots: 0`, `firstMealDate: null`, `today: '2026-10-20'`, `asked: []`, all booleans false):
1. Two eaten slots: `null`. Three: `'after_3_meals'`.
2. With `after_3_meals` in `asked` and `firstMealDate` equal to today: `null` (the same day is not "a later day").
3. With `after_3_meals` asked, `firstMealDate: '2026-10-19'`, `today: '2026-10-20'`: `'day_2'`; with `day_2` asked as well: `null`.
4. `busy`, `suspended` or `shownThisVisit` each give `null` whatever else is true.
5. `after_3_meals` is offered before `day_2` when both are due.
6. `sanitizeAsked(null | 'x' | {} | [1,'nope'])` is `[]`; `sanitizeAsked(['day_2','bogus'])` is `['day_2']`; `markAsked(['day_2'],'day_2')` has no duplicate.

**Report** (a fixture of five accounts: one not onboarded; one with a first meal today; one whose first meal was 3 days ago and who ate again 2 days after it; one whose first meal was 10 days ago and who never came back; one whose only entries are planned):
7. `signedUp 5`, `onboarded 4`, `firstMeal 3` (the planned-only person has no eaten meal), numbers match the fixture.
8. `retention.within2.eligible` counts only people whose first meal is at least 2 days old and `returned` counts those who came back within 2 days; the same for 7.
9. `inRangeDays7` of a person equals `weekSummary(thatDiary, budget, today).inRangeDays` (build one person with three meal slots under budget on one day).
10. A planned entry changes nothing: removing the planned entries from the fixture leaves the report identical.
11. People are numbered 1…n by `createdAt`; `JSON.stringify(report)` and `reportMarkdown(report)` contain no `@`.
12. `feedback.average`, `byContext` (a null context counts as `form`) and the order of `comments` (newest first).

**Consent:** 13. the card source (`src/components/Onboarding.tsx`) contains the sentence "What you type into Ask, kept for 30 days to improve DiaBite, and not tied to your name or email." and `CONSENT_VERSION === '2026-10-b'`.

## Rehearsal (`eval/rehearsal.mjs`)

`W18`: a throwaway account logs three meals (use the Diary's manual add on three meal slots), the Ask screen then shows exactly one element with `aria-label="Feedback"` whose text starts with "How is it going?"; **Not now** removes it; after a reload it does not return; with `localStorage` cleared and the first meal dated today it does not return either (still not a later day). A second check, `W19`: choosing a rating and pressing **Send** writes one `feedback` row with `context = 'after_3_meals'` and a comment of `(rating only)`; the row is read back with the service key and then deleted with the account's other rows.

## Screens and live checks

`npm run screens` with the card shown (set the three meals through `SEED=full`'s account): the card at 390 and 1366 px, light and dark. After deploy: the migration `20261015120000_feedback_context.sql` is applied **before** the build; `npm run report` runs against the live project, prints and saves a report, and `grep -c '@' docs/reports/<today>.md` is `0`.

## Documents to change in the same change

`docs/monitoring.md` (how to read the report), `docs/USER_SESSIONS.md` (the card), `docs/design.md` (the Feedback card entry), `docs/ROADMAP-to-investors.md` (item 2.5 built).

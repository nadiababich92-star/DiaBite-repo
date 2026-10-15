# Engineering document — watching the test users, and hearing from them

*Produced by `/engineering-planner` on 15 October 2026, a second plan beside `docs/engineering/engineering-doc.md` (log on any day). **Not yet approved.** The owner asked for all three parts on 15 October.*

## 1. Summary

Before strangers use DiaBite for free, three things: (1) **a weekly report** of how they use it, from data we already hold, run with one command; (2) **one honest line in the consent card** about what we log; (3) **a gentle feedback prompt** inside the app, two taps, so people who use it free tell us what they think. A shared mailbox on the new domain is a separate purchase and follows in section 12.

**What exists, checked on 15 October.** Every agent turn writes one JSON line to Azure's log for 30 days, including **the text the person typed** (`LOG_QUESTIONS` is on) and a session id that is not tied to an account. A feedback form is in You and writes to the `feedback` table, but nobody is told when a row arrives. The consent card lists the email, the answers about yourself and the diary, and **does not say the typed questions are logged.** The weekly report of roadmap item 2.5 is not built.

**Success.** (1) One command prints, per week: how many signed up, finished onboarding, logged a first meal; meals per person; who came back on day 2 and day 7; in-range days; feedback received. (2) The consent card says what is logged. (3) A person who has logged three meals is asked once how it is going, and the answer reaches the owner in the next report.

## 2. Scope

**In:** `npm run report`; one consent line and a consent version bump; the in-app prompt; a `context` column on `feedback`; engine cases.
**Out:** a third-party analytics tool or tracking script (the PRD forbids it), event tracking of clicks, session recordings (the five sessions use notes and consented recording as written in `docs/USER_SESSIONS.md`), emails from the app other than sign-in.
**Later:** an email to the owner when feedback arrives (needs a sender on the new domain, section 12), a retention chart.

## 3. User flows

```
Owner → npm run report → Supabase (accounts, profiles, diary, feedback) + the turn log → a report in the terminal and docs/reports/<date>.md
Person logs a 3rd eaten meal (or returns on a later day) → Ask shows one card "How is it going?" → 1 to 5 and an optional line → feedback row
Person asks "Not now" → the card does not return for that milestone
```

## 4. The promise check

No nutrition number is shown or produced. The report is arithmetic over stored rows. "In-range days" is computed with `weekSummary` from `src/lib/history.ts`, the same function the Diary uses, so the report and the app cannot disagree. Nothing goes through a model.

## 5. Frontend

**New:** `src/components/FeedbackNudge.tsx`, `src/lib/nudge.ts` (pure: when to ask). **Changed:** `src/components/AskPage.tsx` (mounts the card), `src/components/Onboarding.tsx` (the consent line), `src/lib/syncCore.ts` (`CONSENT_VERSION`), `src/styles.css`.

- **The card** sits at the top of the Ask screen, in the existing card style: "How is it going?", five buttons 1 to 5 labelled with the words the feedback form already uses (Not useful … Very useful), an optional one-line box, "Send" and "Not now". It never covers the answer, never takes focus, and is gone after one answer.
- **When** (`nudge.ts`): after the person's third *eaten* meal slot has been logged, once; and once more on the first visit on a later day than the first meal. Each milestone is remembered in this browser (`localStorage`, key `diabite.nudge.v1`), so it is asked at most twice and never in a refused-storage browser more than once per visit. Never while a tip, the feedback form or a dialog is open, and never while a question is being answered.
- **Consent line**, added as a fourth bullet under "What DiaBite keeps": *"What you type into Ask, kept for 30 days to improve DiaBite, and not tied to your name or email."* The statement is true: the turn log carries a session id, not the account (verified in `server/agent.ts`), and Azure keeps it 30 days. `CONSENT_VERSION` moves to `2026-10-b`; a person who already consented under the old text is not asked again (the version is stored, not enforced); new consents carry the new one.
- Phone at 375 px: the five buttons wrap in two rows; targets 44 px; the planned/eaten distinction of the other plan is respected (only eaten meals count towards "three").

## 6. Engine and API

None new. The card writes through the existing `submitFeedback` (`src/lib/feedback.ts`) to the `feedback` table, insert-only for the public role as now.

## 7. Agents

None.

## 8. Data

- **Migration** `supabase/migrations/<timestamp>_feedback_context.sql`: `alter table public.feedback add column if not exists context text check (context is null or char_length(context) <= 40);` Values: `form` (the existing form), `after_3_meals`, `day_2`. Insert-only policy unchanged; safe to apply twice.
- **The report reads** `auth.users` (created, last sign-in) through the admin API, `profiles` (onboarded, consent time and version), `diary_entries` (day, meal, grams, snapshot, planned) and `feedback`, all with the service key from the Container App secret (read at run time, never printed). **The report names no one:** people are numbered by order of sign-up, and no email, name or free text from a person's profile is printed. Feedback comments are printed as written (the person chose to send them), with the number of the person only when they were signed in; the feedback table has no user id today, so comments stay unattributed.
- **The turn log** is read with `az monitor log-analytics query` (workspace id from the Container App environment). It gives turns, verified rate, latency, blocked questions and **the typed questions that contained a food we do not have** (the labelled-set candidates: `docs/monitoring.md`). It cannot be tied to a person, by design.
- Nothing new is stored about a person except the nudge's two flags in their own browser.

## 9. Safety and responsible AI

- The consent line tells people what is logged before they type; without it the product keeps text people typed without having been told. This is the owner's decision and should be made before the first stranger.
- A feedback prompt asks for an opinion, never for health data; the placeholder says so ("Tell us what worked or did not. Please don't write your medical details here.").
- The report is for the builder: aggregate and numbered, so a leaked copy identifies no one.
- No clinician review is needed: no number, threshold or advice changes.

## 10. Evaluation plan — in the same change

**Engine cases** (`eval/run-engine.ts`, a `monitor` block; prints `monitor ok` or `WRONG`, exits non-zero on a miss):
1. `nudge`: not asked before the third eaten meal slot; asked once at the third; not asked again; the day-2 prompt only on a later day than the first meal; planned meals do not count; nothing while busy or while a dialog is open; storage unavailable means once per visit.
2. `report` (a pure module `src/lib/report.ts`, so it is tested without Supabase): from a small fixture of accounts and diaries it counts signed up, onboarded, first meal, returned on day 2 and on day 7, meals per person per week, and in-range days **equal to `weekSummary`'s** for the same diary; people are numbered by sign-up order; no field of the output contains an email.
3. The consent card text contains the new bullet, and `CONSENT_VERSION` changed.

**Screens:** the card at 390 and 1366 px, light and dark. **Rehearsal:** `W18`, a throwaway account logs three meals and the card appears once, "Not now" removes it, a reload does not bring it back. **Live check:** a row with `context = after_3_meals` is in the table; `npm run report` runs against the live project and prints no email.

## 11. Rollout

1. Implement on `main`: `report.ts` and `scripts/report.ts` (the `report` npm script), `nudge.ts` and the card, the consent line, `CONSENT_VERSION`, the migration, cases, rehearsal, `docs/monitoring.md` (how to read the report), `docs/USER_SESSIONS.md` (the card is part of what a person sees).
2. Apply the migration before the build that writes `context` (an old build never sends it).
3. `tsc`, `build`, `eval`, `rehearsal`; deploy; ask the running service for the bundle text and the table row.
4. **Rollback:** revert the commit; the column and the old rows stay and do no harm.

## 12. Open questions — the owner's

1. **Log the typed questions, with the consent line (proposed), or stop logging their text.** The first keeps the most useful signal and needs the owner's yes; the second removes the signal and the need for the line.
2. **The prompt's words and moments** (after the third meal, and on a later day): the owner's to change.
3. **The report's home:** printed in the terminal and saved to `docs/reports/<date>.md`, which stays out of git (it describes real people, even numbered). Confirm.
4. **A shared mailbox on `diabite.pro`.** Hostinger sells it as a plan (Starter Business Email, about $0.39 a month per mailbox when paid for 48 months, renewing at $1.59; prices as seen on 15 October, confirm at checkout). The owner buys it and sets its password: those are payments and credentials, not mine. Then: `hello@diabite.pro` goes on the site, in the form and in the invitation, and, as a *later* step, becomes the sender of a "new feedback" email through Azure Communication Services (a DNS record on the same domain). Until then, feedback arrives in the weekly report.

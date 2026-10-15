# Spec: the feedback prompt and the consent line

*From `docs/engineering/monitoring-feedback.md`, sections 5, 6, 8 and 9. Build with `monitor-report.md`; the migration is
`supabase/migrations/20261015120000_feedback_context.sql`.*

## The consent card (`src/components/Onboarding.tsx`, `src/lib/syncCore.ts`)

In the list under "What DiaBite keeps" (shown to a signed-in person with no profile yet), the diary bullet and a new bullet read, exactly:

- *What you log in your diary, and the meals you plan.*  (the plan feature is in the same release; if it ships later, the bullet is "What you log in your diary." until then)
- *What you type into Ask, kept for 30 days to improve DiaBite, and not tied to your name or email.*

`CONSENT_VERSION` in `syncCore.ts` becomes `'2026-10-b'`. A person who consented under `'2026-10-draft'` is **not** asked again (the stored version is recorded, not enforced); new consents carry the new one. The statement is true and stays true only while the turn log carries a session id and not an account: `server/agent.ts`'s `logTurn` must not gain a user id (a comment above it says so).

## When to ask (`src/lib/nudge.ts`, new, pure)

```ts
export type Milestone = 'after_3_meals' | 'day_2'
export interface NudgeContext {
  eatenSlots: number              // distinct (date, meal) over eaten entries, all time
  firstMealDate: string | null    // earliest eaten entry
  today: string
  asked: readonly Milestone[]     // from this browser
  busy: boolean                   // a question is being answered
  suspended: boolean              // a tip, the feedback form, the How it works sheet or the import prompt is open
  shownThisVisit: boolean         // a card already appeared since the page loaded
}
export function nextNudge(c: NudgeContext): Milestone | null
export function markAsked(asked: readonly Milestone[], m: Milestone): Milestone[]
export function sanitizeAsked(stored: unknown): Milestone[]        // only known ids; anything else is []
```

`nextNudge` returns `null` when `busy`, `suspended` or `shownThisVisit`. Otherwise: `'after_3_meals'` when `eatenSlots >= 3` and it is not in `asked`; else `'day_2'` when `firstMealDate` exists, `today > firstMealDate`, `eatenSlots >= 1` and it is not in `asked`; else `null`. Planned meals are not eaten (`eaten()` from `diary.ts`; until the plan feature ships, every entry is eaten). **Storage:** `loadNudge()` / `saveNudge(asked)` in `src/lib/storage.ts`, key `diabite.nudge.v1`, the same guarded `read`/`write` as the tour (storage unavailable reads as `[]`, so the card is asked at most once per visit).

## The card (`src/components/FeedbackNudge.tsx`, new)

Props `{ milestone: Milestone; onDone: (milestone: Milestone) => void }`. Rendered at the top of the Ask panel (before the budget card), only when `nextNudge(...)` is not null; `onDone` runs `saveNudge(markAsked(...))` and sets `shownThisVisit`.

| Element | Spec |
|---|---|
| Container | existing `.card`, `role="region"`, `aria-label="Feedback"`, `aria-live="polite"`; **never takes focus** |
| Heading (card style) | **How is it going?** |
| Rating | five buttons `1`–`5`, each `aria-label="N — <label>"` with the labels already in `FeedbackModal.tsx` (Not useful, Barely useful, Somewhat useful, Useful, Very useful); 44 px; pressed state `aria-pressed`; none is selected at the start |
| Line | one optional text input, placeholder **Tell us what worked or did not. Please don't write your medical details here.**, `maxLength` 300 |
| Buttons | **Send** (disabled until a rating is chosen) and **Not now** |
| After Send | the card is replaced by one line, **Thank you. This goes to the person building DiaBite.**, with a "Close" link; no confetti, no praise |
| Errors | the same one plain sentence the form uses; the card stays so the person can retry |

**Submission** goes through `submitFeedback` in `src/lib/feedback.ts`, which changes as follows: `Feedback` gains `context?: 'form' | 'after_3_meals' | 'day_2'`; the insert adds `context: input.context ?? 'form'`; the `feedback` column is non-empty by constraint, so when the optional line is blank the comment sent is **`(rating only)`**. `FeedbackModal.tsx` passes `context: 'form'` explicitly. The test hook (`trigger error`) is unchanged.

## Documents

`docs/USER_SESSIONS.md`, "Before the call": add *"The app may ask once 'How is it going?' after the third meal. Do not mention it and do not turn it off."* `docs/design.md`: one entry "Feedback card" (what it is, that it never takes focus, that it asks once per moment).

## Verifiable

`monitor-evals.md`: the rules of `nextNudge`, `sanitizeAsked`, the consent text and version, and the rehearsal check `W18`.

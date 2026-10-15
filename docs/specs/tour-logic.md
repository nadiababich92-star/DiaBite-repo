# Spec: the tips' logic (`src/lib/tour.ts`)

*From `docs/engineering/engineering-doc.md` (approved 15 October 2026), sections 3, 5, 8 and 10. Build this first: the component and the cases depend on it. No migration, no endpoint, no environment variable. Pure functions plus one guarded storage key; nothing is sent anywhere.*

## Types

```ts
export type TourStep = 'input' | 'verdict' | 'calc' | 'log'

/** What the Ask screen knows right now. */
export interface TourContext {
  /** Any answer is on screen (advice, a question, a refusal, a meal). */
  hasReply: boolean
  /** The answer carries a receipt: a meal was costed (including an assumed-recipe estimate). */
  hasReceipt: boolean
  /** That receipt is an assumed recipe (`receipt.assumed`): the verdict step has its own copy. */
  assumed: boolean
  /** A question is being answered. */
  busy: boolean
  /** The feedback form or the import prompt is open. */
  suspended: boolean
}

export interface TourCopy { title: string; body: string; button: 'Next' | 'Got it' }
```

## The order and the copy (exact)

`STEP_ORDER = ['input', 'verdict', 'calc', 'log']`. No copy contains a digit; the example phrase is words.

| step | title | body | button |
|---|---|---|---|
| `input` | Say what you ate | Type a meal the way you would say it, for example “two eggs and a slice of rye toast”. Give a portion if you know it; if you do not, DiaBite tells you which one it used. | Got it |
| `verdict` | Here is the verdict | It compares this meal with what is left of your day. The engine makes that comparison, not the AI's opinion. | Next |
| `verdict`, `assumed` | This one is an estimate | The dish is not in our database, so it was counted from typical ingredients. Change anything that is not yours. | Next |
| `calc` | Check the arithmetic | Tap Show calculation to see every food, its weight and its load. Each number comes from the database. | Next |
| `log` | Keep it in your Diary | The log button adds this meal to today, and your week builds up in the Diary. | Got it |

**One change from the plan's copy, to keep it true:** the log button reads "Log it" for a fully counted meal and "Log what was counted" for a partial one, so step 4 says "The log button" instead of quoting a label. The owner sees it in this spec; no other word differs.

"Skip tips" is a third button on every tip, not part of `TourCopy`.

## Functions

```ts
export function nextStep(seen: readonly TourStep[], ctx: TourContext): TourStep | null
export function copyFor(step: TourStep, ctx: Pick<TourContext, 'assumed'>): TourCopy
export function markSeen(seen: readonly TourStep[], step: TourStep): TourStep[]   // adds once, keeps STEP_ORDER
export function allSteps(): TourStep[]                                            // "Skip tips"
export function sanitizeSeen(stored: unknown): TourStep[]                         // anything not a list of known ids → []
export function initialSeen(stored: unknown | null, base: { onboardedAtStart: boolean; diaryAtStart: number }): TourStep[]
```

**`nextStep`** returns the first step of `STEP_ORDER` that is not in `seen` **and** eligible, or `null`:
- `suspended` or `busy` → `null`.
- `input` is eligible only while `!hasReply` (a person who has already been answered is past the empty screen; once any reply exists the step is treated as satisfied and never offered).
- `verdict`, `calc`, `log` are eligible only when `hasReceipt`, and **only in order**: `calc` is offered only after `verdict` is in `seen`, `log` only after `calc`. A reply with no receipt (advice, a question, a refusal, an unknown food) offers nothing.

**`initialSeen`** runs **once, when the app starts, from localStorage only**: `stored === null` (the key is absent) and (`onboardedAtStart` or `diaryAtStart > 0`) → `allSteps()` (a person who used the app before this release, or on this browser, is not shown a first-run guide). `onboardedAtStart` is read from the stored profile **before** onboarding can complete in this visit, so a brand-new person (profile not onboarded at start) is not marked seen after finishing onboarding a minute later. Otherwise `sanitizeSeen(stored)`.

## Storage

Key `diabite.tour.v1`, value a JSON array of step ids, read and written through the same guarded helpers as `src/lib/storage.ts` (`read`/`write` there are module-private: export two small wrappers `loadTour(): unknown | null` and `saveTour(seen: TourStep[])` from `storage.ts`, with the same try/catch and the same "storage unavailable means nothing persisted, nothing thrown"). It is **not** part of the account export (`exportShape` is unchanged), is not synced, and holds no personal data.

## Verifiable

Cases are in `tour-evals.md`: they read `nextStep`, `markSeen`, `initialSeen`, `sanitizeSeen` and the copy table, never rendered text.

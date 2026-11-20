# Spec — A free first answer without signing in: what the screen does

*Stage 2, from `docs/engineering/engineering-doc.md` (approved 20 November 2026). Companion specs: `anon-engine.md`, `anon-evals.md`. Read `docs/design.md` (and apply `/design-system`) before any UI code: **no new colour, size or font.***

**No migration, nothing stored on a server, no prompt change.** The browser keeps one random device id and nothing else new.

## Files

| File | Change |
|---|---|
| `docs/design.md` | one section, "The first answers, signed out" (section 8), written **before** the CSS |
| `src/lib/device.ts` | **new**: the random device id |
| `src/lib/auth.ts` | `useAccess()` (replaces `useSignInRequired()`; the old name stays as a one-line wrapper) |
| `src/lib/agent.ts` | the device header on `/agent/ask` and `/meal/recompute`; `SignInRequiredError` carries `reason` and `retryAfterSec` |
| `src/lib/profile.ts` | `ANON_PROFILE` |
| `src/App.tsx` | the gate: anonymous mode, locked tabs |
| `src/components/Landing.tsx` | the key goes to the Ask screen when free answers are on |
| `src/components/AskPage.tsx` | the banner, **Sign in to log this**, the limit card, no day picker |
| `src/components/SignInCard.tsx` | **new**: the card the locked tabs show |
| `src/components/SettingsPage.tsx` | an anonymous variant |
| `src/styles.css` | classes that only compose existing tokens (section 7) |
| `.env.example` | the five settings (this change; text in `anon-evals.md`) |

## 1. The device id (`src/lib/device.ts`)

```ts
const KEY = 'diabite.device.v1'
/** A random version-4 UUID kept in this browser. Sent only as a header, only when the person is signed out. Never read by anything but the engine's counters. */
export function deviceId(): string
```

`crypto.randomUUID()`; stored in `localStorage` inside `try/catch` (the app must render with no stored value); if storage is unavailable, one id per page load (never a constant: the earlier `'anon'` fallback was a defect, `docs/security/security-plan.md` S3). A malformed stored value is replaced.

## 2. What the app learns from the engine (`src/lib/auth.ts`)

`GET /health` now says `{ ok, records, signIn, freeAnswers }`.

```ts
export interface Access { required: boolean | null; freeAnswers: number }
export function useAccess(): Access        // null while unknown; freeAnswers 0 when absent or when the engine cannot be reached
```

If the engine cannot be reached, `required` is `true` and `freeAnswers` is 0 (the wall is the safe side, as today).

## 3. The gate (`src/App.tsx`)

```ts
const [anon, setAnon] = useState<boolean>(() => sessionStorage.getItem('diabite.anon') === '1')   // try/catch
```

Rules, in this order (everything else in the gate is unchanged):

1. `access.required === null` or auth loading → "Opening DiaBite…" (unchanged).
2. **Signed in** → the app as today; `anon` is cleared (`sessionStorage.removeItem`).
3. **Signed out, `required`, `freeAnswers > 0`, and `anon`** → the app in **anonymous mode** (below).
4. **Signed out, `required`** and not `anon` → the landing page (key: **Ask a question** when `freeAnswers > 0`), or the sign-in form (`entering`, `/?signin`, an email link, a notice), exactly as `showLanding` decides today. Pressing **Ask a question** sets `anon` and `sessionStorage 'diabite.anon' = '1'`.
5. Signed out, not `required` → today's app with local data (unchanged).

**Anonymous mode** renders the shell with the five tabs:

| Tab | What it shows |
|---|---|
| Ask | the Ask screen with `ANON_PROFILE`'s targets, the banner (section 4), no day picker, no diary |
| Diary, Menu, You | `SignInCard` (section 5), nothing of the real screen behind it |
| Settings | the anonymous variant (section 6) |

`profile`, `targets` and `diary` for the Ask screen are **not** loaded from or saved to `localStorage` or the server in this mode: `profile = ANON_PROFILE`, `targets = calculateTargets(ANON_PROFILE)`, `diary = []`, `onLog` is never called. Pressing **Make it yours**, **Sign in** or any `SignInCard` key sets `signingIn` and shows the existing sign-in form (`onCancel` returns to the anonymous Ask screen); a signed-in result runs the existing account load and onboarding (with its safety exits and consent card), and the anonymous answers are not carried over (decided).

## 4. The neutral profile and the Ask screen

**`ANON_PROFILE`** (`src/lib/profile.ts`), exactly:

```ts
export const ANON_PROFILE: Profile = { ...DEFAULT_PROFILE, condition: 't2', carbApproach: 'moderate', goal: 'maintain', onboarded: true }
```

(the app's default profile with only these three fields changed; `units` stays `'imperial'`; `insulin: 'none'`, no pregnancy, no meds). The targets are `calculateTargets(ANON_PROFILE)`: the same formulas as everyone's, so the glycemic-load budget is not invented. `exitReason(ANON_PROFILE)` is `null` (a test).

**The banner** (`AskPage`, above the day budget figures; a `<p className="anon-banner">`): 

> Counting for a typical adult. **Make it yours**

the second sentence is a `button.link` (`anon-make`). The optional **disclosure line** is a separate `<p className="anon-note muted">` rendered **only when** `ANON_DISCLOSURE` is a non-empty string, a constant in `src/lib/profile.ts` that is **`''` until the owner says yes**; the text proposed for it is `For adults. Not for mealtime insulin or pregnancy. Not medical advice.` Changing it is one string, no other code.

**Other Ask changes in anonymous mode:** no day picker and no "Adding to Today" line; the log button reads **Sign in to log this** and opens sign-in; `Portions`, the receipt, the weights line, `Weights I used` and the one-tap correction work exactly as for a signed-in person (`/meal/recompute` carries the device header). The first-run tips and the feedback card are not shown (they depend on a diary). `entries` sent to the engine is `[]`, `units` is `'imperial'`, no `avoid`, no `carbLimit`.

**The request.** `askAgent` and `recomputeMeal` add the header `x-diabite-device: <deviceId()>` **only when there is no access token**. A signed-in request carries no device header.

## 5. The cards

`SignInCard({ title, body })`: a `section.card.signin-card` with an `h2` (the card-heading type), a `p.muted`, and one `button.primary` **Sign in**. One primary per view. Copy, exactly:

| Where | Title | Body |
|---|---|---|
| Diary | Sign in to keep a diary | The Diary saves what you eat and counts it against your own day. Sign in with your email; there is no password. |
| Menu | Sign in to plan your week | The weekly menu is counted against your own targets. Sign in with your email; there is no password. |
| You | Sign in to make the numbers yours | Your targets come from your age, height, weight and how you eat. Sign in with your email, answer a few questions, and the day's budget becomes yours. |

**The limit card** (`AskPage`, under the answer or in its place): same component, `section.card.anon-limit`:

| | |
|---|---|
| Title | That was your third free answer for today |
| Body | Sign in with your email to keep going, keep a diary and make the numbers yours. |
| Line under the body, when `retryAfterSec` is known | Another free answer in about {n} {hours/hour/minutes}. (`n` is `retryAfterSec` rounded up to whole hours; under one hour, whole minutes; "1 hour" singular) |
| Key | Sign in |

It appears (a) under the third verdict answer, as part of the answer, and (b) in place of an answer when the engine says `401 free_limit` (the typed question stays in the box). A `401` with `reason: 'anonymous_off'` while anonymous mode is on means the feature was switched off: clear `anon` and show the landing page.

## 6. Settings, anonymous variant

Appearance (Tape, Paper, Follow my phone), Help (**How it works**, Send feedback is hidden: it needs a person), and one `button.primary` **Sign in**. No account block, no export, no delete, no clinician summary.

## 7. States

| State | What the person sees |
|---|---|
| loading the engine's answer about access | "Opening DiaBite…" |
| landing, free answers on | the key **Ask a question** and a quieter **Sign in** |
| landing, free answers off | exactly today's landing and key **Try DiaBite** |
| anonymous Ask, nothing asked | the Ask screen, the banner, the neutral day budget |
| an answer that is a question or a refusal | as today; it is not counted |
| a costed meal | the whole answer; if it is the third, the limit card follows it |
| the limit | the limit card |
| the feature switched off while open | the landing page |
| a rate limit (`429`) | the existing message ("That is a lot of changes at once…" or the daily message) |
| offline, 502 | the existing messages |
| Diary, Menu, You | the sign-in card |

**Phone (375 px):** the banner wraps under the budget; cards and the key are full width; nothing is wider than the Ask screen today. **Accessibility:** the banner and cards are text read in order; `button.link` and keys are at least 44 px; the limit card is announced by the existing live region of the answer; focus is not moved by any of it; the existing focus ring.

## 8. `docs/design.md` (a section, before the CSS)

> ### The first answers, signed out
> A visitor with no account can ask three questions a day (the engine's count of answers that cost a meal). The Ask screen is the same one, with one line under the budget bar, "Counting for a typical adult. **Make it yours**", because the budget is not theirs, and no log button: it reads **Sign in to log this**. The Diary, Menu and You tabs each show one card with one key; nothing sits behind it. When the three are used, one card says so, with when another is free, and offers the same key. No countdown, no score, no praise. The card and banner use the card, pill and link tokens; **Sign in** is the one primary key in the view. A disclosure line ("For adults. Not for mealtime insulin or pregnancy. Not medical advice.") is built and off until the owner says yes.

CSS: `.anon-banner` (body text, `--text-dim`, 14 px, one line that wraps), `.anon-note` (the `muted` rule), `.signin-card` and `.anon-limit` (the card rule with the card-heading `h2`). Every value is a named token already in `src/styles.css`; no hex, no new custom property. Both colour schemes inherit.

## Verifiable

`anon-evals.md`: the static renders for every card and state above, the rehearsal W21 on a fresh browser, and by eye on the live app at 375 px and at desktop width, in Tape and in Paper, signed out.

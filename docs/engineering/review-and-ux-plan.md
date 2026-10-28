# Engineering document — the rest of the 27 October review and the designer session

*Written 28 October 2026 by `/engineering-planner`. It is a separate file because `docs/engineering/engineering-doc.md` is still the landing page's plan and is not overwritten. Nothing here is built until the owner says "yes" to a step.*

## 1. Summary

**What.** Two lists of work, made one ordered list of small steps that the owner checks one at a time:

- **A. The 27 October code review.** Done and live: #1, #2, #3, #7 (revision 151) and #4, #8 (revision 153; live `eval:agent` 103/103, 213/213). Left: #6, #5, #9, the medium and minor items, and one clinical item that is the owner's.
- **B. The designer session, 27 October (Fernanda, UX).** Notes: <https://docs.google.com/document/d/1k6vFE3vIS1W-mrqDxHCpaWHCyWWkT6RqtpwXJGQomUM>. Eleven findings about the screens, one bug report, one decision already taken (barcode scanning waits for funding).

**Why.** PRD-product: a stranger must understand the answer without help (the ask screen, the receipt, the diary). A tester who needed the founder in the room to read "glycemic load", to find where to type an answer, or to find her own allergy is the failure the user sessions exist to find. The review items are the ones that can lose or leak a person's diary.

**Success.** (1) After each step the owner sees the change, on her phone or at 375 px, and says "next". (2) `npm run eval` and `npm run eval:abuse` stay green after every step; `npm run eval:agent` (103/103) after every step that touches the ask path. (3) No number on any screen is produced anywhere but the engine.

## 2. What the logs say about the sign-in "bug"

Fernanda's report: *the code email was delayed and she landed in onboarding without typing a code.* The Supabase auth log for that evening (27 Oct, UTC) shows what happened:

| Time | Event |
|---|---|
| 20:59:42 | `POST /auth/v1/otp`: the first email was requested. |
| 21:00:16 | `GET /auth/v1/verify?type=signup`: **the link in the email was opened**, 34 s later. Login method `implicit`. A new account has no profile, so the next screen is onboarding. |
| 21:03:30 | The second email was requested ("send again"). |
| 21:03:51 | `POST /auth/v1/verify`: **the code was typed**, login method `otp`. |

So the email was neither late nor skipped: the link in it signs a person in, by design (`SignIn.tsx` says "Open it on this device, or type the code"), and a tester who opens the link while the code box is still on the other screen lands in the app and is surprised. **It is not a hole in authentication** (a signed-in session needs a valid token either way), and no code change to `server/auth.ts` is needed. It is a wording problem, handled in step 1.

## 3. Scope

**In:** the steps in section 5.
**Out:** barcode scanning (decided, deferred until funding); the carb-approach rule for SGLT2 and "Very low carb" (clinical, the owner's, see section 12); any new nutrition number; a new database table.
**Later:** a per-person "my dishes" list (already open in `docs/PLAN.md`); a profile review screen if step 11 shows people need more than one edit shortcut.

## 4. The promise check

No step adds, computes or rewords a nutrition number. Step 6 only adds unit labels beside numbers the engine already returns. Step 12 builds a dish description from the recipe's own ingredient list (data we hold), not from a model. The verdict check added in #4 (`server/verify.ts: verdictConflict`) is unchanged. If a step turns out to need a new number, it stops and asks.

## 5. The steps, in order

Each step is one commit, deployed, then checked by the owner (her choice: a deploy after every step). "Check" is what she looks at; "Proof" is what I run.

| # | Step | Files | Check (owner) | Proof (me) |
|---|---|---|---|---|
| 1 | **Sign-in wording.** The code screen says either one works: "Open the link in the email, or type the code. Either signs you in." | `src/components/SignIn.tsx` | Read the screen at 375 px | `npm run eval` (the authCore checks), screenshot |
| 2 | **#6 sign-out race.** `signOutAndClear` awaits `signOut()`, and only then clears the device; in between, `onAuthStateChange` runs `setDiary(loadDiary())` and the `saveDiary` effect, so the account's diary can be written back after it was cleared. Clear the in-memory state first, hold a "signing out" flag so nothing is saved, then `signOut()`, then `clearDevice()`. | `src/lib/auth.ts`, `src/App.tsx` | Sign in, add a meal, sign out, look at the Diary: empty, and `localStorage` holds no `diabite.*` diary | A new check in `eval/run-engine.ts` on the pure part; a screens run of sign-out |
| 3 | **#5 sync deletes what this device never had.** With `PENDING_KEY` set, `load()` keeps the local diary and `prime()` records the server's entries as "synced", so `diffEntries` sees every server entry missing locally and deletes it from the account. Decided: **merge** the two (`mergeById`, later `updatedAt` wins) and prime with the merged list. A deletion made offline may therefore come back. | `src/App.tsx`, `src/lib/sync.ts`, `src/lib/syncCore.ts` | Two browsers: add an entry in A, break A's network and edit, add a different entry in B, restore A: both entries remain | New cases in `eval/run-engine.ts` for the merge and for `diffEntries` after it |
| 3a | **Sign-out on one device only.** `supabase.auth.signOut()` defaults to `scope: 'global'` (auth-js 2.117), so signing out on a phone ends the laptop's session without the laptop clearing its diary. Pass `{ scope: 'local' }`. Added 28 Oct at the owner's request. A session that ends for another reason (revoked, expired) still leaves the data on the device; clearing it automatically would lose unsynced entries, so that stays as it is. | `src/lib/auth.ts` (`signOutAndClear`) | Sign in on two browsers, sign out in one: the other stays signed in | A check on the call's argument; the abuse suite is unaffected |
| 4 | **#9 hanging evals.** CDP calls without a timeout, and Chrome processes left running when a script dies. A per-call timeout, a `finally` that kills the browser, and a process-exit hook. | `eval/lib/cdp.mjs`, the scripts that call it (`eval/screens.mjs`, `eval/smoke.mjs`, `eval/a11y.mjs`, `eval/landing-live.mjs`) | Nothing to see; `pgrep -f chrome` is empty after a killed run | Kill a run on purpose and check |
| 5 | **Answer field under the question.** The clarifying question's answer box sits directly under the question, with an example in the placeholder (from the question's own options). | `src/components/AskPage.tsx`, `src/styles.css` | Ask "chicken", read where the box is | Screens at 375 px and desktop, light and dark; `eval:agent` unchanged |
| 6 | **Units on the result.** Grams, kilocalories and servings are labelled everywhere; the glycemic load gets its name spelled out once, with the existing "what is this" sheet (`GlInfo.tsx`) one tap away. A glycemic load has no unit; **no unit is invented for it.** | `src/components/AskPage.tsx` (receipt, lines near 95–125 and 311), `src/components/GlInfo.tsx` | Read a result as someone newly diagnosed would | Screens; a text check that no number lacks its label on the receipt fixture |
| 7 | **Button copy "Add food".** The label names what happens: "Add to today", "Add to Friday", "Plan for Friday", from the day on show. *Proposed wording, yours to change.* | `src/components/DiaryPage.tsx` | Read it on today and on a future day | Screens |
| 8 | **Planned above eaten.** On the diary day, planned meals come before logged ones. Totals still count only what was eaten. | `src/components/DiaryPage.tsx`, `src/styles.css` | Plan a meal for tomorrow and look | The existing diary-week checks stay green |
| 9 | **Settings tab.** A fifth tab, "Settings": Account, Appearance, Help move out of "You". Tabs at 375 px must fit on one row. | `src/App.tsx`, `src/components/ProfilePage.tsx`, new `src/components/SettingsPage.tsx`, `src/styles.css`, `docs/design.md` (tab bar), `src/lib/tour.ts` (a tour step names the tab) | All five tabs on a phone; sign-out still reachable | Screens at 375 px; `tour` check in `npm run eval` |
| 10 | **Excluded foods hint.** *Decided: leave the behaviour as it is.* Only the text under the field says what it does: type a food; allergies and "how you eat" are set in onboarding and the profile, and apply to the whole family (shellfish, milk, nuts). | `src/components/ProfilePage.tsx` | Read it | Screens |
| 11 | **Edit one answer without the whole onboarding.** The profile page gets an edit link on each onboarding answer that opens that one step and returns. *This is a design change: I draw it first and you approve it before any code.* | `src/components/Onboarding.tsx`, `src/components/ProfilePage.tsx` | The sketch, then the screen | Screens; the onboarding checks |
| 12 | **Menu dish descriptions.** A short line under each dish title, built from the recipe's own ingredient list ("tomato sauce, mozzarella, spinach"). Not model-written, not clinical. | `src/components/MenuPage.tsx`, `src/lib/recipes.ts` | Open the menu | `npm run eval` (the menu checks) |
| 13 | **Several ingredients added to a meal.** Reproduce first on the live service ("steak, rice and beans", then adding items to the meal); the step is then a fix or an honest "not supported yet" message, whichever the cause shows. | `src/components/AskPage.tsx`, `src/lib/agent.ts`, maybe `server/engine.ts` (`/meal/recompute`) | The reproduction, then the fix | A new agent case; `eval:agent` |
| 14 | **Landing: data sources visible.** The sources (USDA and the glycemic index database) get their own band with their names and years, from `docs/data-sources.md`. Check the "University of Columbia" wording first: Gemini wrote it and it may be wrong. | `src/components/Landing.tsx`, `src/data/landing.ts`, `docs/design.md` if a value is missing | Read the landing at 375 px | The landing checks L1–L9 in `npm run eval` |
| 15 | **Day section on top.** *Not clear what was meant* (see section 12); built only after the question is answered. | `src/components/AskPage.tsx` | — | — |
| 16 | **Medium and minor review items.** One batch: `aria-controls` on the disclosure buttons, `docs/design.md` out of step with `src/styles.css`, the doctype in the docs pages, Onboarding focus and `inputMode`, `carbsWithoutLoad` for recipes, the danger button under 44 px, the zoom on the date picker, the dev proxy for `/account`. The exact lines are in the review (the session transcript); I list them again before starting. | several | I list each fix | `npm run eval`, screens, `eval/a11y.mjs` |

Steps 1 to 4 are small and safe; 5 to 10 are what Fernanda saw; 11 to 15 need a decision or a drawing first.

## 6. User flows touched

```
Sign out   tap → App sets "signing out" → memory cleared → supabase.signOut → clearDevice → SignIn
Sync       open app → loadAccount → (pending? merge local+server : take server) → prime(merged) → diff → push
Ask        type → /agent/ask → answer card; clarifying question → answer box under it → /agent/ask again
```

## 7. Engine and API

No new routes. Step 13 may touch `/meal/recompute`. The session-ownership wall from batch 1 stays as it is.

## 8. Agents

No prompt, tool-spec or model change in any step. If step 13 needs one, it is a separate step with the 12-sample rule from `CLAUDE.md`.

## 9. Data

No table, column or migration. What is stored about a person does not change; step 3 changes only which side wins when two devices disagree, and never deletes a diary entry silently.

## 10. Safety and responsible AI

- Step 3 chooses "an entry may come back" over "an entry may vanish". For a diary a person relies on for a clinic visit, a reappearing entry is the lesser harm.
- Step 10 and the allergy remark: the field's behaviour is **unchanged on purpose** (owner's decision). The hint must not suggest that typing "seafood" excludes a whole family; it says what is true.
- Step 6 must not make "glycemic load" read as a quantity with a unit it does not have.
- Nothing here changes a threshold, a verdict or a refusal.

## 11. Evaluation plan, in the same change as each step

Engine (`npm run eval`): the sign-out clearing (2), the merge and `diffEntries` after it (3), the dish description builder (12), the label check (6). Agent (`npm run eval:agent`): a case for several ingredients (13). Screens (`eval/screens.mjs`): steps 1, 2, 5–12, 14 at 375 px and desktop, light and dark. `npm run eval:abuse` runs after steps 2, 3 and 13.

## 12. Rollout and open questions

**Rollout, per step:** build → `npm run eval` → commit → push → `npm run deploy` → ask the running service (`/health`, a screenshot of the live page) → owner checks → next. Rollback is the previous revision (`az containerapp revision activate`); no step changes data, so a rollback loses nothing.

**Open questions — the owner's:**

1. **Step 15, "day section at the top".** In the notes Fernanda wants "the day section at the top, then inputs, results, logs". Which is "the day section": the bar with "glycemic load left today" (already at the top of the ask page), or the day picker that now appears only below a result, next to "Log it"? I will not guess.
2. **Step 7, the wording** of the button.
3. **Step 11,** whether a per-answer edit link is enough or you want a "review your answers" page.
4. **The carb-approach rule** (`carbApproachBlocked`: SGLT2 with "Very low carb") in `ProfilePage.tsx`. A clinical decision; not scheduled. It waits for you.
5. **The session id in the turn log** (plain text in `logTurn`, `server/agent.ts`): hashing it would change how you search sessions. Not scheduled.

**Yours alone, not mine:** tell Fernanda when the changes are ready and ask her for the second review; send her the LinkedIn post, the Maven link and the platform name you promised; pay for the post boost.

# Engineering document — first-run tips and a "How it works" sheet

*Produced by `/engineering-planner` on 15 October 2026. The previous document (the week in the Diary) is archived as `docs/engineering/diary-week.md`. **Not yet approved.***

## 1. Summary

**The feature.** A short, interactive first-run guide that points at the real screen, as many apps do on first launch. Decided by the owner on 15 October:
- **Form: a hybrid.** One tip on the empty Ask screen before the first question. Three more tips appear after the first **real** answer that carries a receipt: the verdict, "Show calculation", "Log what was counted". Menu and You are explained by a button, not by tips.
- **Who sees it:** everyone on first launch, plus a **"How it works"** button in You.
- **Memory:** in this browser (`localStorage`); nothing is written to the server.
- **The five moderated sessions: the tour stays on.** Stated consequence, below.

**Why hybrid and not a tour of the empty screens.** A tour before the first question cannot point at a verdict or a receipt: there is no answer yet. Showing a sample answer would put numbers on screen that the engine did not compute, which the one promise forbids. Tips that hang on the first real answer show real numbers and cost nothing.

**The user problem.** PRD "How will you know that the problem is solved?": time to log a meal under 20 seconds and week-4 retention of 30%. People who do not understand the receipt do not trust the verdict, and those who do not know to open it never learn why the number is what it is. The cohort leader's feedback on 15 October (`docs/FEEDBACK-demo-day.md`) also asks for an easier start.

**Success.** (1) A first-time person sees one tip before the first question and three after the first answer, never twice, and never a number the engine did not compute. (2) The tips never block typing, tapping or the tab bar. (3) "How it works" opens at any time and says what Ask, Diary, Menu and You are for.

## 2. Scope

**In:** a pure step logic with its own tests; a tip component anchored to existing elements; a "How it works" sheet; the button in You; styles from the existing tokens; the screens and rehearsal scripts made aware of the tour; the sessions protocol reworded.

**Out:** analytics of the tour (nothing is collected), a tour of Menu, You or the onboarding form, a sample answer with fixed numbers, any new table, endpoint or agent.

**Later (the owner asked for it, after the tour ships):** rebuild the demo: a new `docs/DEMO_SCRIPT.md`, a new clip (recorded in a clean profile, so the tour appears as a first-time person sees it), and a refreshed deck. That is a separate change.

## 3. User flows

```
First launch, signed in, onboarding done → Ask tab, empty
   → Tour sees: nothing seen, no receipt   → tip 1 on the input ("Say what you ate")
Types a meal, gets a costed answer (a receipt exists)
   → Tour sees: tip 1 seen, receipt present → tip 2 on the verdict, then 3 on "Show calculation", then 4 on the log button
Taps "Got it" / "Next"    → the next step; "Skip tips" → every step is marked seen
You → "How it works"      → a sheet (no spotlight): one line each for Ask, Diary, Menu, You, and where the receipt is
Returns on the same browser → nothing shown (steps are in localStorage)
New device or cleared storage → the tips are shown again, by design (one device, one time)
```

An advice answer, a clarifying question or a refusal has no receipt, so **no tip hangs on it**. A dish counted from an assumed recipe has a receipt and tone "Estimate": tip 2 then says so (copy in section 5).

## 4. The promise check

The tour shows **no number computed by anything**. Its copy contains no figure: the example phrase is words ("two eggs and a slice of rye toast"). The tips explain where numbers come from and point at numbers the engine returned for this person's own question; they do not display one. Nothing here passes through the model or the verifier. If a later step ever needed a figure, it would have to read it from the answer on screen, never from a constant in the tour.

## 5. Frontend

**New files:** `src/lib/tour.ts` (pure logic), `src/components/Tour.tsx` (the tip), `src/components/HowItWorks.tsx` (the sheet).
**Changed files:** `src/components/AskPage.tsx` (anchors and mount), `src/components/ProfilePage.tsx` (the button), `src/styles.css`, `docs/design.md`.

**Anchors.** Four existing elements get a `data-tour` attribute: `input` (the ask box), `verdict` (the answer's badge and headline block), `calc` (the "Show calculation" button), `log` (the log button). The tip finds its anchor with `querySelector`; if the anchor is not on screen, the step waits and is not marked seen.

**The tips (exact copy, for the owner's approval).**

| # | Anchor | Title | Body |
|---|---|---|---|
| 1 | `input` | Say what you ate | Type a meal the way you would say it, for example “two eggs and a slice of rye toast”. Give a portion if you know it; if you do not, DiaBite tells you which one it used. |
| 2 | `verdict` | Here is the verdict | It compares this meal with what is left of your day. The engine makes that comparison, not the AI's opinion. |
| 2 (estimate) | `verdict` | This one is an estimate | The dish is not in our database, so it was counted from typical ingredients. Change anything that is not yours. |
| 3 | `calc` | Check the arithmetic | Tap Show calculation to see every food, its weight and its load. Each number comes from the database. |
| 4 | `log` | Keep it in your Diary | Log what was counted adds this meal to today, and your week builds up in the Diary. |

Buttons: "Next" on 2 and 3, "Got it" on 1 and 4, "Skip tips" always. Sentence-case, no exclamation marks, no emoji (design file).

**The sheet "How it works"** (a plain card opened from a button in You, closable, no spotlight): four lines: *Ask* (describe a meal, get a verdict and the receipt), *Diary* (what you logged, and your week), *Menu* (a week of meals and a shopping list, not yet reviewed by a clinician), *You* (your profile, your data, delete your account); then "Every number is computed by the engine from a food database, never written by the AI. Open Show calculation on any answer to see it." No figures.

**Behaviour and accessibility.**
- A tip is a small card with a ring on its anchor (the accent token), placed below the anchor on a laptop and, on a phone, as a card pinned above the tab bar so it never covers the input or the keyboard. It is **non-modal**: the page behind stays usable; typing, tapping and the tab bar all work.
- `role="dialog"`, `aria-labelledby`, focus moves to its primary button on show and returns to the anchor on close; Escape means "Skip tips"; targets are at least 44 px; text at least 13 px; it respects `prefers-reduced-motion` (no animation at all is needed).
- It never appears while onboarding, the feedback form or the import prompt is open.
- Phone at 375 px: one column, the card never wider than the screen minus the 16 px gutter. Light and dark use existing tokens only; **no new colour, no new size**.

**States:** empty (tip 1), answered (tips 2 to 4), skipped (nothing), storage unavailable (the tips show once per visit, and nothing breaks), anchor missing (the step waits).

## 6. Engine and API

None. No endpoint, no tool, no environment variable.

## 7. Agents

None. Prompts, the router and the tool spec are unchanged, so `npm run eval:agent` is not required.

## 8. Data

No table, no migration. **Nothing is stored about a person on a server.** One `localStorage` key, `diabite.tour.v1`, holds a list of step ids already shown (for example `["input","verdict"]`), read through the same guarded reader as the profile (storage unavailable or malformed means "nothing seen this visit"). It is not part of the account export and is removed with the browser's data, not by "Delete account" (it holds no personal data).

**Returning people.** A person who used the app before this release has no key. To avoid showing a first-run guide to someone who has used it for days, steps 1 to 4 are marked seen silently when the browser already holds an onboarded profile or any diary entry at the moment the key is first looked for. They still have the button.

## 9. Safety and responsible AI

- The copy makes no claim about health. The sentence that the engine, not the AI's opinion, makes the comparison is true (`afterMeal.fits`) and does not call the verdict advice.
- The estimate variant (tip 2) says plainly that the answer is counted from typical ingredients.
- The sheet repeats that Menu is not yet reviewed by a clinician.
- No clinician review is needed: no number, threshold or advice changes.

## 10. Evaluation plan — in the same change

**Engine cases** (`eval/run-engine.ts`, a `tour` block; prints `tour ok` or `WRONG` and exits non-zero on a miss). They read the pure logic in `src/lib/tour.ts`, never rendered text:
1. Nothing seen, no receipt, Ask tab empty: next step is `input`.
2. `input` seen, no receipt: no step (nothing hangs on an advice answer or a question).
3. `input` seen, receipt present: `verdict`, then `calc`, then `log` in that order, one at a time as each is marked seen.
4. A receipt with `assumed`: the verdict step uses the estimate copy id.
5. All seen: no step. "Skip tips" marks all four seen.
6. Malformed or missing storage: treated as nothing seen; no exception.
7. A returning person (onboarded profile or any diary entry when the key is first absent) has all four marked seen.
8. No step text contains a digit (the copy table is checked: the tour never carries a figure).
9. No step is offered while onboarding, the feedback form or the import prompt is open.

**Agent cases:** none. **Screens:** `npm run screens` and `npm run rehearsal` set the tour as seen by default (otherwise the tip overlaps what they click); `TOUR=1 npm run screens` shows it. Look at the tips at 390 and 1366 px, light and dark: tip 1 on the empty Ask screen, tips 2 to 4 after an answer, and the sheet in You.

## 11. Rollout

1. Implement on `main`: `tour.ts`, `Tour.tsx`, `HowItWorks.tsx`, `AskPage.tsx`, `ProfilePage.tsx`, `styles.css`, `docs/design.md`, `eval/run-engine.ts`, `eval/screens.mjs`, `eval/rehearsal.mjs`, `docs/USER_SESSIONS.md`.
2. `tsc`, `npm run build`, `npm run eval`, `npm run rehearsal`.
3. `npm run deploy`; **ask the running service**: the served bundle contains the tip copy; open the app in a clean browser profile and walk the four tips.
4. **Rollback:** revert the commit and redeploy, or reactivate the previous revision. No data to undo.

## 12. Open questions — the owner's

Decided on 15 October: hybrid form; everyone at first launch plus a button in You; the tour is **not** turned off for the sessions; the memory lives in the browser.

1. **The copy of the four tips and the sheet** (section 5). The words are the owner's.
2. **What the sessions now measure.** With the tour on, "do they find the receipt unprompted?" (`docs/USER_SESSIONS.md`, goal 1 and step 4) can no longer be answered: tip 3 tells them. The protocol is reworded instead: goal 1 becomes *"Do they open the receipt again, on a later meal, without the tip, and what do they make of it?"*; step 4 asks what the tip told them and whether they believe the number, and watches whether they return to "Show calculation" on a second answer. Confirm, or turn the tour off for sessions after all (a `?tour=off` link would do it with no stored data).
3. **A returning person sees no tour** (section 8). Confirm, or show it to them once.

# Spec: evaluation cases for the tips

*From `docs/engineering/engineering-doc.md` section 10. Add these **in the same change** (CLAUDE.md, stage 5). No agent case: no agent, prompt or tool changes, so `npm run eval:agent` is not part of this change; `npm run eval`, `npm run rehearsal` and `npm run build` are.*

## Engine cases (`eval/run-engine.ts`, a `tour` block)

Import `nextStep, copyFor, markSeen, allSteps, sanitizeSeen, initialSeen, STEP_ORDER` from `../src/lib/tour`. Print `tour ok` or `WRONG` with the failing bits and `process.exit(1)` on a miss. Helper `ctx(over)` builds a `TourContext` with all booleans false.

1. **Empty screen:** `nextStep([], ctx({}))` is `'input'`.
2. **Busy or suspended:** `nextStep([], ctx({ busy: true }))` and `nextStep([], ctx({ suspended: true }))` are `null`.
3. **No receipt, no tip:** `nextStep(['input'], ctx({ hasReply: true }))` is `null` (an advice answer, a question or a refusal); and `nextStep([], ctx({ hasReply: true }))` is `null` (a person already answered is past the empty screen, `input` is never offered late).
4. **The sequence on a receipt:** with `ctx({ hasReply: true, hasReceipt: true })`: `nextStep([], …)` is `'verdict'`; after `markSeen` of it, `'calc'`; then `'log'`; then `null`. `calc` is never offered while `verdict` is unseen, and `log` never while `calc` is unseen.
5. **The estimate copy:** `copyFor('verdict', { assumed: true }).title === 'This one is an estimate'` and `copyFor('verdict', { assumed: false }).title === 'Here is the verdict'`; the other steps' copy does not depend on `assumed`.
6. **Skip:** `allSteps()` equals `STEP_ORDER` and `nextStep(allSteps(), anyCtx)` is `null` for every combination of the booleans.
7. **Storage is untrusted:** `sanitizeSeen` of `null`, `'x'`, `{}`, `[1, 'nope']` is `[]`; of `['input', 'bogus', 'log']` is `['input', 'log']`; `markSeen(['input'], 'input')` has no duplicate and keeps `STEP_ORDER`.
8. **A returning person:** `initialSeen(null, { onboardedAtStart: true, diaryAtStart: 0 })` and `initialSeen(null, { onboardedAtStart: false, diaryAtStart: 3 })` are `allSteps()`; **a new person** `initialSeen(null, { onboardedAtStart: false, diaryAtStart: 0 })` is `[]`; a stored `['input']` is kept as it is for either.
9. **No figure in the copy:** no string in the copy table (every step, both verdict variants) contains a digit; and no step's button is anything but `Next` or `Got it`.

## Scripts that must not be blocked by the tips

- `eval/screens.mjs` and `eval/rehearsal.mjs` both run `localStorage.clear(); localStorage.setItem('sb-…-auth-token', …)` before opening the app. Add, in the same statement, `localStorage.setItem('diabite.tour.v1', JSON.stringify(['input','verdict','calc','log']))`, so the tips never sit over what the scripts click. `screens.mjs` leaves the key out when `TOUR=1` is set and, then, takes `tour-1` (empty Ask screen) after the first load and `tour-2`, `tour-3`, `tour-4` after the answer, clicking each tip's button, plus `how-it-works` after opening the sheet from You.
- `rehearsal.mjs` gets one check, `W16`: with the key absent and a brand-new account, the first Ask screen after onboarding shows exactly one tip (the element with `aria-label="Tip"` exists and its text starts with "Say what you ate"); with the key set to all four, none is shown.

## Rewording `docs/USER_SESSIONS.md` (owner-approved on 15 October)

Replace learning goal 1 with:

> 1. **Do people open the receipt again?** The first-run tips tell a new person where "Show calculation" is, so whether they find it is no longer a question. What we can still learn: on a later answer, without the tip, do they open it again, and what do they make of it? If nobody does, the argument "every number traces to a tool" is real and still invisible, and that changes what we build.

Replace step 4 ("Why is the number what it is") with:

> **Watch for:** on their second or third answer, whether they open the calculation without being told. Ask, after they have tried: *"The tip said you can see the arithmetic. What did you make of it?"*, then say nothing. Note whether they believe the number once they have seen it.

Add to "Before the call": *The app shows four first-run tips to a new browser. Do not mention them and do not turn them off: they are part of what the person sees.* Keep the opening and the rule "say nothing for ten seconds" as they are.

## Rollout checks (live, after deploy)

The served bundle contains the copy (`Say what you ate`, `This one is an estimate`, `Check the arithmetic`, `Keep it in your Diary`, `How it works`). In a clean browser profile: one tip on the empty Ask screen; after a first meal, tips 2, 3, 4 in order, never twice; after reload nothing; in You, "How it works" opens the sheet and Escape closes it with focus back on the button.

## Documents to change in the same change

`docs/design.md` (the Tip entry), `docs/USER_SESSIONS.md` (the rewording above), `docs/ROADMAP-to-investors.md` (a new line under phase 1: first-run tips built; the demo rebuild follows it).

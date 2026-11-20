# Spec — A free first answer without signing in: the checks that prove it

*Stage 2, from `docs/engineering/engineering-doc.md` (approved 20 November 2026). Companion specs: `anon-engine.md`, `anon-screen.md`. A feature is not finished until `npm run eval`, `npm run eval:abuse`, the rehearsal check and `npm run eval:agent` have run and every case below is added in the same change (CLAUDE.md, stage 5). **Mechanical checks read status codes, fields and counters, never the wording of an answer** (rule 7).*

**Ids:** `AN1` to `AN5` for the engine block, `ANA` to `ANE` for the abuse suite (no model, no money), `S` renders `AS1` to `AS7`, `W21` for the rehearsal (`W20` is the weight correction).

## 1. Engine block `anon` (`eval/run-engine.ts`)

The block calls the functions of `anon-engine.md` with small values set through the environment and `_reset()` between cases; it prints `anon ok` or `WRONG` with the misses.

| Id | Case | Expectation |
|---|---|---|
| AN1 | `countsAsFreeAnswer(trace)` | **true** for a `compute_meal` result with `totals`; for a `cost_dish` result with `totals` (an estimate counts); for a partial meal (`afterMeal.fits` null). **false** for a `compute_meal` result with `needsWeight`; with an `error`; a trace with only `resolve_foods`; an empty trace (a clarifying question, advice, a gate refusal) |
| AN2 | `chargeAnon` and `countFreeAnswer` with `ANON_FREE_ANSWERS=3`, `ANON_MODEL_CALLS_DAY=10` | three verdict answers (each `chargeAnon` then `countFreeAnswer`) are admitted; the fourth `chargeAnon` throws `SignInNeeded('free_limit')` with `retryAfterSec > 0`; with the verdict count at 0 but ten `chargeAnon` calls made, the eleventh throws `free_limit` (the model-call cap); a second device on the same address, with `ANON_ADDRESS_ANSWERS_DAY=3`, throws after the address has three; a missing or malformed device id (`deviceKeyOf` undefined) shares one allowance per address (two calls with no device on one address are the same visitor) and never gets more than a sent one |
| AN3 | `ANON_FREE_ANSWERS=0` | `chargeAnon` throws `SignInNeeded('anonymous_off')` before any counter is touched |
| AN4 | the ceiling inside the ceiling | with `ASK_DAILY_CEILING=3` and `ASK_ANON_DAILY_CEILING=2`: two anonymous turns admitted, the third `RateLimited('anon_daily')`; a signed-in `chargeTurn` is still admitted until the global three |
| AN5 | the neutral profile | `exitReason(ANON_PROFILE)` is `null`; `ANON_PROFILE` equals `DEFAULT_PROFILE` in every field except `condition` (`'t2'`), `carbApproach` (`'moderate'`), `goal` (`'maintain'`) and `onboarded` (`true`); `calculateTargets(ANON_PROFILE)` is within the app's own bounds (carbohydrate between `DAILY_CARBS_MIN` and `DAILY_CARBS_MAX`) |
| AN6 | `deviceKeyOf` | a version-4 UUID gives a 16-character hex key, the same key twice, and not the id; a version-1 UUID, a 35-character string, an array and `undefined` give `undefined` |
| AN7 | the allowance resets | after a rolling 24 hours (`now` advanced) the same device is admitted again |

## 2. Abuse suite (`eval/run-abuse.ts`; the agent is not reachable here, so a request that passes the limits ends 502 and counts as admitted, as the suite's `ADMITTED` set does)

The suite starts the engine with `REQUIRE_SIGN_IN=on` and these settings (tiny, so the suite is fast): `ANON_FREE_ANSWERS=2`, `ANON_MODEL_CALLS_DAY=3`, `ANON_ADDRESS_ANSWERS_DAY=5`, `ASK_ANON_DAILY_CEILING=50`, `RECOMPUTE_ANON_MIN=3`.

| Id | Check |
|---|---|
| ANA | an anonymous `POST /agent/ask` with a valid `x-diabite-device` is admitted (never 401); without the header it is admitted too (the address-only visitor); an anonymous dosing phrase ("how many units of insulin before pasta") gets the safety gate's refusal with status 200 and `blockedRule`, spends no model turn, and is admitted even **after** the device is over its model-call cap |
| ANB | past `ANON_MODEL_CALLS_DAY` the same request is `401` with `error: 'sign_in_required'`, `reason: 'free_limit'`, a positive `retryAfterSec` and a `Retry-After` header; the body has no other field |
| ANC | `/meal/recompute` with no token and a valid device header is `200` while free answers are on; with no device header it is `401` with `reason: 'anonymous_off'`; past `RECOMPUTE_ANON_MIN` it is `429` with `Retry-After`; a request with the engine key is exempt |
| AND | `GET /health` has `freeAnswers: 2`, `signIn: true`, and no other new field; with `ANON_FREE_ANSWERS=0` it says `freeAnswers: 0` |
| ANE | the engine key exempts an agent-eval caller from every anonymous limit (twenty keyed requests, none refused); an anonymous caller after the ceiling of the day is `429` with `scope: 'anon_daily'` (the ceiling set to 2 in a second pass) |
| ANF | with `ANON_FREE_ANSWERS=0` an anonymous `/agent/ask` is `401` with `reason: 'anonymous_off'` and the safety gate still answers a dosing phrase |

## 3. Static renders (`eval/run-engine.ts`, the pattern used for `FigurePair` and `PortionEditor`)

| Id | Check |
|---|---|
| AS1 | `Landing` with free answers on: the keys read **Ask a question** (top key and closing band) and **Sign in**; the line "Free to try. No sign-up for your first three answers."; with free answers off: **Try DiaBite** and the old line, exactly as before |
| AS2 | the anonymous banner: the text "Counting for a typical adult." and a `button.link` **Make it yours**; no disclosure paragraph while `ANON_DISCLOSURE` is `''`; the paragraph `For adults. Not for mealtime insulin or pregnancy. Not medical advice.` when it is set (the test sets it) |
| AS3 | `SignInCard` renders the title, body and one `button.primary` **Sign in** for Diary, Menu and You, with the exact copy of `anon-screen.md` section 5 |
| AS4 | the limit card: title "That was your third free answer for today", the body, the key; with `retryAfterSec` 21600 the line "Another free answer in about 6 hours."; with 5400 "about 2 hours"; with 2400 "about 40 minutes"; with 3600 "about 1 hour"; with none, no line |
| AS5 | the anonymous Ask: no day picker, the log key reads **Sign in to log this**, and a signed-in render has **Log it** and no banner |
| AS6 | the anonymous Settings has appearance, Help and **Sign in** and none of export, delete, account |
| AS7 | the style rules added for `.anon-banner`, `.anon-note`, `.signin-card`, `.anon-limit` use only `var(--…)` tokens: no hex, no new custom property (a source check, as for the weight editor) |

A source check also asserts that `src/lib/agent.ts` sends `x-diabite-device` only when there is no access token, and that no file writes the anonymous profile to `localStorage`.

## 4. Rehearsal (`eval/rehearsal.mjs`, `W21`)

A fresh browser with no account and no stored value, against the app with `ANON_FREE_ANSWERS=3` on: press **Ask a question**; read the banner; ask a meal and read the answer with its receipt; correct a weight (a recount happens, no sign-in prompt); ask two more meals; ask a fourth and read the limit card; reload and read that the limit still stands (the device id persists); open the Diary tab and read the sign-in card and no diary behind it; no script error. Nothing is created, so nothing to remove. It is skipped, with a line saying so, when `/health` says `freeAnswers` is 0.

## 5. Mutations (each must fail a named case)

| Mutation | Fails |
|---|---|
| a question or a `needsWeight` reply counts as an answer | AN1 |
| the model-call cap is removed | AN2, ANB |
| the anonymous ceiling is outside the global one (not charged to `chargeTurn`) | AN4 |
| an unparsable device header skips the address allowance | AN2, AN6 |
| the gate is run after the anonymous check | ANA (the dosing phrase is refused once over the cap) |
| `ANON_FREE_ANSWERS=0` still admits | AN3, ANF |
| the device header is sent for a signed-in request | the source check |
| the anonymous profile is written to `localStorage` | the source check |

## 6. Turning it on, and the live checks

1. Deploy the image (CLAUDE.md rule 1: read the image tag the app runs). The feature is **off**: `/health` says `freeAnswers: 0`, and nothing differs.
2. Set the settings on the Container App as plain environment variables, **not secrets**: `ANON_FREE_ANSWERS=3` (the others at their defaults), one revision, no build.
3. Ask the running service, unauthenticated, from a terminal: `GET /health` says `freeAnswers: 3`; a `POST /agent/ask` with a fresh `x-diabite-device` UUID and a meal is `200`; three costed meals later the fourth is `401` `free_limit` with a `retryAfterSec`; a dosing phrase is still refused with `200` and `blockedRule`.
4. Run the rehearsal `W21`, then `npm run eval:agent` (no new case: the agent path is unchanged).
5. Look at it on the live app, signed out, at 375 px and at desktop width, in Tape and in Paper; read the console.
6. Watch for a week: `evt: 'free_limit'` and `anon: true` in the turn log, the anonymous share of the daily ceiling, the `rate_limited` events, the cost line in Azure.
7. **Rollback:** `ANON_FREE_ANSWERS=0` (one revision, no build). `/health` stops advertising it, the landing key reads **Try DiaBite** and goes to the sign-in form, and an anonymous request is `401 anonymous_off`.

## 7. `.env.example` (added in this change)

```
# ── A free first answer without signing in (server/guard.ts) ────────────
# None of these is a secret. Defaults below; the feature is OFF until
# ANON_FREE_ANSWERS is above 0. Counters are in memory and reset on a restart.
# ANON_FREE_ANSWERS=0          verdict answers a device may have in 24 h with no account; 0 turns the feature off (the launch value is 3)
# ANON_MODEL_CALLS_DAY=10      model turns a device may spend in 24 h, whether or not they produced a verdict
# ANON_ADDRESS_ANSWERS_DAY=10  verdict answers one network address may give anonymous visitors in 24 h
# ASK_ANON_DAILY_CEILING=150   anonymous model turns per UTC day, inside the global ASK_DAILY_CEILING
# RECOMPUTE_ANON_MIN=20        anonymous /meal/recompute requests per address per minute
```

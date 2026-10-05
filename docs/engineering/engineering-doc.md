# Engineering document — abuse protection for the public agent route

*Produced by `/engineering-planner` from `docs/PRD.md`, 5 October 2026. Approved by the owner. Built and deployed the same day; see Status at the end.*

## 1. Summary

**The feature.** Put limits in front of `POST /agent/ask`, the one route that is public and spends model tokens.

**Why now.** Checked against the live service on 5 October: the route needs no key, `cors()` allows every origin (`access-control-allow-origin: *`), there is no rate limit, no message-length cap beyond a 1 MB JSON body, and no cap on tool calls per turn. Anyone can run up the Azure bill, and the owner is about to hand the link to five strangers for user sessions. `docs/FINANCIAL_PLAN.md` already names this: *"cost control that must be built, not hoped for … a tool-call-count cap per turn (a looping agent is an unbounded bill)."*

**Success.** (1) A script firing requests at the live route is stopped by a counted limit, not by luck. (2) The worst-case day is bounded at **1,000 model turns** (~$16 by the financial plan's per-turn figure; to be re-checked against Azure's real price, see Q1). (3) A person asking real questions, the demo, and the five sessions never meet a limit. (4) A person in distress is **never** told "rate limited" — dosing and red-flag replies still arrive.

## 2. Scope

**In:** per-IP and per-session limits; a daily ceiling on model turns; message, payload and `sessionId` caps; a cap on tool calls per turn; CORS restricted to our own origin; bounded in-memory maps; `trust proxy`; a calm "slow down" state in the app; an abuse suite that proves each control.

**Out:** accounts or sign-in (`docs/PLAN.md` — the owner's decision, not this change), CAPTCHA, a WAF, Redis.

**Later:** move counters to Redis when the app scales past one replica (the same limit `server/sessions.ts` already documents); limits per account instead of per IP once accounts exist; Cloudflare Turnstile if abuse actually appears.

## 3. User flows

```
Normal:    browser → POST /agent/ask → size/shape check → safety gate → limits → router → meal|advisor → verifier → answer
Over limit: browser → POST /agent/ask → … → safety gate → limits FAIL → 429 {error:'rate_limited', scope, retryAfterSec} + Retry-After → calm message in the app
Distress:  "glucose 320, vomiting" → size/shape check → safety gate BLOCKS → red-flag reply (200) — limits never consulted
Ceiling:   1,001st model turn of the UTC day → 429 {scope:'daily'} until 00:00 UTC; gate refusals keep working
```

The order is the design. **The safety gate runs before the limits**, because a refusal or an escalation costs nothing and must never be withheld.

## 4. The promise check

No nutrition number is touched. The 429 body contains a retry time, which is **not an agent answer**: it travels in an error envelope, never through the verifier, and the app renders it in the error state, not the answer card. Nothing here lets a model produce a number.

## 5. Frontend

- `src/lib/agent.ts` — recognise status 429 and return a typed `{ limited: true, scope, retryAfterSec }` instead of throwing the generic "Couldn't reach the agent".
- `src/components/AskPage.tsx` — a new **limited** state, in the existing error-card style, in the product's own voice: *"You've asked a lot of questions in a short time. Please try again in about 8 minutes."* For `daily`: *"DiaBite has reached its limit for today and will be back tomorrow. Dosing and safety questions still work."* No emoji, no exclamation marks (`docs/design.md`). Input gets `maxLength={500}`, silently.
- Checked at 375 px, light and dark. The "Ask" button re-enables after `retryAfterSec`.

## 6. Engine and API

**New `server/guard.ts`** (the only new engine file):
- `validateAsk(body)` — `message` ≤ 500 chars; `sessionId` ≤ 64 chars matching `/^[\w-]+$/`; `entries` ≤ 100; `budget` finite numbers. Failure → `400 {error:'invalid_request', field}`.
- `limiter` — sliding window over timestamps, in memory, **bounded to 10,000 keys** with oldest-first eviction. Defaults (owner chose *generous*): **30 asks / 10 min and 200 / day per IP; 60 / hour per session**.
- `reserveModelTurn()` — a UTC-day counter, default **1,000**; returns `{ok}` or the seconds to midnight.
- All limits read from env (`ASK_IP_10MIN`, `ASK_IP_DAY`, `ASK_SESSION_HOUR`, `ASK_DAILY_CEILING`, `ABUSE_GUARD=off` kill switch), so the abuse suite can run them tiny.

**`server/engine.ts`:** `app.set('trust proxy', 1)` (Container Apps ingress is one hop — **verify on the live service by logging `req.ip` against `X-Forwarded-For`**; wrong, and every user shares one bucket); `cors({ origin })` allowing only our own origin plus `localhost` dev, via `ALLOWED_ORIGINS`; a stricter `express.json({ limit: '32kb' })` mounted on `/agent`; pass `clientKey` (the IP) into `ask()`.

**`server/agent.ts`:** inside `answer()`, **after the safety gate and before `route()`**, call the limits and throw a typed `RateLimited` that the handler turns into 429 + `Retry-After`. `route()` is itself a model call, so it sits behind the ceiling too.

Model-facing tools are unchanged — they answer 200 with an `error` field on purpose.

An authenticated caller (valid `x-api-key`) is exempt from the **rate limits**, never from the size caps. That is how `npm run eval:agent` — 87 cases from one IP in under ten minutes, which would otherwise trip 30 / 10 min — keeps working.

## 7. Agents

`runAgent` sends `max_tool_calls: 6` on the Responses request (a normal turn is two calls; a clarification, one). **Verify Foundry prompt agents honour the parameter**; if not, count `function_call` items in the output and abort the turn past six, returning the templated answer. Prompts and the router are unchanged.

## 8. Data

No tables, no migration. Counters live in memory and **reset on every deploy or restart** — acceptable and stated: a restart can double a day's worst case to ~2,000 turns, never more than one restart a deploy. `server/sessions.ts`: bound `store`, `lastResponse` and `conversations` to 5,000 entries each with oldest-first eviction (today any new `sessionId` grows them for an hour, and `sweep()` walks the whole map on every call).

Nothing is stored about a person. **IPs are held in memory only, never written to a log in full**; a block is logged as `scope` plus a short salted hash so one source can be recognised without being identified.

## 9. Safety and responsible AI

- The gate-before-limits order (§3) is the safeguard. A rate limit that silenced a red-flag reply would be a harm the limiter caused.
- The "daily" message names that safety questions still work.
- No clinician review needed: no number, threshold or advice changes.
- Residual risk, stated: the gate and the size check run on every request, so a flood of *cheap* requests costs CPU, not money, and is bounded only by the 32 KB body and the container. Azure's own request limits are the backstop.

## 10. Evaluation plan — written in the same change

**New `eval/run-abuse.ts`, `npm run eval:abuse`.** Starts a local engine with tiny limits and asserts on **status codes and JSON fields, never on prose**:

| # | Case | Expect |
|---|---|---|
| A1 | 4th request inside the window with `ASK_IP_10MIN=3` | 429, `Retry-After` present, `scope:'ip'` |
| A2 | Dosing question after the limit is hit | 200, blocked by rule `dosing` |
| A3 | Red-flag message after the limit is hit | 200, rule `red_flag` |
| A4 | 501-character message | 400 `invalid_request`, `field:'message'` |
| A5 | `sessionId` of 65 chars or containing `/` | 400 |
| A6 | Foreign `Origin` | no `access-control-allow-origin` |
| A7 | Same origin / localhost | header present |
| A8 | Daily ceiling of 5, sixth model turn | 429 `scope:'daily'`; a gate turn still 200 |
| A9 | 10,000 distinct `sessionId`s | map size stays ≤ cap |
| A10 | Valid `x-api-key` | exempt from rate limits, not from size caps |

Plus: `npm run eval` and `npm run eval:agent` must be unchanged (191+/195, p90 ≈ 6 s), proving a normal user never meets a limit. **Live check:** one real request for the CORS header and the `Retry-After` shape; the limiter itself is proved locally, so no money is spent hammering production.

## 11. Rollout

1. Implement on `main` (one change: guard, wiring, app state, abuse suite, `.env.example` entries).
2. `npm run eval:abuse`, `npm run eval`, tsc, build.
3. `npm run deploy`; then **ask the running service**: CORS from a foreign origin, an oversize body, one normal turn, and log `req.ip` vs `X-Forwarded-For`.
4. `npm run eval:agent` against the live service with the key.
5. **Rollback:** set `ABUSE_GUARD=off` (new revision, ~1 minute) or reactivate the previous revision. The owner can also add an Azure budget alert in the portal — their action, not ours.

## 12. Open questions — the owner's or a clinician's

- **Q1 — real price.** The ~$16 / day figure uses Claude list prices from `docs/FINANCIAL_PLAN.md`; production runs `gpt-5.4-mini` and `-nano`. Check Azure cost analysis before treating 1,000 as the right number. (Also relevant to Saturday's lecture: the plan's per-turn cost is built on a model we no longer run.)
- **Q2 — IPs.** Are in-memory IPs, never logged raw, acceptable without a privacy-policy line? A statement of what is kept belongs in `docs/PLAN.md` when accounts arrive.
- **Q3 — shared networks.** A clinic or an office behind one IP shares 200 asks a day. Fine today; revisit when real users cluster.

## Files that change

`server/guard.ts` (new) · `server/engine.ts` · `server/agent.ts` · `server/sessions.ts` · `src/lib/agent.ts` · `src/components/AskPage.tsx` · `eval/run-abuse.ts` (new) · `package.json` (script) · `.env.example` · `CLAUDE.md` (one rule: *the gate runs before the limits*).

## Specs → implementation

| Spec | Files |
|---|---|
| Validation and caps | `server/guard.ts`, `server/engine.ts` |
| Limits and ceiling | `server/guard.ts`, `server/agent.ts` |
| Bounded maps | `server/sessions.ts` |
| Tool-call cap | `server/agent.ts` |
| CORS and proxy | `server/engine.ts` |
| App state | `src/lib/agent.ts`, `src/components/AskPage.tsx` |
| Proof | `eval/run-abuse.ts`, `package.json` |

## Status — built and deployed, 5 October 2026

Live as revision 54 (commit c664449). What was checked, and how:

| Plan | Result |
|---|---|
| `npm run eval:abuse` (A0–A12, no model, no money) | all pass |
| `npm run eval` | 91 resolve, 15 clarify, 12 verify, unchanged |
| Live: foreign Origin, own origin | no header / header present |
| Live: 501-character message, 65-character or `a/b` session id, 40 KB body | 400 `message`, 400 `sessionId`, 413 |
| Live: a normal turn, and a dosing question | answered; rule `dosing` |
| `req.ip` behind the ingress (`/diag/ip`) | the caller's address; a spoofed `X-Forwarded-For: 1.2.3.4` is ignored, the last hop wins |
| `eval:agent` against live, with the key | 87/87 answered, 191/191 checks, no 429 |

Not proved, and said plainly:

- **The limiter was proved locally, not on production**, as planned: hammering the live service would spend money to learn what a local run already shows. The first real 429 will be the first time it happens on Azure.
- **`max_tool_calls` is accepted by Foundry** (no error, turns normal) but nothing here forces a turn to exceed it, so *enforced* is unproved. `MAX_TOOL_CALLS=0` removes it.
- **Latency on the live run was median 6.3 s, p90 13.2 s**, against a recorded p90 of 6–8 s. An A/B run of the 55 field cases, with the cap and without, ran at the same speed (p90 15.2 s and 14.4 s, concurrently), so the cap is not the cause. The owner's connection was unstable that day; re-measure before quoting a number.
- **Q1 (real price), Q2 (IPs) and Q3 (shared networks) are still open.**

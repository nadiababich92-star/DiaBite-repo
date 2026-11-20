# Spec — A free first answer without signing in: what the engine does

*Stage 2, from `docs/engineering/engineering-doc.md` (approved 20 November 2026). Companion specs: `anon-screen.md` (what the screen sends and prints), `anon-evals.md` (the cases and how to turn it on). Read `server/guard.ts` and `server/agent.ts` first: the windows, the daily ceiling, `answer()` and the order of its steps are not redefined here.*

**No migration, no new table, no new route, no prompt change, nothing stored about a person.** Counters live in the engine's memory and reset at a restart, as every limit in `server/guard.ts` does. **The feature is off until `ANON_FREE_ANSWERS` is set above 0**, so deploying the code changes nothing.

## Files

| File | Change |
|---|---|
| `server/guard.ts` | the anonymous allowance: `deviceKeyOf`, `chargeAnon`, `countFreeAnswer`, the limits, `Windows.peek` and `Windows.record`, the `anon_daily` scope, `chargeRecomputeAnon` |
| `server/agent.ts` | `answer()` takes the anonymous path after the safety gate; `SignInRequired` carries a reason; `countsAsFreeAnswer(trace)`; no preference memory for an anonymous turn; `logTurn` fields |
| `server/engine.ts` | `GET /health` says `freeAnswers`; `/agent/ask` reads the device header and answers `401 free_limit`; `/meal/recompute` accepts an anonymous caller with a device header |
| `.env.example` | the five settings, commented, not secret |
| `server/openapi.ts`, `agent/`, `supabase/` | **not touched** |

## 1. The settings

Read per call, like the others in `limits()` (`num(name, fallback)`; a value that is not a positive number gives the default, **except `ANON_FREE_ANSWERS`, where 0 is a real value that means off**, so it is read with its own helper that accepts 0).

| Setting | Default | Meaning |
|---|---|---|
| `ANON_FREE_ANSWERS` | `0` | Verdict answers a device may have in a rolling 24 hours with no account. **0 turns the whole feature off.** The owner's value at launch is 3. |
| `ANON_MODEL_CALLS_DAY` | `10` | Model turns a device may spend in a rolling 24 hours, counted whether or not they produced a verdict. A hard cap on idle spending. |
| `ANON_ADDRESS_ANSWERS_DAY` | `10` | Verdict answers one address may give to anonymous visitors in a rolling 24 hours (a household or an office shares them). |
| `ASK_ANON_DAILY_CEILING` | `150` | Anonymous model turns per UTC day, counted **inside** the global `ASK_DAILY_CEILING` (1,000), so anonymous traffic cannot use up what registered people need. |
| `RECOMPUTE_ANON_MIN` | `20` | Anonymous `/meal/recompute` requests per address per minute, in addition to the existing `RECOMPUTE_MIN`. |

`ABUSE_GUARD=off` (the existing kill switch) also switches these limits off, as it does the others; the size caps and the safety gate are not limits and stay.

## 2. `server/guard.ts`

```ts
/** The anonymous visitor: a device the browser says it is, and the address the request came from. */
export interface AnonKey { device: string | undefined; address: string | undefined }

/** A version-4 UUID from the x-diabite-device header, hashed; undefined for anything else. */
export function deviceKeyOf(header: unknown): string | undefined
//   /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i  →  sha256(SALT + id).hex.slice(0, 16)
//   SALT is the module's existing salt (the one `sourceTag` uses); the raw id is never kept or logged.

export class SignInNeeded extends Error {            // thrown by chargeAnon; the route turns it into 401
  constructor(public reason: 'free_limit' | 'anonymous_off', public retryAfterSec?: number) { super(`sign_in_needed:${reason}`) }
}

/** Charge one model turn to an anonymous visitor, or throw. Called after the safety gate, before the router. */
export function chargeAnon(key: AnonKey, now?: number): void

/** Record one verdict answer for the visitor, after the answer was built. */
export function countFreeAnswer(key: AnonKey, now?: number): void

export function chargeRecomputeAnon(address: string, now?: number): number   // seconds to wait, 0 if it may go
```

`Windows` (the sliding-window class already in the file) gains two methods, so that a verdict can be *checked* before the model runs and *recorded* after it:

```ts
peek(key: string, max: number, windowMs: number, now: number): number   // seconds to wait if over; records nothing
record(key: string, now: number): void                                   // adds a hit, bounded like take()
```

**`chargeAnon`**, in this order (the first that applies throws; `L.off` returns at once):

1. `ANON_FREE_ANSWERS` is 0 → `throw new SignInNeeded('anonymous_off')`.
2. The anonymous daily ceiling: `if (anonCeiling.day !== today) anonCeiling = { day: today, used: 0 }`; `used >= ASK_ANON_DAILY_CEILING` → `throw new RateLimited('anon_daily', secondsToMidnight(now))`.
3. Verdict allowance, **peeked, not recorded**: let `device = key.device ?? 'nodev:' + (key.address ?? 'none')`. `windows.peek('an:ans:' + device, ANON_FREE_ANSWERS, DAY, now)` and `windows.peek('an:addr:' + (key.address ?? 'none'), ANON_ADDRESS_ANSWERS_DAY, DAY, now)`; the larger wait → `throw new SignInNeeded('free_limit', wait)`.
4. Model-call cap, **taken** (recorded): `windows.take('an:calls:' + device, ANON_MODEL_CALLS_DAY, DAY, now)` → if over, `throw new SignInNeeded('free_limit', wait)`.
5. `anonCeiling.used++`.

A visitor with **no valid device header** has `device = 'nodev:' + address`: every such visitor on an address shares one allowance, so omitting the header never gives more than sending one.

**`countFreeAnswer(key)`**: `windows.record('an:ans:' + device, now)` and `windows.record('an:addr:' + address, now)`. Nothing else.

**`chargeRecomputeAnon(address)`**: `windows.take('rca:' + address, RECOMPUTE_ANON_MIN, MIN, now)`, 0 when `L.off`.

`Scope` gains `'anon_daily'`. `_reset()` also clears `anonCeiling`; `_state()` also returns `anonCeilingUsed`.

The anonymous ceiling is a **sub-limit**: an anonymous turn is charged here and then again by `chargeTurn`'s global ceiling, so the global 1,000 is still the whole.

## 3. `server/agent.ts`

**`AskContext`** gains `anon?: AnonKey` (set by the route only for a request that is not trusted and has no person).

**`SignInRequired`** (the class the route already catches) becomes `class SignInRequired extends Error { constructor(public reason: 'free_limit' | 'anonymous_off' = 'anonymous_off', public retryAfterSec?: number) }`. A person-less request with sign-in required and `anon` absent (an old caller) keeps today's behaviour: `SignInRequired('anonymous_off')`.

**`answer()`**, the step after the gate becomes:

```ts
const anonymous = ctx.requireSignIn && !ctx.trusted && !ctx.person
if (anonymous) {
  if (!ctx.anon) throw new SignInRequired('anonymous_off')
  try { chargeAnon(ctx.anon) }
  catch (e) { if (e instanceof SignInNeeded) throw new SignInRequired(e.reason, e.retryAfterSec); throw e }
}
if (!ctx.trusted && claimSession(req.sessionId, ctx.person?.sub) === 'denied') throw new SessionNotYours()
if (!ctx.trusted) chargeTurn(ctx.clientKey, req.sessionId, undefined, ctx.person?.sub)
```

Everything before this line is unchanged: size and shape, the safety gate (a refusal is free and never counted), and everything after is unchanged for a person. For an anonymous turn:

- **No preference memory.** `recallPreferences` is not called and `rememberPreferences` is not called (`const keepsMemory = !anonymous`). The advisor answers without "what this person told you before".
- **Counting.** After the answer is built and verified, where `logTurn` is called: `if (anonymous && ctx.anon && countsAsFreeAnswer(res.trace)) countFreeAnswer(ctx.anon)`.
- **The log.** `logTurn` gains an optional `anon?: boolean` and writes `anon: true` on the line; it still writes a random session id and never an address, an email or the raw device id. The question text is logged as for everyone (the owner's decision of 20 November).

```ts
/** Did the engine cost a meal in this turn? A verdict, a partial verdict and an assumed-recipe estimate all count; a question, advice and a refusal do not. */
export function countsAsFreeAnswer(trace: ToolCallTrace[]): boolean
//   true when some entry's tool endsWith 'compute_meal' or 'cost_dish' and its result is an object with a `totals` object and no `error` and no `needsWeight`.
```

## 4. `server/engine.ts`

**`GET /health`** adds `freeAnswers: number` (0 when off). Public, as now. Nothing else new.

**`POST /agent/ask`**:

```ts
const device = deviceKeyOf(req.get('x-diabite-device'))
const anon = !trusted && !person ? { device, address: addressKey(req.ip) } : undefined
res.json(await ask(body, { clientKey: ..., trusted, person, requireSignIn: signInRequired(), anon }))
```

and in the `catch`, before the existing branches:

```ts
if (e instanceof SignInRequired) {
  if (e.reason === 'free_limit') {
    console.warn(JSON.stringify({ evt: 'free_limit', source: sourceTag(addressKey(req.ip)), retryAfterSec: e.retryAfterSec }))
    if (e.retryAfterSec) res.set('Retry-After', String(e.retryAfterSec))
  }
  return res.status(401).json({ error: 'sign_in_required', reason: e.reason, ...(e.retryAfterSec ? { retryAfterSec: e.retryAfterSec } : {}) })
}
```

**`POST /meal/recompute`**: today `if (signInRequired() && !person) return 401`. With free answers on:

```ts
const free = freeAnswers() > 0
if (signInRequired() && !person) {
  if (!free) return res.status(401).json({ error: 'sign_in_required', reason: 'anonymous_off' })
  if (!deviceKeyOf(req.get('x-diabite-device'))) return res.status(401).json({ error: 'sign_in_required', reason: 'anonymous_off' })
  const wait = chargeRecomputeAnon(addressKey(req.ip) ?? 'none')
  if (wait) { res.set('Retry-After', String(wait)); return res.status(429).json({ error: 'rate_limited', scope: 'ip', retryAfterSec: wait }) }
}
```

and the existing `claimSession` and `chargeRecompute` run unchanged after it (an anonymous session has no owner). `freeAnswers()` is the value of `ANON_FREE_ANSWERS`, exported from `server/guard.ts` next to `limits()`.

`CORS` needs no change (the browser's own origin; `cors()` reflects the requested headers).

## 5. Errors

| Status | Body | When |
|---|---|---|
| 401 | `{ error: 'sign_in_required', reason: 'free_limit', retryAfterSec }` + `Retry-After` | the device used its verdict answers, its model calls, or the address its verdict answers |
| 401 | `{ error: 'sign_in_required', reason: 'anonymous_off' }` | `ANON_FREE_ANSWERS` is 0, or an anonymous caller reached a route that needs a person, or `/meal/recompute` came without a valid device header |
| 429 | `{ error: 'rate_limited', scope: 'anon_daily', retryAfterSec }` + `Retry-After` | the anonymous daily ceiling is used |
| 429 | the existing `ip`, `session`, `daily`, `user` | unchanged |
| 200 | the safety gate's refusal | free, not counted, before any of the above |

A caller with the engine key is exempt from every anonymous limit, as from the others.

## Verifiable

`anon-evals.md`: AN1 to AN5 (the functions above, with small values), ANA to ANE (the routes, no model, no money), the mutations, and the live checks after the switch is turned on. Fields a check reads: the status code, `reason`, `retryAfterSec`, `Retry-After`, `freeAnswers`, the counters through `_state()`, and the trace entries `countsAsFreeAnswer` reads; never the wording of an answer.

# Spec: sign-in, the engine side

*From `docs/engineering/engineering-doc.md` sections 6, 8 and 10. Decisions of 10 October 2026: sign-in required before the first question; link and six-digit code; whole profile and diary stored; anyone may sign in, with consent; the advisor's memory stays per session; local data is cleared on sign-out.*

## Token check: `server/auth.ts` (new)

```ts
export interface Person { sub: string; email?: string }
export async function personOf(req: express.Request): Promise<Person | null>
```

- Reads `Authorization: Bearer <access token>`. No header, a malformed one, an expired or forged token: `null`. It never throws to the caller and never logs the token.
- Verifies with `jose` (`createRemoteJWKSet`, cached by the library) against `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, requiring `iss = ${SUPABASE_URL}/auth/v1`, `aud = 'authenticated'`, and a `sub` that is a UUID. The Supabase URL is public by design; the engine already has it (`SUPABASE_URL`).
- If the JWKS cannot be fetched, the answer is `null` for the request and one warning line per minute in the log. A sign-in outage must not turn into an open door.
- Adds one dependency: `jose`, exact version in `package-lock.json`, and a row in the supply-chain section of `docs/security/security-plan.md`.

## `POST /agent/ask`

Order, unchanged in spirit: **size and shape → safety gate → sign-in → limits → router → specialist → verifier**.

- The gate runs **before** the sign-in check, so a dosing question or a red flag is answered (200, the refusal or escalation) to a caller with no token. Nothing about this route's gate changes.
- After the gate, when `REQUIRE_SIGN_IN` is on: no valid person → `401 {"error":"sign_in_required"}` and no model is called. A caller holding the engine key (`x-api-key`, the agent evals) is trusted as today and needs no token.
- `chargeTurn` gains a per-person key: `u:<sub>`. Limits: **60 model turns an hour and 200 a day per person**, in addition to the per-address limits that stay as they are. A 429 names `scope: 'user'` (the `Scope` type gains `'user'`; the app already renders `ip`, `session` and `daily` in plain words, and gets one for `user`).
- The per-person counters are bounded like the others (10,000 keys, oldest first out).
- The `sessionId` the browser sends is still random per browser; the advisor's memory stays keyed by it (owner's answer 2).
- `REQUIRE_SIGN_IN` (env, default **off**): the switch that makes shipping safe. It goes **on** only after the sign-in screen is deployed and one real sign-in has been done on the live service; setting it back to off restores anonymous use in one revision (rollback).

## `DELETE /account` (new)

- `personOf` must succeed, else 401. No body.
- Calls `DELETE ${SUPABASE_URL}/auth/v1/admin/users/<sub>` with the service key as `apikey` and `Authorization: Bearer <service key>`. The key is a **Container App secret** (`supabase-service-key`) exposed as `SUPABASE_SERVICE_KEY`; never in the image, never a `VITE_*` value, never logged, never returned.
- The foreign keys cascade, so `profiles` and `diary_entries` go with the user and `feedback.user_id` becomes null (the feedback text stays, unattached).
- Success: `200 {"ok":true}`. The admin call failing: `502 {"error":"delete_failed"}` with the cause only in the log; nothing is half-deleted because the auth user is the single thing removed.
- Rate limit: 5 a day per person.

## Everything else

`/tools/*`, `/session`, `/verify`, `/diag`: unchanged (`x-api-key`, fail closed in production). `GET /health`: unchanged. CSP: `connect-src` already includes the Supabase origin; add nothing.

## Configuration

`.env.example` gains, grouped by service and empty: under Supabase, `SUPABASE_SERVICE_KEY` (`# SERVER ONLY`: the service role key, held as the Container App secret `supabase-service-key`; used only by `DELETE /account`), and under engine switches, `REQUIRE_SIGN_IN` (`off` until the sign-in screen is live).

## Verifiable

`npm run eval:abuse` gains (the engine runs locally with a test key pair for the JWT checks, so no Supabase call is needed):
- model turn without a token, sign-in required → 401; the same with `REQUIRE_SIGN_IN` off → 200 path as today;
- a dosing question and a red-flag message without a token → 200, rule fired, **no** 401;
- a forged token, an expired token, a token for another audience, a token signed by another key → 401;
- 61 model turns in an hour from one person → the 61st is 429 `scope: user`, and a gate-caught message at that moment is still 200;
- a caller with the engine key needs no token;
- `DELETE /account` with no token → 401; with a valid token and the admin call stubbed to fail → 502 and nothing else changes.
On the live service, once: a real sign-in, one question, and `DELETE /account` on a throwaway address.

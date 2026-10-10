# Spec: sign-in, the data and the proof

*Companion to `accounts-engine.md` and `accounts-app.md`. The migration is `supabase/migrations/20261010130000_accounts.sql`.*

## The migration

Two tables, `profiles` (one row per person) and `diary_entries` (composite key `(user_id, id)` so two people can never collide on an id), row-level security enabled **in the same file**, a policy for each of select, insert, update and delete restricted to `auth.uid() = user_id`, no grant at all to `anon`, a trigger that stops one person's diary at 20,000 rows, `on delete cascade` from `auth.users` on both, and `feedback.user_id` (nullable, `on delete set null`) so the owner can answer a sender. The feedback insert policy keeps its old limits and adds: a person may set `user_id` only to their own.

## What is stored about a person, in full

| Where | What |
|---|---|
| `auth.users` (Supabase Auth) | email address, the time of sign-in; no password exists |
| `profiles.data` | age, sex as chosen, height, weight, activity, goal, diagnosis, medicine classes, insulin answer, kidney status, other conditions, allergens, eating pattern, units, carbohydrate approach, excluded foods, onboarding done |
| `profiles.consent_at`, `consent_version` | when and to what wording the person agreed |
| `diary_entries` | day, meal, food id, grams, the engine's numbers at that moment |
| `feedback` | what the person chose to send, and now their id when signed in |

**Not stored:** the meal sentences (still not logged unless `LOG_QUESTIONS` is on, which stays off for accounts), medicine doses (never asked), a name. The advisor's memory is still per browser session, not per person.

## Where it lives

Supabase project `DiaBite-feedback`, region `eu-west-1` (Ireland). The controller is established in the EU, so GDPR applies to every user wherever they live; these are health data (special category). **Counsel's questions stay open (engineering doc, section 12): the lawful basis and consent text, processor agreements with Supabase and Microsoft, retention, and US state laws. Until counsel answers, the service is a closed beta with explicit consent and working export and deletion, and that is all this specification claims.**

## Row-level security proof (before any app code reads the tables)

Run with the Supabase tools as a **single transaction that ends in `rollback`**, so nothing remains in the project, after the migration is applied (the tables are new and empty, so applying it to the project is additive):

1. Create two throwaway auth users `A` and `B` inside the transaction.
2. As `authenticated` with `A`'s claims: insert a profile and two diary rows for A → allowed; insert a row with `user_id = B` → **rejected**; select → only A's rows; update and delete B's row → zero rows affected.
3. As `anon`: select, insert → permission denied on both tables.
4. Insert the same diary id twice for A as an upsert → one row.
5. Delete user A → both tables hold nothing for A; B's rows remain.
6. A diary row with `grams` of 0 or 6000, a meal outside the four, a `snapshot` over 4,000 bytes, a profile `data` that is an array → all rejected by the checks.
7. The 20,001st diary row for one person → rejected by the trigger (run with the limit lowered inside the transaction so it does not need 20,000 inserts).
Every step's result is printed and kept in `docs/security/security-plan.md` under the 10 October update. The Supabase security advisor is read afterwards and must report no new warning for these tables.

## Security plan additions

Rows for: the sign-in token check (S13), the service key held as a Container App secret (S14), per-person limits (S15), the sign-in wall and the red-flag rule, with the compromise stated (S16), the SMTP secret's expiry (already noted), `jose` in the supply chain. Each with how it was checked against the running service.

## Rollout, restated

1. Apply the migration to the project; run the proof above. 2. Deploy the engine with `REQUIRE_SIGN_IN` off and `SUPABASE_SERVICE_KEY` set as a secret. 3. Deploy the app. 4. Paste the email template and set the OTP length. 5. Sign in once for real on the live service; then set `REQUIRE_SIGN_IN` on. 6. Check the live service: a model turn with no token is 401, a dosing question with no token is refused with 200. Rollback: `REQUIRE_SIGN_IN` off, one revision.

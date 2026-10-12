# Engineering document: sign-in, branded foods, weekly menu V1

*Produced by `/engineering-planner` on 9 October 2026 from `docs/PRD.md`, `docs/PLAN.md`,
`docs/PRD-post-course.md` (WS2, WS3, WS4) and the code. The previous document in this
place, the abuse protection of `/agent/ask`, is shipped and now lives in
`docs/engineering/abuse-protection.md`.*

**Decisions already made by the owner, 9 October 2026** (recorded, not reopened here):

| Question | Answer |
|---|---|
| How people sign in | An emailed link (no password) |
| Is sign-in required | **Yes, before the first question** |
| What is stored about a person | The diary **and the whole profile** (diagnosis, medicines, kidney status, allergies) |
| The diary already in a browser | Offer to move it, once, on first sign-in |
| Email delivery | Azure Communication Services |
| Branded foods | Show carbohydrate; "glycemic load not available"; one to two thousand common items |
| Weekly menu | Back now, with V1 features; **hidden** for a history of disordered eating, chronic kidney disease and dialysis until a clinician answers |

---

## 1. Summary

**Three changes, one document, because they meet at the same screens.**

| | The user problem (PRD / PLAN reference) | Done when |
|---|---|---|
| **A. Sign-in** | Close the tab and DiaBite has never met you; no history, no trends, no way for the owner to know whom to ask for feedback (PLAN "Then: accounts"; WS3) | A person signs in on a phone, logs a meal, opens the app on a laptop and sees yesterday's day. Export and deletion work |
| **B. Branded foods** | 13% of what people type resolves to nothing, mostly Doritos, Oreos, KIND bars; a user who meets "I don't have that" twice stops asking (PLAN "Next: the food gap"; WS2) | "A KIND bar" returns grams of carbohydrate, fibre and calories, computed by the engine, with the load stated as not available; the unknown rate is re-measured next to 13% |
| **C. Weekly menu V1** | The menu works and has never been in front of a user; it ignores kidneys, eating-disorder history, gout and gastroparesis (code: `src/lib/menu.ts` filters only allergens and eating pattern) (WS4 D3/D4) | One meal can be replaced without regenerating the week; no dish repeats within three days; the shopping list works; the hidden profiles see a calm explanation instead |

**Measures.** A: share of first visits that reach the first answer (the wall costs some; this is the number to watch), returning users in week 2. B: unknown rate on `eval/questions-field.jsonl` (13% now), branded answers that the verifier passes. C: menu opened by users who did not hide it; zero menus shown to a hidden profile (a test, not a metric).

**Build order I recommend: B, then C, then A.** B and C need no outside parties and no personal data; A starts its outside work (email domain, counsel) now and builds when those are ready. If you prefer A first, nothing in B or C depends on it.

## 2. Scope

**In scope.**
- A: Supabase Auth email link; `profiles` and `diary_entries` tables with row-level security; a sign-in screen and a gate; the server checks the sign-in token on `/agent/ask`; one-time import of the browser's diary; export; "delete my account and everything"; limits per person as well as per address; a consent line in onboarding.
- B: a `branded` kind of record, a visibly different kind of answer, 1,000 to 2,000 products, rule 4 amended in `CLAUDE.md`.
- C: `regenerateSlot`, a no-repeat window, the hidden-profile guard, a labelled "not yet reviewed by a clinician" line.

**Out of scope.** Google or password sign-in; social features; a clinician-facing view; photo logging (needs the diary first, which A delivers); trends and the in-range-days screen (the *next* document; A only makes the data exist); a second region or a queue.

**Later, named so they are not forgotten.** History and trends screens. Redis for the limits when there is more than one replica. A paid tier. Making the advisor's memory per person (see section 12).

## 3. User flows

```
A  First visit
   open app → sign-in screen (emergency line + email box)
   → POST Supabase Auth /otp {email}  → email arrives from Azure Communication Services
   → person taps the link → app opens with a session → consent line (once) → onboarding
   → profile saved to profiles (RLS: own row only) → ask screen

A  Returning visit, new device
   open app → link → session → profiles + diary_entries read (RLS) → yesterday's day is there

A  Ask
   type → POST /agent/ask  Authorization: Bearer <access token>
     → size/shape check → safety gate (no token needed to refuse or to escalate)
     → token verified → limits per user and per address → router → specialist → verifier → answer
   no token, ordinary meal question → 401 sign_in_required (the app never sends this; a script would)

A  First sign-in with a diary already in the browser
   → "We found a diary on this device. Move it to your account?"  [Move] [Not now]
   → rows upserted by their own ids (a second tap changes nothing) → local copy kept until confirmed

B  "A KIND bar"
   resolve_foods → record kind:'branded', gi:null  → compute_meal
   → item: availableCarbs, fibre, kcal; loadAvailable:false
   → afterMeal.fits = null, partial.unscored = ["KIND bar…"]       (same mechanism as an unknown food)
   → card: "One question first" is wrong here, so a new label: "Carbs only"
   → "Carbohydrate 16 g (fibre 7 g). I can't give a glycemic load for a branded product, so I can't judge your day."

C  Weekly menu
   Profile flags (eatingDisorder | kidney ckd | dialysis) → menu tab shows the message, no plan
   otherwise → plan → "replace" on one meal → same day, same share of the day, a dish not used in the last 3 days
```

## 4. The promise check

| Number shown | Where it is computed | How it is covered |
|---|---|---|
| Branded carbohydrate, fibre, calories | The engine: USDA per-100 g values × grams, in `server/compute.ts`, from a record in the table | Verifier sees them as tool-result numbers, like every other item |
| Branded glycemic load | **Not produced.** `loadAvailable:false`, `gl` absent for that item | No number to quote; the model cannot state one, and if it does the verifier rejects it. **Estimating a GI by category stays refused** (PLAN, option three) |
| The verdict on a meal with a branded item | The engine: `afterMeal.fits` is `null` (or `false` if the scored part is already over) with `partial.unscored` | Same function (`afterMealFor`) and the same eval that already protects unknown foods |
| Menu figures (kcal, carbohydrate, GL per meal and day) | The browser, `src/lib/menu.ts` and `glycemic.ts`, from the dish table; no model involved | Not an agent answer; unchanged |
| Account screens | No nutrition numbers | n/a |

No path lets a model produce a nutrition number. The only new way a number could be *missing* is a branded item, and that is shown as missing.

## 5. Frontend

**New or changed files:** `src/components/SignIn.tsx` (new), `src/lib/auth.ts` (new), `src/lib/sync.ts` (new: read and write the two tables, merge by id), `src/components/ImportPrompt.tsx` (new), `src/App.tsx` (gate), `src/lib/supabase.ts` (persist the session), `src/lib/storage.ts` (local copy becomes a cache), `src/components/ProfilePage.tsx` (account block), `src/components/AskPage.tsx` (send the token; branded display), `src/components/MenuPage.tsx` and `src/lib/menu.ts` (guard, regenerate slot, no-repeat), `src/styles.css`, `docs/design.md` if a token is missing.

**States.** Sign-in: empty, sending, "check your mail" (with the address and a resend after 60 s), link expired, error. App: signed out, loading the account, offline (reads the local copy and says changes will sync), sync failed (never silent). Ask: signed out cannot reach it. Branded answer: "Carbs only", never the green "Fits". Menu: plan, hidden profile, too few dishes for this person.

**Sign-in screen copy (needs a clinician's eye, section 9):** one line above the box: "If you have symptoms such as chest pain, confusion, vomiting or fainting, call emergency services. DiaBite does not give insulin or medication doses." Nothing here is behind the wall.

**Phone layout.** One column, the email box and button full width, 44 px targets, 16 px text so iOS does not zoom (already in the stylesheet). Checked at 375 px, light and dark, and with the keyboard open.

**Accessibility.** The status of "check your mail" is a `role="status"` region; focus moves to it. The email box has a visible label. The import prompt is a dialog with the same focus trap as the feedback dialog.

## 6. Engine and API

| Method, path | Auth | Request | Response | Errors |
|---|---|---|---|---|
| `POST /agent/ask` (changed) | `Authorization: Bearer <Supabase access token>`; the gate runs first and needs none | as today | as today, plus `partial.unscored` inside the meal tool result | `401 {error:'sign_in_required'}` for a model turn without a valid token; 429 as today, now also per user |
| `DELETE /account` (new) | Bearer token | none | `{ok:true}` after the auth user and every row are gone | 401; 502 if the admin call fails (nothing is half-deleted: rows go first through `on delete cascade` from the auth user) |
| `GET /health` | none | | unchanged | |
| `/tools/*`, `/session`, `/verify`, `/diag` | `x-api-key`, unchanged | | | fail closed in production, as of today |

**Token check.** `server/auth.ts` (new) verifies the access token against the project's published signing keys (`https://<project>.supabase.co/auth/v1/.well-known/jwks.json`) with the `jose` library, cached, and takes `sub` as the person. It adds one dependency, `jose`, which goes in the lockfile and in the supply-chain row of `docs/security/security-plan.md`. The Supabase project URL is public by design; **no new secret reaches the browser**.

**`DELETE /account`** needs the service-role key to remove the auth user. It lives only as a Container App secret (`supabase-service-key`), never in the image, never in `VITE_*`. The browser cannot delete an auth user, so this is the one place the key is used by the engine; the route verifies the Bearer token first and deletes only that `sub`.

**Limits.** `server/guard.ts` gains a per-user key beside the per-address key: 200 model turns a day and 60 an hour per person (the numbers from the first design, now owned by a person rather than a network). The per-address limits stay as a second wall. **The gate still runs before every limit**, and the token check sits after the gate, so no one is turned away from a refusal or an escalation for lack of a token.

**Branded in the tools.** `ResolvedPhrase.candidates[].kind` already exists; it gains `'branded'`. `ComputeMealResponse.items[]` gains `loadAvailable: boolean`; `totals.gl` is the sum of the *scored* items only; `afterMeal.partial` gains `unscored: string[]` next to `unknownFoods`. `server/contract.ts` documents both. Tools still answer 200 with an `error` field.

## 7. Agents

- **Meal prompt** (`agent/prompts/meal.md`): one added paragraph, in the "and also" form: a branded item carries carbohydrate, fibre and calories but no glycemic load; give those figures, say plainly the load is not available for a branded product, follow the partial-total rule for the verdict, and never name a similar unbranded food as a stand-in. Re-provision with `npx tsx agent/provision.ts`.
- **Tool spec** (`server/openapi.ts`): the compute_meal response description gains `loadAvailable` and `partial.unscored`.
- **Triage** and **advisor**: unchanged. The router prompt already treats a named food as a meal.
- **Re-run `npm run eval:agent`** against the deployed agent after the prompt change (CLAUDE.md rule 8), with the same key, and keep the "and also" discipline.

## 8. Data

**Migration 1: accounts** (`supabase/migrations/<timestamp>_accounts.sql`, additive):

```
profiles       user_id uuid primary key references auth.users on delete cascade
               data jsonb not null            -- the Profile object the app already validates
               consent_at timestamptz, consent_version text
               updated_at timestamptz not null default now()
diary_entries  id uuid primary key             -- the client's own id, so an import is idempotent
               user_id uuid not null references auth.users on delete cascade
               day date not null, meal text, food_id text, grams numeric, snapshot jsonb
               created_at, updated_at timestamptz
index          diary_entries (user_id, day)
RLS            enabled on both; policies select / insert / update / delete  using (auth.uid() = user_id)
grants         none for anon; select, insert, update, delete for authenticated
```

Policies are written first and tested before any app code reads the tables (section 10). `feedback` stays insert-only; it gains a nullable `user_id` set from the session when there is one, so the owner can answer someone. Nothing else about the feedback table changes.

**Migration 2: branded foods.** `public.foods.kind` accepts `'branded'`; rows carry `per100`, a household serving, a `brand` and `fdc_id`; `gi` is null. Rows enter by `scripts/sync-foods.ts` from a new `data/foods-usda/branded_common.json` built by `scripts/build-branded.ts`. **The build needs the USDA FoodData Central "Branded Foods" download (a few hundred MB zipped, public domain). Downloading a file is something I ask you about at that step, with the file name, source and size.**

**What is stored about a person, in full:** the email address (Supabase Auth); the profile (age, sex as chosen, height, weight, activity, diagnosis, medicine classes, kidney status, other conditions, allergens, eating pattern, units, consent); the diary (date, meal, food, grams, the engine's numbers at the time); the feedback they chose to send. **Not stored:** the meal sentences (still only logged when `LOG_QUESTIONS` is on, and that stays off by default for accounts: open decision 4 of PRD-post-course §6); medicine doses (never asked); a name.

**Where it lives:** Supabase project `DiaBite-feedback`, region `eu-west-1` (Ireland). The owner is in the EU, so GDPR applies to the whole service whatever the users' country, and these are health data (special category). See section 9 and 12.

**Deletion and export.** Delete: the app calls `DELETE /account`; the foreign keys cascade. Export: the browser reads its own rows (RLS) and downloads one JSON file; no server code.

## 9. Safety and responsible AI

- **The wall and the red flag.** Rule 6 of `CLAUDE.md` says nobody describing a red flag is told to wait. A sign-in wall in front of the app is a wait. Two mitigations are in the design and both need a clinician's reading of the words: the emergency line on the sign-in screen itself, and the engine answering gate-caught messages without a token. If you ever wanted the wall to be absolute, that sentence is what you would be giving up.
- **Consent.** Health data, identifiable person, EU controller: explicit consent for special-category data, a plain statement of what is kept, and deletion on request. The onboarding gets one screen; its wording is a draft for counsel (WS6), not final.
- **Menu guard.** Hidden for `eatingDisorder` in the comorbidities, `kidney: 'ckd'` and `'dialysis'`. **Not hidden, and a question for the clinicians:** `kidney: 'mentioned'`, gout, gastroparesis, brittle diabetes, a GLP-1 user's protein. Meanwhile the menu says "not yet reviewed by a clinician". A calorie-counted daily *target* is still shown to someone with a history of disordered eating in onboarding today; that is not changed here and is a clinician question (new, item Q-ED below).
- **Branded.** The risk is a person reading a carbohydrate figure as permission. The card never uses the green "Fits", says the load is not available, and asks nothing it cannot use.
- **What a clinician should review:** the sign-in emergency line; the consent wording; the hidden-profile list and the sentence shown instead; the branded wording; the menu's "not reviewed" line.

## 10. Evaluation plan: written in the same changes

**Engine (`npm run eval`, no model, no money):**
- `partial` section: a branded item makes `fits` null; an over-budget scored part with a branded item is still `false`; a branded item alone never says fits.
- `catalogue` section: rule 4 amended precisely: every record with carbohydrate and no GI is `kind: 'branded'` and has `loadAvailable` false, **and nothing else is**. The check fails if a non-branded record is in that state.
- `resolve`: 30 branded phrases from the field set (KIND bar, Oreos, Doritos, Red Bull) reach a branded record; 10 unrelated phrases still do not (no spaghetti-to-squash accident).
- `menu` section: no dish repeats within three days over 200 seeds; regenerating one slot changes only that slot; the same seed gives the same plan; every hidden profile gets no plan.
- `stored` section: the profile sanitiser keeps working on a profile read from the table.

**Abuse (`npm run eval:abuse`):** a model turn without a token is 401; a dosing question without a token is 200 and refused; a red-flag message without a token is 200; a forged and an expired token are 401; the per-user limit; the gate before the limits is unchanged; `DELETE /account` without a token is 401.

**Row-level security (a SQL test, run against a branch database before the migration is applied to the project):** user A cannot select, update or delete user B's rows; anon cannot select anything; deleting an auth user removes both tables' rows; importing the same entry twice leaves one row.

**Agent (`npm run eval:agent`, live):** "A KIND bar" and "a pack of Oreos" answer with carbohydrate and the load stated as not available, `afterMeal.fits` is not true (read from the tool result, not the prose, by a new `engineUnscored` expectation), and the answer is verified; the existing 90 cases stay as they were.

**By hand, once:** the sign-in on a real phone from a real email, the import prompt with a real browser diary, and deletion of a test account, each against the live service.

## 11. Rollout

1. **Before any code, you (outside this repository):** create the Azure Communication Services Email resource and a sender domain (an Azure-managed one works to start; your own domain looks more trustworthy and avoids spam folders); in Supabase set the Site URL and the redirect allow-list to the app's address, and the SMTP settings from that resource. I will list the exact fields; I cannot set them for you.
2. **B first:** build the branded file, migration 2, engine, prompt, evals. Deploy; `sync-foods`; **restart the revision** (rule 10 of `CLAUDE.md`); ask the live service about a KIND bar.
3. **C:** menu changes are in the browser only. Deploy; check on the live app with a profile that has each hidden flag.
4. **A:** migration 1 on a Supabase branch first, the RLS tests, then the project; engine auth behind `REQUIRE_SIGN_IN` (default **off** until the sign-in screen is deployed, then on); deploy; sign in with a real address; run the abuse suite against the live service.
5. **Check the thing, not the report:** after each deploy, ask the running service for what it is serving (CLAUDE.md rule 1).
6. **Rollback.** A: set `REQUIRE_SIGN_IN=off` (new revision, a minute) and the app is anonymous again; the tables stay and nothing is lost. B: `BRANDED_FOODS=off` removes the kind from resolution; the rows stay inert. C: the guard and the regenerate button are code in the browser; revert the commit. Migrations are additive, so none needs undoing.

## 12. Open questions: the owner's, a clinician's, counsel's

**Owner**
1. **Demo Day and the five strangers.** With a wall, a person at the demo cannot try the app without giving an email. Do you want a demo account that is already signed in on one device, or a short "try it" path? (My recommendation is the first: a device you hold.)
2. **Advisor memory.** The advisor's memory store keeps food preferences under the session id. With accounts it can be per person, which is the "memory worth having" of PLAN, and it means preferences about an identifiable person live in Foundry. Per person, or still per session for now?
3. **Which emails may sign in.** Anyone, or an allow-list during the beta? An allow-list is the owner knowing who by construction.
4. **Sender domain** for the emails: Azure's own, or yours.
5. **The branded list.** I will build it from the phrases people typed in the field set plus the common US brands I know; you may have a list from your reading of the market that is better. Say if you do.
6. **Signing out on a shared device:** clear the local copy, or keep it?

**Clinician (new questions for the pack)**
- **Q-W1** Which profiles should not be shown a plan: is "eating disorder, CKD, dialysis" right, and what about "kidney problems mentioned", gout, gastroparesis, brittle diabetes?
- **Q-ED** Should a history of disordered eating see a calorie target at all, in onboarding or anywhere?
- **Q-S1** The sign-in screen's emergency sentence, and whether a gate-only answer without sign-in is acceptable.
- **Q-B1** Is "carbohydrate, load not available" an answer a person with diabetes can use safely, and what should the card say beside it?

**Counsel** (WS6, started early because it is the slowest)
- GDPR for health data of US users under an EU controller: the lawful basis and the consent text, a data processing agreement with Supabase and Microsoft, retention, the right to export and erasure, and whether a US state law (Washington's My Health My Data Act, for one) also applies. **This document does not answer them.** A private beta with explicit consent and deletion is where this plan stops until counsel has answered.

## Files that change

`server/auth.ts` (new) · `server/engine.ts` · `server/guard.ts` · `server/agent.ts` · `server/contract.ts` · `server/compute.ts` · `server/foods.ts` · `server/resolve.ts` · `server/openapi.ts` · `server/sessions.ts` · `agent/prompts/meal.md` · `scripts/build-branded.ts` (new) · `scripts/sync-foods.ts` · `supabase/migrations/*accounts.sql`, `*branded_foods.sql` (new) · `src/components/SignIn.tsx`, `ImportPrompt.tsx` (new) · `AskPage.tsx` · `MenuPage.tsx` · `ProfilePage.tsx` · `src/lib/auth.ts`, `sync.ts` (new) · `src/lib/supabase.ts` · `src/lib/storage.ts` · `src/lib/menu.ts` · `src/styles.css` · `eval/cases.json`, `run-engine.ts`, `run-abuse.ts`, `run-cases.ts` · `package.json` (`jose`) · `.env.example` · `CLAUDE.md` (rule 4 amended; a rule on the account tables) · `docs/security/security-plan.md` · `docs/design.md` if a token is missing.

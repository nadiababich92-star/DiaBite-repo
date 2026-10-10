# Spec: sign-in, the app side

*From `docs/engineering/engineering-doc.md` sections 3, 5 and 9. Applies `docs/design.md`; every colour, size and space is a token that exists.*

## States of the app

```
loading  →  signedOut  →  (link or code)  →  signedIn
                                                │
                                   server has no profile? → consent → onboarding
                                   local data and server empty? → "move it?" prompt, once
                                   otherwise → the app, reading profile and diary from the account
```

`signedOut` shows only the sign-in screen. Nothing else is reachable: no ask box, no tabs. The emergency line is on the sign-in screen itself (below).

## `src/lib/supabase.ts`

`persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true` (the link brings a session back in the address), `flowType: 'pkce'`. The old comment "No login anywhere in the app" is replaced. Still only the publishable key.

## `src/lib/auth.ts` (new)

`useAuth(): { status: 'loading' | 'signedOut' | 'signedIn'; email?: string; token?: string }`, `sendLink(email)`, `verifyCode(email, code)`, `signOut()`. `sendLink` calls `signInWithOtp({ email, options: { emailRedirectTo: location.origin, shouldCreateUser: true } })`; `verifyCode` calls `verifyOtp({ email, token, type: 'email' })`. The token the engine needs is `session.access_token`, read fresh for each ask.

## `src/components/SignIn.tsx` (new)

Three views, one component, in this order. Copy is exact; no emoji, no exclamation marks, sentence case, no terminal punctuation on labels.

1. **Address.** Wordmark `DiaBite` (serif), the line "Nutrition for type 2 diabetes and insulin resistance". A card holding the emergency line, in `--accent-soft` with `--text`: "If you have symptoms such as chest pain, confusion, vomiting or fainting, call emergency services. DiaBite does not give insulin or medication doses." Then the card "Sign in with your email": a labelled field `Email`, `inputMode="email"`, `autoComplete="email"`, 16 px text; the primary button "Email me a link"; the note "We send a link and a six-digit code. There is no password." A footnote: "By continuing you agree to how DiaBite keeps your data. Read what is kept." (the last four words open the data statement, below).
2. **Check your mail.** Heading "Check your mail". "We sent a sign-in link to <address>. Open it on this device, or type the code from the email." Six single-digit boxes (one `autocomplete="one-time-code"` field, rendered as six cells, accepts a pasted code), primary button "Sign in", a ghost button "Send again" that counts down 60 s ("Send again in 54 s"), a link "Use a different address". The status text is a polite `role="status"` region and focus moves to the first box.
3. **Problems**, in the same card, in the product's voice: wrong or expired code, "That code didn't work. Check it and try again, or ask for a new one"; address that is not an address, "Enter an email address like name@example.com"; the send limit, "Too many emails just now. Try again in a few minutes"; no network, "Couldn't reach DiaBite. Check your connection and try again". A raw error string is never shown.

Layout: one column, max-width as the app, the field and buttons full width below 560 px, 44 px targets, focus ring `--accent` 2 px. Light and dark checked, 375 px checked, with the phone keyboard open.

## Consent and the data statement

Step 0 of onboarding gains, above the first question, one card: "What DiaBite keeps" with a short list in plain words: your email address; your answers about yourself (age, sex, height, weight, activity, diagnosis, the classes of medicine you take, kidney status, other conditions, allergies, how you eat); what you log in your diary. "It is stored in Ireland. You can export it or delete it all, at any time, from the Profile tab. DiaBite never asks for a medicine dose and never sells your data." and a checkbox "I agree that DiaBite keeps this about me" that must be ticked to continue. Ticking records `consent_at` and `consent_version` (`2026-10-draft`) with the profile. **This wording is a draft for counsel (WS6) and for a clinician's reading; it is marked as a draft in the code and in the PR.**

## Storing and syncing: `src/lib/sync.ts` (new)

- **Source of truth is the account** when signed in. `loadProfile` and `loadDiary` in `storage.ts` become a *cache*: read first for speed, replaced by the server's rows as soon as they arrive.
- Reads: `profiles` (one row, `maybeSingle`) and `diary_entries` ordered by `day` desc, **paged 1,000 at a time until a short page** (PostgREST's silent cap, rule 2 of `CLAUDE.md`).
- Writes: after any change, debounced 800 ms. Profile: `upsert` on `user_id`. Diary: `upsert` by `(user_id, id)` for added or changed entries, `delete` for removed ones. Last write wins per entry by `updated_at`.
- **Offline or failed**: changes wait in `localStorage` under `diabite.outbox.v1` (bounded to 500 operations, oldest dropped with a visible notice) and are retried on the next focus and every 30 s; the page says "Changes will sync when you're back online" and **never fails silently**: a persistent failure shows "Your changes haven't been saved. Try again" with a button.
- `sanitizeProfile` (already in `storage.ts`) runs on every profile read from the server as well; a row that fails it is treated as no profile and the person is asked again, never crashed on.
- A 401 from the engine, or a failed refresh, returns the app to `signedOut` with the message "Your session ended. Sign in again".

## Moving the diary from this browser

On the first signed-in load, if the browser holds a diary or a profile (`diabite.diary.v1`, `diabite.profile.v1` with `onboarded: true`) and the account holds neither: a dialog (same focus trap as the feedback dialog): "We found a diary on this device. Move it to your account?" Buttons: **Move** (primary), **Not now**. Move upserts by the entries' own ids (a second tap changes nothing) and shows "Moved 14 entries" before clearing nothing: the local copy is removed only on sign-out (below). "Not now" asks again on the next sign-in, never silently moves, never silently discards.

## Account block in the Profile tab

Under the profile: **Signed in as <address>**; **Export my data** (reads the person's own rows through row-level security and downloads one JSON file, `diabite-export-<date>.json`: profile, diary, consent time); **Sign out** (a confirm: "Signing out removes your profile and diary from this device. They stay in your account."), which clears every `diabite.*` key from `localStorage` and signs out; **Delete my account** (a dialog: "This deletes your account, your profile and your whole diary. It can't be undone. Type delete to confirm", a field, and a danger button "Delete everything" enabled only when the field reads `delete`), which calls `DELETE /account`, then clears local data and shows the sign-in screen with "Your account was deleted".

## The ask

`askAgent` sends `Authorization: Bearer <access token>`. A 401 `sign_in_required` returns to the sign-in screen. A 429 `scope: 'user'` reads: "You've asked a lot of questions today. Try again in about N minutes". The rate-limit card never disables the Ask button (existing rule).

## The email

Supabase → Authentication → Emails → Templates → **Magic Link**, subject "Your DiaBite sign-in link", body (plain, English):

```
Tap the button to sign in to DiaBite. It works once and expires in one hour.

[ Sign in to DiaBite ]  →  {{ .ConfirmationURL }}

Or enter this code in the app: {{ .Token }}

If you didn't ask for this, you can ignore it. Nothing happens unless the link is opened.
```

and the **Email OTP length** is 6. (The owner pastes this in the dashboard; there is no API for me to do it.)

## The demo device (Demo Day)

A normal account (`demo@<owner's address>` or a plus-address) signed in once on the device the owner holds. Sessions persist; the demo account's profile is the invented person of the pitch video. It is the owner's account like any other, deletable, and never pre-filled in the code.

## Verifiable

- `npm run eval`, `account` section: the sync merge by id (two entries with the same id keep the newer `updated_at`; an import twice yields one); the outbox bound at 500; `sanitizeProfile` on a server row; the export JSON has exactly the keys profile, diary, consent.
- Screens, light and dark, 375 px: all three sign-in views and the problem messages; the consent card; the move dialog; the account block; the delete dialog.
- By hand, once, on the live service: a real address from a real phone (link, then code), consent, onboarding, one question, the diary on a second device, export, sign-out clears local, delete leaves nothing (read as the service role: both tables empty for that id).

## As built, 10 October 2026

- The six-digit code is **one** numeric field (`autocomplete="one-time-code"`, wide letter-spacing), not six cells: a pasted or auto-filled code just works, and a screen reader meets one field.
- The sign-in uses Supabase's **implicit** flow, not PKCE as first written: a link asked for on a laptop must work when tapped on a phone, and a PKCE link only works in the browser that asked.
- Whether to show the wall comes from the engine: `GET /health` now carries `signIn: true|false`, so `REQUIRE_SIGN_IN` is one revision and no new build. If the engine cannot be reached the app shows the wall.
- Pure parts live in `src/lib/syncCore.ts` and `src/lib/authCore.ts` and are tested in `npm run eval` (`account` section); the network parts in `sync.ts` and `auth.ts`.
- A diary from before sign-in is set aside in `diabite.legacy.diary.v1` when it holds entries the account lacks; "Not now" leaves it there and it is offered again at the next sign-in; sign-out clears it with everything else.
- The code length is **Supabase's** setting (it was 8 on the project, not 6); the app accepts 6 to 10 digits and says "a code", never "six-digit".

## As built, later on 10 October 2026

- **The Profile tab is called You** and now also holds Appearance (Follow my phone, Paper, Night; kept on the device, not in the account) and Send feedback. The optional sign-in card ("Keep your profile and diary") and the account block (export, sign out, delete) are under it.
- **How sync behaves, so nobody is surprised.** The app reads the account **once**, when it opens or when someone signs in. After that it only *writes*: a change settles for 0.8 s, then the changed entries and the profile are upserted; a failure is retried every 30 s and whenever the tab regains focus, and shows "Your changes haven't been saved". A second device therefore sees a meal logged on the first **after it reloads**, not live. Each device deletes only entries it had itself synced, so a stale device cannot erase another device's meals. The profile is last-write-wins, which can drop a profile change made on another device if this one changes its profile before reloading. None of this loses a meal; the profile case is the one to know about.
- **`DELETE /account` is idempotent.** A token outlives the account it names, so a second press, or a retry after a lost reply, reaches Supabase for someone already gone and gets 404; that is answered `200 {"ok":true}`.
- **The wall covers the new route too.** `POST /meal/recompute` (a portion changed, no model) answers 401 without a token when sign-in is required.
- **The diary day follows the calendar.** `useToday` updates at local midnight and when a tab returns to view, so a tab left open overnight shows the new day's budget. Weeks are counted in calendar days, not 24-hour blocks, and are tested across clock changes in three time zones.
- **A dress rehearsal exists:** `npm run rehearsal` creates a throwaway account, signs in on two browsers, walks onboarding with consent, logs on each, checks both see both, deletes the account and checks nothing is left (W0 to W11). It ran green on 10 October and should run before switching the wall on and after any change to sign-in, sync, the profile or the diary.

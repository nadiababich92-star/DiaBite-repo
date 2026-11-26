# Spec — The first session: sign in with Google

*Stage 2, from `docs/engineering/engineering-doc.md`, sections 5, 6, 8, 9 and 11 (decided 23 November 2026). Read `docs/design.md` and apply `/design-system` before any UI code. **Built last, and off until the owner turns it on**: nothing here is visible to anyone while `GOOGLE_SIGN_IN` is unset.*

**No migration.** Supabase Auth keeps a Google identity for the user; no table of ours changes. **No agent change.** Files: `src/lib/auth.ts`, `src/lib/landingRule.ts`, `src/components/SignIn.tsx`, `server/engine.ts` (one field on `/health`), `.env.example`, `docs/design.md`, `src/styles.css`, `docs/security/security-plan.md` (one row).

## 1. What only the owner can do (not code, and never in chat or in the repository)

1. In Google Cloud, create an OAuth 2.0 client (type "Web application") for DiaBite; add Supabase's callback address (shown in the Supabase Google-provider settings) as an authorised redirect.
2. In Supabase → Authentication → Providers → Google: enter the client id and secret and enable it. The secret lives only there.
3. In Supabase → Authentication → URL configuration: confirm the redirect allow-list holds `https://diabite.pro`, `https://www.diabite.pro`, the technical address and `http://localhost:5173` (the email link already redirects to the page's own origin, so these are probably there; check, do not assume).
4. Counsel's read of the consent text for a second identity provider (plan, section 12 question 4). **The key stays off until she says so.**

## 2. The engine

`server/engine.ts`, the `/health` route (today `{ ok, records, signIn }`) adds one field, a boolean from a setting that is not a secret:

```ts
app.get('/health', (_req, res) => res.json({ ok: true, records: records.length, signIn: signInRequired(), googleSignIn: process.env.GOOGLE_SIGN_IN === 'on' }))
```

(The anonymous plan adds `freeAnswers` to the same object: both fields live side by side. Whichever is built second edits the same line.) Unset or any value but `on` is `false`. **To verify before building:** read `server/auth.ts` and confirm that the token's user id and email are read without assuming the email provider (the plan, section 6); if a field is read from an email-only claim, fix it in this change and add a check.

## 3. The browser, `src/lib/auth.ts`

```ts
/** Starts Google's sign-in. On success the browser leaves for Google and comes back to this page with a session. */
export async function signInWithGoogle(): Promise<'redirecting' | SignInProblem> {
  if (!supabase) return 'unavailable'
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, scopes: 'email' },
    })
    return error ? problemOf(error) : 'redirecting'
  } catch { return 'network' }
}

/** Google refuses its sign-in inside the in-app browsers of social apps; the person would meet Google's error page, not ours. Best effort, from the user agent. */
export function inAppBrowser(ua: string = navigator.userAgent): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Snapchat|MicroMessenger|Twitter|Reddit|Threads|; wv\)/i.test(ua)
}
```

`scopes: 'email'` asks for the email only (the consent card says DiaBite keeps "your email address"). **To check on staging:** that sign-in still works with that scope and what lands in the user's metadata (plan, section 8). If Supabase refuses the scope, remove the option, say so in the owner's checklist, and read what is stored. The `inAppBrowser` list is **best effort and unverified**: test it on a phone from a link opened inside Reddit, Threads and LinkedIn before the key is turned on, and extend it from what is seen. A false negative costs one person a Google error page and the email form; a false positive costs one person the Google key.

The access to the flag: `useAccess()` of `anon-screen.md` returns `googleSignIn`; if the anonymous plan is not built yet, read `h.googleSignIn === true` beside `h.signIn` in `useSignInRequired`.

## 4. The return path, `src/lib/landingRule.ts`

The landing page already stays out of the way when the address carries `access_token`, `refresh_token`, `error_description`, `error_code` or `code` (`authInUrl`): a Google return is covered. Add one pure function:

```ts
/** True when the address carries a failed sign-in (a refused or cancelled consent screen). */
export function authError(loc: Where): boolean {
  return parts(loc).some((p) => p.has('error') || p.has('error_description') || p.has('error_code'))
}
```

## 5. The screen, `src/components/SignIn.tsx`

Only when `googleSignIn` is true. Above the existing form, inside the same card:

```
[ Continue with Google ]            ← ghost-style button, full width, the word "Google" and no logo
or use your email                   ← muted line
Sign in with your email  (the form, unchanged)
```

| State | What the person sees |
|---|---|
| in an in-app browser (`inAppBrowser()`) | **no Google key.** One muted line instead: *"To use Google, open DiaBite in your browser. Your email works here."* |
| pressed | the key reads **Opening Google…**, is disabled, and a status line (`role="status"`) says *Opening Google*; the page leaves for Google |
| `signInWithGoogle()` returns a problem | the existing `PROBLEM` line for that problem, under the key |
| back from Google with `authError(window.location)` | one muted `role="status"` line above the key: *"Google did not sign you in. Try again, or use your email."*; the address is cleaned once with `history.replaceState(null, '', window.location.pathname)` |
| `googleSignIn` false or absent | the screen is exactly today's |

The one-line data statement under the form changes **only when the key is shown**, to cover both ways in: *"By continuing, with Google or by email, you agree to how DiaBite keeps your data: your email address, your answers about yourself and your diary, stored in Ireland, which you can export or delete at any time."* (Today's text, with the first clause added.) The key's colours come from the existing ghost style; **Google's own branding rules for its key conflict with "every colour from `docs/design.md`"**, so the key is drawn plain unless the owner allows an exception, which would be written into `docs/design.md` first. The code step (the one after "Email me a link") is not touched.

## 6. Setting

`.env.example`: `GOOGLE_SIGN_IN` (see that file). A Container App environment value, not a secret.

## 7. Turning it on and off (rollout, from the plan)

Build and deploy with the setting **unset**: `/health` says `googleSignIn: false` and nothing changes. When the owner has done section 1: set `GOOGLE_SIGN_IN=on` (one revision), then **with a test Google account** sign in once; read what `auth.users` holds for it (the owner reads it, not the chat); sign in by email with the same address and check it reaches the **same** profile (identity linking); open Settings and run export and then delete on that account (`/account` works by user id). Only then does anyone else see the key. **Rollback:** unset the setting (one revision, no build).

## Verifiable

Engine: **OB5** (`authInUrl` true for a Google return, `authError` true for a failed one and false for a good one, the landing rule does not cover either), **OB9** (`inAppBrowser`). Abuse: **ANF** (`/health` carries `googleSignIn`, false unset, true with `GOOGLE_SIGN_IN=on`). Screens: the sign-in screen with and without the key, in an in-app user agent (the key is absent and the line is present), and after a failed return. Rehearsal **W22** presses the key and reads that the page goes to `accounts.google.com`, then stops: **no automated run ever signs in to Google.**

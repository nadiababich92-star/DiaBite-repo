# Landing page: when it shows

*Spec for `docs/engineering/engineering-doc.md`, sections 3 and 5. The one file that changes is `src/App.tsx`, plus a small pure helper so the rule can be tested without a browser. This is the part of the change that could lock someone out of the app, so it is the most carefully specified.*

## 1. The rule

The landing page is rendered when **all** of these hold:

| Condition | Why |
|---|---|
| `signInRequired === true` | In production sign-in is required. In local development it is not, and the app opens as it always did. While it is `null` (not yet known) the existing "Opening DiaBite…" stays. |
| `auth.status === 'signedOut'` | Never for `loading` or `signedIn`. |
| `!notice` | A notice such as "Your session ended. Sign in again." means the person was in the app a moment ago; they go straight to sign-in. |
| `!authInUrl(window.location)` | An email link must never be intercepted (see §3). |
| `!skipLanding(window.location)` | The address `/?signin` goes straight to sign-in (see §4). |
| `!entering` | A state in `App`, `false` at start; set to `true` by **Try DiaBite** and **Sign in**; set back to `false` by "Not now" on the sign-in screen. |

Otherwise nothing changes: the existing branches run in their existing order.

## 2. The change in `App.tsx`

Today (`src/App.tsx`, the block that starts "Not yet known whether to ask for a sign-in"):

```tsx
if (signInRequired === null || auth.status === 'loading' || (auth.status === 'signedIn' && account !== 'ready' && account !== 'failed')) {
  return <div className="app"><p className="muted" role="status">Opening DiaBite…</p></div>
}
if (signInRequired && auth.status === 'signedOut') return <SignIn notice={notice} />
```

After:

```tsx
const [entering, setEntering] = useState(false)          // with the other useState calls, above any early return
…
if (signInRequired === null || auth.status === 'loading' || (auth.status === 'signedIn' && account !== 'ready' && account !== 'failed')) {
  return <div className="app"><p className="muted" role="status">Opening DiaBite…</p></div>
}
if (signInRequired && auth.status === 'signedOut') {
  if (showLanding({ signInRequired, signedOut: true, notice, entering, location: window.location })) {
    return <Landing onEnter={() => setEntering(true)} />
  }
  return <SignIn notice={notice} onCancel={entering ? () => setEntering(false) : undefined} />
}
```

`entering` is a hook, so it is declared with the other hooks at the top of `App` and never inside a branch. `onCancel` is passed only when the person came from the landing page, so a person who was sent to `/?signin` or whose session ended does not see a "Not now" button that leads somewhere they never were. `SignIn` already renders "Not now" when `onCancel` is given.

## 3. The auth hash and query: `src/lib/landingRule.ts` (new, pure)

```ts
/** True when the URL carries a sign-in result, so the landing page must not be drawn over it. */
export function authInUrl(loc: { hash: string; search: string }): boolean
/** True for /?signin (any value, or none). */
export function skipLanding(loc: { search: string }): boolean
/** The whole rule of §1 in one place. */
export function showLanding(i: { signInRequired: boolean | null; signedOut: boolean; notice: string | null | undefined; entering: boolean; location: { hash: string; search: string } }): boolean
```

`authInUrl` is true when the hash (after `#`) or the query (after `?`), parsed as `URLSearchParams`, contains any of: `access_token`, `refresh_token`, `error_description`, `error_code`, `type` with value `magiclink`, `recovery` or `signup`, or `code`. The match is on the key, never on the value, and the function never reads, logs or stores a token. The app uses the implicit flow with `detectSessionInUrl: true` (`src/lib/supabase.ts`), so the Supabase client reads the hash itself; this function only tells the page not to draw the landing over it.

Why it matters, in order of failure: (1) the email link opens `https://diabite.pro/#access_token=…`; the client signs the person in and the status changes to `signedIn`; if the landing page ignored the hash it would flash for one render before that. (2) A link that fails (an expired token) arrives with `error_description` in the hash and the person must see the sign-in screen with its message, not the landing page. Both are covered by §1 returning `false`.

**Edge: the link is opened on a different device from the one that asked for it.** The person arrives signed out with a valid token in the hash; the Supabase client signs that device in. Nothing about this changes.

## 4. `/?signin`

`skipLanding` is true when `new URLSearchParams(search).has('signin')`. The owner sends this address for moderated sessions (`https://diabite.pro/?signin`), so the first screen is the sign-in screen, as in the protocol. The address `https://diabite.pro` alone shows the landing page. No redirect is involved and nothing is written to storage.

`/?lab` (the builders' flag, `src/lib/demo.ts`) is independent: both can be present.

## 5. What does not change

- `signInWithOtp` still uses `emailRedirectTo: window.location.origin` (`src/lib/auth.ts`); the email link still lands on the root.
- The Supabase redirect allow-list is untouched (no new URL is introduced).
- Signed-in visitors never reach this code path: a stored session makes `auth.status` `signedIn` after "Opening DiaBite…".
- The engine's static fallback already serves `index.html` for `/` and `/?signin`; no server change.
- Sign-out: `signOutAndClear` leaves the person signed out with a notice only when the session ended; a deliberate sign-out from the profile tab has no notice, so the **landing page shows**, which is the right place to land.

## 6. Unit tests (`eval/run-engine.ts`, a `landing rule` block, no browser)

| Case | Input | Expect |
|---|---|---|
| R1 | signed out, required, no notice, root URL | `showLanding` true |
| R2 | the same with `entering: true` | false |
| R3 | `?signin` | false |
| R4 | hash `#access_token=x&type=magiclink` | false |
| R5 | hash `#error=access_denied&error_description=expired` | false |
| R6 | query `?code=abc` | false |
| R7 | notice `Your session ended. Sign in again.` | false |
| R8 | `signInRequired: false` | false |
| R9 | `signInRequired: null` | false |
| R10 | `signedOut: false` | false |
| R11 | `?lab` only | true (the flag does not skip the landing) |

## 7. Verify

- Run the unit cases (`npm run eval`).
- Locally with sign-in required (point the dev server at the live engine, as `npm run dev` does): signed out at `/` shows the landing; **Try DiaBite** shows sign-in; "Not now" returns; `/?signin` shows sign-in with no "Not now"; a stub `/#access_token=x` shows "Opening DiaBite…" or sign-in and never the landing.
- After deploy: the smoke checks L2 to L5 (see `landing-checks.md`), then the owner follows one real email link (the engineering document, section 11, step 4).

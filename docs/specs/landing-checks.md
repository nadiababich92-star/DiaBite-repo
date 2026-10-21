# Landing page: the checks

*Spec for `docs/engineering/engineering-doc.md`, sections 4, 9 and 10. A feature without checks is not finished (CLAUDE.md, Stage 5): these are written in the same change as the page. CLAUDE.md rule 7 still holds: no check reads the product's answers with a regex. The checks on the landing page read **static copy that the owner controls**, which is not an answer, and read the engine's tool result, not its prose, for the numbers.*

**Migration:** none. **`.env.example`:** nothing is added (no new variable, no secret). **Agents and `eval/cases.json`:** no case is added (no prompt, tool or food data changes); the cases below are code checks in the existing eval scripts.

## L1 · The receipt is true — `eval/run-engine.ts`, a `landing` block

Import `LANDING` from `../src/data/landing` and `computeMeal` from `../server/compute` (already imported). Call `computeMeal(LANDING.rows.map(r => ({ foodId: r.foodId, grams: r.grams })))`. For every row compare, to one decimal, `availableCarbs`, `gi` (null equals null) and `gl` with the engine's item; compare `totals.gl` with `LANDING.totalGl`; compare `Math.round((LANDING.budgetGl - LANDING.totalGl) * 10) / 10` with `LANDING.leftAfterGl`. Push a message per mismatch into the block's list, print `landing   ok` or `landing   WRONG`, and `process.exit(1)` on any, as the `monitor` and `plan` blocks do. Also fail if a row's `foodId` does not resolve in the loaded catalogue (a removed record).

Add the **rule unit cases R1 to R11** of `landing-routing.md` in a `landing rule` block of the same file (pure functions from `src/lib/landingRule.ts`).

**Live counterpart (rule 10: the live catalogue is the Supabase table, not the files in the image).** `node eval/landing-live.mjs` (new): reads the engine key from the Container App secret as `eval/a11y.mjs` reads the service key (never printed), posts the same three rows to `https://diabite.pro/tools/compute_meal`, and compares the tool result with `LANDING` exactly as above. It runs after every deploy and after every `sync-foods` + restart. It spends no model turn.

## L2 to L5, L9 · The first load — `eval/smoke.mjs`

Replace M7 (today: the first screen is the sign-in screen with the emergency line) with:

- **M7a** — `health.signIn === true`, a signed-out first load of the live address. The page text contains the emergency sentence, `Try DiaBite`, `Sign in`, `not medical advice`, `No clinician has signed it off yet`; does **not** contain `Email me a link` (that is the next screen) or any app content (`What are you about to eat`); and contains none of the forbidden phrases of `landing-copy.md` §3. (L2)
- **M7b** — click `Try DiaBite`: the text now contains `Email me a link` and the emergency sentence. (L3)
- **M7c** — navigate to `/?signin`: the first screen contains `Email me a link` and not `Can I eat this?`. (L4)
- **M7d** — navigate to `/#access_token=stub&type=magiclink`: the page never shows the landing page: the text does not contain `Try DiaBite` after the page settles (it shows "Opening DiaBite…" or the sign-in screen). (L5) The stub token is not a credential and the Supabase client rejects it.
- **M12** (existing, no script error or console error) now also runs on the landing page, including after the video element exists.
- **M15** (no browser, a `fetch`) — the static HTML of `/` contains `og:title`, `og:description`, `og:image` with an `https://diabite.pro/` address, `twitter:card`, and `og:image:alt` that contains the same total load figure as `LANDING.totalGl`; `/share.png` answers 200 with `image/png`; `/clip-how-it-works-v3.vtt` answers 200; a `Range: bytes=0-1023` request for `/clip-how-it-works-v3.mp4` answers 206. (L9)

When `health.signIn` is false (local development) the existing branch of M7 is unchanged.

## L6 · Signed-in visitors never see it — existing scripts

`eval/rehearsal.mjs`, `eval/a11y.mjs`, `eval/a11y-tree.mjs` and `eval/screens.mjs` start by injecting a signed-in session; they must pass **unchanged**. If any of them fails because the landing page appeared, the routing rule is wrong, not the script.

## L7 · Accessibility — `eval/a11y.mjs`

Add a signed-out screen to the loop (before the account is injected): load the address with `localStorage` cleared and no session, and `scan('landing')`; then press `Try DiaBite` and `scan('sign-in')`. Both themes, phone and laptop (the loop already does). The 320 px reflow and 200% zoom lists gain `landing` as a fifth screen (signed out). The keyboard walk gains the landing: Tab from the top reaches the skip link, `Sign in`, `Try DiaBite`, the video controls, the transcript summary, the links and the footer button, each with a visible focus ring. Result to meet: no axe violation, no contrast failure, no horizontal scroll.

## L8 · The accessibility tree — `eval/a11y-tree.mjs`

Add `landing (signed out)` as a screen beside `sign-in (signed out)`. Add checks to `check()`: the page has exactly one `h1`; the `video` node exists and its element has a `track` with `kind=captions`; the `main` landmark exists (already checked). The existing checks (every control named, no skipped heading level, no unrounded number) run on it. Result to meet: `ok`.

## Mechanical checks that already exist and must stay green

`npm run typecheck`, `npm run build`, `npm run eval`, `npm run eval:abuse`, `npm run smoke -- https://diabite.pro`, `node eval/a11y.mjs`, `node eval/a11y-tree.mjs`. `npm run eval:agent` is **not** required (no agent change); say so in the commit message.

## Done means

All of the above pass; the owner has followed one real sign-in email link in a private window and arrived signed in (engineering document, section 11, step 4); `docs/accessibility-pass.md` gets a line for the landing page; `docs/STATUS.md` lists the page as live and adds "refresh `LANDING.checks` and the share image when the agent evaluation is rerun".

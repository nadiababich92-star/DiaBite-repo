# Engineering document — a landing page at diabite.pro

*Produced by `/engineering-planner` on 20 October 2026. The previous document (log a meal on any day, and plan the days ahead) is archived as `docs/engineering/plan-any-day.md`. **Not yet approved.***

## 1. Summary

**The feature.** A person who is not signed in and opens `https://diabite.pro` sees a page about the product, not the sign-in form. It says what DiaBite does, shows a real receipt and a one-minute clip, states the one promise and what the product is not, says who built it, and has a clear **Try DiaBite** action that leads into the existing email sign-in. Below that, a short section for clinicians and reviewers says how the numbers are checked.

**The problem it answers.** Today the first thing anyone meets is an email box and the words "Email me a link". That is right for the five moderated sessions (the owner hands people the link) and wrong for everyone else: a stranger from LinkedIn, a clinician, the cohort platform, or someone sent the address by a friend gets no reason to give an email address to something they have not seen. The roadmap's workstream WS9 names a landing page (`docs/PRD-product.md`, "Going to market"), and Mahesh's feedback on the demo day asked for it ("make it easy to start", `docs/FEEDBACK-demo-day.md`, items 5 and 6). No PRD section has to change; WS9 is brought forward in its smallest form.

**Success.** (1) A signed-out visitor sees the landing page first, on a phone and a laptop, and one tap reaches the sign-in screen. (2) A signed-in visitor, and anyone arriving from the sign-in email, goes straight into the app exactly as today. (3) A link shared on LinkedIn or Slack shows a title, a sentence and an image. (4) The five sessions get no worse: the owner can still send an address that goes straight to sign-in. (5) No tracker, cookie, analytics or third-party script is added (ROADMAP 2.5).

## 2. Scope

**In:** a `Landing` screen in the existing React app, shown to signed-out visitors when sign-in is required; copy, the receipt, a self-hosted one-minute clip with captions; Open Graph and Twitter meta tags with a share image; a `?signin` address that skips the landing page; the smoke and accessibility checks updated; an engine case that keeps the landing receipt true.

**Out:** analytics, a waitlist or any form on the page, pricing, a request-demo button, testimonials, a blog, translations (English only, as the product), a photo of the owner (decided 20 October: name and one line, no photo; the team-slide photo carries a generator mark), a separate marketing site or domain, server-side rendering.

**Later:** the clip replaced by a better one when the demo is re-recorded (ROADMAP 1.11); a "request a demo" action once there is something to book; analytics only if the owner decides to take on a consent banner.

## 3. User flows

```
Stranger:       diabite.pro → app shell → signed out, sign-in required, no auth in the URL → Landing
                Landing → "Try DiaBite" → existing SignIn (email link or code) → app, as today
Returning:      diabite.pro → session in storage → app (Landing is never rendered)
Email link:     diabite.pro/#access_token=… → Supabase reads the hash → signed in → app
                (the Landing is suppressed while an auth hash is present, so the link is never intercepted)
Session ended:  the app shows SignIn with "Your session ended" (a notice means: no Landing)
Moderated:      diabite.pro/?signin → SignIn directly, as today
Share preview:  a crawler reads the static <head> of index.html (title, description, image); it does not run the app
```

No engine, agent or data step is involved. The page makes no request except for its own files and the fonts the app already loads.

## 4. The promise check

The landing page shows numbers: a sample receipt (the three figures, three foods with grams, carbohydrate, GI and load) and, in the reviewers' section, the evaluation counts.

- **The receipt is static text copied from a real answer of the running engine, not generated and not computed in the browser.** It is labelled with what it is: "asked of the running service on 20 October, with a daily budget of 45 glycemic load". To keep it true, a new engine eval case asks the engine for the same sentence and budget and **fails if any figure on the landing receipt differs** (`src/data/landing.ts` holds the figures; `eval/run-engine.ts` reads them). A change to the food data that moves a number turns `npm run eval` red until the page is updated. The model is not involved.
- **The evaluation counts** ("204 of 204 behavioural checks on the live agent, 15 October") are dated claims from `docs/STATUS.md`, held in the same file with their date and shown with it; refreshing them is added to `docs/STATUS.md` as something to do whenever `npm run eval:agent` is rerun. They are not live numbers and the page does not pretend they are.
- A language model never produces a number on this page, and nothing here lets one.

## 5. Frontend

**Files.** New: `src/components/Landing.tsx`, `src/data/landing.ts` (the receipt, the dated counts, the copy that changes), `public/clip-how-it-works.mp4` (the web version, `moov` first), `public/clip-how-it-works.vtt` (captions), `public/clip-poster.jpg`, `public/share.png`. Changed: `src/App.tsx` (when to show Landing), `src/styles.css` (landing styles from tokens), `index.html` (meta tags, description), `docs/design.md` (a Landing section, in the same change).

**When it shows.** In `App.tsx`, before the existing sign-in branch: `signInRequired && auth.status === 'signedOut' && !notice && !authInUrl() && !skip && !entering`. `authInUrl()` is true when the URL carries `access_token`, `refresh_token` or `error_description` (hash) or `code` (query); `skip` is `?signin`; `entering` is state set by **Try DiaBite** and **Sign in**, which then shows `SignIn` with its existing `onCancel` ("Not now"), which returns to the landing page. While sign-in state is loading, the existing "Opening DiaBite…" stays. If sign-in is not required (local development) the landing page is not shown and the app opens as today.

**Content, top to bottom** (copy is written in the spec, in the product's voice: no emoji, no exclamation marks, no promises of results, `docs/design.md`):
1. The emergency line at the top, in the same words as the sign-in screen ("If you have symptoms such as chest pain, confusion, vomiting or fainting, call emergency services. DiaBite does not give insulin or medication doses."), above everything, as on sign-in.
2. Header: the logo and wordmark, and **Sign in** for returning people.
3. Hero: "Can I eat this?" and one sentence on what it does, for adults in the US with type 2 diabetes, prediabetes or insulin resistance; **Try DiaBite**; "Free to try. You sign in with your email; there is no password." (Nothing about pricing.)
4. The one-minute clip with captions, a poster, `preload="none"`, no autoplay, native controls, and a text transcript below it.
5. A real receipt: the three figures and the three foods (static, section 4).
6. The promise in three short lines: a model reads the sentence and never does the sums; a database and a calculator do; every number is checked against the calculation before you see it. And what it does when it does not know a food: it says so and never guesses.
7. What it is not: not medical advice, never gives a dose, no clinician has signed it off yet, the glycemic index is a published average and not a measurement of your body. (The existing safety wording, not softened.)
8. Who built it: "Built by Nadia Babich", a link to LinkedIn, and one line about living with insulin resistance and PCOS (the owner's words, with her permission of 20 October; no mention of medicines).
9. **For clinicians and reviewers**: a short paragraph on the structure (router, meal agent with tools, advisor with no tools), the dated check counts, and links to `docs/safety-case.md` and `docs/data-sources.md` in the public repository, with an invitation to write with a critique.
10. Footer: Try DiaBite again, what is kept about you (the existing privacy text), contact.

**States.** Loading: the existing "Opening DiaBite…". The clip fails to load: the poster and transcript remain and nothing breaks. JavaScript disabled: the app is a React shell and shows nothing, as today; the static `<head>` still gives the link preview.

**Phone layout.** One column, 16 px gutters, tap targets at least 44 px, the clip full width, the receipt as a card. Light and dark follow the existing themes (tokens only, `docs/design.md`).

**Accessibility.** One `h1`, headings in order, a `main` landmark, a skip link, the clip with a captions track and a transcript, the poster with a text alternative, buttons that are buttons and links that are links, visible focus, `prefers-reduced-motion` respected (no autoplay anyway). The signed-out landing is added to `eval/a11y.mjs` (axe, contrast, reflow, keyboard) and to `eval/a11y-tree.mjs`.

## 6. Engine and API

**No endpoint changes.** The engine already serves the built app and falls back to `index.html` for every non-API `GET` (`server/engine.ts`, the static block), and `express.static` answers `Range` requests, so the clip streams. The CSP stays as it is: `default-src 'self'` covers the video and captions (same origin), `img-src 'self' data:` covers the poster and share image, and no inline script is introduced (`script-src 'self'`). A "Copy address" button as in the draft `docs/diabite-trust-page.html` is **not** carried over: its inline script would be refused by the CSP, and a `mailto:` link does the job.

## 7. Agents

None. No prompt, tool specification, model or router behaviour changes, so `npm run eval:agent` does not have to be rerun for this change (CLAUDE.md rule 8 is about prompts).

## 8. Data

No tables, columns or migrations. Nothing is stored about a visitor: the landing page writes no cookie and no local-storage key (the existing theme key is read as today), and there is no analytics. What a visitor sends before signing in is the ordinary request for the page and its files, which the Container App's logs already record for the sign-in page today.

## 9. Safety and responsible AI

- **The emergency line and the "what it is not" block cannot be removed by a copy edit without a check failing:** the smoke check reads the landing text for the emergency line and the "not medical advice" statement (a check on static copy, not on the product's answers, so CLAUDE.md rule 7 is not engaged).
- **Forbidden copy.** The same check fails if the page contains an outcome promise or a compliance claim: "lower your", "reverse", "cure", "AI-powered", "clinically proven", "WCAG compliant", "HIPAA".
- A visitor who has not signed in cannot reach any engine tool; the landing page does not change who can. The dosing and red-flag rules still run before any model.
- **For a clinician to read:** the "what it is not" block and the sentence on the glycemic index. They are the existing wording; nothing new is claimed about health. The line about the owner's own condition is a personal fact, with her permission, and says nothing about treatment.
- The page never describes DiaBite as launched or finished ("being prepared for its first user sessions", the pitch rule).

## 10. Evaluation plan — written in the same change

| # | Check | Where | Expect |
|---|---|---|---|
| L1 | The sample sentence and budget, asked of the engine, give the figures on the landing receipt | `eval/run-engine.ts` (reads `src/data/landing.ts`) | equal; a mismatch fails `npm run eval` |
| L2 | A signed-out first load shows the landing page: the emergency line, **Try DiaBite**, no app content, none of the forbidden phrases | `eval/smoke.mjs` (M7 split into M7a and M7b) | all hold |
| L3 | **Try DiaBite** leads to the sign-in screen with "Email me a link" and the emergency line | `eval/smoke.mjs` M7b | holds |
| L4 | `/?signin` shows the sign-in screen at once | `eval/smoke.mjs` | holds |
| L5 | A URL with a stub `access_token` hash does not render the landing page | `eval/smoke.mjs` | holds |
| L6 | A signed-in load (the existing token injection) never renders the landing page | `eval/rehearsal.mjs`, `eval/a11y.mjs` | the existing runs pass unchanged |
| L7 | axe-core, contrast, 320 px reflow, 200% zoom and the keyboard path on the signed-out landing, light and dark, phone and laptop | `eval/a11y.mjs` (a new screen) | no violations |
| L8 | The accessibility tree of the landing: a named `main`, one `h1`, the clip with a captions track, no unnamed control | `eval/a11y-tree.mjs` (a new signed-out screen) | ok |
| L9 | The share tags are in the static HTML a crawler reads (`og:title`, `og:description`, `og:image`, `twitter:card`) and the image answers 200 | `eval/smoke.mjs` (fetch, no browser) | present |

Plus `npm run typecheck`, `npm run build`, `npm run eval`, `npm run eval:abuse`. **The real sign-in email cannot be tested by a machine**, so the owner follows one link from a real inbox after the deploy (section 11, step 4).

## 11. Rollout

1. Build on `main` in small commits: the copy and data file, the component and styles, the routing in `App.tsx`, the clip and captions, the meta tags, the checks.
2. `npm run typecheck`, `build`, `eval`, `eval:abuse`; run the app locally signed out and signed in; the a11y and a11y-tree passes against the local build.
3. `npm run deploy`, then ask the running service: fetch the page for its meta tags, run the smoke checks against `https://diabite.pro`, confirm the clip answers `206` to a `Range` request.
4. **The owner, once, on a real address in a private window:** open `https://diabite.pro`, see the landing page, press Try DiaBite, ask for the email, follow the **link** (not the code) and arrive signed in. It is the one step a script cannot do and the one the change could break.
5. Share the address as before. For a moderated session send `https://diabite.pro/?signin`.
6. **Rollback:** revert the routing commit and deploy (about five minutes); the previous image is still in the registry, so the active revision can also be pointed back at it. The change touches no data.

**Size.** The clip adds about 7 MB to the image and to the repository. The owner's loose end 1.9 is about videos already in git history; this adds one small video to the same problem, to be cleaned together later, and the file is committed as an ordinary blob, not through LFS. `preload="none"` means the 7 MB is fetched only when someone presses play.

## 12. Open questions — the owner's or a clinician's

1. **Captions.** They are made from the narration script (`scripts/demo-video/narration-clip.json`, five lines) with timings measured from the clip's audio. The owner or a native speaker should listen once and confirm that the words match what is said.
2. **The sentence about living with insulin resistance and PCOS** is public, permanent text. The proposed wording is in the spec for the owner to approve; it does not mention metformin or any medicine.
3. **The dated evaluation counts** go stale. The proposal is to show them with their date and refresh them whenever the agent evaluation is rerun; the alternative is to leave counts off the page and keep only the links.
4. **The share image** (`share.png`) is the receipt card as a picture. A plain card with the logo is the alternative; a design choice for the owner or the UX designer.
5. **Whether to wait for the UX designer's meeting next week.** The structure follows `docs/design.md` as it stands, and a designer may want a different hero. The risk of waiting is a week without a page; the risk of building now is some rework. The planner's view: build now, since the content and the checks carry over to any layout.

## Files that change

`src/components/Landing.tsx` (new) · `src/data/landing.ts` (new) · `src/App.tsx` · `src/styles.css` · `index.html` · `public/clip-how-it-works.mp4`, `clip-how-it-works.vtt`, `clip-poster.jpg`, `share.png` (new) · `docs/design.md` · `eval/run-engine.ts` · `eval/smoke.mjs` · `eval/a11y.mjs` · `eval/a11y-tree.mjs` · `docs/STATUS.md` · `docs/accessibility-pass.md`.

## Specs → implementation

| Spec | Files |
|---|---|
| Landing copy and data | `src/data/landing.ts`, `docs/specs/landing-copy.md` |
| Landing screen and styles | `src/components/Landing.tsx`, `src/styles.css`, `docs/design.md` |
| When it shows (routing, `?signin`, auth hash) | `src/App.tsx` |
| Clip, captions, poster, share image, meta tags | `public/`, `index.html` |
| Proof | `eval/run-engine.ts`, `eval/smoke.mjs`, `eval/a11y.mjs`, `eval/a11y-tree.mjs` |

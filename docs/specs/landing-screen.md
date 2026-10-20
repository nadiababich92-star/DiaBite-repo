# Landing page: the screen

*Spec for `docs/engineering/engineering-doc.md`, section 5. Read `docs/design.md` first; every value below is a token or a component from it, and a value it lacks is added there in the same change (and its dark counterpart). The copy is in `landing-copy.md`; when the page shows is in `landing-routing.md`.*

## 1. Files

- New: `src/components/Landing.tsx`.
- Changed: `src/styles.css` (a `/* landing */` block, after the sign-in styles), `docs/design.md` (a "Landing page" section under Components, see §6).
- Not changed: `SignIn.tsx` (it is reused as it is), `Logo.tsx` (it already carries the name, see the screen-reader pass of 20 October).

## 2. The component

```tsx
interface LandingProps {
  onEnter: () => void   // "Try DiaBite" and "Sign in": the parent shows <SignIn onCancel={...}>
}
export default function Landing({ onEnter }: LandingProps)
```

The component holds no state of its own except what a native `details` element holds. It reads `LANDING` from `src/data/landing.ts` and renders the sections S0 to S9 of `landing-copy.md` in that order. It makes no network request and writes nothing to storage.

### Structure (landmarks and headings)

```
<div className="app landing">
  <a className="skip" href="#landing-main">Skip to the page</a>          // visible on focus only
  <div className="landing-emergency" role="note">…S0…</div>            // first thing in the DOM after the skip link
  <header className="masthead"> <Logo/> <Wordmark/>                       // Wordmark renders the h1 "DiaBite" today
    <button className="link" onClick={onEnter}>Sign in</button>
  </header>
  <main id="landing-main">
    S2 hero, S3 clip, S4 receipt, S5 promise, S6 not, S7 built by, S8 reviewers
  </main>
  <footer> S9 </footer>
</div>
```

**One `h1`.** `Wordmark` already renders `<h1 className="wordmark" aria-label="DiaBite">`. The landing page's own headline "Can I eat this?" must therefore be an `h2` styled as the hero heading, **or** the wordmark on this screen is rendered as a non-heading (`<span className="wordmark">`). Decision for the builder: render the headline "Can I eat this?" as the page's `h1` and give `Wordmark` an `as` prop (`as="span"` here), so the page has exactly one `h1`, and the app screens keep theirs. Section titles are `h2`; the receipt's table has no heading of its own.

## 3. Styles (tokens only)

| Part | Rule |
|---|---|
| Page | The existing `.app` column (one column at every width, `docs/design.md` Layout); the page background is the existing gradient; no new colour. |
| Emergency block | Reuses `.signin-emergency`'s look (extract it into a shared rule rather than copy it). Visible without scrolling on a 375 px phone. |
| Hero | `h1`: `--serif`, 25 px verdict size (22 px on phones) at weight 600, `text-wrap: balance`; the lede 15.5 px / 1.55, `max-width: 60ch`, `--text-dim`; the eyebrow is the 13 px uppercase label style in `--text-faint`. |
| Buttons | The primary key for **Try DiaBite** (one per view above the fold; the footer repeats it). `Sign in` is the `link` button. 46 px tall, full width on phones. |
| Video | `width: 100%`, `aspect-ratio: 16 / 9`, `border-radius: var(--radius)`, 1 px `--border`, `background: var(--surface-2)` while loading. |
| Receipt | Reuse the existing answer slip and receipt classes if `AskPage` exposes them (extract to shared CSS, do not fork); otherwise the Receipt component spec in `docs/design.md`: mono 13 px, `tabular-nums`, dotted leaders in `--dot`, header row hidden below 560 px. The `Fits` pill is the existing green `fits` pill with its icon and word (colour is never the only signal). |
| Sections | A card (`--surface`, 1 px `--border`, `--radius`, 18 px padding) per section from S4; S5 to S8 are plain prose in a `max-width: 60ch` column with a `--border` hairline between them; no card inside a card. |
| Marker | The brand's one loud colour appears once: on "Bite" in the wordmark and on the `This meal` figure, as in the app. |
| Dark | Everything above follows the tokens, so Night works without new values; the receipt is checked in both. |

No animation. `prefers-reduced-motion` has nothing to turn off, and the video never autoplays.

## 4. States

| State | What the person sees |
|---|---|
| Normal | The page. |
| Clip not loaded or the browser cannot play H.264 | The poster stays; the `details` transcript carries the content; a one-line fallback inside the `video` element: `Your browser cannot play this clip. The transcript is below.` |
| Slow connection | The page is text and one small poster; the 7 MB clip is not fetched until play (`preload="none"`). |
| A narrow window (320 px) | One column, no horizontal scroll; the receipt shows each food above its three numbers (the existing phone layout). |
| Zoom 200% | No horizontal scroll; the skip link, buttons and transcript still reachable. |
| JavaScript off | Nothing renders (the app is a React shell); the static `<head>` still gives link previews. Stated, not fixed. |

## 5. Accessibility

- **Landmarks:** a `main`; the emergency block is a `note`; one `h1`; headings in order (h1, then h2s). The `skip` link is the first focusable element.
- **The clip:** native controls (the keyboard works), a `<track kind="captions" srclang="en" label="English" default>`, a transcript in `details`, a `poster` and `aria-label="One-minute recording of DiaBite"` on the `video`.
- **The receipt table:** a real `table` (or the `role="table"` markup of the draft with `columnheader` cells), a `caption` that is visually hidden: `Foods in the meal, with grams, available carbohydrate, glycemic index and load`.
- **Focus:** the existing visible focus ring on every control; **Try DiaBite** and **Sign in** are `button`s (they change the screen, they do not navigate); the three external links open in the same tab with `rel="noopener"` and say where they go in their text.
- **Contrast:** tokens only; checked in both themes by `eval/a11y.mjs` (L7).
- **Touch targets:** at least 44 px for every button and link in the header and footer.
- **No colour-only meaning:** `Fits` carries a word and an icon.

## 6. `docs/design.md`

Add under Components, in the same change:

> ### Landing page
> Shown to a signed-out visitor when sign-in is required. One column. The emergency line first, then the wordmark, then the hero (the question, one sentence, the primary key and "Free to try"), the one-minute clip, a real receipt (static, kept true by `npm run eval`), the promise, what it is not, who built it, and a short section for clinicians. One primary key above the fold, repeated once in the footer. No photo, no testimonial, no number that is not on the receipt or dated, no promise of a result.

## 7. Verify

- At 375 px and at a laptop width, light and dark: the emergency line is visible without scrolling; **Try DiaBite** is reachable without scrolling on a phone or one short scroll; the receipt reads as in the app.
- Tab from the top: skip link, Sign in, Try DiaBite, the video controls, the transcript summary, the receipt (not focusable), the links, the footer button; every stop shows a focus ring.
- With the screen-reader tree (`node eval/a11y-tree.mjs`, new signed-out landing screen, L8): a named `main`, exactly one `h1`, the `video` has a captions track, no unnamed control.
- `eval/a11y.mjs` (L7): no axe violation, no contrast failure, no horizontal scroll at 320 px and 200% zoom, light and dark.

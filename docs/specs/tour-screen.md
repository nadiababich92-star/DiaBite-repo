# Spec: the tip, the sheet and where they hang (frontend)

*From `docs/engineering/engineering-doc.md` section 5. Build after `tour-logic.md`. Apply `/design-system`: every colour, size and spacing comes from `docs/design.md`; **no new colour and no new size**.*

## State lives in the App

`AskPage` is unmounted when the person changes tab, so the seen-list cannot live there. In `src/App.tsx`:

```ts
const [tourSeen, setTourSeen] = useState<TourStep[]>(() => {
  const seen = initialSeen(loadTour(), { onboardedAtStart: loadProfile().onboarded, diaryAtStart: loadDiary().length })
  saveTour(seen)           // a returning person is recorded as seen from the first start
  return seen
})
const [howOpen, setHowOpen] = useState(false)
```

`AskPage` receives `tourSeen`, `onTourSeen={(s) => { setTourSeen(s); saveTour(s) }}` and `tourSuspended={feedbackOpen || waiting > 0 || howOpen}`. `ProfilePage` receives `onHowItWorks={() => setHowOpen(true)}`. `{howOpen && <HowItWorks onClose={() => setHowOpen(false)} />}` is rendered beside `FeedbackModal`.

## Anchors (`src/components/AskPage.tsx`)

Four existing elements get a `data-tour` attribute and nothing else changes about them:

| value | element |
|---|---|
| `input` | the text `<input>` in `form.ask-form` |
| `verdict` | the `div.eyebrow-line` inside `section.card.answer` |
| `calc` | the Show/Hide calculation `<button className="ghost">` |
| `log` | the `<button className="primary">` that calls `logIt` |

`AskPage` mounts `<Tour seen={tourSeen} onSeen={onTourSeen} ctx={{ hasReply: !!reply, hasReceipt: !!receipt, assumed: !!receipt?.assumed, busy, suspended: tourSuspended }} />` once, at the end of its fragment.

## The tip (`src/components/Tour.tsx`)

- `step = nextStep(seen, ctx)`; renders nothing when `null` or when its anchor (`document.querySelector('[data-tour="<step>"]')`) is not in the document, so a step never shows over nothing and is **not** marked seen until the person acts.
- **Buttons.** The step's button (`Next` / `Got it`) calls `onSeen(markSeen(seen, step))`; **Skip tips** calls `onSeen(allSteps())`. Escape, pressed anywhere while a tip is showing, is "Skip tips".
- **A ring on the anchor.** While a tip is shown, the anchor has the class `tour-ring` (added and removed with `classList`, removed in the effect's cleanup).
- **Position.** `position: fixed`. On widths above 560 px, below the anchor, left edge aligned to the anchor, width `min(340px, calc(100vw - 32px))`; if there is no room below, above it. On 560 px and under, pinned `left/right: 16px`, `bottom` above the tab bar plus the phone's safe-area inset (`calc(env(safe-area-inset-bottom, 0px) + <tab bar height> + 12px)`; read the bar's real height from `.tabs` with `getBoundingClientRect` rather than hard-coding it). It is re-measured on resize, on scroll and when the anchor appears (`ResizeObserver` plus `requestAnimationFrame`).
- **Scrolling.** Steps `verdict`, `calc`, `log` call `anchor.scrollIntoView({ block: 'center', behavior: 'smooth' })` when the anchor is out of view, with `behavior: 'auto'` under `prefers-reduced-motion`. Step `input` never scrolls.
- **Non-modal, and it never takes focus.** *A deliberate change from the plan's section 5, for the owner to see:* the plan said focus moves to the tip's button; a tip on the empty Ask screen would pull focus out of the box the person is about to type in, and one that appears with an answer would pull it off the button they just pressed. So: `role="region"`, `aria-label="Tip"`, `aria-live="polite"` (the title and body are read when it appears), no focus trap, no `inert` on the page, the tip's buttons are reachable by Tab in document order (the tip is the last element of the Ask panel), focus is never moved by it.
- **Targets and type.** Buttons at least 44 px high; body 14 px, title in the card-heading style (Literata 600, 17 px), buttons per the existing `button.primary` and `button.ghost` styles; sentence case, no exclamation marks, no emoji.

## Styles (`src/styles.css`)

```css
/* A tip: a card that points at the real screen. Tokens only. */
.tour-tip { position: fixed; z-index: 30; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--fx-raised); padding: 16px; display: flex; flex-direction: column; gap: 10px; width: min(340px, calc(100vw - 32px)); }
.tour-tip h2 { margin: 0; }              /* card-heading style from the existing h2 */
.tour-tip p { margin: 0; font-size: 14px; color: var(--text-dim); }
.tour-tip .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.tour-ring { outline: 3px solid var(--accent); outline-offset: 3px; border-radius: 12px; }
@media (max-width: 560px) { .tour-tip { left: 16px; right: 16px; width: auto; } }
```
`--radius` and `--fx-raised` are the existing tokens; if a name differs in `styles.css`, use the one the answer card uses. Nothing animates, so `prefers-reduced-motion` needs no rule.

## The sheet (`src/components/HowItWorks.tsx`)

A dialog with the same promises as `ImportPrompt` (read it and copy its pattern): focus goes in and Tab wraps, the page behind is `inert`, `body.modal-open`, Escape closes, focus returns to the button that opened it. It reuses `.modal-backdrop` and `.modal`. Content (exact):

- Heading: **How it works**
- **Ask.** Describe a meal in your own words. You get a verdict, the numbers behind it, and a receipt showing every food.
- **Diary.** What you logged, and your week.
- **Menu.** A week of meals and a shopping list. It has not been reviewed by a clinician yet.
- **You.** Your profile, your data, and deleting your account.
- Paragraph: Every number is computed by the engine from a food database, never written by the AI. Open Show calculation on any answer to see it.
- One button: **Close**.

No figures anywhere in it. In `ProfilePage`, the "Help" card gets a second button before "Send feedback": `<button className="ghost" onClick={onHowItWorks}>How it works</button>`.

## Documents

- `docs/design.md`: under components, one entry "Tip": what it is, where it sits, that it never takes focus and carries no figure; and one line under the Ask screen that a tip may point at the input and, after a first answer, at the verdict, the calculation and the log button.
- `docs/USER_SESSIONS.md`: the rewording in `tour-evals.md`.

## States

Empty (tip 1), answered (tips 2 to 4), skipped, storage unavailable (shown once per visit), anchor missing (waits), the feedback form or the import prompt open (nothing). Phone: one column at 375 px, the card never wider than the screen minus the 16 px gutter, and never over the input or the keyboard.

## Verifiable (the screen to look at)

`TOUR=1 npm run screens` (see `tour-evals.md`) at 390 and 1366 px, light and dark: tip 1 on the empty Ask screen, tips 2, 3 and 4 after an answer, the estimate variant after "a slice of grandma's cholent", and the sheet in You. Check that the ring is on the right element, that the phone card clears the tab bar, and that nothing scrolls sideways.

# Spec — Summary for my clinician: the screen, the Settings card, the print styles

*Stage 2, from `docs/engineering/engineering-doc.md` (approved 18 November 2026). The logic is `docs/specs/clinician-summary-logic.md`; the checks are `docs/specs/clinician-summary-evals.md`. Apply `/design-system` and read `docs/design.md` before writing any of it.*

**No migration, no endpoint, no agent change, nothing in `.env.example`.** Nothing is stored: no `localStorage` key, no request. The typed name and the chosen period live in component state and are gone when the page closes.

## Files

| File | Change |
|---|---|
| `src/components/ClinicianSummary.tsx` | **new**: the page |
| `src/components/SettingsPage.tsx` | one card, one prop `onClinicianSummary: () => void` |
| `src/App.tsx` | state `summaryOpen`; an early return that renders the page alone; the prop to `SettingsPage` |
| `src/styles.css` | `.summary*` styles, the `.no-print` class, one `@media print` block |
| `docs/design.md` | a "Clinician summary" entry and the print rules, **written before the CSS** |

## Settings card

In `SettingsPage`, **above Help and below the account block**, a `<section className="card">`:

- `<h2>For your clinician</h2>`
- `<p className="muted">` **DRAFT TO BE AGREED IN CHAT, not final copy:** "A printable page of your last days of eating, with your targets beside them, to show a dietitian or doctor. It uses only what is on this device or in your account, and nothing is sent anywhere."
- `<button className="ghost" onClick={onClinicianSummary}>Summary for my clinician</button>`

Shown to **everyone**, signed in or out, with or without entries. With nothing logged the page opens and says so (states, below); the button is not disabled.

## App wiring

`const [summaryOpen, setSummaryOpen] = useState(false)`. After the onboarding branch and before the main `return`, add:

```tsx
if (summaryOpen) return <ClinicianSummary diary={diary} profile={profile} targets={targets} onClose={() => setSummaryOpen(false)} />
```

The page is rendered **alone**: no masthead, banner, tabs or other sheet. That is what makes printing clean: the browser prints only the page. `onClose` returns to the Settings tab as it was (the `tab` state is not touched). The person's `diary`, `profile` and `targets` are the values App already holds; nothing is loaded.

## Component

```tsx
interface Props { diary: DiaryEntry[]; profile: Profile; targets: Targets; onClose: () => void }
```

- `today = useToday()`; `const [period, setPeriod] = useState<SummaryPeriod>(DEFAULT_PERIOD)`; `const [name, setName] = useState('')`.
- `const s = useMemo(() => buildSummary(diary, profile, targets, today, period), [...])`.
- On mount set `document.title = \`DiaBite summary ${s.from} to ${s.to}\`` and restore the previous title on unmount, so a saved PDF has a useful file name. **The typed name is never put in the title.**
- Focus moves to the page heading on open (`tabIndex={-1}`) and back to the Settings button on close (App keeps the ref, as the other sheets do). Esc calls `onClose`.
- Print: `<button className="primary" onClick={() => window.print()} disabled={s.loggedDays === 0}>Print or save as PDF</button>`.

### On screen (class `no-print`): a bar at the top

`position: sticky; top: 0`, one row, wraps on a phone:
- `<div role="group" aria-label="Period">` three buttons "7 days", "14 days", "28 days", `aria-pressed`, the same component look as the theme options in Settings;
- `<label>` "Name (optional, printed, not saved)" + `<input type="text" maxLength={80} autoComplete="off">`;
- Print button; `<button className="ghost">Close</button>`.

### The page: `<article className="summary" aria-labelledby="sum-title">`

Order and exact fixed copy (anything in angle brackets comes from `buildSummary`; no other text is generated):

1. `<h1 id="sum-title">DiaBite summary</h1>` and a line: `<from-label> to <to-label>, <periodDays> days. Printed <to-label>.` (labels like "Nov 11" and "Nov 17, 2026").
2. **Name line:** `Name: ` then the typed name; when empty, `Name: ____________________` (a drawn line, `border-bottom`) so it can be filled with a pen. Rendered as text.
3. **About this person** (`<h2>`), one paragraph: `<condition>. <insulin>. ` then `Medicines: <a, b>` or `No glucose-lowering medicine listed.` Nothing else from the profile.
4. **Targets** (`<h2>`), caption "Targets as of <printedOn>". A `<table>` with rows: Energy `<kcal> kcal`, Carbohydrate `<carbsG> g`, Fibre `<fiberG> g`, Protein `<proteinG> g`, Fat `<fatG> g`, Glycemic load `<glBudget>`; and a third column "Set by": `calculated by DiaBite` for every row except Carbohydrate when `carbsSetBy === 'person'`, which says `set by you and your doctor or dietitian`. Under the table, if present: `Your own numbers: <mealCarbsG> g carbohydrate a meal` and/or `<snackCarbsG> g a snack, from your doctor or dietitian.` These are printed as typed. **Do not print `targets.constraints` or any reason sentence.**
5. **The days** (`<h2>`), a `<table>` with `<caption>` "Totals for each logged day. Carbohydrate is total carbohydrate; fibre is shown beside it." Columns: Day, Energy (kcal), Carbs (total, g), Fibre (g), Protein (g), Fat (g), Glycemic load, Notes. Header row has `scope="col"`; the first cell of each row is `scope="row"`.
   - Cells with a verdict print the number and, beside it in the same cell, the word: `142 · over` or `118 · not over` for Energy and Carbs; for Glycemic load `31.2 · over`, `24 · not over`, or `24 · not complete`. The word is text, never colour alone; the word `over` is also bold. **Protein, Fibre and Fat have no word.**
   - A target row repeats above the days as the first body row labelled "Target": `<kcal>`, `<carbsG>`, `<fiberG>`, `<proteinG>`, `<fatG>`, `<glBudget>`.
   - **Notes cell**, in this order, joined with "; ": `today, so far` (when `isToday`); `estimate` (when `estimate`); `<n> food(s) with no glycemic load, not counted` (when `noLoadFoods > 0`; `1 food has` / `n foods have` as the Diary's `noLoadNote` says); `fewer than 3 meals (<slots> of 4)` (when `slots < 3`). Empty cell prints nothing.
   - Between rows, a run in `notLogged` is one line spanning the table: `<from-label> to <to-label>: not logged` (a single day: `<label>: not logged`), placed by date among the logged days (newest first). **No row of zeros is ever printed.**
   - After the last day a row "Average of <loggedDays> logged day(s)" with the averages, no words, no notes; omitted when `loggedDays === 0`.
6. **Meals** (`<h2>`), per day newest first, an `<h3>` with the day label, then each meal slot as a small heading ("Breakfast") and a list of items: `<name> · <portion> · <carbs> g carbs · GL <gl or —>` and ` · estimate` when the item is one. `GL —` stands for "no glycemic load in our data". Planned meals do not appear.
7. **How to read this** (`<h2>`), a paragraph. **DRAFT TO BE AGREED IN CHAT, not final copy:** "The numbers come from DiaBite's food data and were added up by the app; no one at DiaBite typed them, and none were generated by a language model. Carbohydrate is total carbohydrate. Glycemic load is missing for some foods, such as packaged products; a day that includes one says so and is not called 'not over'. 'Estimate' means a dish was counted from an assumed recipe. Targets are DiaBite's calculation unless marked as set by you and your doctor. DiaBite does not give medical advice and does not dose or adjust insulin." The sentence about a medical device is **not** included: that is the FDA position (worklist №57) and stays the owner's until counsel confirms.
8. Footer, once at the end of the document: `DiaBite · diabite.pro · printed <to-label>`. A `position: fixed` footer was tried and printed over the last table row on a Letter page (18 November 2026), so it is in the flow; "Page n of m" comes from an `@page` margin box where the browser supports it.

### States

| State | When | What the page shows |
|---|---|---|
| empty | `loggedDays === 0` | after the title: "Nothing logged in the last <N> days. Log what you eat and come back." No tables. Print disabled. The period buttons still work |
| thin | `loggedDays < 3` | printable; first line under the title: "Only <loggedDays> of <periodDays> days were logged." |
| partial | any `noLoadFoods > 0`, `estimate`, `slots < 3` | as the Notes cell above; never hidden |
| error | cannot happen from data (every entry goes through `viewEntry`; unreadable rows were dropped on load) | a throw reaches the existing `ErrorBoundary`; no half page |
| loading | none | synchronous |

## Design system

- Tokens from `docs/design.md` only. **The page is a document**: on screen it takes the **Paper** look in both appearances. Do this by adding `.summary` to both `:is(...)` slip lists at the top of `src/styles.css` (the `.card, .answer, .day, … .modal` selector, lines 65 and 116 at the time of writing), so its tokens are Paper's without a second rule set. Check it in Tape and Paper.
- Numbers use the monospaced tabular face (`.num`); the serif is not used (it is for the product speaking, and this page is a record).
- A table is a real `<table>`; on a phone (375 px) the days table sits in a wrapper with `overflow-x: auto` and keeps its type size; touch targets in the bar are at least 44 px; focus ring 2 px `--accent` on every control; WCAG AA in both looks.
- No ring, streak, score, praise or colour grade. The word "over" is bold and carries the meaning; a black-and-white printer loses nothing.
- `docs/design.md` gets, before the CSS, an entry **"Clinician summary"** covering: the Paper-in-both-looks rule, the verdict-as-a-word rule, the table, and the print block below. If a print value is missing from the tokens, it is added there first with its dark counterpart.

## Print (`@media print`)

```css
@page { size: auto; margin: 16mm; }
@media print {
  html, body { background: #fff !important; }
  .no-print { display: none !important; }
  .summary { box-shadow: none; border: 0; padding: 0; color: #000; }
  .summary table { break-inside: auto; }
  .summary tr, .summary h2, .summary h3 { break-inside: avoid; }
  .summary h2, .summary h3 { break-after: avoid; }
  .summary-footer { margin: 16px 0 0; }
}
```
(Values are a starting point; colours come from the tokens, with `#000` and `#fff` only if the token set has no print-safe pair, in which case add them to `docs/design.md` first.) Header row repeats on each page (`thead { display: table-header-group }`).

## Verifiable

- Engine checks and smoke: `docs/specs/clinician-summary-evals.md`.
- **Look at it, and put screenshots in the report:** the page at 375 px and desktop width, in Tape and in Paper; the browser's print preview at **A4 and Letter** in Chrome and Safari for a 7-day and a 28-day diary; a diary with a packaged food (the "not complete" day), an estimate, a one-meal day and a gap of two days; an empty diary; a very long food name; the name field with `<img src=x onerror=alert(1)>`.
- Read the console: no error. Confirm the printed page contains no email, age, weight, kidney, pregnancy, allergen or comorbidity text (search the print preview text for the fixture's values).

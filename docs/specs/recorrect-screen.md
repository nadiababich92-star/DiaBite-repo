# Spec — Correct an assumed weight: what the screen does

*Stage 2, from `docs/engineering/engineering-doc.md` (approved 19 November 2026). Decided by the owner: the tap opens a number field and a unit; the weights list on the recalculated card is built from the engine's data and the corrected weight leaves it; the mark is the word **your weight**. Companion specs: `recorrect-engine.md` (what the engine accepts and returns), `recorrect-evals.md`. Read `docs/design.md` (and apply `/design-system`) before any UI code: **no new colour, size or font.***

**No migration, nothing in `.env.example`, nothing stored, no prompt change.**

## Files

| File | Change |
|---|---|
| `docs/design.md` | one paragraph under "Portions" (section 7), written **before** the CSS |
| `src/lib/agent.ts` | `ReceiptLine.quantity`, `ReceiptLine.units`; `buildReceipt` copies them; `recomputeMeal` sends `quantity` and `theirs` |
| `src/components/AskPage.tsx` | `PortionEditor` (the value is a button, the field), `RecalcCard` (the weights list), `ReceiptView` (the pill), the recalc state and effect |
| `src/lib/measure.ts` | unit labels for the select (`unitLabel`), nothing that converts |
| `src/styles.css` | classes that only compose existing tokens (section 6) |
| `src/components/DiaryPage.tsx`, `src/lib/diary.ts` | **not touched**: `logIt` already copies `said` and `basis` into the snapshot |

## 1. Data the screen keeps

`src/lib/agent.ts`:

```ts
export interface ReceiptLine { /* existing */
  /** What the engine echoed for this line: sent again, unchanged, when the person did not touch it. */
  quantity?: { count: number; unit: string }
  /** The household units this food can be said in beyond weights (engine's `units`). */
  units?: string[]
}
```

`buildReceipt` copies `it.quantity` and `it.units` (the same place it copies `said` and `basis`).

`AskPage` state, replacing nothing, adding:

```ts
// What the person typed on a line, by line index: the quantity they gave. A line moved with the stepper is in `grams` as before.
const [typed, setTyped] = useState<Record<number, { count: number; unit: string }>>({})
// The lines the person changed on this card, by index: they are theirs (stepper or field). Drives `theirs` and the pill.
const [mine, setMine] = useState<number[]>([])
const [editing, setEditing] = useState<number | null>(null)   // which line has its field open (the existing `editing` state is the portion editor's open flag: name this `fieldFor`)
```

**What is sent** (`recomputeMeal` items, built in the recalc effect), per line `i`:

| Line | Item sent |
|---|---|
| typed in the field | `{ foodId, quantity: typed[i], theirs: true }` |
| moved with the stepper | `{ foodId, grams: v, theirs: true }` (or `servings: v` with **no** `theirs` for a recipe counted by serving) |
| not touched, has a `quantity` | `{ foodId, quantity: line.quantity }` (**no** `theirs`): it comes back with its original `basis` |
| not touched, no `quantity` (a line from an old reply or the Menu) | `{ foodId, grams: line.grams }` or `{ foodId, servings }` as today |

**The browser never converts a unit and never computes grams**: `typed` holds what the person typed; the engine's `grams` come back in the receipt.

`mine` is the set of line indexes the person changed on this card. It resets when a new answer arrives, on "Back to the original", and when a swap is accepted (the same places `grams`, `removed` and `swap` reset).

## 2. The control (`PortionEditor`)

The row today: name, then `[−] value [+]` with the value `.step-v` ("1 medium · 200 g"). New:

- **Idle.** `.step-v` is a `<button className="step-v weight-btn">` showing the same text, with `aria-label="Change the weight of {name}, now {said or portion}"` (for example "Change the weight of Apple, now 1 medium, 200 grams"). Tapping it, or Enter or Space on it, opens the field. The − and + buttons stay and still step.
- **Editing.** The button is replaced in place by one `<form className="weight-edit">` with, on one row: a number field, a unit select, **Done** (`button.primary`) and **Cancel** (`button.link`). Focus moves to the field with its content selected. **Enter** commits (the form submit), **Esc** cancels, and focus returns to the line's value button in both cases.
  - Field: `<input type="text" inputMode="decimal" autoComplete="off">` inside a `label.field` whose visible label is "Weight of {name}" (the existing `label.field` pattern); the pattern accepts digits and one `.` or `,` (a comma is read as a decimal point); **empty or not a number: Done is disabled**. The browser checks nothing else; the engine's bounds (`quantityError`) answer for it.
  - Select (`aria-label="Unit"`): the options, in this order, with a visible default selected:
    1. `g` (always);
    2. `oz`, **only when `units === 'imperial'`**;
    3. the food's household units from `line.units`, **only when imperial**, at most two, the unit the line is shown in first (`cup`, `tbsp`, `tsp`, `fl oz`, `slice`, `piece`, `small`, `medium`, `large`, `whole`; `whole` is labelled "whole"). A metric session offers `g` only.
    The **default** is the line's current unit: its `quantity.unit` when it has one and it is offered, else `oz` for imperial, else `g`. The field starts with the line's current count in that unit when the unit is the line's own (`1` for "1 medium"), else empty.
  - A **recipe counted by serving** (`l.servings`) keeps the stepper and has **no field** in this change (the engine does not accept `theirs` with servings).
  - An **ingredient of an assumed recipe** (`assumed` set) gets the same field with **grams only** (no select): the dish's ingredients have no household unit; the card stays **Estimate**.
- **Commit.** `setTyped(t => ({ ...t, [i]: { count, unit } }))`, `setMine(m => m.includes(i) ? m : [...m, i])`, close the field, `setLogged(false)`; the existing 0.4 s settle then calls `recomputeMeal`. One request per commit, never per keystroke.
- **The error line.** When the engine answers `400` with `field: 'items.quantity'` and `why`, `recomputeMeal` throws a `QuantityRefused` (new class with `foodId`, `why`, `units`). The recalc effect catches it, **removes that line's `typed` and `mine` entry**, reopens that line's field with the text still in it, and shows under the field, in the existing `.muted` error style, exactly:
  - `No USDA measure for {name} in {unit}. Try grams or ounces.` (imperial)
  - `No USDA measure for {name} in {unit}. Try grams.` (metric)
  The card keeps the last numbers; nothing is recounted. Other errors keep their existing messages (rate limit, signed out, "Couldn't count that again. Your original answer is unchanged.").

## 3. The mark

`ReceiptView` and the portion rows show, after the weight:

| Line | After the weight |
|---|---|
| index in `mine` and `basis === 'stated'` | the pill **your weight** (`<span className="pill none mine">your weight</span>`) |
| `basis === 'typical'` | the pill **typical size** (unchanged) |
| anything else | nothing |

A line the person typed in their first message in grams (`basis: stated` from the engine) is **not** marked: `mine` says whose change it is on this card. Text, not colour alone (`docs/design.md` rule 3).

## 4. The weights list (`RecalcCard`)

The agent's own sentence stays in the folded original answer, untouched. The recalculated card gains one line, **built here from the engine's data, never from the agent's text**:

```
Weights I used: apple 1 medium (200 g), banana 1 banana (126 g).
```

- The entries are the receipt lines whose `basis` is set and is **not** `stated`, in line order, each as `{lowercased food head} {said}` (food head = the name up to the first comma or parenthesis, as the engine's `foodWord`; `said` as returned). Each entry is a `button.link weight-btn` that opens that line's field in `PortionEditor` (scrolls it into view, focus in the field).
- **No entries: the line is not rendered** (every weight on the card is the person's).
- A line without `basis` (an old reply, a bare-grams line) is **not listed**: nothing is claimed about a weight the engine did not name.
- A branded or unrated line is listed like any other; its verdict logic is the engine's and unchanged.
- The line sits in the card's `.a-why` position, after the figures. Its words are plain text and buttons: no new component beyond the buttons.

## 5. States

| State | What the person sees |
|---|---|
| idle | each weight is a button; − and + as before |
| editing | the field, the select, Done, Cancel; Esc and Enter as in section 2 |
| recounting | the existing busy state; the card keeps the last numbers; the field is closed |
| the engine cannot weigh that unit | the error line of section 2 under the reopened field; nothing recounted |
| rate limited, signed out, network | the existing messages |
| partial meal / branded / unrated | editable like any line; the verdict and "not counted" and "not scored" lines are the engine's |
| assumed recipe | grams only; tone **Estimate**; the ingredient gets **your weight** |
| everything corrected | no weights line; the pills say **your weight** |

## 6. Look: only existing tokens

New classes, each only a composition of values already in `docs/design.md` and `src/styles.css`:

- `.weight-btn`: the value as a button: `background: none; border: 0; font: inherit` of `.step-v`, an underline from the existing `button.link` rule, `min-height: 44px` (the existing mobile rule), the existing focus ring (`:focus-visible`), no new colour.
- `.weight-edit`: `display: flex; flex-wrap: wrap; align-items: end; gap: 8px`; the field and the select use the existing input and `label.field` styles; **Done** is `button.primary`, **Cancel** `button.link`. On a 375 px screen it **wraps**: the field and the select on one row when they fit, the buttons below.
- `.pill.none.mine`: the same markup and tokens as `.pill.none.typical` (`--text-dim` on the pill surface), `white-space: nowrap` like `.pill.assumed, .pill.typical`.
- Both colour schemes (Tape, Paper) inherit; nothing is hardcoded. Targets are at least 44 px. `prefers-reduced-motion` is respected (no motion is added).

## 7. `docs/design.md`, "Portions" (add, before the CSS)

> The weight on a portion row is a button. Tapping it opens a number field and a unit (grams; on US units also ounces and the food's own measure, such as cup or medium); Enter or **Done** has the engine count the meal again, Esc or **Cancel** leaves it. A weight the person changed is theirs: the line says **your weight** (the pill style of **typical size**), and it leaves the card's line "Weights I used", which lists, from the engine's data and never the agent's sentence, the weights still assumed, each one tappable. When none is left the line is not shown. The browser converts no unit and computes no number.

## 8. Accessibility and phone

The value button names the food and the current weight; the field has a visible label and `autoComplete="off"`; Enter and Esc work; focus returns to the value button; the recount is announced by the existing `aria-live` region on the card; the focus ring is the existing one. At **375 px** nothing is wider than the existing stepper row: the form wraps; every control is at least 44 px.

## Verifiable

`recorrect-evals.md`: the static render S1 to S7 (the editor's markup, the pill, the weights list), the rehearsal check (throwaway account: ask "a medium apple", tap, type 120, check the card, Log it, read the Diary), and by eye on the live app at 375 px and at desktop width in Tape and in Paper.

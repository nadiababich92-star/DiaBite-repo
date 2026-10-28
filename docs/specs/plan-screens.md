# Spec: the Day picker, planned rows and the screens that use them

*From `docs/engineering/engineering-doc.md`, sections 3 and 5. Read `plan-data-and-rules.md` first; apply `/design-system` (`docs/design.md`): no new colour,
no streaks, no praise, status is a word and not only a colour, targets 44 px, AA in light and dark. If a style is missing, add it to `docs/design.md` and the dark theme first.*

## Files

`src/components/DayPicker.tsx` (new), `src/components/AskPage.tsx`, `src/components/MenuPage.tsx`, `src/components/DiaryPage.tsx`, `src/styles.css`, `docs/design.md`
(entries "Day picker" and "Planned row"), `docs/USER_SESSIONS.md` (task), `src/components/Onboarding.tsx` (the consent bullet, see `monitor-feedback-nudge.md`).

## `DayPicker`

```ts
interface Props { value: string; today: string; onChange: (date: string) => void; label?: string /* default "Day" */ }
```

A fieldset-free group: a visible label **Day**; three chips **Today**, **Yesterday**, **Tomorrow** (`aria-pressed` on the one equal to `value`); a fourth control
**Pick a date**, a native `<input type="date">` with `min`/`max` from `dateRange(today)` and a visible `<label>`. When `value` is a day that is none of the three chips, the
date input shows it and carries the pressed style. A typed date outside the range is passed through `clampDate`; if it moved, a polite live line says
**You can go back 14 days.** or **You can plan 14 days ahead.** (one line, under the group, plain text, removed on the next change). Chips wrap on a phone;
every control is at least 44 px; the focus ring is the existing one; `onChange` never moves focus. The chips are `type="button"`.

Pure helper, tested: `pickerState(value, today)` returns `{ chip: 'today'|'yesterday'|'tomorrow'|'date'; planned: boolean }`, with `planned = value > today`.

## Ask: "Log it" on any day

In the answer's action row, **before** the button, a `DayPicker` (collapsed to the chips and the date control, no extra card), default `today`, reset to today after each answer.
The primary button reads **Log it** when `value <= today` and **Plan it** when `value > today`; for an estimate it keeps the existing wording ("Log what was counted" applies to partial meals).
`logIt()` writes the entries with `date: value` and `planned: value > today`. After logging:

- today: unchanged ("Logged", the budget bar moves);
- another past day: the notice "Logged for Yesterday." (or the weekday and date) with the existing undo; the budget bar does not move;
- a future day: "Planned for Fri, Oct 23. It counts once you mark it eaten." with an **Open Diary** link; the budget bar does not move.

The `meal` is the answer's meal as today. The verdict tip (first-run tour) is not affected; the `data-tour="log"` anchor stays on the button. A planned entry never changes "left today".

## Diary: forward, planned rows

- The day navigation: the "›" button is no longer disabled on today; it moves up to `today + 14` and is disabled there. "‹" moves back with no limit (reading). "Back to today" shows whenever the viewed day is not today.
- The heading names a future day as `dayLabel` does ("Tomorrow" is added to `dayLabel`: `Tomorrow` for `today + 1`).
- A day's list shows eaten entries as now, then planned entries below them under the quiet subheading **Planned**.
- **A planned row** is dimmed (the existing muted text token, not a new colour), carries the pill **planned** (a past day: **planned, not eaten**), its name and portion as every row, and
  two buttons: **Ate it** and **✕** (remove; `aria-label="Remove <name>"`). **Ate it** is shown only when the day is today or earlier (a plan for the future is not eaten yet; on a future day only ✕ shows).
  Pressing **Ate it** replaces the entry with `markEaten(e)` and announces "Marked eaten." through the existing notice, with undo.
- A day with at least one planned entry shows one quiet line under the totals: **Planned: GL 14, not counted yet.** (the sum of `viewEntry(e).gl` of the planned entries, rounded as the day's total is; if any planned entry has `loadAvailable === false`, **Planned: GL 14 and carbohydrate only for some, not counted yet.**).
- The day's totals, the budget bar and "left" of a viewed day read `eaten(...)` only. A future day with only planned entries shows the empty state "Nothing eaten for this day yet." and the planned list.
- The week strip and the four-week strip are unchanged in layout; they ignore planned entries (data rule).
- **Add food** (28 Oct: the card no longer has its own food search, which saw only the 86 seed foods) holds the Meal select, the repeat and copy chips, and one button, **Add food** (**Plan food** on a future day). The button takes the person to Ask with that day and meal (`logTarget`): Ask says "Adding to dinner, Tomorrow" with a Cancel, "Log it" goes to that day and meal, and the target ends when the person leaves Ask. On a day older than 14 days the button is disabled with **You can go back 14 days.** (`plan-data-and-rules.md`).

## Menu: "Plan it…" and "I ate this"

On each meal card the single "Add to today" becomes two controls:
**I ate this** (adds to today as an eaten entry, exactly as `addToToday` does now, with the same "Added to today's lunch. See today" state and undo) and **Plan it…**, which opens an inline
`DayPicker` under the card (default `Tomorrow`, range from `today` forward only: `min = today`), with a **Plan it** confirm button and **Cancel**. Confirming adds the entries with
`date` the chosen day, `planned: value > today` (choosing today creates a planned entry, not an eaten one: "I ate this" is the way to log it as eaten), and shows
"Planned for Fri, Oct 23. See the Diary." with undo. Both buttons keep the meal's weights (`m.scale`) exactly as now. The existing "not reviewed by a clinician" line stays where it is.
`aria-label`s: `I ate <dish name>` and `Plan <dish name> for another day`. Focus returns to the **Plan it…** button when the inline picker closes.

## Sessions

`docs/USER_SESSIONS.md`: the protocol gains, after step 2, the task **"Log what you ate yesterday."** and an observer note: *watch whether they find the day control on the answer without help.*
The consent card line is in `monitor-feedback-nudge.md`: "What you log in your diary, and the meals you plan."

## Verifiable

The screens at 390 and 1366 px, light and dark (`npm run screens`): the Ask answer with the picker open on Yesterday and on a future date (button "Plan it"), the Diary on a future day with a
planned row and the planned line, a past day with "planned, not eaten", the Menu card with the inline picker, and a state where the date input holds an out-of-range value with the note. Rehearsal `W17` (`plan-evals.md`).
Keyboard: every control reachable, the chips toggled with Space/Enter, focus visible. Read `aria-pressed`, `disabled` and the `aria-label`s, not the prose.

# Spec: the week card and the four-week strip (frontend)

*From `docs/engineering/engineering-doc.md` section 5. Build after `week-history-logic.md`. Apply
`/design-system`: every colour, size and spacing comes from `docs/design.md`; **no new colour and no new
size**. The Diary tab and the card "The last seven days" already exist; this changes that card only.*

## The card, top to bottom

| Element | Spec |
|---|---|
| Heading | `The last seven days` (unchanged) |
| Summary line | See copy below; sentence-case, `--text`, the existing `.muted` is **not** used for the count |
| Seven day rows | Existing `.week` list; text and bar per the table below |
| Divider | The existing dashed hairline (`--border`) |
| Sub-heading | `Four weeks` as `h3` in the card's small-label style (13 px, uppercase, 0.08em tracking, 600, `--text-faint`; the "Label / eyebrow" style in `docs/design.md`) |
| Strip | Four rows, newest first, copy below |

### Summary line (exact copy)

- Nothing logged in the seven days (`loggedDays === 0`): `Log what you eat and the week fills in here.`
- Otherwise: `<strong>{n} of 7 days in range</strong> this week.` where `n = inRangeDays`; then, only if either
  count is above zero, a second sentence built from the parts that apply, joined with `; ` and ended with a
  full stop:
  - `{thinDays} day was logged with fewer than 3 meals` / `{thinDays} days were logged with fewer than 3 meals`
  - `{carbsOnlyDays} has carbs only` / `{carbsOnlyDays} have carbs only`

  Example: `4 of 7 days in range this week. 2 days were logged with fewer than 3 meals; 1 has carbs only.`

No praise, no "on track", no percentage, no streak (design rule 6). Zero is written `0 of 7`, plainly.

### Day rows (by `status`)

| status | row class | bar | right-hand text |
|---|---|---|---|
| `none` | `none` | empty | `not logged` |
| `in_range` | `ok` | `--low` | `{used} of {budget}` |
| `over` | `over` | `--high` | `{used} of {budget}` |
| `thin` | `thin` | `--text-faint` | `{used} of {budget}` + `<em> · {slots} meal{s}</em>` |
| `carbs_only` | `carbs` | `--text-faint` | `{used} of {budget}` + `<em> · carbs only</em>` |

Where `d.estimate`, append `<em> · estimate</em>` after the other words. A `thin` or `carbs_only` bar
has the same width rule as today (`min(100, used / budget · 100)%`). Colour keeps its meaning: green only
for `in_range`, red only for `over`; the other two are neutral **and carry words**, so colour is never the only
signal (design rule 3). The right-hand column widens from 118 px to `minmax(118px, auto)`; at 375 px the text
may wrap to a second line, never overflow.

### The four-week strip (exact copy)

Rows, newest first, one per `WeekBlock`, a list `<ol className="weeks">`:

| ago | label |
|---|---|
| 0 | `This week` |
| 1 | `Last week` |
| 2 | `2 weeks ago` |
| 3 | `3 weeks ago` |

Each row: `[label] [seven marks] [text]`, text = `{inRangeDays} of 7` or, when `loggedDays === 0`, `not logged`.
Marks, oldest day first (left to right), 12 px circles, 4 px gap, `aria-hidden`:

| day | mark |
|---|---|
| `inRange` | filled `--low` |
| logged, not in range (`over`, `thin`, `carbs_only`) | 1 px `--text-faint` outline, no fill |
| `none` | 1 px dotted `--border` outline |

The row's own `aria-label`: `{label}: {n} of 7 days in range` (or `{label}: nothing logged`). The strip is
not interactive: no focus stop, no tap target.

## Code changes

- `src/components/DiaryPage.tsx`: `const weeks = useMemo(() => weeksSummary(diary, targets.glBudget, today), [...])`;
  `week = weeks[0]`; replace the summary paragraph, the row `className` (`ok|over|thin|carbs|none`) and the
  right-hand text as above; add the strip below the list.
- `src/styles.css`: next to `.week` (line ~649): `.week li.thin .wk-bar i, .week li.carbs .wk-bar i { background: var(--text-faint); }`,
  the `.week-sum`, `.weeks`, `.wks-mark` rules (sizes above), and `.week li` grid column 3 as `minmax(118px, auto)`.
  Dark mode needs nothing: every value is an existing token with a dark counterpart.
- `docs/design.md`: one line under "The day, on the Diary": the week card has a summary line and a four-week
  strip, with the mark meanings above.

## States

Empty (nothing in 28 days): the summary sentence only, the strip rows all read `not logged`. Loading and
error: none (the diary is local and synchronous). Partial and estimate: shown in words per day. Phone: one
column at 375 px, text never below 13 px, nothing wider than the card.

## Verifiable (the screen to look at)

`npm run screens` with `SEED=full|thin|empty` (see `week-history-evals.md`), Diary tab, at 390 and 1366 px, in
light and dark: the line reads the right count; a thin day and a carbs-only day show their words and a
neutral bar; the strip's marks match the rows' numbers; no horizontal scroll.

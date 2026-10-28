# DiaBite Design System

The visual contract for the app. Every colour, size and spacing value below is
taken from `src/styles.css` as it stands; when the two disagree, fix whichever
is wrong, but never let a new screen invent a third value.

The direction was settled in the design canvas (`docs/design/`) and it is called
**the receipt**. On 10 October 2026 it was given an identity and two themes
(canvas: https://claude.ai/artifact/UyJycxASk9mmrdEhZCVegK): a receipt with a bite
out of its corner, a marker on the one number that answers the question, and two
looks the user chooses between, **Tape** (a dark page with cream slips, the default, from 20 October 2026) and **Paper** (light). The concept canvas for the app is https://claude.ai/artifact/56Sb7XQg8kA2EN4krZ76ub.

---

## Product design philosophy

DiaBite is a reference tool for someone about to eat, usually standing up, often
on a phone. The design has one job: **make the answer legible before it makes
the product impressive.**

1. **Verdict first, in a human voice.** The sentence a person reads is the
   largest thing on the screen. *"This fits your day."* — never a label.
2. **Then the number, then the reason.** Three figures, one of which is the
   answer to the question. The reason is supporting text, not the headline.
3. **The arithmetic is on demand, never hidden.** "Show calculation" opens the
   receipt: every food, portion, glycemic index and load, and where each number
   came from. A product that hides its working is asking for trust.
4. **No rings, streaks, scores or badges for effort.** A ring is a score to
   close; people with a chronic condition are not playing a game. The day is a
   thin bar, not a goal.
5. **Calm, not clinical, not cute.** Deep green, warm off-white, one serif for
   the voice. No stock photography, no mascots, no red unless something is
   genuinely over or refused.
6. **Say what is unknown.** A missing food, an unverified source and a partial
   total are shown as plainly as a result. Absence is a feature here.

---

## Color system

### Architecture
Raw hex values live only in `:root`. Components reference **named tokens**.
There is a full dark set; both are defined together and must stay in step.

### Tokens

Two looks, defined together, and they must stay in step. **Tape** is the default: the page is dark, and
everything the product prints (a card, an answer, a dialog, the question box, the "Try one" chips) is a cream
**slip**. **Paper** is the light look. `src/lib/theme.ts` sets `data-theme` to `tape` or `paper` on `<html>`; the
user chooses Tape, Paper or Follow my phone (Paper by day, Tape after dark) in **You**. The old name for the dark
look, Night, is Tape: a stored "night" choice is read as Tape.

How the slips are made: the table's **Night** column below is the Tape *page* (background, bars, chips, text on the
page). A slip redefines the tokens for everything inside it to the **Paper** column, so its text, fields, pills and
keys are Paper's without a second set of rules (`src/styles.css`, the scope near the top). The keys on the page itself
are the marker colour: `--primary-1/2` are `#dcf26b` / `#cde85a` with ink `#0c1b15` and a hard `#8fa23a` edge. A
disabled key in the question box is pale (`#e9f2b3`, text `--text-dim`, edge `#cfd7a6`), not faded, so it stays at 4.5:1.
The verdict on an answer is printed as a stamp in the slip's corner (`--low`, `--medium` or `--high`, a word and a mark).

| Token | Paper | Night | Use |
|---|---|---|---|
| `--bg` / `--bg-top` / `--bg-bottom` | `#f1ece0` / `#f8f4e9` / `#eee8d8` | `#0a1812` / `#12291f` / `#0a1812` | The page: a soft vertical gradient and a faint paper grain |
| `--surface` | `#fffcf5` | `#14281f` | Cards, the answer, the receipt, the tab bar |
| `--surface-2` | `#efe9da` | `#1d332a` | Chips, tiles, ghost buttons |
| `--sheet-1` / `--sheet-2` | `#f2ebd9` / `#e8dfc8` | `#10221a` / `#0d1c15` | The two sheets under an answer |
| `--field` / `--field-border` | `#fbf8ef` / `#d8cfb8` | `#0e1f17` / `#2a4235` | Inputs, cut into the page |
| `--border` | `#dcd3bf` | `#2a4235` | All hairlines |
| `--dot` | `#cfc6ae` | `#2f4a3b` | The dotted leader rule |
| `--text` | `#14201a` | `#eef3e8` | Body and headings |
| `--text-dim` | `#4f5a53` | `#a9bbaf` | Secondary text, the reason line |
| `--text-faint` | `#5e6861` | `#84998c` | Labels, units, disclaimers |
| `--accent` | `#0e5a3c` | `#9fe0b6` | Links, focus, fills |
| `--accent-soft` | `#e3f0e7` | `#1c3a2b` | Accent-tinted backgrounds, a chosen option |
| `--on-accent` | `#fffcf5` | `#0a1812` | Text on an accent fill |
| `--primary-1` / `--primary-2` / `--primary-ink` | `#18754e` / `#0e5a3c` / `#fffcf5` | `#f7faf2` / `#d9e3d2` / `#0a1812` | The main button (a green key in Paper, a cream key in Night) |
| `--mark` | `#0e5a3c` | `#eef3e8` | The slip in the logo |
| `--marker` / `--marker-ink` | `#dcf26b` / `#14201a` | `#dcf26b` / `#0c1b15` | The marker: the brand's one loud colour |

### Semantic tokens — the glycemic scale

| Token | Paper | Night | Meaning |
|---|---|---|---|
| `--low` / `--low-bg` | `#1b6b45` / `#ddf0e4` | `#63b98c` / `#15291f` | Low load, fits |
| `--medium` / `--medium-bg` | `#8f5200` / `#fbebcb` | `#e2ad4c` / `#2b2313` | Medium, fits with a change |
| `--high` / `--high-bg` | `#9e3025` / `#f8ddd8` | `#d97b70` / `#2c1c1a` | High, over budget, refused |

Contrast of every text pair, computed from these values: 4.7:1 or better in both
sets (ink on the receipt 16.4 / 13.8, dim 7.0 / 7.7, faint on the page ground 4.7 /
6.0, the three status chips 5.3 to 7.6).

### Depth

Depth is built the same way in both sets, from tokens, never ad hoc:

- **A lifted slip.** The answer is a card whose bottom edge is torn into teeth,
  with two sheets behind it. The shadow follows the teeth (`filter: drop-shadow`),
  never a box.
- **A key.** Buttons have a lit top edge, a dark bottom edge and press down 2px.
- **Pressed in and cut in.** A chosen option is pressed in; a field is cut in.
- **A groove.** The day bar is a groove with a filled bead.
- **The marker.** On the figure that answers the question: tilted, with an uneven
  edge. It is never put on a negative number, and in Night it glows softly.

### Colour rules
1. **Colour carries meaning, so it is never decoration.** Green = fits,
   amber = fits with a change, red = over or refused. Nothing else is amber or red.
   The marker is the one exception to "colour is meaning": it marks emphasis, once
   per screen, and never marks a loss.
2. **Colour is never the only signal.** Every status has a word and an icon
   beside it (see the status disc).
3. The verdict's colour comes from the **engine's `afterMeal.fits`**, never from
   reading the sentence.
4. Never hardcode hex in a component. Never add a colour without adding its
   dark counterpart.

---

## Typography

Three families, each with one job.

| Family | Token | Use |
|---|---|---|
| **Literata** (serif) | `--serif` | The voice: verdict, page and card headings, the wordmark |
| **IBM Plex Sans** | `--font` | Everything else |
| **IBM Plex Mono** | `--mono` | Numbers, the receipt, the three figures. Always `tabular-nums` |

### Scale

| Role | Size | Notes |
|---|---|---|
| Verdict | 25px (22px on phones) | Literata 600, `-0.02em`, `text-wrap: balance`, max ~22ch |
| Card heading | 17px | Literata 600, `-0.01em` |
| Wordmark | 24px | Literata 600, `-0.02em` |
| Body | 15px / 1.5 | |
| Answer text | 15.5px / 1.55 | `max-width: 60ch` |
| Secondary / dim | 14px | `--text-dim` |
| Label / eyebrow | 13px | Uppercase, `0.08em` tracking, 600, `--text-faint` |
| Figure value | 19px (17px phone) | Mono 500 |
| Receipt | 13px | Mono, tabular |

### Typography rules
1. The serif is for **the product speaking**. Never use it for UI chrome.
2. Numbers are monospaced and tabular, always, so columns align.
3. No more than two weights on a screen: 400 and 600 (the mono uses 500).
4. **Never set any text below 13px.** The primary persona skews 40+.

---

## Spacing and radius

A loose 4px grid. The values already in use:

- **Gaps:** 6, 8, 10, 12 px. **Padding:** 8, 10, 12, 18 px (cards are 18px).
- **Page:** max-width 880px, 16px side gutters, 64px bottom.
- **Radius:** `--radius` 14px for cards; 12px for chips and the ask input;
  8px for buttons and fields; 10px for figure tiles; 99px for pills and tabs.

Rules: cards never nest cards; one radius per element class; touch targets are
at least 44px tall.

---

## Layout

- **One column.** Everything stacks; nothing sits beside the ask box at any width.
- **Navigation is a floating bar at the bottom**, four items (Ask, Diary, Menu,
  You), reachable with a thumb, at every width. The page leaves room beneath it.
- **Below 560px:** the ask button goes under its input at full width, the
  receipt shows each food above its three numbers, figure tiles tighten.
- **Mobile first.** Check every change at 375px before desktop.

---

## Components

### Card
`--surface`, 1px `--border`, `--radius`, 18px padding, a soft lift. The answer is
the one card with a torn edge and two sheets behind it; its verdict is carried by
the status chip, not by a coloured edge.

### Buttons
- **Primary:** the key: `--primary-1` to `--primary-2`, `--primary-ink`, 600, radius
  12, a lit top and a dark bottom edge. One per view.
- **Ghost:** a stamp: `--surface`, 1.5px `--text` border and a 3px `--text` shadow
  beneath, radius 12.
- **Ask:** full width under the input on phones, 46px tall.

### The answer (a meal)
In this order: status disc + label → **verdict** → **three figures** → reason →
next action behind a dashed rule → verified pill. Advice, clarifying questions
and refusals are plain prose; never dress them as a verdict.

### The answer box, under a question
When the answer is a clarifying question (badge "One question first"), a field sits directly under it:
a small label "Your answer", the input in the same card as the question box above, and a **Ghost**
button "Send answer" (the one primary action of the view is still "Check this meal"). Its placeholder is
an example taken from the engine's own result (the first candidate it offered), never from the sentence;
with no candidate it says what to type. It goes away when the next answer arrives, and focus is not moved
into it, so a phone's keyboard does not open over the question.

### Status disc
A 20px filled circle in the verdict colour with a white icon, beside an
uppercase label: ✓ Fits, + Fits with a change, ✕ Not today, ! One question first,
i Advice.

### The three figures
`this meal` · `before` · `left after`. The last carries the verdict colour and
reads **over by** when negative. Values come from the tool result, in mono.

### Day bar
A 3px bar under the budget line showing how much of the day is used. Never a ring.

### Pills
13px, 600, radius 99. `.low` `.medium` `.high` use the semantic pairs; `.none`
uses `--surface-2`. A source is **checked** or **unverified**, and always says so.

### Receipt
Mono, 13px, dotted leaders (`--dot`). Header, one line per food, total, formula, sources.
Header hidden on phones.

### Chips ("Try one")
Raised: `--surface`, 1px border, radius 12, 15px, 44px minimum height.

### Navigation bar
A floating slab at the bottom: four items, each an icon above a 13px label. The
selected item sits on a marker pill. Feedback is not in the bar; it lives in **You**.

### The day, on the Diary
A day is named (**Today**, **Yesterday**, or "Fri, Oct 9") between two 44px arrows; the next
arrow stops at today. The one number that matters (what is **left**, or what a past day
**used**) is large and on the marker, as in the answer; the other figures sit under it in a
quiet list: a label, a groove with a bead, and plain numbers. Each meal is a card of foods;
a food logged by hand has a weight stepper, a food logged from an answer shows the weight it
was costed at (its numbers were computed then). Removing a food, or adding one, leaves one
line under the figures that says so and can take it back for ten seconds. Foods logged before
are offered as chips ("Again, to dinner") and add themselves in one tap.

The week card opens with one plain line ("4 of 7 days in range this week") and names thin days (fewer than 3 meals) and carbs-only days in words; below the seven day bars a four-week strip shows one row per week of seven 12 px marks (filled `--low` = in range, outlined `--text-faint` = logged but not in range, dotted `--border` = not logged). No praise, streak, ring or score.

### Tips, on the Ask screen

A **tip** is a small card that points at the real screen: before the first question it points at the input, and after the first answer, one at a time, at the verdict, at Show calculation and at the log button. A ring in `--accent` marks what it points at. It uses the card tokens (`--surface`, `--border`, `--radius`, `--fx-raised`), the card-heading type and 14 px body text, and carries a "Next" or "Got it" key and a "Skip tips" link. It is **non-modal and never takes focus**; on a phone it is pinned above the tab bar. It carries **no figure**: tips explain where numbers come from and never display one.

"How it works" (a button under Help in You) opens a plain dialog, one line for each tab.

### Feedback card, on the Ask screen

"How is it going?": a card at the end of the Ask page (after the answer, so the question box stays first on the screen) with the five rating keys (the labels the feedback form uses), one optional line and **Send** / **Not now**. It asks once after the third eaten meal and once on a later day, at most once per visit, and never while a question is being answered or a tip, the feedback form or a dialog is open. It is announced politely and **never takes focus**. After Send it becomes one plain line ("Thank you. This goes to the person building DiaBite.") with a Close link. No confetti, no praise. Card tokens, the rating keys' own styles, 44 px targets on touch.

### Day picker, and planned rows

The **Day picker** is a label ("Day"), three chips (Today, Yesterday, Tomorrow; the Menu offers Today and Tomorrow) and a native date field ("Pick a date") built from the existing chip toggle. The chosen chip is pressed (`aria-pressed`); a date out of range snaps to the nearest allowed one and says so in one line ("You can go back 14 days." / "You can plan 14 days ahead."). It never takes focus. On Ask it sits above the log button; the button reads **Log it** up to today and **Plan it** after. On the Menu each meal has **I ate this** and **Plan it…**, which opens the picker under the card.

A **planned row** in the Diary is in the muted text colour with a dashed **planned** pill (a past day: **planned, not eaten**), with **Ate it** (shown only for today and earlier) and ✕. A day with plans carries one quiet line under the figures: "Planned: GL 14, not counted yet." Nothing planned is counted in any figure, bar or week mark, and the state is a word, not a colour.

### The week, on the Menu
Seven day keys (the day's name and its planned glycemic load), today pre-selected, and one
day open as a card: a bar, then each meal with its glycemic load, its foods at their weights,
the recipe behind a disclosure, **I ate this**, **Plan it…** and **Replace**. The week stays on this
device until **Generate again** is pressed.

### Portions
After an answer, **Change a portion** opens one row per food: its name and a stepper
(a 44px minus and plus around the weight, in mono). A change settles for 0.4s, then the
engine counts the meal again; a card above the original answer shows the new figures
with the verdict word taken from `fits`, and the original is dimmed under the label
"Original answer, before you changed a portion". No figure is worked out in the browser.

### Plain-words link
**What is GL?** sits under the main figure as an underlined link and opens a short
dialog, drawn into `.app` so the rest of the page can go inert behind it.

### Onboarding progress
Five bars (cut-in grooves, the filled ones beaded) and one line, *"Step name, N of 5"*.
On a phone the button that moves you on stays at the bottom while the form scrolls.

### Landing page: the tape
Shown to a signed-out visitor when sign-in is required. **Always the dark page, whatever the theme** (the Night set, with the cream of the slip and the marker): it is the one place where the receipt is the layout. The emergency line first, then the wordmark and **Sign in**, then the hero: the headline "Can I eat this?" (the only `h1`, with "eat" on the marker), one sentence, the primary key in the marker colour, and a real receipt printed as a tilted tape with a torn bottom edge, dotted leaders and a green **FITS** stamp (static, kept true by `npm run eval`). Then the one-minute clip with captions and a transcript, three cream slips ("you say it", "the engine counts", "the day answers"), the promise as one large line, "What it is not" as fine print on paper, a short section for clinicians, and a closing band in the marker colour with the key. The author is one small line in the footer, never a section. No photo, no testimonial, no number that is not on the receipt or dated, no promise of a result. The named values the page adds to Night are declared at the top of its block in `src/styles.css` (`--lp-*`); the wordmark beside the logo is plain text hidden from a screen reader (the logo already says "DiaBite").

### Logo and wordmark
The mark is a **stamp** (chosen by the owner on 21 October 2026 from seven directions, https://claude.ai/artifact/FijYoKhe1B9izkBwLP1kQU): a ring with a bite out of its top-right corner and a tick, the way the product stamps FITS on a receipt. The ring takes `--text`, the tick the marker colour on the dark page and Paper's green on Paper (`--logo-tick`). It stays a ring and a tick at 16px, which is why it is the favicon. The earlier mark, a receipt with a bite and a highlighted line, remains as the slip in the product itself. The wordmark is **Dia** and a marker-highlighted **Bite** in the serif.

---

## Motion

Almost none, and never for its own sake.

- The waiting state names the three things happening (look up, compute, check)
  and pulses gently. It never shows a progress bar, because the trace only
  arrives with the answer and a bar would be a guess.
- The day bar eases its width over 0.5s.
- A button presses down 2px in 0.08s. `prefers-reduced-motion` turns that off too.
- `prefers-reduced-motion` turns the pulse off.

---

## Accessibility

1. WCAG AA minimum: 4.5:1 for text, in both colour schemes.
2. Keyboard reachable, with a visible focus ring (2px `--accent`) on every control.
3. Status is conveyed by text and icon, never colour alone.
4. Decorative icons are `aria-hidden`; the day bar has an `aria-label` stating
   used and total.
5. Respect `prefers-color-scheme` and `prefers-reduced-motion`. **You** offers
   Tape (default), Paper and Follow my phone; the choice is kept on the device.

---

## UI consistency rules

1. Use the tokens above; if one is missing, add it here **first**.
2. Reuse an existing component before writing a new one.
3. One primary action per view.
4. Plain words. No medical jargon without a gloss, no "AI-powered", no
   exclamation marks, no emoji in product copy.
5. The disclaimer is a banner that never leaves the screen and is read before
   any number. Its first sentence, "This is a reference tool, not medical advice.",
   is always shown; the rest is one tap away under "Read more". The words
   themselves are a clinical and legal matter (docs/clinical-review-addendum.md,
   Q27): do not edit them for layout.
6. If the product does not know something, the interface says so in the same
   voice and weight as an answer.

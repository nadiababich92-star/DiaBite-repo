# DiaBite Design System

The visual contract for the app. Every colour, size and spacing value below is
taken from `src/styles.css` as it stands; when the two disagree, fix whichever
is wrong, but never let a new screen invent a third value.

The direction was settled in the design canvas (`docs/design/`) and it is called
**the receipt**.

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

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f3f6f4` | `#0e1412` | Page background |
| `--surface` | `#ffffff` | `#161d1a` | Cards, the answer, the receipt |
| `--surface-2` | `#eaf0ec` | `#1d2622` | Inputs, ghost buttons, chips, figure tiles |
| `--border` | `#d9e1dd` | `#253029` | All hairlines |
| `--text` | `#131c18` | `#e7ede9` | Body and headings |
| `--text-dim` | `#57655e` | `#94a29b` | Secondary text, the reason line |
| `--text-faint` | `#7d8b84` | `#74827b` | Labels, units, disclaimers |
| `--accent` | `#1c6b49` | `#58b487` | Primary action, links, focus, the "left after" figure |
| `--accent-soft` | `#e2efe8` | `#162b22` | Accent-tinted backgrounds |

### Semantic tokens — the glycemic scale

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--low` / `--low-bg` | `#2f7d57` / `#e3f0e8` | `#63b98c` / `#15291f` | Low load, fits |
| `--medium` / `--medium-bg` | `#91650f` / `#f6edda` | `#c99a3c` / `#2b2313` | Medium, fits with a change |
| `--high` / `--high-bg` | `#a9443b` / `#f7e5e2` | `#d97b70` / `#2c1c1a` | High, over budget, refused |

### Colour rules
1. **Colour carries meaning, so it is never decoration.** Green = fits,
   amber = fits with a change, red = over or refused. Nothing else is amber or red.
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
| Label / eyebrow | 11px | Uppercase, `0.12em` tracking, 600, `--text-faint` |
| Figure value | 19px (17px phone) | Mono 500 |
| Receipt | 12.5px | Mono, tabular |

### Typography rules
1. The serif is for **the product speaking**. Never use it for UI chrome.
2. Numbers are monospaced and tabular, always, so columns align.
3. No more than two weights on a screen: 400 and 600 (the mono uses 500).
4. Never set body text below 13px.

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
- **Tabs** are one line that scrolls on a phone, never wraps.
- **Below 560px:** the ask button goes under its input at full width, the
  receipt shows each food above its three numbers, figure tiles tighten.
- **Mobile first.** Check every change at 375px before desktop.

---

## Components

### Card
`--surface`, 1px `--border`, `--radius`, 18px padding. The answer card adds a
3px left border in the verdict's colour.

### Buttons
- **Primary:** `--accent` background, white, 600, radius 8, `9px 16px`. One per view.
- **Ghost:** `--surface-2`, 1px `--border`, radius 8. Hover: border becomes `--accent`.
- **Ask:** full width under the input on phones, 46px tall.

### The answer (a meal)
In this order: status disc + label → **verdict** → **three figures** → reason →
next action behind a dashed rule → verified pill. Advice, clarifying questions
and refusals are plain prose; never dress them as a verdict.

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
11px, 600, radius 99. `.low` `.medium` `.high` use the semantic pairs; `.none`
uses `--surface-2`. A source is **checked** or **unverified**, and always says so.

### Receipt
Mono, 12.5px, dashed rules. Header, one line per food, total, formula, sources.
Header hidden on phones.

### Chips ("Try one")
`--surface-2`, 1px border, radius 12, 14.5px, 44px minimum height.

### Tabs
Text tabs with a 2px accent underline on the selected one; the feedback action is
a small pill beside them.

---

## Motion

Almost none, and never for its own sake.

- The waiting state names the three things happening (look up, compute, check)
  and pulses gently. It never shows a progress bar, because the trace only
  arrives with the answer and a bar would be a guess.
- The day bar eases its width over 0.5s.
- `prefers-reduced-motion` turns the pulse off.

---

## Accessibility

1. WCAG AA minimum: 4.5:1 for text, in both colour schemes.
2. Keyboard reachable, with a visible focus ring (2px `--accent`) on every control.
3. Status is conveyed by text and icon, never colour alone.
4. Decorative icons are `aria-hidden`; the day bar has an `aria-label` stating
   used and total.
5. Respect `prefers-color-scheme` and `prefers-reduced-motion`.

---

## UI consistency rules

1. Use the tokens above; if one is missing, add it here **first**.
2. Reuse an existing component before writing a new one.
3. One primary action per view.
4. Plain words. No medical jargon without a gloss, no "AI-powered", no
   exclamation marks, no emoji in product copy.
5. The disclaimer is a banner that never leaves the screen and is read before
   any number.
6. If the product does not know something, the interface says so in the same
   voice and weight as an answer.

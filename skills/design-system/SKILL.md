---
name: design-system
description: >
  Enforces DiaBite's design system on every UI component, page and style
  decision. Always apply when writing any frontend code — components, layouts,
  pages, CSS, inline styles. Trigger when the user asks to build a screen,
  component or layout, or says "make it look like the design", "follow the
  design system" or "style this properly". Never use a colour, size or font
  that is not defined in docs/design.md.
---

## Purpose

Make every screen look like the same product. Used whenever UI code is written; it
reads the design file at the start of every session and never works from memory.

## Inputs

- `docs/design.md` — the contract: tokens, type, spacing, components, rules
- `src/styles.css` — the values as they run; the two must agree
- the screen or component being built

**Precondition:** if `docs/design.md` is missing, stop and say so. Do not invent a
design.

### Source of truth

All tokens, type, spacing, components and rules live in **`docs/design.md`**.
Read it in full before writing any UI. The runtime values live in
`src/styles.css`; the two must agree.

## Instructions

Apply these rules to every piece of UI:

1. Never use a colour, spacing or font that is not in `docs/design.md`.
2. Never hardcode a hex value in a component — use the named token. When adding
   a colour, add its **dark** counterpart in the same change.
3. **Colour means something.** Green fits, amber fits with a change, red is over
   or refused. Nothing else is amber or red, and colour is never the only signal:
   a status carries a word and an icon.
4. The verdict, its colour and its badge come from the engine's
   `afterMeal.fits`, never from reading the sentence.
5. A meal answer has four levels — verdict, three figures, reason, next action.
   Do not flatten them into paragraphs. Advice, clarifying questions and refusals
   stay plain prose; never style them as a verdict.
6. **No rings, streaks, scores, confetti or praise.** The day is a thin bar.
7. Numbers are monospaced and tabular. The serif is for the product speaking,
   never for chrome.
8. Say what is unknown, in the same voice and weight as a result.
9. Mobile first: check 375px. Touch targets at least 44px.
10. WCAG AA (4.5:1) in both colour schemes; visible focus on everything
    interactive; respect `prefers-reduced-motion`.

### Before finishing
Look at the screen at 375px and at desktop width, in light and dark. If you
introduced a value `docs/design.md` does not contain, add it there first.

## Output

UI code that uses only named tokens and the components in `docs/design.md`. If a
value was missing, `docs/design.md` and the dark theme are updated first, in the
same change.

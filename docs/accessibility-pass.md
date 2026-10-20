# DiaBite — a free accessibility pass

*Roadmap item 3.4. Run on 19 October 2026 by the builder against the live app (`https://diabite.pro`, revision 128) with `node eval/a11y.mjs`. **Self-assessed.** Automated checks find roughly a third of accessibility problems; this is a floor, and an audit by a person who uses a screen reader is on the use-of-funds list.*

## What was run

| Check | How | Result |
|---|---|---|
| **axe-core 4.10.2**, WCAG 2.0 A and AA, 2.1 A and AA, 2.2 AA | 10 screens × a phone (390 px) and a laptop (1366 px) × light and dark = **40 runs** | **No violations in any run** |
| **Text contrast**, checked directly (axe's own contrast rule reported "inapplicable" in this headless setup, even on a page with planted faults, so it is not relied on) | The computed text colour against its background on every text element: 1,960 elements checked in all runs, 4.5:1 (3:1 for large text); 104 elements sitting on gradients or images were counted as unknown, not as passes | **No failures.** The first run flagged the large "left" figure in the dark theme; that was the checker not seeing the lime marker drawn behind the number (ink on marker is 14.3:1 in dark and 13.6:1 in light), and the checker was corrected |
| **Reflow** (WCAG 1.4.10) at 320 px wide and **200% zoom** (1.4.4, a 1280 px window shown at 640 px) | Ask, Diary, Menu and You | **No horizontal scroll** on any of the eight |
| **Keyboard** (2.1.1, 2.4.7) | Tab through each tab at laptop size; count the controls reached and whether each shows a focus indicator | Ask 9 of 9, Diary 20 of 20, Menu 30 of 30, You 24 of 24 controls reached; **a visible focus indicator on every one** |

The screens scanned: the empty Ask screen; an answer; the open receipt; the "What is GL?" dialog; the Diary for today; the Diary on a planned day; the Menu; the Menu with the shopping list; You; and the "How it works" dialog.

## What was not run, and what that means

- **A screen reader.** No VoiceOver or NVDA walk-through was done (the accessibility tree was read by machine on 20 October: see the addendum). The structure is built for one (labelled regions, `aria-live` on notices, `aria-pressed` and `aria-checked` on the day and rating controls, the feedback card and the first-run tips announced politely and never taking focus), but that is the intention, not a test.
- **Lighthouse.** Not run; it uses axe for its accessibility score, so it would repeat the above.
- **Screens not scanned:** the sign-in and onboarding screens, the feedback form dialog, the first-run tips (they were switched off for the run so they would not sit over what the script clicks), and the Diary's add-a-food form in use.
- **Touch targets** (44 px) are set in `src/styles.css` for touch devices and were not measured here.
- **Reduced motion and text-only zoom** were not tested.

## What this supports saying

"We ran axe-core on every main screen in both themes at phone and laptop size with no violations, checked contrast and 320 px reflow and 200% zoom, and walked the keyboard path; a screen-reader audit is still to do." It does **not** support "WCAG compliant": that is a claim for an audit.

## Addendum, 20 October 2026: what a screen reader is given (`node eval/a11y-tree.mjs`)

Not a screen-reader session. The script reads Chrome's **accessibility tree** on each screen, which is what VoiceOver and NVDA announce, and checks what a machine can check: every control has a name, headings do not skip a level, there is a `main` landmark, a modal dialog has a name, takes focus when it opens and gives it back when it closes, and notices are in a live region and never take focus. It also writes each screen's reading order so a person can read it.

**It found three things, all fixed the same day:**
1. **No `main` landmark on any screen.** `<main role="tabpanel">` replaced the landmark with a tab panel, so a reader could not jump to the content. `<main>` now wraps a `tabpanel`; the sign-in and onboarding screens had no `main` at all and now have one.
2. **The budget bar was announced as "8.600000000000001 of 45 glycemic load used today"**, a float that was never rounded. It is rounded to one decimal, and the script now flags any accessible name with a long decimal.
3. **The product name was announced as "Dia Bite"** (the marked-up "Bite"); the heading now carries the label "DiaBite".

**What passed:** both dialogs ("What is GL?", "How it works") are named, move focus in and return it to the button that opened them on Escape; the answer is announced politely (`role=status`, `aria-live=polite`) and the first-run tip is a polite region that never takes focus; the day and rating controls expose their pressed and selected state. axe-core ran again on the local build after the change: 0 violations in 40 runs.

**Still not done:** a person using VoiceOver or NVDA. The reading order of each screen is saved by the script; whether it makes sense by ear, whether the labels are clear, and how a real virtual cursor moves through the tables and the diary are only answered by that session, and the claim "WCAG compliant" is still not supported.

## Addendum, 20 October 2026 (evening): the landing page

The signed-out landing page was added to `eval/a11y.mjs` (axe-core, contrast, 320 px reflow, 200% zoom, a keyboard walk: skip link, Sign in, Try DiaBite, the video, the transcript, the links, the footer button) and to `eval/a11y-tree.mjs` (one `h1`, a `main` landmark, the clip with a captions track, every control named). The clip has English captions and a text transcript; it never autoplays. **Still not done:** a person listening to the page with VoiceOver or NVDA, and the captions listened to once against the sound.

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

- **A screen reader.** No VoiceOver or NVDA walk-through was done. The structure is built for one (labelled regions, `aria-live` on notices, `aria-pressed` and `aria-checked` on the day and rating controls, the feedback card and the first-run tips announced politely and never taking focus), but that is the intention, not a test.
- **Lighthouse.** Not run; it uses axe for its accessibility score, so it would repeat the above.
- **Screens not scanned:** the sign-in and onboarding screens, the feedback form dialog, the first-run tips (they were switched off for the run so they would not sit over what the script clicks), and the Diary's add-a-food form in use.
- **Touch targets** (44 px) are set in `src/styles.css` for touch devices and were not measured here.
- **Reduced motion and text-only zoom** were not tested.

## What this supports saying

"We ran axe-core on every main screen in both themes at phone and laptop size with no violations, checked contrast and 320 px reflow and 200% zoom, and walked the keyboard path; a screen-reader audit is still to do." It does **not** support "WCAG compliant": that is a claim for an audit.

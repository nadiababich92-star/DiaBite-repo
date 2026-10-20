# DiaBite — where things stand

*20 October 2026. A short list, kept current. The plan it follows is `docs/ROADMAP-to-investors.md`; the product is `docs/PRD-product.md`.*

## Built and live at https://diabite.pro

- Sign-in by email, onboarding with a consent step, a daily budget with its formula, the ask screen (a verdict, three figures, the reason, the receipt), a diary that follows you across devices, the week in range, planning and logging on any day (14 days back, 14 ahead; a plan counts only once eaten), a weekly menu with a shopping list that follows the plan, first-run tips, a feedback card, export and deletion.
- The engine: 8,633 records, every number computed and checked; a dish the database lacks is counted from its ingredients as an estimate; the safety rules run before any model. Evidence: `docs/safety-case.md`, `docs/data-sources.md`.
- Evidence of checking: 204 of 204 behavioural checks on the live agent (15 October); a free security pass (Mozilla Observatory A+, row-level security tested with two accounts) in `docs/security/security-plan.md`; a free accessibility pass in `docs/accessibility-pass.md`.
- Watching it: `npm run report` splits our own tests from browser sessions; the throwaway accounts of our scripts carry a `test-` session id.
- Two videos: the full demo (`docs/demo-story.mp4`, 4 min 15 s) and a one-minute how-it-works clip in the deck.

## Only the owner can do these

1. **Recruit people and run the five sessions** (roadmap 2.1, 2.2). The one blocker for the beta, the investor folder and every real number. The protocol and the "how to try" page are ready.
2. **An Azure budget alert.** None exists (checked 16 October). October is heading for about €48 (about $56). Postponed by the owner.
3. **The meeting with the UX designer**: the brief is ready (a private page, shared by the owner).
4. **Loose ends (1.9):** the old Entra secret, videos in git history, the photo on the Team slide (the file carries a Gemini mark).
5. **Founders Hub:** undecided.
6. **Look and listen yourself:** the Menu and You tabs on a laptop and a phone (1.5), both videos, the LinkedIn link in the deck.
7. **Calendar:** the sign-in email secret ends 10 October 2027; the domain renews 15 October 2027.
8. **A follow-up to Eugene Kaganovich** with the demo: a draft is in `docs/clinician-outreach.md`.

## The builder can do these now

- Fix what the accessibility pass found (see `docs/accessibility-pass.md`).
- Skipped on purpose (20 October): an OWASP ZAP baseline. It needs a JDK and ZAP installed (about 450 MB), and it would repeat what is already checked (headers A+ on Mozilla Observatory, TLS 1.2/1.3, row-level security tested with two accounts, `eval:abuse`, `npm audit` at 0); an outside penetration test is the real next step and is on the use-of-funds list. Done 20 October: the Vite 8 upgrade (the two dev-server advisories are closed) and a screen-reader-oriented pass over the accessibility tree (`docs/accessibility-pass.md`, addendum).
- Confirm the licence of the International Tables' supplementary tables and the Sydney permission (`docs/data-sources.md`), which are the owner's letters to write.

## Waits for people

- After the sessions: every phrase that broke the product becomes a test; fix the top three findings (2.3, 2.4).
- The beta of 10 to 20 people; the real cost per active user (3.7); the unknown-food rate with real users (not measured yet: there are no outside users).
- Deck v13 with real numbers, the investor folder, the answers to the hard questions, the ask (phase 4).

## Waits for money (the use of funds)

A registered dietitian (the 364 ingredient indices, the copy), counsel (FDA general-wellness position, privacy policy, terms, the consent text), an outside penetration test, an accessibility audit, and help to build.

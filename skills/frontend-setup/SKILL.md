---
name: frontend-setup
description: >
  Orients on DiaBite's existing React + Vite frontend and scaffolds a new screen
  or component in the established structure. Trigger when the user asks to add a
  page, a screen, a tab or a component, or says "set up the frontend" or "start
  the app". DiaBite's frontend already exists: this skill never re-scaffolds the
  project, never switches framework, and never overwrites existing files.
---

# Frontend conventions

**Stack: React 18 + Vite 5 + TypeScript. Plain CSS in one stylesheet. No router,
no UI library, no state library.** Do not add one without asking. If a feature
seems to need one, say why and let the user decide.

## Step 1 — Read what is there

Before writing anything, look at the real structure:

```
src/
  App.tsx            the shell: masthead, banner, tabs, which page shows
  main.tsx           entry
  types.ts           shared types (Profile, Dish, DiaryEntry, Targets, …)
  styles.css         every style, built on the tokens in docs/design.md
  components/        one file per screen or widget:
                     AskPage, DiaryPage, MenuPage, ProfilePage,
                     Onboarding, FeedbackModal, Pills
  lib/               logic that is not UI:
    agent.ts           the call to /agent/ask and its response type
    profile.ts         targets, exits, constraints  ← shared with the engine
    glycemic.ts        the arithmetic                ← shared with the engine
    dietary.ts         allergen and pattern rules    ← shared with the engine
    storage.ts         localStorage, every access wrapped in try/catch
    supabase.ts, feedback.ts   the feedback form's backend
  data/              seed foods and dishes
```

`src/lib/{profile,glycemic,dietary}.ts` and `src/types.ts` are also copied into
the engine's Docker image. **Changing one is changing the engine.** Run
`npm run eval` afterwards, and check the Dockerfile still copies what it needs.

## Step 2 — Decide where the feature goes

- A new **screen** → a new file in `src/components/`, one tab in `App.tsx`.
- A new **widget** → a component in the file that uses it, until a second place
  needs it.
- **Logic** that is not rendering → `src/lib/`, so it can be tested and, if the
  engine needs it, shared.
- **Numbers shown to the user come from a tool result.** Never compute a
  nutrition figure in a component.

## Step 3 — Build with the design system

Apply `/design-system` and read `docs/design.md` first. Every colour, size and
spacing value is a token. The phone is the first screen: check **375px** before
anything else.

## Step 4 — Check it in the browser

1. Start the dev server (`npm run dev`, or the `diabite` entry in
   `.claude/launch.json`) and open it.
2. Ask a real question end to end, not a mocked one.
3. Look at: the loading state, an unknown food, a refusal, a very long answer,
   and the phone width.
4. Read the console. Report what you saw, with a screenshot.

## Rules
- Never overwrite an existing file without saying so.
- Every `localStorage` access is wrapped in `try/catch` — the app must render
  with no stored value.
- Anything inlined by Vite (`VITE_*`) is public. Never put a secret there.
- The feedback form talks to Supabase with the publishable key and insert-only
  rights. Do not widen that.

---
name: engineering-planner
description: >
  Turns docs/PRD.md plus a feature request into an engineering document for
  DiaBite: how the feature fits the existing stack, data, API, agents, UI and
  evaluations. Trigger when the user asks for an engineering doc, a technical
  design, an architecture plan, or wants a new feature planned before it is
  built. Output is one file, docs/engineering/engineering-doc.md. DiaBite is
  already built, so this plans a change to a running system, not a new app.
---

## Purpose

Plan a change to DiaBite before any code is written. This is the first skill in
the pipeline: every later one reads what it produces, so run it first and get its
output approved.

**Stack is fixed — do not ask about it.** React + Vite + TypeScript frontend;
Express + TypeScript engine on Azure Container Apps; Azure AI Foundry prompt
agents (triage, meal, advisor); Supabase (Postgres, pgvector, feedback table);
GitHub Actions builds the image. Read `CLAUDE.md` first for the rules that
already cost us time.

## Inputs

- `docs/PRD.md` — the source of truth; read the Week 1–5 sections the feature belongs to
- `CLAUDE.md` — the rules that already cost us time
- `docs/PLAN.md` — what is deliberately not being built yet, and the owner's open decisions
- `docs/design.md` — only if the feature has a screen
- the feature the user wants planned (a sentence, a file, a pasted brief)

**Precondition:** if `docs/PRD.md` is missing, stop and say so. There is nothing
to plan against.

## Instructions
1. **Read** the PRD, `CLAUDE.md`, and the code the feature touches. Do not plan
   against how the stack is *described*; open `server/`, `src/` and `agent/`.
2. **Find the gaps.** List every undecided architectural choice. Ask the user
   about each with `AskUserQuestion` — what to store about a person, which
   threshold, which foods — before writing anything. Never decide a medical or
   data-protection question yourself.
3. **Write** `docs/engineering/engineering-doc.md`.
4. **Stop.** Show it and wait for approval.

## Output

`docs/engineering/engineering-doc.md`, one file.
1. **Summary** — the feature, the user problem it answers (cite the PRD
   section), and how success is measured
2. **Scope** — in scope / out of scope / later
3. **User flows** — each as `User action → Frontend → Engine → Agent → Data → Response`
4. **The promise check** — which numbers the feature shows, where each is
   computed, and how the verifier covers it. If any number could come from the
   model, the design is wrong; say so and fix it
5. **Frontend** — screens and components touched, states (loading, empty,
   error, unknown, partial), phone layout, accessibility
6. **Engine and API** — endpoints and tool changes: method, path, auth, request,
   response, errors. Model-facing tools answer 200 with an `error` field
7. **Agents** — prompt changes, tool-spec changes, which agent, and the
   router's behaviour
8. **Data** — tables, columns, indexes, migrations; what is stored about a
   person and what is not
9. **Safety and responsible AI** — what the rules gate catches, what could
   mislead a patient, what a clinician should review
10. **Evaluation plan** — the engine cases and agent cases that must exist *in
    the same change*, and the mechanical checks that read tool results
11. **Rollout** — build, deploy, how to check the live service, how to roll back
12. **Open questions** — everything that belongs to the owner or a clinician

### Requirements
- Concrete. No "TBD", no "as needed".
- Name the files that will change.
- Diagrams (Mermaid or ASCII) where a flow is easier seen than read.
- No implementation begins until this document is approved.

# DiaBite — project guide

Read this first, every session. Claude starts each session with no memory of the
last one, so everything that must not be re-learned is written here.

DiaBite is an agentic nutrition copilot for **adults with type 2 diabetes,
prediabetes and insulin resistance in the US**. A person describes a meal in
their own words; the app says whether it fits what is left of their day, and
shows the arithmetic. Product and docs are in **English**; the owner chats in
Russian. The source of truth for *what* we build is [`docs/PRD.md`](docs/PRD.md).

---

## The one promise

**Every number a user sees was computed, not generated.** Foods are matched
against a database, the engine does the arithmetic, and a verifier checks every
number in an answer against the tool results before it is shown. A language
model never produces a nutrition number, and nothing in this repository may
change that. If a change would let it, stop and say so.

---

## How it fits together

| Piece | Where | What it does |
|---|---|---|
| Frontend | `src/` — React + Vite + TypeScript | Onboarding, ask screen, diary, weekly menu, profile, feedback form |
| Engine | `server/` — Express + TypeScript, `tsx` | `/tools/*` for the agent, `/agent/ask` for the browser, serves the built app |
| Agents | `agent/` — Azure AI Foundry prompt agents | `diabite-triage` (routes), `diabite-meal` (tools), `diabite-advisor` (no tools, no numbers, has memory + knowledge base) |
| Data | `data/`, `src/data/`, Supabase | 351 ingredients, ~85 everyday foods, 1,000 recipes, 4,618 USDA foods; pgvector index in Supabase, embedded fallback |
| Evals | `eval/` | `npm run eval` (engine), `npm run eval:agent` (deployed agent), Foundry runs via `eval/run-foundry.ts` |
| Hosting | Azure Container App `diabite-engine`, image built by GitHub Actions | One image serves engine and app at one address |

Permanent address: `https://diabite-engine.greenglacier-ab5551c6.swedencentral.azurecontainerapps.io`

---

## Commands

```bash
npm run dev                      # frontend on :5173, proxied to the deployed engine
npm run eval                     # engine evals — run after ANY change to data, aliases, thresholds, targets
npm run eval:abuse               # rate limits, size caps, CORS, bounded memory — no model, no money
ENGINE_API_KEY=<key> AGENT_URL=<url>/agent/ask npm run eval:agent   # agent evals — after ANY change to a prompt, tool spec, model or food data (the key exempts the run from rate limits)
npm run deploy                   # waits for that commit's image build, updates the app, retires old revisions
npx tsx agent/provision.ts       # republish the three agents after editing agent/prompts/*.md (needs the env in agent/SETUP.md)
npx tsx scripts/sync-foods.ts    # push the catalogue and vectors to Supabase (needs .env.local)
```

The shell does not have Node on its PATH by default: prefix with
`export PATH="/opt/homebrew/bin:$PATH"`.

---

## Rules that cost us an afternoon each

1. **Check the thing, not the tool's report.** After a deploy, ask the running
   service what it is serving. A container app does not re-pull an image whose
   tag is unchanged, so a rebuild on the same commit deploys nothing and
   prints "live".
2. **PostgREST stops at 1,000 rows without saying so.** Always paginate reads;
   an unpaginated read once left 813 withdrawn foods in the table.
3. **A food the database lacks never enters the arithmetic under a neighbour's
   name.** It comes back `unknown` and the agent says so. Partial meals are
   costed without it and labelled partial, and may never be called "fits".
4. **A record with no glycemic index and real carbohydrate stays out of the
   catalogue.** The load helper answers 0 for a missing GI — true of cheese,
   false of pizza.
5. **Curated records win a tie against the coverage layer**, in resolution
   and in swaps.
6. **Dosing, red flags, fasting and referral are caught by rules before any
   model runs.** A refusal that depends on a model behaving is not a refusal.
   The same order holds for the limits on `/agent/ask`: **the safety gate runs
   before the rate limits**, so nobody describing a red flag is told to wait.
7. **Do not write checks that read the product's prose with a regex when the
   tool result already says it.** Every prose-reading check failed the day the
   agent started sounding human. Read `afterMeal`, `items`, `alternatives`.
8. **Changing a prompt means rerunning the agent evals**, and a prompt rule
   written to fix one failure must not take something else away. Say
   "and also", not "instead of".
9. **A federated credential is scoped to a branch.** Renaming the trunk broke
   the deploy until one for `main` was added.
10. **The live catalogue is the Supabase table, not the files in the image.**
    A change to aliases, GI, portions or any food record reaches production only
    after `npx tsx scripts/sync-foods.ts` *and* a restart of the active revision
    (`az containerapp revision restart`), because the engine reads the table once
    at start. `npm run deploy` alone leaves the old behaviour in place, and the
    local `npm run eval` will say it is fixed. Ask the running service.

---

## Working rules

- **Wait for approval** between stages (below). After finishing one, stop,
  show what was produced, and ask.
- **Never assume a missing decision.** Ask. Product decisions — medical
  thresholds, what to store about a person, which foods to show — belong to the
  owner, and some belong to a clinician.
- **Secrets never go in chat, code, docs or logs.** Use `.env.local` and
  Container App secrets. The Supabase URL and publishable key are public by
  design; everything else is not.
- **Sharing is the owner's call.** Never change who can open a Google Doc, an
  artifact, or the repository.
- **Report outcomes plainly.** If a check fails, say so with the output. If a
  step was skipped, say that.
- **Commits** are small and explain *why*; the message carries the reasoning
  the code cannot.

---

## The build workflow

DiaBite already exists, so these stages describe how a **new feature** is
added, not how the app is created. Each stage ends with a stop.

### Stage 1 — Engineering plan
**Skill:** `/engineering-planner` · **Input:** `docs/PRD.md` and the feature ask
**Output:** `docs/engineering/engineering-doc.md`

Architecture of the feature against the stack above: data, API, agent
changes, UI, evals. Ask about every undecided architectural choice with
`AskUserQuestion` before writing.

### Stage 2 — Implementation specs
**Skill:** `/implementation-specs` · **Output:** `docs/specs/*.md`, any Supabase
migration, and additions to `.env.example`

### Stage 3 — Frontend conventions
**Skill:** `/frontend-setup` · Orients on the existing React app and, for a
feature, scaffolds only the new screen or component in the established
structure. It never re-scaffolds the project.

### Stage 4 — Build one feature at a time
Read the spec, say which files will change, wait for a yes, then implement.
**Always apply `/design-system`** to any UI work: every colour, size and
spacing comes from `docs/design.md`.

### Stage 5 — Evaluate
Run `npm run eval`, then `npm run eval:agent` against the deployed agent. A
feature is not finished until both pass or each failure is explained. Add the
cases the feature needs *in the same change*.

### Stage 6 — Deploy
`npm run deploy`, then check the live service returns what you expect.

### Stage 7 — Security review
**Skill:** `/security-foundation` · **Output:** `docs/security/security-plan.md`

---

## Skills

| Skill | Command | What it does |
|---|---|---|
| Engineering Planner | `/engineering-planner` | PRD + feature ask → `docs/engineering/engineering-doc.md` |
| Implementation Specs | `/implementation-specs` | Engineering doc → granular specs, migration, `.env.example` |
| Frontend Setup | `/frontend-setup` | Conventions for the existing app; scaffolds a new screen, not a project |
| Design System | `/design-system` | Enforces `docs/design.md` on all UI code |
| Security Foundation | `/security-foundation` | Audits DiaBite's real surfaces → `docs/security/security-plan.md` |

## Writing a skill

Every `skills/<name>/SKILL.md` has the same four sections, so each one is a
contract:

- **Purpose** — what it does and when to run it
- **Inputs** — the files it reads, **by path** ("read `docs/design.md`", never
  "read the design document"), and a **Precondition** that stops it if the
  previous stage's output is missing
- **Instructions** — the steps, specific enough that two runs agree
- **Output** — the files that exist when it has finished, which is the proof

The folder name is the slash command. The skills form a pipeline — each reads
what the one before it wrote — so a skill whose input is missing stops and says
which skill to run first. Treat a SKILL.md like code: edit it, commit it, and
tighten any instruction that produced something unexpected.

## Docs

| File | Purpose |
|---|---|
| `docs/PRD.md` | What we build and why — the source of truth |
| `docs/design.md` | The visual contract |
| `docs/PLAN.md` | What comes after the demo, and the decisions that are the owner's |
| `docs/PRD-post-course.md` | All the work after the course: workstreams, sizes, decisions, people needed |
| `docs/COST-post-course.md` | What that work costs: three ways to build it, running costs, what a subscription must earn |
| `docs/CLINICAL_REVIEW.md` | Every decision the product makes about a person, with questions for clinicians |
| `docs/DEMO_SCRIPT.md`, `docs/USER_SESSIONS.md` | The demo and the five moderated sessions |

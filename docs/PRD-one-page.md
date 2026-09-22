# DiaBite — One-Page PRD

**Date:** 16 September 2026 | **Author:** Nadia Babich | **Status:** Draft v1.1
**Market:** United States | **Build:** 5 weeks, solo, AI-assisted | **Outcome:** working demo for a pitch

### Problem

People with type 2 diabetes, prediabetes, or insulin resistance face one narrow
question five to seven times a day — *can I eat this, how much, and with what?*
— and the tools they are given either don't answer it (a printed food list) or
make answering it so laborious that logging collapses within weeks (a calorie
app). The job is bookkeeping, not knowledge: turning a real meal into grams and
glycemic load, and holding a running daily budget.

### Solution

An agentic copilot that does the bookkeeping from a sentence. A model reads a
free-text meal and decides which tools to call; a deterministic engine computes
every number; a verifier rejects any answer containing a number no tool
returned. The user gets a verdict, the number behind it, a one-line reason, and
a next action — with the arithmetic one tap away, laid out like a receipt. The
agent is orchestrated in n8n; the engine and the React frontend live in one
repository and share one module, so nothing is ever computed twice.

### Why Now?

- **The population is huge and under-served.** 97.6M US adults have prediabetes
  and over 80% don't know it; diet is first-line treatment, yet only a low
  single-digit share of eligible Medicare beneficiaries ever use the nutrition
  therapy they are entitled to. **[verify — CDC, ADA]**
- **The market has been educated.** ZOE, Levels and Nutrisense taught consumers
  what a glycemic response is — then gated it behind $100+/month sensors.
- **The technology just became trustworthy.** Tool-calling models make
  free-text meal understanding cheap; a deterministic core makes the numbers
  reproducible. Neither was true two years ago, and a general chatbot still
  gives two different glycemic loads for the same meal.
- **No one shows the arithmetic.** Levels and ZOE give a score you cannot
  question; MyFitnessPal gives a database and 3–5 minutes of work per meal
  with no glycemic index at all; GI-lookup apps give a table with no verdict.
  The legible answer is an open position.

### Success Metrics

| Metric | Current | Target (demo, Week 5) |
|---|---|---|
| Ungrounded numbers in agent output | not measured | **0** across the eval set |
| Insulin-dosing refusals | not measured | **100%** on scripted probes |
| Red-flag escalation | not measured | **100%** on scripted probes |
| Meal-parsing accuracy (top-1, ~100 labelled meals) | not measured | **reported**, not promised |
| Agent answer latency, p90 | not measured | **< 10 s** |
| *Product North Star (post-launch):* in-range days per active user per week | — | median 4.5 / 7 by week 8 |

### Scope

**In (V0):** free-text meal → computed glycemic load → verdict with reason ·
verifier and a visible trace of every tool call · personal targets with their
derivation · safety envelope (no dosing, red-flag escalation, honest "no
verified data") · a measured evaluation set · weekly menu generator, already
built, carried as-is

**Out:** photo and voice logging · accounts, sync, export · personalisation
from history · broad food coverage · clinical review · T1D on intensive
insulin, children, pregnancy, CKD

### User Flow

Type a meal → agent resolves foods, asks one question if unsure → engine
computes carbs, glycemic load, and remaining daily budget → verifier checks
every number against tool results → verdict + number + reason + action, with
**Show calculation** and the tool trace one tap away

### Risks

1. **Two copies of the arithmetic drift apart** → the browser and the engine
   service import the same `src/lib` module; the API contract is fixed before
   the agent is wired, so nothing is ever re-implemented
2. **Food data eats the schedule** → a 1,000-recipe base on 350 ingredients
   now computes dish GI deterministically from ingredient GI; unknown foods
   are named as unknown, never guessed; ingredient values still need
   source-by-source verification
3. **FDA general-wellness line** → positioned as information with a
   non-dismissible disclaimer; diagnosis and dosing are refused; open question
   for counsel
4. **Live demo fails** → backup recording made in Week 5
5. **Parsing accuracy lands below the PRD's 90%** → the measured number is
   reported with its method; a stated 78% beats an unmeasured 90%

### Timeline

- **Week 1** — environment, engine verified end to end, English UI, design direction and clickable prototype ✅ *done*
- **Week 2** — agent loop end to end in n8n on existing seed data; engine deployed as HTTP tools
- **Week 3** — verifier and evaluation set
- **Week 4** — visible tool trace; food data extended where demo scenarios need it
- **Week 5** — rehearsal, backup recording, remaining PRD sections, buffer

### Resources

Engineering: 1 (founder, AI-assisted) | Agent: n8n | Frontend: React, in this
repo | QA: founder + automated eval harness | Budget: ~$100–200 in API spend
over 5 weeks with prompt caching, plus an n8n cloud plan

### Open Questions

1. **Does the weekly menu stay in the demo?** It fails the "one core job" test
   (planning + tracking). Recommendation: cut from the narrative, keep the code.
   Pending instructor review.
2. **Minimal memory in V0?** Remembering rejected suggestions is cheap and
   strengthens the "agentic" and "why not ChatGPT" cases. Pending the same review.
3. **Food data verification.** The ingredient-first approach is settled;
   each ingredient GI still needs checking against its cited source, and
   packaged and restaurant foods need a different source. GI values must come
   from published tables — never from the model.
4. **Where exactly is the FDA line** between general wellness and a regulated
   device for a "can I eat this" verdict aimed at diagnosed users?

### Assumptions Made

- The pitch audience values a proven architectural claim over feature breadth.
- Week 1 counts as complete: the engine builds, runs, and has been verified end
  to end against hand calculation; the UI is English; the design direction is
  chosen and prototyped.
- US-only scope holds; the checklist fixes (menu cut, memory in V0, JTBD reframe)
  are not yet applied to the full PRD pending review.
- Market figures are recalled from CDC/ADA reports and require verification
  before external use.

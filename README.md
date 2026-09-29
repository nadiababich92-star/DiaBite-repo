# DiaBite

Nutrition support for type 2 diabetes, prediabetes, and insulin resistance.

**This is a reference tool, not medical advice.** The numbers come from published
formulas and averaged glycemic-index values. They do not account for a user's
therapy and must never be used to calculate insulin doses.

## What works today

**Can I eat this?** — the core loop. Type a meal in plain words; the agent
(in Azure Foundry) looks foods up in the verified database, computes the
glycemic load against today's remaining budget, and answers with a verdict, the
numbers, a reason and a next step. Every number is checked by the verifier
against the tool results before it is shown. "Show calculation" opens the
receipt; "How this answer was made" lists the tool calls. "Log it" writes the
meal into the diary with the engine's numbers.


**Food diary.** Search the food database, enter a portion weight, break the day
down by meal. Every entry shows available carbohydrate, glycemic load, and bread
units; the day totals are compared against personal targets.

**Profile and targets.** Sex, age, height, weight, activity, condition (T2D /
prediabetes / insulin resistance), weight goal, and carbohydrate approach. From
these the app derives daily targets for energy, macros, fibre, and glycemic
load, plus a list of excluded foods.

**Weekly menu.** The generator assembles 7 days x 4 meals from the dish set,
scaling portions to the user's energy target and penalising glycemic-load
overshoot roughly four times more heavily than undershoot. Includes an
aggregated shopping list.

Everything is stored in `localStorage`. There is no server and no account.

## Running it

Node 18+. Homebrew installs Node into `/opt/homebrew/bin`, which is not on the
PATH of a non-interactive shell unless the profile sets it up:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
```

Then:

```bash
npm install && npm run dev
```

Type-check without running: `npm run typecheck`.

### Running the whole loop

The agent and the engine both run in Azure, so the app alone is enough:

```bash
npm run dev
```

In dev the app calls `/agent`, which Vite proxies to `/agent/ask` on the
deployed engine (`AGENT_WEBHOOK` overrides the target — point it at
`http://localhost:8787/agent/ask` with `npm run server` to work against a
local engine). For a production build set `VITE_AGENT_URL`. The Foundry setup
is described in `agent/SETUP.md`; `n8n/SETUP.md` documents the workflow this
replaced.

## Layout

```
src/
  types.ts             domain types
  data/foods.ts        food database: GI plus nutrients per 100 g
  data/dishes.ts       recipes as sets of foods with weights
  lib/glycemic.ts      glycemic load, available carbs, bread units, GI/GL bands
  lib/profile.ts       Mifflin-St Jeor, macro split, glycemic-load ceiling
  lib/menu.ts          weekly menu generator and shopping list
  lib/storage.ts       localStorage persistence
  lib/agent.ts         client for /agent/ask; reads the tool trace into a receipt
  lib/diary.ts         one reader for diary entries, hand-logged or agent-logged
  components/          pages: Ask (the core loop), Diary, Menu, Profile
server/
  engine.ts            the engine as an HTTP service (npm run server, port 8787)
  contract.ts          request/response shapes for every tool
  foods.ts             unified index: 350 ingredients + 86 everyday foods + 1,000 recipes
  embeddings.ts        local sentence embeddings + in-memory vector store (swap for pgvector/Qdrant)
  resolve.ts           resolve_foods: phrases -> records with a confidence band
  compute.ts           compute_meal, get_day_state, find_alternatives
  verify.ts            the verifier: every number in an answer must trace to a tool result
  agent.ts             one turn: safety gate, Foundry run, verifier, trace
  safety.ts            the safety gate: dosing refusals and red-flag escalation
  sessions.ts          day state and thread, kept out of the model's hands
  openapi.ts           the OpenAPI spec Foundry's tool reads
agent/                 system prompt, provisioning, Foundry setup guide
n8n/                   the workflow this replaced, kept for reference
```

`lib/` and `data/` are pure TypeScript with no React dependency. The React
frontend imports them directly for the diary's calculations, and the same
modules are deployed as a small HTTP service that the Foundry agent calls as
tools. One source, two deploy targets.

Key formulas:

- Available carbohydrate = total minus fibre.
- Glycemic load of a portion = GI x available carbs / 100.
- Bread units = available carbs / 12.
- GI bands: <=55 low, 56-69 medium, >=70 high.
- Portion GL bands: <=10 low, 11-19 medium, >=20 high.
- Daily GL is judged against the user's own budget, not the portion scale:
  <=60% low, <=100% medium, above that high.
- Daily GL ceiling = carbohydrate target x target mean GI / 100, capped at 120.
  Target mean GI is 45 in diabetes, 50 in prediabetes and insulin resistance.

## Data source

`src/data/foods.ts` holds 86 foods and is **seed data**. GI values are averages
from the International Tables of Glycemic Index (Foster-Powell, Holt,
Brand-Miller); nutrients are approximations per 100 g.

The GI of a given food varies by as much as +/-15 points between sources,
depending on variety, ripeness, and cooking method. These values must be
reconciled with a chosen source before any public use — that decision is still
open.

Data validation rules: energy computed from macros must agree with the stated
value within 25%, fibre must not exceed total carbohydrate, and `gi: null` is
only valid when available carbohydrate is near zero.

## Known limitations

- **Too few recipes.** 30 dishes across 28 weekly slots means dishes repeat, and
  with a 3-day repeat gap the week currently comes out as a 3-day cycle shown
  seven times. Roughly 60 dishes would be needed for a week without repeats.
- **The very-low-carb mode is not met.** At a 15% carbohydrate target (~60 g) the
  generator produces ~76 g: the dish set has no sufficiently low-carb breakfasts.
- **Energy ceiling.** Above a 2500 kcal target the menu under-delivers by about
  9%; portions hit the upper scaling bound of x1.75.
- Weekly glycemic load lands well below the ceiling. That is deliberate —
  carbohydrate overshoot is penalised four times more heavily than undershoot.
- The menu generator does not consider fibre or protein when selecting dishes,
  only energy, carbohydrate, and glycemic load.
- The dish set still reflects Eastern European cooking (pearl barley, kefir,
  mackerel) and needs re-curating for the US market.
- No barcode scanning, no food photos, no glucose-meter import.

## Feedback → Supabase

The Feedback button in the navbar opens a form (rating 1–5 and a comment are
required, name and email optional) that writes one row to `public.feedback` in
the Supabase project **DiaBite-feedback**.

- Schema and policies: `supabase/migrations/20260922173000_create_feedback_table.sql`.
  Row-level security allows the browser to insert a feedback row and nothing
  else — reading rows back needs a privileged key, so one visitor can never see
  another's feedback.
- Config: copy `.env.example` to `.env.local` and fill in the project URL and
  the **publishable** key (`sb_publishable_…`). A service-role key must never go
  in a `VITE_*` variable — Vite inlines those into the shipped bundle.
- Without `.env.local` the form still works end to end and keeps submissions in
  localStorage, so the UI can be developed without the database.
- Typing `trigger error` as the comment forces the error state, for testing.

Read submissions in the Supabase dashboard (Table editor → `feedback`).

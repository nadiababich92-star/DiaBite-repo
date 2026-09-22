# DiaBite

Nutrition support for type 2 diabetes, prediabetes, and insulin resistance.

**This is a reference tool, not medical advice.** The numbers come from published
formulas and averaged glycemic-index values. They do not account for a user's
therapy and must never be used to calculate insulin doses.

## What works today

**Can I eat this?** — the core loop. Type a meal in plain words; the agent
(an n8n workflow) looks foods up in the verified database, computes the
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

Three processes: the engine, a tunnel so n8n Cloud can reach it, and the app.

```bash
npm run server
```

```bash
npm run tunnel
```

```bash
npm run dev
```

In dev the app calls `/agent`, which Vite proxies to the published n8n webhook
(`AGENT_WEBHOOK` env overrides it). For a production build set `VITE_AGENT_URL`
to the webhook directly. The n8n build
guide is in `n8n/SETUP.md`.

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
  lib/agent.ts         client for the n8n agent webhook; reads the tool trace into a receipt
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
n8n/                   workflow build guide, node code, system prompt
```

`lib/` and `data/` are pure TypeScript with no React dependency. The React
frontend imports them directly for the diary's calculations, and the same
modules are deployed as a small HTTP service that the n8n agent calls as tools.
One source, two deploy targets.

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

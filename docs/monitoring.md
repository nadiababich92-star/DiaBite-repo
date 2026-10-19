# Monitoring the live agent

Every turn writes one JSON line to stdout. On Container Apps that lands in the
Log Analytics workspace created with the app, where it is queryable for 30
days. No extra service: what the PRD asks for per day — verified rate,
unmatched count, share of unknown resolutions, share of clarifying questions,
latency p90 — is all in that one line.

```json
{"evt":"turn","at":"2026-09-24T…","session":"a1b2c3","question":"oatmeal with a banana",
 "ms":8421,"blocked":false,"rule":null,"verified":true,"unmatched":[],"attempts":1,
 "templated":false,"tools":["resolve_foods","get_day_state","compute_meal"],
 "phrases":2,"unknownPhrases":0,"clarified":0}
```

`LOG_QUESTIONS=false` replaces `question` with `questionLength`. The question is
the most useful field — every food we do not have becomes a candidate for the
labelled set, so the eval set grows from what people type rather than from what
we imagined — and it is also the one field that describes what someone ate.
Decide that before real users arrive, not after.

## The daily numbers

Run these in the workspace (Azure portal → Log Analytics → Logs), or with
`az monitor log-analytics query`.

```kusto
// the five daily metrics, per day
ContainerAppConsoleLogs_CL
| where ContainerName_s == "diabite-engine" and Log_s startswith '{"evt":"turn"'
| extend t = parse_json(Log_s)
| extend day = bin(todatetime(t.at), 1d)
| summarize
    turns           = count(),
    verifiedRate    = round(100.0 * countif(tobool(t.verified)) / count(), 1),
    unmatchedTurns  = countif(array_length(t.unmatched) > 0),
    blocked         = countif(tobool(t.blocked)),
    regenerated     = countif(toint(t.attempts) > 1),
    unknownShare    = round(100.0 * countif(toint(t.unknownPhrases) > 0) / count(), 1),
    clarifyShare    = round(100.0 * countif(toint(t.clarified) > 0) / count(), 1),
    latency_p90_ms  = percentile(toint(t.ms), 90)
  by day
| order by day desc
```

```kusto
// every food we did not have, most common first — the feed for the labelled set
ContainerAppConsoleLogs_CL
| where ContainerName_s == "diabite-engine" and Log_s startswith '{"evt":"turn"'
| extend t = parse_json(Log_s)
| where toint(t.unknownPhrases) > 0
| summarize hits = count() by question = tostring(t.question)
| order by hits desc
```

```kusto
// turns that went out unverified — these need reading, not counting
ContainerAppConsoleLogs_CL
| where ContainerName_s == "diabite-engine" and Log_s startswith '{"evt":"turn"'
| extend t = parse_json(Log_s)
| where tobool(t.verified) == false
| project at = todatetime(t.at), question = tostring(t.question),
          unmatched = t.unmatched, attempts = toint(t.attempts)
| order by at desc
```

## Traces, tokens and cost

Two more places, both already switched on: the project has an Application
Insights resource attached (`diabite-resource-appinsights`), so every agent run
is traced without any code in the engine.

**In the portal.** Azure AI Foundry → the `diabite` project → *Tracing* (or an
agent's *Traces* tab). Each turn is a tree: `invoke_agent diabite-triage`, then
`invoke_agent diabite-meal` or `-advisor`, with a `chat gpt-5.4-…` span for the
model call and an `execute_tool remote_openapi.diabite_engine_…` span for every
tool the agent called. A span shows tokens in and out, the time it took, and the
request and response. This is where to look when an answer is wrong: the tool
results the model saw are in the trace.

**By query**, in the workspace `diabite-resource-logs`:

```kusto
// tokens per day and model; cached input is billed at a fraction
AppDependencies
| where Name startswith "chat gpt-5.4"
| extend p = parse_json(Properties)
| summarize calls = count(),
            inTok  = sum(toint(p["gen_ai.usage.input_tokens"])),
            cached = sum(toint(p["gen_ai.usage.cache_read.input_tokens"])),
            outTok = sum(toint(p["gen_ai.usage.output_tokens"]))
  by day = bin(TimeGenerated, 1d), model = iff(Name has "nano", "nano", "mini")
| order by day desc
```

```kusto
// which tools the agent calls, and how often
AppDependencies
| where Name startswith "execute_tool"
| summarize calls = count() by Name
| order by calls desc
```

**Cost** is not in a trace. It is in Cost Management, per meter: portal →
Cost Management → Cost analysis, grouped by *Meter*, or
`az rest` against `Microsoft.CostManagement/query` for the resource group.

### What it measured, 8 October 2026

27 September to 8 October, 1,941 questions that reached a model:

| | Per question | Share of input that was cached |
|---|---|---|
| `gpt-5.4-nano` (router) | 259 tokens in, 13 out | 36% |
| `gpt-5.4-mini` (meal or advisor) | 4,913 in, 137 out | 74% |

Billed cost for the same period, from Cost Management: about **€5.03** for
`gpt-5.4-mini` (input €2.66, output €2.07, cached input €0.30), so roughly
**€0.0026 per question**, evaluation runs included. The router is too small to
appear among the larger meters. Next to it, in the same weeks: Container Apps
idle compute €7.6 over the period (the replica was not on every day; on a day it runs it is about €0.70, so about €21 a month at list price), the registry €2.26, and
€5.3 of the Foundry evaluation judge (`gpt-5-mini`), plus €7.3 of `gpt-4o` from
the earlier agent versions and their evaluations.

A turn log line does not carry tokens; the trace does.

## Targets

From the PRD's launch table: verified rate ≥ 98% in beta and ≥ 99% at launch,
latency p90 under 10 s, refusals and escalations 100%. A verified rate under
the line for more than a day moves a stage back, as does a class of `unknown`
phrases that is systematic rather than incidental — a whole cuisine, a whole
food category. The second query is how you see that: one-off misses scatter,
a systematic gap repeats.

## The weekly report: how to read it

```bash
npm run report                                   # the last 7 days, to the terminal and docs/reports/<today>.md
npm run report -- --exclude a@x.com,b@y.com      # leave these accounts out (your own, say)
```

It reads the accounts, profiles, diaries and feedback in Supabase with the service key (from the Container App secret, never
printed) and the turn log from Log Analytics. The arithmetic is in `src/lib/report.ts`; `npm run eval` tests it. `docs/reports/` is
not in git. People are numbered by sign-up order: no email, name or id is in the output.

- **Only eaten meals count.** A planned meal is a promise, not a log.
- **Active** is a person with an eaten meal in the last 7 days. **Meal slots** are distinct (day, meal) pairs, not entries.
- **Days in range** is the Diary's own function (`weekSummary`): three meal slots, none without a load, load at or under the
  budget. The number here and the one on the person's screen are the same by construction.
- **Back in 2 / 7 days** counts an eaten meal after the first-meal day and within 2 (or 7) days of it. Someone whose first meal is
  too recent is "not yet" and is left out of both sides of the fraction.
- **Throwaway accounts** (`@example.com`: the rehearsal, screens and the demo video) are dropped.
- **The agent numbers are split by who asked** (since 19 October). A browser session id is a random UUID; every other id (`eval-…`, `smoke-…`, `lat6-…`, `sec-…`) is one of our scripts and is counted under "Our own tests". The "Browser sessions" group is an upper bound on real use, not a count of testers: our rehearsals, screenshots and demo recordings drive a real browser too, and the log carries no account to tell them apart. Until outside people use the app, it is the owner and us. The unknown-food list comes from browser sessions only.
- **The turn log is optional.** If Azure cannot be read, the report says so and the rest still prints.
- **Typed questions with a food we do not have** come from the turn log, deduplicated and not tied to a person: the log holds the
  browser's random session id and never an account. The consent card promises exactly that, and that they are kept for 30 days
  (the workspaces' retention is 30 days). `logTurn` in `server/agent.ts` must never gain a user id, email or IP.

The feedback card ("How is it going?") asks once after the third eaten meal and once on a later day; answers land in the
`feedback` table with a `context` (`form`, `after_3_meals`, `day_2`). A rating without words is stored as "(rating only)".

## What October cost, and why (Cost Management, 1 to 16 October 2026)

Month to date: **€35.26** (about $41). By service: Foundry Models €22.81, Container Apps €9.64, Container Registry €2.31, Foundry Tools (speech for the demo voice) €0.49.

- **The floor is about €0.85 a day, about €26 a month**: the always-on replica (1 vCPU, 2 GiB, minimum one replica) is about €0.70 a day and the registry €0.16. It does not depend on use. With no other spending, October ends near €48 (about $56).
- **Almost everything above the floor was our own testing, not users.** Foundry Models cost €13.15 on 12 October alone (the model-graded Foundry runs and the agent runs of that day), €2.2 a day on 10 and 11 October, €1.6 on 15 October. There were no outside users yet.
- **Before running them again:** a model-graded Foundry evaluation and `npm run eval:agent` spend model tokens. Run them when a prompt, a tool spec, a model or the food data changed (CLAUDE.md, rules 8 and 12), not as a habit; `npm run eval` and `npm run eval:abuse` cost nothing.
- **A budget alert is not in place:** on 16 October `az rest` found no budget at the subscription or resource-group scope, although one was recorded as set on 12 October. See the first section of `docs/AZURE-continuity.md`.

## What this is not

A product database. Nothing here syncs a diary, survives 30 days, or belongs
to a user account. It is operational telemetry for deciding whether the agent
is behaving, and the feed that keeps the eval set honest. Storing meals
against identified people is a different decision with a different bar —
see the Responsible AI section of the PRD.

---

# The food index in Postgres

The engine can read its food index from Supabase (`pgvector`) instead of the
2 MB index built into the image. It does so when `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` are set **and** a probe query answers at startup;
otherwise it says so once and runs on the embedded index, which holds the same
data. Every later fallback is logged too — a database that has gone quiet
should be visible, not invisible.

Both keys are browser-safe: `public.foods` is reference data about food, with
row-level security allowing `select` and nothing else.

**The repository stays the source of truth.** `data/recipes-db` plus
`src/data/foods.ts` and the embeddings built from them are what the table is
filled from, so a row edited by hand in Supabase is lost at the next sync.

```bash
npm run sync:foods    # needs SUPABASE_DB_URL in .env.local
```

The script upserts every record with its vector and deletes rows that no longer
exist, so a food removed from the repository cannot linger in search results.
Run it after any change to the food data, the aliases or the embedding model.

**Why a database at all**, when 1,436 vectors search in five milliseconds in
memory: food coverage is the part of the product that will change most often,
and in the table it changes without rebuilding an image; and the filters that
used to run in code after over-fetching (`topK × 8`) can run in the query.
Neither reason is speed, and the fallback exists because a free project pauses
after a week of quiet — a sleeping database should cost a few hundred
milliseconds, not the demo.

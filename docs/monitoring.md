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
idle compute €7.6 (the single replica is always on), the registry €2.26, and
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

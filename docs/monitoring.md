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

# The DiaBite agent in Azure Foundry

The agent that used to be an n8n workflow now runs in Foundry as a **prompt
agent** — the object the current portal shows, driven through the Responses
API. The n8n version still exists; this is the one that goes to production.

```
browser
  │  POST /agent/ask  { sessionId, message, budget, entries }
  ▼
Container App  "diabite-engine"          ← one service, two surfaces
  │  1. safety gate (rules, no model)
  │  2. park the day state under sessionId
  │  3. Foundry thread + run
  │  4. read the run steps → trace
  │  5. verifier: every number must trace to a tool result
  ▼
Foundry prompt agent  "diabite-agent-v2"  (gpt-5-mini)
  │  one OpenAPI tool, four operations
  ▼
the same Container App, /tools/* (x-api-key, from a project connection)
```

## What each n8n part became

| n8n | Foundry |
|---|---|
| Webhook | `POST /agent/ask` |
| Code node "Safety gate" | `server/safety.ts`, still ahead of the model |
| AI Agent node | a Foundry prompt agent: model deployment, system prompt, one OpenAPI tool |
| four HTTP Request tools | one OpenAPI tool with four operations, from `server/openapi.ts` |
| Simple Memory | `previous_response_id`, keyed by session id |
| Code node "Verifier" | `server/verify.ts`, unchanged — and now with one regenerate, then a templated answer |
| `Respond to Webhook` | the JSON returned by `/agent/ask` |

## The resources

| What | Name |
|---|---|
| Resource group | `rg-nadia.babich92-5702` (Sweden Central) |
| Foundry project | `diabite-resource/diabite` |
| Model deployment | `gpt-5-mini` (GlobalStandard 50K TPM) |
| Agent | `diabite-agent-v2` (prompt agent; versions are immutable) |
| Engine | Container App `diabite-engine` |
| Registry | `ca83d2041d5eacr` |
| Engine key connection | `diabite-engine-key` (CustomKeys, `x-api-key`) |

## Redeploying

The image is built by GitHub Actions (`.github/workflows/build-engine.yml`) and
pushed to ACR. ACR Tasks — the cloud build behind `az containerapp up --source` —
is not permitted on a Free Trial subscription, and the runners are amd64, which
is what Container Apps wants.

Nothing holds a registry password. Actions enters Azure with a token GitHub
mints for the run (OIDC), and the Container App pulls with its own managed
identity; the registry's admin user is off.

```bash
git push                      # Actions builds and pushes :latest
az containerapp update -g rg-nadia.babich92-5702 -n diabite-engine \
  --image ca83d2041d5eacr.azurecr.io/diabite-engine:latest
```

After changing the system prompt or the OpenAPI spec, re-provision the agent so
the portal copy never drifts from this repository:

```bash
npx tsx agent/provision.ts
```

`agent/try.ts` runs a single turn and prints the answer, the verifier's verdict
and the full tool trace.

## Three things that will bite

**`tool_choice` must be `required`.** Without it gpt-5-mini answers "I'll check
that for you — one moment" and stops, having called nothing. Every answer this
product gives is grounded in the engine, so a turn that calls no tool is a turn
that guessed.

**The tool's auth type is `project_connection`, not `connection`,** and the id
is the connection's full ARM id. Get either wrong and the call reaches the
engine without `x-api-key` and comes back 401. A tool error fails the whole
response with a 400 rather than returning to the model, so the engine must not
404 mid-turn — which is why the day state is parked before the run, not during.

**Prompt agents and classic agents are different objects.** The portal lists
prompt agents under Home → Recent work → Agents; a classic Agent Service agent
(`asst_...`) appears only with "New Foundry" switched off. The classic
`diabite-agent` still exists and is unused.

**The budget must not travel through the model.** In n8n the day's budget
reached `get_day_state` from the webhook body. An OpenAPI tool has the model
fill every parameter, and a mistyped budget would produce an answer that is
internally consistent — and therefore invisible to the verifier. The client
parks the day state under an opaque id and the agent only passes that id back.

## Still to do

- Delete the unused classic agent once the prompt agent has run for a while.
- Retire the n8n workflow itself; the frontend no longer calls it.
- Read the tool trace into Foundry's agent evaluators (PRD Week 3).

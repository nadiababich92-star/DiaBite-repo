# The DiaBite agent in Azure Foundry

The agent that used to be an n8n workflow now runs in Foundry Agent Service.
The n8n version still exists; this is the one that goes to production.

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
Foundry agent  "diabite-agent"  (gpt-4o-agent)
  │  one OpenAPI tool, four operations
  ▼
the same Container App, /tools/* (x-api-key, from a project connection)
```

## What each n8n part became

| n8n | Foundry |
|---|---|
| Webhook | `POST /agent/ask` |
| Code node "Safety gate" | `server/safety.ts`, still ahead of the model |
| AI Agent node | a Foundry agent: model deployment, system prompt, one OpenAPI tool |
| four HTTP Request tools | one OpenAPI tool with four operations, from `server/openapi.ts` |
| Simple Memory | a Foundry thread per conversation |
| Code node "Verifier" | `server/verify.ts`, unchanged |
| `Respond to Webhook` | the JSON returned by `/agent/ask` |

## The resources

| What | Name |
|---|---|
| Resource group | `rg-nadia.babich92-5702` (Sweden Central) |
| Foundry project | `diabite-resource/diabite` |
| Model deployment | `gpt-4o-agent` (gpt-4o 2024-11-20, Standard 20K TPM) |
| Agent | `diabite-agent` |
| Engine | Container App `diabite-engine` |
| Registry | `ca83d2041d5eacr` |
| Engine key connection | `diabite-engine-key` (CustomKeys, `x-api-key`) |

## Redeploying

The image is built by GitHub Actions (`.github/workflows/build-engine.yml`) and
pushed to ACR. ACR Tasks — the cloud build behind `az containerapp up --source` —
is not permitted on a Free Trial subscription, and the runners are amd64, which
is what Container Apps wants.

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

**The model matters.** `gpt-5-mini` cannot be used with OpenAPI tools in Agent
Service — GPT-5 models only accept Responses API tools. Hence the separate
`gpt-4o-agent` deployment. `gpt-4.1` has no Standard quota on a Free Trial.

**The SDK loses the trace.** `@azure/ai-agents` deserializes a run step of type
`openapi` down to the call's id, dropping the arguments and the output. The
verifier needs both, so `traceOf` reads the steps over REST. Foundry returns
the output as a Python literal, not JSON, so it is converted before use.

**The budget must not travel through the model.** In n8n the day's budget
reached `get_day_state` from the webhook body. An OpenAPI tool has the model
fill every parameter, and a mistyped budget would produce an answer that is
internally consistent — and therefore invisible to the verifier. The client
parks the day state under an opaque id and the agent only passes that id back.

## Still to do

- Retry once when the verifier fails, then fall back to a templated answer
  built only from tool results (PRD component 9).
- Point the frontend at `/agent/ask` and retire the n8n webhook.
- Rotate the registry credentials in GitHub secrets for OIDC.

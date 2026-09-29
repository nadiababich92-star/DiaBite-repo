# DiaBite agent in n8n — build guide

The agent is orchestrated in n8n Cloud; the deterministic engine runs from this
repo and is reached through a tunnel. n8n never computes a number.

```
Webhook ─▶ Safety gate (Code) ─▶ IF blocked? ─┬─ yes ─▶ Respond (templated reply)
                                             └─ no ──▶ AI Agent ─▶ Verifier (Code) ─▶ Respond
                                                        │ tools: resolve_foods, compute_meal,
                                                        │        get_day_state, find_alternatives
                                                        └ memory: Simple Memory (sessionId)
```

## 0. Run the engine and the tunnel (two terminals)

```bash
npm run server
```

```bash
npm run tunnel
```

The tunnel runs on a static ngrok domain, so its address never changes. Tunnel and engine must both be running for the agent to answer.

Check from any browser: `<tunnel-url>/health` → `{"ok":true,"records":1436}`.

## 1. Skeleton

1. New workflow `DiaBite Agent`.
2. **Webhook**: POST, path `diabite`, Respond = *Using 'Respond to Webhook' Node*.
3. **AI Agent**: Prompt = *Define below* → `{{ $json.message }}`.
   Options → **System Message** → paste `n8n/system-prompt.md`.
   Options → **Return Intermediate Steps** = ON (the verifier needs this).
4. Chat Model → **Anthropic Chat Model** with your API key.
5. Memory → **Simple Memory**, Session ID = *Define below* →
   `{{ $('Webhook').first().json.body.sessionId }}`.
6. **Respond to Webhook**: Respond With = JSON.

## 2. Tools — four HTTP Request Tool nodes under the agent

Engine: `server/engine.ts` (`npm run server`, port 8787, 1436 records). Current tunnel:
`https://tinkling-grievance-brink.ngrok-free.dev` — static, does not change.

For each tool: Method **POST**, URL below, **Send Body** = ON, Body Content
Type = JSON, Specify Body = **Using Fields Below**. Each body field: Name as
given, Value switched to **Expression** and set to the template (`$fromAI(...)`
lets the model fill the value; `$('Webhook')...` takes it from the request).
Rename the node to the tool name — the model sees the node name as the tool name.

### resolve_foods
URL: `https://tinkling-grievance-brink.ngrok-free.dev/tools/resolve_foods`
Description:
```
Look up foods the user mentioned in the verified food database. Pass ALL food phrases from the message in one call. Returns per phrase: confidence (high/medium/low), unknown (true = not in database, say so, do not guess), clarify (a question to ask if present), and candidates with id, name, unit (g or serving) and defaultPortion. Use candidates[0].id as foodId for the other tools.
```
Body field `phrases` → Expression:
```
{{ $fromAI("phrases", "Array of short food phrases from the user's message, e.g. oatmeal, banana", "json") }}
```

### compute_meal
URL: `https://tinkling-grievance-brink.ngrok-free.dev/tools/compute_meal`
Description:
```
Compute calories, carbs, fibre, available carbs, GI, glycemic load (gl) and glLevel for a meal. Input: items with foodId (from resolve_foods) plus grams for ingredients or servings for recipes. Returns per-item and totals. This is the ONLY source of numbers for a meal.
```
Body field `items` → Expression:
```
{{ $fromAI("items", "Array of objects {foodId, grams} for ingredients or {foodId, servings} for recipes, e.g. [{foodId: seed:oats, grams: 200}]", "json") }}
```

### get_day_state
URL: `https://tinkling-grievance-brink.ngrok-free.dev/tools/get_day_state`
Description:
```
Get what the user has consumed today and the remaining budget (gl, carbsG, kcal) against their daily targets. Call this before judging whether a meal fits. Takes no arguments.
```
Two body fields, both → Expression (taken from the request; the model fills nothing):
- `budget` → `{{ $('Webhook').first().json.body.budget }}`
- `entries` → `{{ $('Webhook').first().json.body.entries || [] }}`

### find_alternatives
URL: `https://tinkling-grievance-brink.ngrok-free.dev/tools/find_alternatives`
Description:
```
Return lower-glycemic-load alternatives to one food, costed at the SAME grams as the food being replaced, so the swap compares like for like. Only options with glycemic load at or under maxGL. Use when a meal does not fit the remaining budget. Returns id, name, gl, kcal, portion per alternative.
```
Body fields:
- `foodId` → Expression: `{{ $fromAI("foodId", "foodId of the item with the largest glycemic load", "string") }}`
- `grams` → Expression: `{{ $fromAI("grams", "grams of that item in the meal, from compute_meal", "number") }}`
- `maxGL` → Expression: `{{ $fromAI("maxGL", "maximum acceptable glycemic load, usually the remaining gl budget", "number") }}`
- `sameCategory` → Expression: `{{ true }}`
- `topK` → Expression: `{{ 3 }}`

## 3. Safety gate and verifier

- Insert a **Code** node between Webhook and AI Agent, paste `n8n/code-safety-gate.js`.
- After it an **IF** node: condition `{{ $json.blocked }}` is true →
  a second **Respond to Webhook** with body `{{ { "answer": $json.reply, "blocked": true } }}`.
  False branch → AI Agent (its prompt is now `{{ $json.message }}`).
- After the AI Agent a **Code** node `Verifier`, paste `n8n/code-verifier.js`
  (set `ENGINE` to the current tunnel URL). It parses the agent's
  `intermediateSteps`, posts them with the draft to the engine's `POST /verify`
  (one implementation of the check, in `server/verify.ts`), and returns
  `answer`, `verified`, `unmatchedNumbers` and a `trace` of tool calls.
  Then the final **Respond to Webhook** with body `{{ $json }}`.

## 4. Test request

```bash
curl -s -X POST "<webhook-test-url>" -H 'Content-Type: application/json' -d @n8n/test-request.json
```

Expected: `answer` with verdict + numbers, `verified: true`, `trace` with 3–4 tool calls.
Then try `"message": "how many units of insulin for this?"` → `blocked: true`.

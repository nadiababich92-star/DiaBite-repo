# Lab 3.2, adapted for DiaBite — evaluating the n8n agent in Azure AI Foundry

The course lab evaluates a contract-review agent. DiaBite's agent answers
"can I eat this?", so the mapping is:

| In the lab | In DiaBite |
|---|---|
| Contract-review app | The **Can I eat this?** tab |
| Upload the MSA contract | Nothing to upload — the dataset comes from asking about meals |
| Chat with the app to generate Q&A pairs | Ask the sample questions and the cases in `eval/cases.json` |
| `config.json` with `question` / `response` | Same, plus `context` (the tool results the answer was built from), `verified`, `blocked` |
| Groundedness against the contract text | Groundedness against **the engine's tool results** — that is what our answers are grounded in |

## Phase 1 — export data from the app (done)

Every successful agent reply is saved to `localStorage` (key
`diabite.responses.v1`) as `{ question, response, context, verified, blocked, savedAt }`.
After the first reply a **Download Responses** button appears on the Ask
tab and exports everything as `config.json`. Errors are never saved;
safety refusals are saved with `blocked: true` — they are correct answers
and belong in the Harmless rows. Code: `src/lib/responses.ts`, wired in
`src/components/AskPage.tsx`.

### Generating the dataset

Three processes, then ask questions in the app:

```bash
npm run server
```

```bash
npm run tunnel
```

```bash
npm run dev
```

Tunnel: `https://tinkling-grievance-brink.ngrok-free.dev` — a static ngrok domain, already set in n8n. The workflow is published, so no "Execute workflow" clicks are needed.

Ask at least the three sample chips, then work through `eval/cases.json`
→ `agent` rows (H1–H6, O3, O6, S1–S5, S7). Aim for 25–40 rows: enough
for Foundry to score, small enough to read every answer.

## Phase 2 onward — what to expect in Foundry

- **Dataset**: `config.json` maps directly; `question` → query,
  `response` → response, `context` → context. For **Similarity** add a
  `ground_truth` column from the `expect`/`ground_truth` fields in
  `eval/cases.json`.
- **Evaluators**: Relevance, Coherence, Fluency read the response;
  Groundedness needs `context`; Similarity needs `ground_truth`.
- **Judge model**: Foundry's model-graded evaluators use a model deployed in
  Azure. The system under test stays Claude in n8n.
- **What Foundry will not measure**: dosing refusals and red-flag escalation.
  Those are our Harmless cases — check them from the `blocked` column and
  the verifier's `verified` flag, or as a custom evaluator (PRD Week 3).

## What to write in the PRD

Week 3 already describes the two-layer strategy and the Foundry mapping.
After the run, paste the five scores into the Evaluations section next to
"reported, not promised".

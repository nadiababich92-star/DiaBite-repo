// n8n Code node "Verifier", mode "Run Once for All Items". Place it AFTER the
// AI Agent (with "Return Intermediate Steps" enabled on the agent).
//
// PRD component 9: every number in the draft must trace to a tool result.
// The check itself lives in the engine (POST /verify, server/verify.ts) —
// this node only gathers the evidence and renders the trace for the UI.
// ENGINE below must match the tool URLs (tunnel base, no trailing slash).
const ENGINE = 'https://tinkling-grievance-brink.ngrok-free.dev';

const item = $input.first().json;
const answer = String(item.output ?? '');
const steps = item.intermediateSteps ?? [];
const userText = $('Webhook').first().json.body?.message ?? '';

const toolResults = [];
const trace = [];
for (const s of steps) {
  let obs = s.observation;
  if (typeof obs === 'string') { try { obs = JSON.parse(obs); } catch {} }
  if (Array.isArray(obs) && obs.length === 1) obs = obs[0]; // n8n wraps tool output in an array
  toolResults.push(obs);
  trace.push({ tool: s.action?.tool ?? 'unknown', input: s.action?.toolInput ?? null, result: obs });
}

let verdict = { ok: false, numbersInAnswer: [], matched: [], unmatched: [], error: null };
try {
  const res = await this.helpers.httpRequest({
    method: 'POST', url: ENGINE + '/verify', json: true,
    body: { answer, toolResults, userText },
  });
  verdict = { ...verdict, ...res };
} catch (e) {
  verdict.error = 'verify unavailable: ' + (e.message ?? String(e));
}

return [{
  json: {
    answer,
    verified: verdict.ok === true,
    unmatchedNumbers: verdict.unmatched,
    matchedNumbers: verdict.matched,
    verifierError: verdict.error,
    toolCalls: trace.length,
    trace,
  },
  pairedItem: { item: 0 },
}];

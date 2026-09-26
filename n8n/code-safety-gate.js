// n8n Code node, mode "Run Once for All Items". Place it BETWEEN Webhook and AI Agent.
// Rules-based safety check (PRD component 7). Returns { blocked, reply } so the
// downstream IF node can route to a templated reply without calling the model.
const body = $input.first().json.body || {};
const text = String(body.message || '').toLowerCase();

const DOSING = /\b(insulin|units?|bolus|basal|metformin|ozempic|dose|dosage|how much (insulin|medication))\b/;
const RED_FLAGS = /\b(faint|passed out|unconscious|chest pain|confus|vomit|can'?t breathe|seizure)\b|\b(3[0-9]{2}|[4-9][0-9]{2}) ?mg|\b([1-6][0-9]) ?mg\/?dl\b/;

let blocked = false;
let reply = null;

if (RED_FLAGS.test(text)) {
  blocked = true;
  reply = "What you describe can be a medical emergency. Please call your local emergency number or your care team right now. I can't help with food while this is happening.";
} else if (DOSING.test(text)) {
  blocked = true;
  reply = "I can't help with insulin or medication doses — that must come from your care team. I can help you understand the carbohydrate and glycemic load of a meal, if you'd like.";
}

return [{ json: { ...body, blocked, reply }, pairedItem: { item: 0 } }];

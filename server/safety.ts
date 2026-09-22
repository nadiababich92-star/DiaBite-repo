/**
 * The safety gate (PRD component 7), ported from the n8n Code node.
 *
 * Rules run before the model, not after: a question about insulin dosing must
 * be refused whatever the model would have said, and a red-flag symptom must
 * reach the user as advice to seek help rather than as a conversation about
 * food. Cheap, deterministic, and impossible for a prompt to talk out of.
 *
 * This is a first layer, not the whole answer — the system prompt carries the
 * same rules for everything the patterns miss.
 */

export interface GateResult {
  blocked: boolean
  /** The reply to send verbatim when blocked. */
  reply?: string
  /** Which rule fired, for the trace and for evaluation. */
  rule?: 'red_flag' | 'dosing'
}

const DOSING =
  /\b(insulin|units?\b|bolus|basal|metformin|ozempic|dosage|how much (insulin|medication|metformin))\b/i

/** Symptoms that need care now, plus glucose readings outside a safe range. */
const RED_FLAGS =
  /\b(faint(ing|ed)?|passed out|unconscious|chest pain|confus(ed|ion)|vomit(ing)?|can'?t breathe|seizure|ketones?)\b/i
const GLUCOSE = /\b(\d{2,3})\s*mg\/?d?l?\b/i

const RED_FLAG_REPLY =
  "What you describe can be a medical emergency. Please call your local emergency number or your care team right now. I can't help with food while this is happening."
const DOSING_REPLY =
  "I can't help with insulin or medication doses — that must come from your care team. I can help you understand the carbohydrate and glycemic load of a meal, if you'd like."

export function safetyGate(message: string): GateResult {
  const text = String(message ?? '')

  if (RED_FLAGS.test(text)) return { blocked: true, reply: RED_FLAG_REPLY, rule: 'red_flag' }

  // A glucose number is only a red flag outside the range a meal question can
  // sensibly follow; "my glucose was 110" is ordinary context.
  const g = text.match(GLUCOSE)
  if (g) {
    const mgdl = Number(g[1])
    if (mgdl >= 300 || mgdl < 70) return { blocked: true, reply: RED_FLAG_REPLY, rule: 'red_flag' }
  }

  if (DOSING.test(text)) return { blocked: true, reply: DOSING_REPLY, rule: 'dosing' }

  return { blocked: false }
}

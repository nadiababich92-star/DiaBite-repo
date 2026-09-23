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
  rule?: 'red_flag' | 'dosing' | 'prolonged_fast' | 'referral'
}

const DOSING =
  /\b(insulin|units?\b|bolus|basal|metformin|ozempic|dosage|how much (insulin|medication|metformin))\b/i

/**
 * Dosing asked in the language of the people who already do it. A carb ratio
 * is an insulin-to-carbohydrate ratio and a correction factor is a dose
 * calculation; neither says "insulin", and the eval set caught both going
 * through as ordinary questions.
 */
const DOSING_JARGON =
  /\b(carb(ohydrate)?[ -]?ratio|insulin[ -]?to[ -]?carb|i:?c ratio|correction factor|sensitivity factor|\bisf\b|\bicr\b|basal rate|sliding scale)\b/i

/**
 * The people our targets were never derived for.
 *
 * `calculateTargets` is Mifflin-St Jeor plus a macro split: it accounts for
 * neither pregnancy nor kidney disease, and an eating disorder makes a daily
 * budget an actively harmful thing to hand someone. Saying so is the honest
 * answer, and it costs a model call we would otherwise spend guessing.
 */
const REFERRAL =
  /\b(pregnan\w*|breast ?feed\w*|nursing|lactating|kidney disease|renal (disease|failure)|dialysis|eating disorder|anorexi\w*|bulimi\w*)\b/i

/**
 * A long fast is not a meal question and must not be answered as one. The
 * agent otherwise reports a glycemic load of zero against a full budget, which
 * reads as approval of not eating.
 */
const PROLONGED_FAST =
  /\b(hav(e|en'?t|n'?t) (not )?eaten (in|for)|not eaten (in|for)|stopped eating|fasting for|no food (in|for)|skipping (all )?meals)\b/i

/** Symptoms that need care now, plus glucose readings outside a safe range. */
const RED_FLAGS =
  /\b(faint(ing|ed)?|passed out|unconscious|chest pain|confus(ed|ion)|vomit(ing)?|can'?t breathe|seizure|ketones?)\b/i
const GLUCOSE = /\b(\d{2,3})\s*mg\/?d?l?\b/i

const RED_FLAG_REPLY =
  "What you describe can be a medical emergency. Please call your local emergency number or your care team right now. I can't help with food while this is happening."
const DOSING_REPLY =
  "I can't help with insulin or medication doses — that must come from your care team. I can help you understand the carbohydrate and glycemic load of a meal, if you'd like."
const REFERRAL_REPLY =
  "I can't work this one out for you. The daily targets I use come from a general formula that was never derived for pregnancy, kidney disease or disordered eating, so any number I gave you would be misleading. Please ask your care team or a dietitian who knows your situation — they can set targets that fit it."
const FAST_REPLY =
  "Going that long without food is worth talking to your care team about today — especially if you take glucose-lowering medication, where it raises the risk of a hypo. I'd rather not treat this as a question about your daily budget. If you feel shaky, confused or unwell, please seek help now."

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

  if (PROLONGED_FAST.test(text)) return { blocked: true, reply: FAST_REPLY, rule: 'prolonged_fast' }

  if (DOSING.test(text) || DOSING_JARGON.test(text)) return { blocked: true, reply: DOSING_REPLY, rule: 'dosing' }

  if (REFERRAL.test(text)) return { blocked: true, reply: REFERRAL_REPLY, rule: 'referral' }

  return { blocked: false }
}

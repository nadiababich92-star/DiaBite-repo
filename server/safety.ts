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
  /\b(insulin|bolus|basal|metformin|ozempic|dosage|how much (insulin|medication|metformin))\b/i

/**
 * "Units" as a dose. The bare word used to be enough, which refused "a unit of
 * bread" (an ordinary portion) as a dosing question. A unit counts as a dose
 * when a number stands on it, when the question is *how many* of them, when a
 * dosing verb leads to it, or when it is tied to a meal ("units before lunch").
 * Anything with a drug or a brand in it is caught above and below regardless.
 * What stays over-blocked on purpose: "2 units of bread" — a refusal that is
 * wrong about a portion costs a rephrasing; the other kind costs more.
 */
const DOSING_UNITS =
  /(\b\d+(\.\d+)?\s*(u\b|units?\b))|\bhow many units?\b|\b(take|taking|inject\w*|give|giving|dose|dosing|need|use|using|bolus)\b[^.!?]{0,25}\bunits?\b|\bunits?\b[^.!?]{0,25}\b(before|for every|per|to cover|of (it|this|that|them))\b/i

/**
 * Insulin as people name it. Nobody types "insulin" when the pen in their hand
 * says Novolog, and a bare brand name reached the model before this existed —
 * which refused it, but a refusal that rests on the model is not a rule.
 * A mention is treated like the word "insulin" itself: the app is not for
 * mealtime insulin, so a person who names a rapid-acting product is told so.
 */
const INSULIN_NAMES =
  /\b(ins[ue]l+[iu]n[es]?|inzulin|novolog|novorapid|humalog|admelog|apidra|fiasp|lyumjev|humulin|novolin|lantus|toujeo|basaglar|semglee|levemir|tresiba|afrezza|aspart|lispro|glulisine|glargine|detemir|degludec|nph|mounjaro|wegovy|trulicity|victoza|saxenda|glipizide|glyburide|glimepiride|jardiance|farxiga)\b/i

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
  /\b(faint(ing|ed)?|pass(ed|ing)? out|black(ed|ing)? out|unconscious|chest (pain|tightness)|confus(ed|ion)|vomit(ing)?|can'?t breathe|(short of|trouble|difficulty) breath(ing)?|slurred|seizure|ketones?|ketoacidosis|dka|hypo(glycemi\w*)?|dizz\w*|light-?headed|clammy)\b/i

/**
 * Symptoms that are also ordinary cooking words. Nobody "sweats" a person's
 * onions in the first person, so these count only when the speaker is the one
 * shaking or sweating.
 */
const RED_FLAGS_FIRST_PERSON =
  /\b(i|i'?m|i am|i feel|feeling|feel|i'?ve been|got|getting|having|so|suddenly)\b[^.!?]{0,30}\b(shak(y|ing)|sweat(y|ing)|trembl\w+)\b/i

/**
 * A glucose word said to be low or falling: "my sugar is low", "glucose is
 * crashing". The low word must belong to the sugar itself, through "my" or
 * "blood" or a verb, or "sugar and low calorie sweetener" is an emergency.
 */
const LOW_WORD = '(?:too |really |very |so |a bit |pretty )?(?:low|crash\\w*|dropp\\w*|plummet\\w*|tanking)\\b'
const LOW_SAID = new RegExp(
  `\\b(?:my|blood)\\s+(?:blood\\s+)?(?:sugar|glucose|bg|bs)\\s+(?:(?:is|was|feels?|has been|keeps|got|gets|seems|going|getting)\\s+)?${LOW_WORD}` +
  `|\\b(?:sugar|glucose)\\s+(?:is|was|has been|keeps|getting|going)\\s+${LOW_WORD}`,
  'i',
)

/**
 * A glucose reading, however it was written.
 *
 * The first version of this wanted "mg/dl" and so read straight past "my
 * sugar is 55 and I feel shaky" — a hypo, asked as a lunch question. The
 * model refused it correctly, but a rule layer that leans on the model for
 * the emergencies is not a layer. Matching needs the word near the number so
 * that "55 grams of rice" stays a meal.
 */
const GLUCOSE = [
  // With no unit, a number followed by a quantity or a time is not a reading:
  // "my sugar was fine 2 hours after", "sugar 5 g".
  /\b(?:blood\s*)?(?:sugar|glucose|bg|bs)\b[^.\d]{0,24}?(\d{1,3}(?:\.\d+)?)\s*(mmol)?(?!\d|\s*(?:hours?|hrs?|minutes?|mins?|days?|weeks?|times|g\b|grams?|cups?|slices?|oz\b|ounces?|tbsp|tsp|pieces?|%))/i,
  /\b(\d{2,3})\s*mg\s*\/?\s*dl\b/i,
  /\b(\d{1,2}(?:\.\d+)?)\s*(mmol)\b/i,
]

/** "Sugar" that is an ingredient claim, not a reading: stripped before the glucose rules look. */
const SUGAR_AS_FOOD =
  /\b(sugar[- ]free|no (added )?sugars?|added sugars?|low[- ]sugar|reduced[- ]sugar|sugar substitutes?|brown sugar|powdered sugar|cane sugar|sugars? in)\b/gi

/** One mmol/L of glucose is 18.016 mg/dL. */
const MGDL_PER_MMOL = 18.016

const ONES: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
}
const TEENS: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}

/**
 * "three hundred and fifty" -> "350". Only forms a glucose reading can take
 * (twenty and up, or a hundred): a bare "five" is as likely a mmol/L reading
 * as anything else, and turning it into 5 mg/dL would call every normal
 * number an emergency.
 */
export function numberWordsToDigits(text: string): string {
  const one = Object.keys(ONES).join('|')
  const ten = Object.keys(TENS).join('|')
  const teen = Object.keys(TEENS).join('|')
  const tail = `(?:${ten})(?:[ -](?:${one}))?|${teen}|(?:${one})`
  const re = new RegExp(`\\b(?:(${one}) hundred(?: and)?(?: (${tail}))?|(${ten})(?:[ -](${one}))?)\\b`, 'gi')
  const small = (w?: string) => {
    if (!w) return 0
    const t = w.toLowerCase().split(/[ -]/)
    return t.reduce((n, x) => n + (TENS[x] ?? TEENS[x] ?? ONES[x] ?? 0), 0)
  }
  return text.replace(re, (_m, h, rest, t, o) =>
    String(h ? ONES[h.toLowerCase()] * 100 + small(rest) : small(t) + small(o)))
}

/**
 * What people do to get past a pattern, undone: zero-width characters, accents
 * and compatibility forms ("ｉｎｓｕｌｉｎ"), and a word spelled letter by letter
 * ("i n s u l i n", "i.n.s.u.l.i.n").
 */
export function normalise(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '')
    .replace(/\b(?:\w[\s.*_-]){3,}\w\b/g, (m) => m.replace(/[\s.*_-]/g, ''))
}

const RED_FLAG_REPLY =
  "What you describe can be a medical emergency. Please call your local emergency number or your care team right now. I can't help with food while this is happening."
const DOSING_REPLY =
  "I can't help with insulin or medication doses — that must come from your care team. I can help you understand the carbohydrate and glycemic load of a meal, if you'd like."
const REFERRAL_REPLY =
  "I can't work this one out for you. The daily targets I use come from a general formula that was never derived for pregnancy, kidney disease or disordered eating, so any number I gave you would be misleading. Please ask your care team or a dietitian who knows your situation — they can set targets that fit it."
const FAST_REPLY =
  "Going that long without food is worth talking to your care team about today — especially if you take glucose-lowering medication, where it raises the risk of a hypo. I'd rather not treat this as a question about your daily budget. If you feel shaky, confused or unwell, please seek help now."

/**
 * The reading in mg/dL, whichever unit it was written in. A number under 35
 * after a glucose word cannot be mg/dL (that is not survivable), so it is read
 * as mmol/L; "my sugar is 5" is a normal 90 and "my sugar is 2" is not.
 */
export function readingMgdl(value: number, unit?: string): number {
  return unit || value < 35 ? value * MGDL_PER_MMOL : value
}

export function safetyGate(message: string): GateResult {
  const text = numberWordsToDigits(normalise(String(message ?? '')))
  const reading = text.replace(SUGAR_AS_FOOD, ' ')

  if (RED_FLAGS.test(text) || RED_FLAGS_FIRST_PERSON.test(text) || LOW_SAID.test(reading)) {
    return { blocked: true, reply: RED_FLAG_REPLY, rule: 'red_flag' }
  }

  // A glucose number is only a red flag outside the range a meal question can
  // sensibly follow; "my glucose was 110" is ordinary context.
  for (const pattern of GLUCOSE) {
    const g = reading.match(pattern)
    if (!g) continue
    const mgdl = readingMgdl(Number(g[1]), g[2])
    if (mgdl >= 300 || mgdl < 70) return { blocked: true, reply: RED_FLAG_REPLY, rule: 'red_flag' }
  }

  if (PROLONGED_FAST.test(text)) return { blocked: true, reply: FAST_REPLY, rule: 'prolonged_fast' }

  if (DOSING.test(text) || DOSING_UNITS.test(text) || DOSING_JARGON.test(text) || INSULIN_NAMES.test(text)) return { blocked: true, reply: DOSING_REPLY, rule: 'dosing' }

  if (REFERRAL.test(text)) return { blocked: true, reply: REFERRAL_REPLY, rule: 'referral' }

  return { blocked: false }
}

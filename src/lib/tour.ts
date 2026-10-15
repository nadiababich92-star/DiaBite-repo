/**
 * First-run tips: which one to show next, and what it says.
 *
 * A tour of the empty screens cannot point at a verdict or a receipt (there is no answer yet), and a sample
 * answer would put numbers on screen the engine did not compute. So there is one tip before the first
 * question and three that hang on the first real answer, and the copy carries no figure at all.
 *
 * Pure and tested (npm run eval). The only thing remembered is which steps were shown, in this browser.
 */

export type TourStep = 'input' | 'verdict' | 'calc' | 'log'

export const STEP_ORDER: readonly TourStep[] = ['input', 'verdict', 'calc', 'log']

/** What the Ask screen knows right now. */
export interface TourContext {
  /** Any answer is on screen (advice, a question, a refusal, a meal). */
  hasReply: boolean
  /** The answer carries a receipt: a meal was costed, an assumed-recipe estimate included. */
  hasReceipt: boolean
  /** That receipt is an assumed recipe: the verdict step has its own words. */
  assumed: boolean
  /** A question is being answered. */
  busy: boolean
  /** The feedback form or the import prompt is open. */
  suspended: boolean
}

export interface TourCopy { title: string; body: string; button: 'Next' | 'Got it' }

const COPY: Record<TourStep, TourCopy> = {
  input: {
    title: 'Say what you ate',
    body: 'Type a meal the way you would say it, for example “two eggs and a slice of rye toast”. Give a portion if you know it; if you do not, DiaBite tells you which one it used.',
    button: 'Got it',
  },
  verdict: {
    title: 'Here is the verdict',
    body: 'It compares this meal with what is left of your day. The engine makes that comparison, not the AI\'s opinion.',
    button: 'Next',
  },
  calc: {
    title: 'Check the arithmetic',
    body: 'Tap Show calculation to see every food, its weight and its load. Each number comes from the database.',
    button: 'Next',
  },
  log: {
    title: 'Keep it in your Diary',
    body: 'The log button adds this meal to today, and your week builds up in the Diary.',
    button: 'Got it',
  },
}

const ESTIMATE: TourCopy = {
  title: 'This one is an estimate',
  body: 'The dish is not in our database, so it was counted from typical ingredients. Change anything that is not yours.',
  button: 'Next',
}

export function copyFor(step: TourStep, ctx: Pick<TourContext, 'assumed'>): TourCopy {
  return step === 'verdict' && ctx.assumed ? ESTIMATE : COPY[step]
}

/** Every string the tour can show, for the check that none of them holds a figure. */
export const allCopy = (): TourCopy[] => [...STEP_ORDER.map((s) => COPY[s]), ESTIMATE]

/**
 * The first step not yet shown that fits what is on screen, or null.
 * `input` belongs to the empty screen only. The other three need a receipt and come in order.
 */
export function nextStep(seen: readonly TourStep[], ctx: TourContext): TourStep | null {
  if (ctx.suspended || ctx.busy) return null
  for (const step of STEP_ORDER) {
    if (seen.includes(step)) continue
    if (step === 'input') {
      if (ctx.hasReply) continue            // already past the empty screen: treated as satisfied, never offered late
      return 'input'
    }
    return ctx.hasReceipt ? step : null     // the other three need a receipt, and come in order
  }
  return null
}

/** Adds a step once and keeps the order. */
export function markSeen(seen: readonly TourStep[], step: TourStep): TourStep[] {
  return STEP_ORDER.filter((s) => s === step || seen.includes(s))
}

/** "Skip tips". */
export const allSteps = (): TourStep[] => [...STEP_ORDER]

/** Whatever was stored is whatever an older build or a browser extension left: only known ids survive. */
export function sanitizeSeen(stored: unknown): TourStep[] {
  if (!Array.isArray(stored)) return []
  return STEP_ORDER.filter((s) => stored.includes(s))
}

/**
 * What counts as seen when the app starts, from this browser only. A person who used the app before this
 * release, or has anything in this browser's diary, is not shown a first-run guide. `onboardedAtStart` is read
 * before onboarding can finish in this visit, so a new person is not mistaken for a returning one a minute later.
 */
export function initialSeen(stored: unknown | null, base: { onboardedAtStart: boolean; diaryAtStart: number }): TourStep[] {
  if (stored === null && (base.onboardedAtStart || base.diaryAtStart > 0)) return allSteps()
  return sanitizeSeen(stored)
}

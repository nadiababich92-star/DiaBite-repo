/**
 * When to ask "How is it going?": once after the third eaten meal, and once on a later day.
 *
 * The card is a moment of feedback, never an interruption: it waits while a question is being answered or
 * anything else is open, appears at most once per visit, and each moment is asked once per browser. The only
 * thing remembered is which moments were asked, in this browser (`diabite.nudge.v1`); nothing about the person.
 *
 * Pure and tested (npm run eval). Planned meals are not eaten and never count here.
 */

export type Milestone = 'after_3_meals' | 'day_2'

const KNOWN: readonly Milestone[] = ['after_3_meals', 'day_2']

export interface NudgeContext {
  /** Distinct (date, meal) pairs over eaten entries, all time. */
  eatenSlots: number
  /** The earliest eaten entry's date. */
  firstMealDate: string | null
  today: string
  /** Moments already asked in this browser. */
  asked: readonly Milestone[]
  /** A question is being answered. */
  busy: boolean
  /** A tip, the feedback form, the How it works sheet or the import prompt is open. */
  suspended: boolean
  /** A card has already appeared since the page loaded. */
  shownThisVisit: boolean
}

export function nextNudge(c: NudgeContext): Milestone | null {
  if (c.busy || c.suspended || c.shownThisVisit) return null
  if (c.eatenSlots >= 3 && !c.asked.includes('after_3_meals')) return 'after_3_meals'
  if (c.firstMealDate && c.today > c.firstMealDate && c.eatenSlots >= 1 && !c.asked.includes('day_2')) return 'day_2'
  return null
}

export const markAsked = (asked: readonly Milestone[], m: Milestone): Milestone[] =>
  asked.includes(m) ? [...asked] : [...asked, m]

/** Whatever is stored, as a list of known moments; anything else reads as nothing asked. */
export function sanitizeAsked(stored: unknown): Milestone[] {
  if (!Array.isArray(stored)) return []
  return KNOWN.filter((k) => stored.includes(k))
}

/** The eaten-slot count and first-meal date `nextNudge` needs, from the entries. */
export function nudgeFacts(entries: readonly { date: string; meal: string; planned?: boolean }[]): { eatenSlots: number; firstMealDate: string | null } {
  const slots = new Set<string>()
  let first: string | null = null
  for (const e of entries) {
    if (e.planned === true) continue
    slots.add(`${e.date}|${e.meal}`)
    if (first === null || e.date < first) first = e.date
  }
  return { eatenSlots: slots.size, firstMealDate: first }
}

/**
 * The first session: when the three things after a first answer show (docs/specs/first-session-after-answer.md).
 *
 * Pure, so the rules are tested without a browser (npm run eval). Nothing here computes a nutrition figure, reads
 * storage or knows how a card looks; the caller gathers the facts and passes them in.
 */
import type { DeferredStep } from '../types'

export interface FirstSessionContext {
  /** False for the anonymous visitor of the free-answer plan: none of the three shows. */
  signedIn: boolean
  /** A meal was costed in the answer on screen. */
  hasReceipt: boolean
  /** Eaten diary entries in all; a planned meal does not count. */
  eatenCount: number
  /** The first question not yet answered, or null (`nextDeferred(profile)`). */
  next: DeferredStep | null
  /** A card was already shown in this session (a sessionStorage flag). */
  cardShownThisSession: boolean
  /** "Later" was pressed on this screen visit. */
  dismissedThisVisit: boolean
  /** A tour tip, the feedback card, the feedback form or the import prompt is showing. */
  blocked: boolean
}

/** The words of the two lines (docs/specs/first-session-after-answer.md), one copy for the page and the check. */
export const DEFAULTS_LINE = 'These numbers use cautious defaults until you answer a few more questions.'
export const WHAT_NEXT = 'Log it to count it toward today. Your day is in the Diary.'

/** The line under the budget bar that says the numbers use cautious defaults. */
export const showDefaultsLine = (c: Pick<FirstSessionContext, 'signedIn'>, deferredCount: number): boolean =>
  c.signedIn && deferredCount > 0

/** The line under the first receipt, until a first meal has been logged. */
export const showWhatNext = (c: Pick<FirstSessionContext, 'signedIn' | 'hasReceipt' | 'eatenCount'>): boolean =>
  c.signedIn && c.hasReceipt && c.eatenCount === 0

/** The card that offers the next unanswered question: after the first eaten meal, once a session, never over another card. */
export const showDeferredCard = (c: FirstSessionContext): boolean =>
  c.signedIn && c.next !== null && c.eatenCount >= 1 && !c.cardShownThisSession && !c.dismissedThisVisit && !c.blocked
